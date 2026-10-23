const PythonSubmission = require('../models/PythonSubmission');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const PointsManager = require('../utils/pointsManager');

/**
 * Python编程活动控制器
 */

// 获取学生的提交记录
exports.getSubmission = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user.id;

        let submission = await PythonSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        // 如果没有记录，获取活动的初始代码
        if (!submission) {
            const lesson = await Lesson.findById(lessonId);
            if (!lesson) {
                return res.status(404).json({ success: false, message: '课时不存在' });
            }

            const activity = lesson.activities.find(a => a._id.toString() === activityId);
            if (!activity) {
                return res.status(404).json({ success: false, message: '活动不存在' });
            }

            // 创建新的提交记录，使用活动的初始代码
            submission = new PythonSubmission({
                lessonId,
                activityId,
                studentId,
                code: activity.pythonSettings?.starterCode || '# 在这里编写你的Python代码\n',
                status: 'draft'
            });
            await submission.save();
        }

        res.json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error('获取Python提交记录失败:', error);
        res.status(500).json({ success: false, message: '获取提交记录失败', error: error.message });
    }
};

// 保存草稿
exports.saveDraft = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const { code, output, turtleGraphics } = req.body;
        const studentId = req.user.id;

        let submission = await PythonSubmission.findOneAndUpdate(
            { lessonId, activityId, studentId },
            {
                code,
                output,
                turtleGraphics,
                status: 'draft'
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            data: submission,
            message: '草稿已保存'
        });
    } catch (error) {
        console.error('保存Python草稿失败:', error);
        res.status(500).json({ success: false, message: '保存草稿失败', error: error.message });
    }
};

// 提交代码（支持自动评分和测试结果保存）
exports.submit = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const { code, output, autoScore, testResults } = req.body;
        const studentId = req.user.id;

        // 构建更新数据
        const updateData = {
            code,
            output,
            status: 'submitted',
            submittedAt: new Date()
        };

        // 如果有自动评分，设置分数
        if (autoScore !== null && autoScore !== undefined) {
            updateData.score = autoScore;
            updateData.gradedAt = new Date();
            updateData.feedback = '自动评测';
        }

        // 如果有测试结果，保存它
        if (testResults) {
            updateData.testResults = testResults;
        }

        let submission;
        if (req.user.role === 'student') {
            submission = await PythonSubmission.findOneAndUpdate(
                { lessonId, activityId, studentId },
                updateData,
                { new: true, upsert: true }
            );
            console.log('Python代码提交成功(已写入数据库)');
        } else {
            submission = { ...updateData, _id: new require('mongoose').Types.ObjectId(), lessonId, activityId, studentId };
            console.log('教师模拟：Python代码提交成功(未写入数据库)');
        }

        res.json({
            success: true,
            data: submission,
            message: autoScore !== null ? `提交成功，自动评分: ${autoScore}/10` : '代码已提交'
        });
    } catch (error) {
        console.error('提交Python代码失败:', error);
        res.status(500).json({ success: false, message: '提交代码失败', error: error.message });
    }
};

// 撤回提交
exports.withdraw = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user._id;

        const submission = await PythonSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        if (!submission) {
            return res.status(404).json({ success: false, message: '提交记录不存在' });
        }

        if (submission.status !== 'submitted') {
            return res.status(400).json({ success: false, message: '当前状态无法撤回' });
        }

        // 如果已经评分，不允许撤回
        if (submission.score !== null) {
            return res.status(400).json({ success: false, message: '已评分的提交无法撤回' });
        }

        submission.status = 'draft';
        submission.submittedAt = null;
        await submission.save();

        res.json({
            success: true,
            data: submission,
            message: '已撤回提交'
        });
    } catch (error) {
        console.error('撤回Python提交失败:', error);
        res.status(500).json({ success: false, message: '撤回提交失败', error: error.message });
    }
};

// 教师端 - 获取活动的所有提交记录
exports.getActivitySubmissions = async (req, res) => {
    try {
        // 验证是否为教师
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '权限不足' });
        }

        const { lessonId, activityId } = req.params;
        const { classId } = req.query;

        // 基础查询条件：只获取已提交的记录（与待批改树逻辑保持一致）
        let query = { lessonId, activityId, status: 'submitted' };

        // 获取所有提交
        let submissions = await PythonSubmission.find(query)
            .populate({
                path: 'studentId',
                select: 'name studentId classId role',
                populate: {
                    path: 'classId',
                    select: 'grade name status'
                }
            })
            .populate('gradedBy', 'name')
            .sort({ submittedAt: -1 });

        // 过滤掉教师模拟学生提交的记录（只显示真正学生的提交），并过滤掉所在班级已归档的学生
        submissions = submissions.filter(s => {
            const isStudent = s.studentId && s.studentId.role !== 'teacher' && s.studentId.role !== 'admin';
            const isArchived = s.studentId?.classId?.status === 'archived';
            return isStudent && !isArchived;
        });

        // 如果指定了班级，过滤学生
        if (classId) {
            submissions = submissions.filter(s =>
                s.studentId?.classId?._id?.toString() === classId
            );
        }

        res.json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('获取Python提交列表失败:', error);
        res.status(500).json({ success: false, message: '获取提交列表失败', error: error.message });
    }
};


// 教师端 - 评分
exports.gradeSubmission = async (req, res) => {
    try {
        // 验证是否为教师
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '权限不足' });
        }

        const { submissionId } = req.params;
        const { score, feedback } = req.body;
        const teacherId = req.user.id;

        // 如果score不是null，验证范围
        if (score !== null && score !== undefined && (score < 0 || score > 10)) {
            return res.status(400).json({ success: false, message: '分数必须在0-10之间' });
        }

        let submission = await PythonSubmission.findById(submissionId);

        if (!submission) {
            return res.status(404).json({ success: false, message: '提交记录不存在' });
        }

        const oldScore = submission.score;

        // 如果score为null，则清除评分
        if (score === null) {
            submission.score = null;
            submission.feedback = null;
            submission.gradedAt = null;
            submission.gradedBy = null;
        } else {
            submission.score = score;
            submission.feedback = feedback;
            submission.gradedAt = new Date();
            submission.gradedBy = teacherId;
        }

        await submission.save();

        // 重新获取并填充用户信息，用于返回
        submission = await PythonSubmission.findById(submissionId).populate('studentId', 'name studentId');

        // 更新积分
        try {
            if (score === null) {
                // 清除评分时，撤销积分
                if (oldScore !== null && oldScore !== undefined) {
                    await PointsManager.deductPoints(
                        submission.studentId._id || submission.studentId,
                        oldScore * 10,
                        'task_completion_revoked',
                        'Python作业评分已清除',
                        submissionId
                    );
                }
            } else {
                await PointsManager.updatePoints(
                    submission.studentId._id || submission.studentId, // 兼容 populate
                    score * 10,  // 新积分
                    oldScore !== null && oldScore !== undefined ? oldScore * 10 : null, // 旧积分
                    submissionId,
                    'task_completion',
                    `Python作业评分: ${score}分`
                );
            }
            console.log(score === null ? 'Python作业评分已清除' : 'Python作业评分积分更新成功', {
                submissionId,
                studentId: submission.studentId._id || submission.studentId,
                score
            });
        } catch (pointsError) {
            console.error('Python作业评分积分更新失败:', pointsError);
        }

        res.json({
            success: true,
            data: submission,
            message: score === null ? '评分已清除' : '评分成功'
        });
    } catch (error) {
        console.error('Python评分失败:', error);
        res.status(500).json({ success: false, message: '评分失败', error: error.message });
    }
};


// 教师端 - 删除提交记录
exports.deleteSubmission = async (req, res) => {
    try {
        // 验证是否为教师
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '权限不足' });
        }

        const { submissionId } = req.params;

        const submission = await PythonSubmission.findByIdAndDelete(submissionId);

        if (!submission) {
            return res.status(404).json({ success: false, message: '提交记录不存在' });
        }

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除Python提交记录失败:', error);
        res.status(500).json({ success: false, message: '删除失败', error: error.message });
    }
};
