const LoginRequest = require('../models/LoginRequest');
const User = require('../models/User');
const logger = require('../utils/logger');
const Class = require('../models/Class');
const { getClientIp } = require('../utils/getClientIp');
async function canManageClass(user, classId) {
    if (user?.role === 'admin') return true;
    if (user?.role !== 'teacher') return false;
    return !!await Class.exists({ _id: classId, teacher: user._id || user.id });
}
const forbidden = res => res.status(403).json({ success: false, message: '无权审批该班级的登录请求' });

const loginRequestController = {
    /**
     * 学生发起登录请求
     * POST /api/login-requests/request
     */
    async createRequest(req, res) {
        try {
            const { username, requestType, classId, studentId, studentName } = req.body;

            logger.info('收到登录请求', { username, requestType });

            // 验证必填字段
            if (!username || !requestType || !classId || !studentId || !studentName) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必填字段'
                });
            }

            const student = await User.findOne({ _id: studentId, username, classId, role: 'student', isActive: { $ne: false } });
            if (!student || !['device_conflict', 'ip_change', 'ip_and_device_conflict'].includes(requestType)) {
                return res.status(400).json({ success: false, message: '学生信息或请求类型无效' });
            }
            // 检查学生是否已有待处理的请求
            const existingRequest = await LoginRequest.hasPendingRequest(studentId);
            if (existingRequest) {
                logger.info('学生已有待处理的登录请求', { studentId, requestId: existingRequest._id });
                return res.json({
                    success: true,
                    message: '已有待处理的登录请求',
                    requestId: existingRequest._id,
                    expiresAt: existingRequest.expiresAt
                });
            }

            // 创建新的登录请求
            const loginRequest = new LoginRequest({
                studentId,
                studentName: student.name,
                username,
                classId,
                requestType,
                oldIp: student.loginHistory?.[0]?.ip || null,
                newIp: getClientIp(req)
            });

            await loginRequest.save();

            logger.info('创建登录请求成功', { requestId: loginRequest._id, studentName });

            return res.json({
                success: true,
                message: '登录请求已发送，等待教师审批',
                requestId: loginRequest._id,
                expiresAt: loginRequest.expiresAt
            });
        } catch (error) {
            logger.error('创建登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '创建登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 教师获取班级的待处理登录请求
     * GET /api/login-requests/pending/:classId
     */
    async getPendingRequests(req, res) {
        try {
            const { classId } = req.params;

            if (!classId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少班级ID'
                });
            }

            if (!await canManageClass(req.user, classId)) return forbidden(res);
            const requests = await LoginRequest.getPendingByClass(classId);

            return res.json({
                success: true,
                requests,
                count: requests.length
            });
        } catch (error) {
            logger.error('获取待处理登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '获取待处理登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 教师同意登录请求
     * POST /api/login-requests/approve/:id
     */
    async approveRequest(req, res) {
        try {
            const { id } = req.params;
            const teacherId = req.user?.id;

            const loginRequest = await LoginRequest.findById(id);

            if (!loginRequest) {
                return res.status(404).json({
                    success: false,
                    message: '登录请求不存在或已过期'
                });
            }

            if (!await canManageClass(req.user, loginRequest.classId)) return forbidden(res);
            if (loginRequest.expiresAt <= new Date()) return res.status(400).json({ success: false, message: '请求已过期' });
            if (loginRequest.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: '该请求已被处理'
                });
            }

            // 如果是设备冲突或组合类型，需要先清除原有会话
            if (loginRequest.requestType === 'device_conflict' || loginRequest.requestType === 'ip_and_device_conflict') {
                await User.findByIdAndUpdate(loginRequest.studentId, {
                    $unset: { sessionId: 1, sessionExpiresAt: 1 }
                });
                logger.info('已清除学生原有会话', { studentId: loginRequest.studentId });
            }

            // 如果是IP变更或组合类型，需要更新登录历史中的IP地址
            if ((loginRequest.requestType === 'ip_change' || loginRequest.requestType === 'ip_and_device_conflict') && loginRequest.newIp) {
                // 更新最近一条登录记录的IP为新IP
                await User.findByIdAndUpdate(loginRequest.studentId, {
                    $set: { 'loginHistory.0.ip': loginRequest.newIp }
                });
                logger.info('已更新学生登录历史IP', {
                    studentId: loginRequest.studentId,
                    oldIp: loginRequest.oldIp,
                    newIp: loginRequest.newIp
                });
            }

            // 更新请求状态
            loginRequest.status = 'approved';
            loginRequest.processedAt = new Date();
            loginRequest.processedBy = teacherId;
            await loginRequest.save();

            logger.info('登录请求已批准', { requestId: id, teacherId, studentName: loginRequest.studentName });

            return res.json({
                success: true,
                message: '已同意登录请求'
            });
        } catch (error) {
            logger.error('批准登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '批准登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 教师拒绝登录请求
     * POST /api/login-requests/reject/:id
     */
    async rejectRequest(req, res) {
        try {
            const { id } = req.params;
            const teacherId = req.user?.id;

            const loginRequest = await LoginRequest.findById(id);

            if (!loginRequest) {
                return res.status(404).json({
                    success: false,
                    message: '登录请求不存在或已过期'
                });
            }

            if (!await canManageClass(req.user, loginRequest.classId)) return forbidden(res);
            if (loginRequest.expiresAt <= new Date()) return res.status(400).json({ success: false, message: '请求已过期' });
            if (loginRequest.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: '该请求已被处理'
                });
            }

            // 更新请求状态
            loginRequest.status = 'rejected';
            loginRequest.processedAt = new Date();
            loginRequest.processedBy = teacherId;
            await loginRequest.save();

            logger.info('登录请求已拒绝', { requestId: id, teacherId, studentName: loginRequest.studentName });

            return res.json({
                success: true,
                message: '已拒绝登录请求'
            });
        } catch (error) {
            logger.error('拒绝登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '拒绝登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 批量同意班级所有待处理请求
     * POST /api/login-requests/bulk-approve
     */
    async bulkApprove(req, res) {
        try {
            const { classId } = req.body;
            const teacherId = req.user?.id;

            if (!classId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少班级ID'
                });
            }

            if (!await canManageClass(req.user, classId)) return forbidden(res);
            // 获取所有待处理请求
            const pendingRequests = await LoginRequest.getPendingByClass(classId);

            // 处理每个请求
            for (const request of pendingRequests) {
                // 对于设备冲突类型或组合类型，清除原有会话
                if (request.requestType === 'device_conflict' || request.requestType === 'ip_and_device_conflict') {
                    await User.findByIdAndUpdate(request.studentId, {
                        $unset: { sessionId: 1, sessionExpiresAt: 1 }
                    });
                }
                // 对于IP变更类型或组合类型，更新登录历史IP
                if ((request.requestType === 'ip_change' || request.requestType === 'ip_and_device_conflict') && request.newIp) {
                    await User.findByIdAndUpdate(request.studentId, {
                        $set: { 'loginHistory.0.ip': request.newIp }
                    });
                }
            }


            // 批量更新状态
            const result = await LoginRequest.updateMany(
                {
                    classId,
                    status: 'pending',
                    expiresAt: { $gt: new Date() }
                },
                {
                    $set: {
                        status: 'approved',
                        processedAt: new Date(),
                        processedBy: teacherId
                    }
                }
            );

            logger.info('批量同意登录请求', { classId, count: result.modifiedCount, teacherId });

            return res.json({
                success: true,
                message: `已同意 ${result.modifiedCount} 个登录请求`,
                count: result.modifiedCount
            });
        } catch (error) {
            logger.error('批量同意登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '批量同意登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 批量拒绝班级所有待处理请求
     * POST /api/login-requests/bulk-reject
     */
    async bulkReject(req, res) {
        try {
            const { classId } = req.body;
            const teacherId = req.user?.id;

            if (!classId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少班级ID'
                });
            }

            if (!await canManageClass(req.user, classId)) return forbidden(res);
            // 批量更新状态
            const result = await LoginRequest.updateMany(
                {
                    classId,
                    status: 'pending',
                    expiresAt: { $gt: new Date() }
                },
                {
                    $set: {
                        status: 'rejected',
                        processedAt: new Date(),
                        processedBy: teacherId
                    }
                }
            );

            logger.info('批量拒绝登录请求', { classId, count: result.modifiedCount, teacherId });

            return res.json({
                success: true,
                message: `已拒绝 ${result.modifiedCount} 个登录请求`,
                count: result.modifiedCount
            });
        } catch (error) {
            logger.error('批量拒绝登录请求失败', error);
            return res.status(500).json({
                success: false,
                message: '批量拒绝登录请求失败',
                error: error.message
            });
        }
    },

    /**
     * 学生查询请求状态
     * GET /api/login-requests/status/:id
     */
    async getRequestStatus(req, res) {
        try {
            const { id } = req.params;

            const loginRequest = await LoginRequest.findById(id);

            if (!loginRequest) {
                return res.json({
                    success: true,
                    status: 'expired',
                    message: '请求不存在或已过期'
                });
            }

            // 检查是否已过期
            if (loginRequest.expiresAt < new Date() && loginRequest.status === 'pending') {
                return res.json({
                    success: true,
                    status: 'expired',
                    message: '请求已过期'
                });
            }

            return res.json({
                success: true,
                status: loginRequest.status,
                processedAt: loginRequest.processedAt,
                expiresAt: loginRequest.expiresAt
            });
        } catch (error) {
            logger.error('获取登录请求状态失败', error);
            return res.status(500).json({
                success: false,
                message: '获取登录请求状态失败',
                error: error.message
            });
        }
    }
};

module.exports = loginRequestController;
