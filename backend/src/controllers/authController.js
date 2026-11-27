const User = require('../models/User');
const Class = require('../models/Class');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getClientIp } = require('../utils/getClientIp');
const mongoose = require('mongoose');
const ClassMembership = require('../models/ClassMembership');
const roster = require('../services/classRoster');
const { formatClassName } = require('../utils/className');

const STUDENT_SESSION_SECONDS = 2 * 60 * 60;

const authController = {
  // 登录
  async login(req, res) {
    try {
      logger.info('登录尝试', { username: req.body.username });
      const { username, password } = req.body;

      // 输入验证
      if (typeof username !== 'string' || !username.trim()) {
        logger.warn('缺少用户名');
        return res.status(400).json({ message: '用户名不能为空' });
      }

      // 管理员、教师均使用数据库账号和加密密码
      // 查找用户
      logger.info('查找用户:', username);
      const user = await User.findOne({ username });
      if (!user || !user.isActive) {
        logger.warn('用户未找到:', username);
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      // 教师登录：只验证密码
      if (user.role === 'teacher' || user.role === 'admin') {
        logger.info('教师登录，开始验证密码', {
          username,
          inputPasswordLength: password?.length
        });

        const isMatch = typeof password === 'string' && await bcrypt.compare(password, user.password);

        logger.info('密码验证结果', {
          username,
          isMatch,
          passwordMatch: isMatch ? '密码匹配' : '密码不匹配'
        });

        if (!isMatch) {
          logger.warn('教师密码验证失败', {
            username,
            attemptTime: new Date().toISOString()
          });
          return res.status(401).json({ message: '用户名或密码错误' });
        }

        // 生成教师登录token
        const token = jwt.sign(
          {
            _id: user._id,
            id: user._id,
            role: user.role
          },
          process.env.JWT_SECRET,
          { expiresIn: '12h' } // 设置为12小时
        );

        // 记录登录信息
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'];
        await user.addLoginRecord(ip, userAgent);

        // 返回教师登录信息
        const responseData = {
          message: '登录成功',
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            name: user.name
          },
          token
        };

        logger.info('教师登录成功:', username);
        return res.json(responseData);
      }
      // 学生登录：确定本次登录的班级（行政班或参加的教学班）并检查状态 + 单点登录会话处理
      else if (user.role === 'student') {
        const userWithClass = await User.findById(user._id).select('classId loginHistory seatNumber loginHandoff');
        const CLASS_FIELDS = 'type title grade name allowIpChange isInClass currentLesson currentCourse currentUnit autoRedirectToLesson status';
        // 行政班可以为空：只在本机房上社团/选修课的学生没有行政班，只能登录参加的教学班
        const adminClass = userWithClass.classId
          ? await Class.findById(userWithClass.classId).select(CLASS_FIELDS)
          : null;
        if (userWithClass.classId && !adminClass) {
          logger.warn('班级未找到:', userWithClass.classId);
          return res.status(404).json({ message: '未找到指定的班级' });
        }

        // 如果行政班已归档（已毕业），则禁止登录并返回友好提示
        if (adminClass && adminClass.status === 'archived') {
          logger.info('学生尝试登录已归档班级', { username, classId: userWithClass.classId });
          return res.status(403).json({
            message: '您所在班级已完成本阶段学习，如有问题请联系教师',
            code: 'CLASS_ARCHIVED'
          });
        }

        // 登录页选了教学班（社团、选修）：必须是该班成员
        let classObj = adminClass;
        let membership = null;
        const requestedClassId = req.body.classId;
        if (requestedClassId && !(adminClass && String(requestedClassId) === String(adminClass._id))) {
          const requested = mongoose.isValidObjectId(requestedClassId)
            ? await Class.findById(requestedClassId).select(CLASS_FIELDS)
            : null;
          membership = requested && requested.type === 'elective'
            ? await ClassMembership.findOne({ class: requested._id, student: user._id })
            : null;
          if (!requested || !membership) {
            logger.warn('学生选择了不属于自己的班级', { username, requestedClassId });
            return res.status(403).json({ message: '你不在所选的班级里，请重新选择班级', code: 'NOT_IN_CLASS' });
          }
          if (requested.status === 'archived') {
            return res.status(403).json({ message: '该教学班已结课', code: 'CLASS_ARCHIVED' });
          }
          classObj = requested;
        }
        if (!classObj) {
          logger.warn('没有行政班的学生未选择教学班', { username });
          return res.status(400).json({ message: '请先选择你参加的社团 / 选修课', code: 'SELECT_CLASS' });
        }
        const classId = classObj._id;

        // 非上课时间一律不允许学生登录（无论密码是否正确）。
        // 该检查放在 IP/设备冲突检查之前：未登录成功前不向外返回学生姓名、上次登录 IP 等信息。
        if (!classObj.isInClass) {
          logger.warn('学生在非上课时间尝试登录被拒绝', {
            username,
            classId,
            attemptTime: new Date().toISOString()
          });
          return res.status(403).json({
            message: '当前不在上课时间，暂不能登录',
            code: 'CLASS_NOT_IN_SESSION',
            isClassInSession: false
          });
        }

        const currentIp = getClientIp(req);
        const now = new Date();
        // 一次性放行：该班开始上课时被踢下线的学生，在原来那台电脑上登录本班不需要审批
        const handoff = roster.handoffApplies(userWithClass, classId, currentIp, now);
        const boundIp = roster.boundIpFor(userWithClass, classObj, membership);
        logger.info('IP检查信息:', { allowIpChange: classObj.allowIpChange, currentIp, handoff });

        // 检测两种可能的问题
        let hasIpIssue = false;
        let hasDeviceConflict = false;
        let oldIp = null;

        // 检查 IP 变更问题：只和这个班级绑定的 IP 比较（行政班、各教学班分别绑定）
        if (!classObj.allowIpChange && !handoff && boundIp && boundIp !== currentIp) {
          hasIpIssue = true;
          oldIp = boundIp;
        }

        // 检查设备冲突问题
        if (user.sessionId && user.sessionExpiresAt && user.sessionExpiresAt > now) {
          hasDeviceConflict = true;
        }

        // 根据问题类型返回相应的错误响应（审批请求发给所选班级的老师）
        if (hasIpIssue && hasDeviceConflict) {
          // 同时存在 IP 变更和设备冲突
          logger.warn('IP不匹配且存在设备冲突，需要请求登录', {
            lastLoginIp: oldIp,
            currentIp,
            sessionId: user.sessionId
          });
          return res.status(409).json({
            code: 'IP_AND_DEVICE_CONFLICT',
            message: '登录IP变更且已在其他设备登录',
            oldIp: oldIp,
            newIp: currentIp,
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId
          });
        } else if (hasIpIssue) {
          // 仅 IP 变更
          logger.warn('IP不匹配，需要请求登录', { lastLoginIp: oldIp, currentIp });
          return res.status(401).json({
            code: 'IP_CHANGE_REQUIRED',
            message: '登录IP与上次不一致',
            oldIp: oldIp,
            newIp: currentIp,
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId
          });
        } else if (hasDeviceConflict) {
          // 仅设备冲突
          logger.warn('学生已有在线会话，需要请求登录', { username, sessionId: user.sessionId });
          return res.status(409).json({
            code: 'DEVICE_CONFLICT',
            message: '该用户已在其他设备登录',
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId
          });
        }

        const userAgent = req.headers['user-agent'];
        await user.addLoginRecord(currentIp, userAgent, classId);

        // 教学班第一次登录：绑定这台电脑的 IP
        if (membership && !membership.boundIp) {
          await ClassMembership.updateOne({ _id: membership._id, boundIp: null }, { $set: { boundIp: currentIp } });
        }

        // 创建新的会话ID与过期时间，并存储到用户；记下本次登录所属的班级，用过的一次性放行作废
        const newSessionId = require('crypto').randomBytes(16).toString('hex');
        const sessionExpiresAt = new Date(Date.now() + STUDENT_SESSION_SECONDS * 1000);
        await User.findByIdAndUpdate(user._id, {
          sessionId: newSessionId,
          sessionExpiresAt,
          sessionClassId: classId,
          ...(handoff && { loginHandoff: { classId: null, ip: null, expiresAt: null } })
        });
        const seatNumber = membership ? (membership.seatNumber || null) : userWithClass.seatNumber;

        const token = jwt.sign(
          {
            _id: user._id,
            id: user._id,
            role: user.role,
            sessionId: newSessionId
          },
          process.env.JWT_SECRET,
          { expiresIn: STUDENT_SESSION_SECONDS }
        );

        const responseData = {
          message: '登录成功',
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            seatNumber
          },
          token,
          classInfo: {
            classId,
            className: formatClassName(classObj),
            classType: classObj.type || 'admin',
            isInClass: classObj.isInClass,
            currentLesson: classObj.currentLesson,
            currentCourse: classObj.currentCourse,
            currentUnit: classObj.currentUnit,
            autoRedirectToLesson: classObj.autoRedirectToLesson,
            needSelectSeat: !seatNumber  // 是否需要选择座位（教学班的座位与行政班分开）
          }
        };

        logger.info('学生登录成功:', username);
        return res.json(responseData);
      }

      return res.status(403).json({ message: '不支持的账号角色' });
    } catch (error) {
      logger.error('登录错误:', error);
      res.status(500).json({
        message: '登录失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // 登出：清理学生会话ID
  async logout(req, res) {
    try {
      logger.info('登出请求', { userId: req.user?.id, role: req.user?.role });

      if (!req.user) {
        return res.status(401).json({ message: '未认证' });
      }

      // 仅学生需要清理会话；教师直接返回成功
      if (req.user.role === 'student') {
        const setting = await require('../models/Setting').findOne({ key: 'studentLogoutPassword' });
        const password = req.body?.teacherPassword;
        if (!setting || typeof password !== 'string' || password.length > 72 || !await bcrypt.compare(password, setting.value)) {
          return res.status(403).json({ message: '退出密码错误或尚未配置，请联系管理员' });
        }
        await User.findByIdAndUpdate(req.user.id || req.user._id, { $unset: { sessionId: 1, sessionExpiresAt: 1 } });
      }

      return res.json({ message: '已登出' });
    } catch (error) {
      logger.error('登出错误:', error);
      return res.status(500).json({ message: '登出失败', error: error.message });
    }
  },

  // 获取当前用户信息
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .select('-password')  // 排除密码字段
        .populate('loginHistory');

      if (!user) {
        logger.warn('用户不存在:', req.user.id);
        return res.status(404).json({ message: '用户不存在' });
      }

      // 确保返回座位号信息
      const responseData = {
        ...user.toObject(),
        seatNumber: user.seatNumber
      };
      delete responseData.loginHandoff;

      // 学生：本次登录所在的班级（教学班的座位号取该班的座位），以及参加的教学班
      if (user.role === 'student') {
        const ctxId = roster.contextClassId(user);
        const memberships = await ClassMembership.find({ student: user._id }).select('class seatNumber').lean();
        const electives = memberships.length
          ? await Class.find({ _id: { $in: memberships.map(m => m.class) } }).select('type title term status teacher').populate('teacher', 'name').lean()
          : [];
        responseData.electives = electives
          .filter(c => c.status !== 'archived')
          .map(c => ({ _id: c._id, title: c.title, term: c.term || '', teacherName: c.teacher && c.teacher.name }));
        const ctxMembership = memberships.find(m => roster.sameId(m.class, ctxId));
        if (ctxMembership) {
          const ctx = electives.find(c => roster.sameId(c._id, ctxId));
          responseData.seatNumber = ctxMembership.seatNumber || null;
          responseData.currentClass = { _id: ctxId, type: 'elective', displayName: formatClassName(ctx || { type: 'elective' }) };
        } else if (user.classId) {
          const admin = await Class.findById(user.classId).select('grade name type').lean();
          responseData.currentClass = admin ? { _id: admin._id, type: 'admin', displayName: formatClassName(admin) } : null;
        }
      }

      res.json(responseData);
    } catch (error) {
      logger.error('获取用户信息错误:', error);
      res.status(500).json({
        message: '服务器错误',
        error: error.message
      });
    }
  },

  // 添加新方法：验证token有效性
  async validateToken(req, res) {
    try {
      logger.info('验证token有效性');
      // 如果请求能通过auth中间件，说明token有效
      res.json({ valid: true });
    } catch (error) {
      logger.error('验证token错误:', error);
      res.status(401).json({ valid: false });
    }
  },

  // 更新座位号
  async updateSeatNumber(req, res) {
    try {
      const { seatNumber, userId } = req.body;
      // 学生只能给自己选座位；教师可以指定学生
      const targetUserId = req.user.role === 'student' ? req.user.id : (userId || req.user.id);

      logger.info('更新座位号:', { targetUserId, seatNumber });

      // 获取目标用户信息(包含班级ID和当前座位号)
      const targetUser = await User.findById(targetUserId).select('classId sessionClassId seatNumber role');
      if (!targetUser) {
        logger.warn('用户不存在:', targetUserId);
        return res.status(404).json({ message: '用户不存在' });
      }

      // 教学班的座位记在成员记录里，与行政班座位分开：
      // 学生按本次登录的班级，教师按传入的 classId
      const seatClassId = req.user.role === 'student'
        ? roster.contextClassId(targetUser)
        : (mongoose.isValidObjectId(req.body.classId) ? req.body.classId : null);
      const seatClass = seatClassId && !roster.sameId(seatClassId, targetUser.classId)
        ? await Class.findById(seatClassId).select('type teacher coTeachers isInClass currentLesson currentCourse currentUnit autoRedirectToLesson')
        : null;
      if (seatClass && seatClass.type === 'elective') {
        if (req.user.role === 'teacher' && !require('../services/teachingAccess').canTeachClass(req.user, seatClass)) {
          return res.status(403).json({ message: '无权修改该班级的座位' });
        }
        const membership = await ClassMembership.findOne({ class: seatClass._id, student: targetUserId });
        if (!membership) return res.status(404).json({ message: '该学生不在这个教学班' });
        if (req.user.role === 'student' && membership.seatNumber) {
          return res.status(403).json({ message: '已分配座位只能由老师修改' });
        }
        if (req.user.role !== 'student' && seatNumber === null) {
          membership.seatNumber = null;
          await membership.save();
          return res.json({ message: '座位号已清空', seatNumber: null });
        }
        if (!seatNumber || !/^[A-Z][0-9]+$/.test(seatNumber)) {
          return res.status(400).json({ message: '无效的座位号格式' });
        }
        if (await ClassMembership.exists({ class: seatClass._id, seatNumber, student: { $ne: targetUserId } })) {
          return res.status(400).json({ message: '该座位已被同班级其他同学占用' });
        }
        membership.seatNumber = seatNumber;
        await membership.save();
        return res.json({
          message: '座位号更新成功',
          seatNumber,
          classInfo: {
            isInClass: seatClass.isInClass,
            currentLesson: seatClass.currentLesson,
            currentCourse: seatClass.currentCourse,
            currentUnit: seatClass.currentUnit,
            autoRedirectToLesson: seatClass.autoRedirectToLesson
          }
        });
      }

      // 检查权限：如果是学生自己更新且已有座位号，则不允许
      if (req.user.role === 'student' && targetUser.seatNumber) {
        logger.warn('学生尝试修改已分配的座位:', {
          studentId: req.user.id,
          currentSeat: targetUser.seatNumber,
          attemptedSeat: seatNumber
        });
        return res.status(403).json({ message: '已分配座位只能由老师修改' });
      }

      // 如果是老师要清空座位号
      if (req.user.role === 'teacher' && seatNumber === null) {
        logger.info('老师清空学生座位号:', {
          teacherId: req.user.id,
          studentId: targetUserId,
          originalSeat: targetUser.seatNumber
        });

        const user = await User.findByIdAndUpdate(
          targetUserId,
          { $unset: { seatNumber: 1 } },
          { new: true }
        );

        return res.json({
          message: '座位号已清空',
          seatNumber: null
        });
      }

      // 验证座位号格式
      if (!seatNumber || !/^[A-Z][0-9]+$/.test(seatNumber)) {
        logger.warn('无效的座位号格式:', seatNumber);
        return res.status(400).json({ message: '无效的座位号格式' });
      }

      // 检查同班级中是否有相同座位号
      const existingSeat = await User.findOne({
        classId: targetUser.classId,
        seatNumber,
        _id: { $ne: targetUserId } // 排除当前用户
      });

      if (existingSeat) {
        logger.warn('座位已被占用:', {
          seatNumber,
          classId: targetUser.classId,
          occupiedBy: existingSeat._id
        });
        return res.status(400).json({ message: '该座位已被同班级其他同学占用' });
      }

      // 更新用户的座位号
      const user = await User.findByIdAndUpdate(
        targetUserId,
        { seatNumber },
        { new: true }
      );

      // 获取班级信息
      const classObj = await Class.findById(targetUser.classId)
        .select('isInClass currentLesson currentCourse currentUnit autoRedirectToLesson');

      logger.info('座位号更新成功:', { targetUserId, seatNumber });
      res.json({
        message: '座位号更新成功',
        seatNumber: user.seatNumber,
        classInfo: classObj ? {
          isInClass: classObj.isInClass,
          currentLesson: classObj.currentLesson,
          currentCourse: classObj.currentCourse,
          currentUnit: classObj.currentUnit,
          autoRedirectToLesson: classObj.autoRedirectToLesson
        } : null
      });
    } catch (error) {
      logger.error('更新座位号错误:', error);
      res.status(500).json({
        message: '更新座位号失败',
        error: error.message
      });
    }
  }
};

module.exports = authController;
