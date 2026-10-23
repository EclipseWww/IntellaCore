const PracticeSession = require('../models/PracticeSession');
const Question = require('../models/Question');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Class = require('../models/Class');
const PointsManager = require('../utils/pointsManager');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// 开始练习
exports.startPractice = async (req, res) => {
    try {
        const studentId = req.user.id;

        // 1. 获取学生班级及练习配置
        const user = await User.findById(studentId).select('classId');
        if (!user.classId) {
            return res.status(403).json({ success: false, message: '未分配班级，无法进行练习' });
        }

        const classObj = await Class.findById(user.classId).select('freePracticeSettings');

        // 默认配置
        const defaultConfig = {
            timeLimit: 300,
            questionCount: 10,
            pointsPerQuestion: 5,
            allowedTypes: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'],
            allowedTags: [],
            difficultyRange: { min: 1, max: 5 }
        };

        const config = classObj?.freePracticeSettings || defaultConfig;

        // 合并配置（处理部分设置可能为空的情况）
        const practiceConfig = {
            isEnabled: config.isEnabled !== false, // 默认开启
            timeLimit: config.timeLimit || 300,
            questionCount: config.questionCount || 10,
            pointsPerQuestion: config.pointsPerQuestion || 5,
            allowedTypes: (config.allowedTypes && config.allowedTypes.length > 0)
                ? config.allowedTypes
                : ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'],
            allowedTags: config.allowedTags || [],
            difficultyRange: config.difficultyRange || { min: 1, max: 5 }
        };

        if (!practiceConfig.isEnabled) {
            return res.status(403).json({ success: false, message: '当前班级未开启自由练习功能' });
        }

        // 2. 构建查询条件
        const matchCondition = {
            deletedAt: null, // 匹配 null 或字段不存在
            isArchived: { $ne: true }, // 匹配 false, null 或字段不存在
            type: { $in: practiceConfig.allowedTypes },
            difficulty: {
                $gte: practiceConfig.difficultyRange.min,
                $lte: practiceConfig.difficultyRange.max
            }
        };

        // 如果设置了标签限制，则必须包含其中至少一个标签
        if (practiceConfig.allowedTags.length > 0) {
            matchCondition.tags = { $in: practiceConfig.allowedTags };
        }

        // 调试日志
        logger.info('自由练习题目查询条件:', { studentId, matchCondition, config: practiceConfig });

        // 3. 随机抽取题目
        const questions = await Question.aggregate([
            { $match: matchCondition },
            { $sample: { size: practiceConfig.questionCount } }
        ]);

        if (questions.length === 0) {
            // 尝试更宽泛的搜索来诊断问题
            const fallbackCount = await Question.countDocuments({ deletedAt: null, isArchived: false });
            logger.warn('未找到符合条件的练习题目', { matchCondition, totalActiveQuestions: fallbackCount });

            return res.status(404).json({
                success: false,
                message: '题库中暂无符合当前设置的题目，请联系老师添加题目或调整设置。',
                data: []
            });
        }

        // 4. 创建练习会话
        const sessionQuestions = questions.map(q => ({
            questionId: q._id,
            questionVersion: q.version || 1,
            questionSnapshot: q
        }));

        const session = await PracticeSession.create({
            studentId,
            questions: sessionQuestions,
            totalQuestions: sessionQuestions.length,
            startTime: new Date(),
            pointsPerQuestion: practiceConfig.pointsPerQuestion,
            timeLimit: practiceConfig.timeLimit,
            status: 'IN_PROGRESS'
        });

        // 5. 返回给前端的数据
        const questionsForFrontend = questions.map(q => {
            // 处理选项，移除 isCorrect 字段
            const options = q.options.map(opt => {
                const { isCorrect, ...rest } = opt;
                return rest;
            });

            return {
                _id: q._id,
                title: q.title,
                content: q.content,
                type: q.type,
                options,
                difficulty: q.difficulty,
                tags: q.tags
            };
        });

        res.status(201).json({
            success: true,
            data: {
                sessionId: session._id,
                questions: questionsForFrontend,
                timeLimit: session.timeLimit,
                totalQuestions: questions.length
            }
        });

    } catch (error) {
        logger.error('开始自由练习失败', { error: error.message, studentId: req.user.id });
        res.status(500).json({
            success: false,
            message: '开始练习失败',
            error: error.message
        });
    }
};

// 提交练习
exports.submitPractice = async (req, res) => {
    try {
        const { sessionId, answers } = req.body;
        const studentId = req.user.id;

        const session = await PracticeSession.findOne({
            _id: sessionId,
            studentId,
            status: 'IN_PROGRESS'
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: '未找到进行中的练习会话'
            });
        }

        let correctCount = 0;
        const pointsPerQuestion = session.pointsPerQuestion || 5;

        // 获取完整的题目信息用于比对
        const questionIds = session.questions.map(q => q.questionId);
        const questions = await Question.find({ _id: { $in: questionIds } });
        const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

        // 更新会话中的题目状态
        session.questions.forEach(sessionQ => {
            const qId = sessionQ.questionId.toString();
            const submittedOption = answers[qId];
            const question = questionMap.get(qId);

            if (question && submittedOption) {
                sessionQ.selectedOption = submittedOption;

                // 检查是否正确
                const correctOption = question.options.find(opt => opt.isCorrect);
                const isCorrect = correctOption && correctOption._id.toString() === submittedOption;

                sessionQ.isCorrect = isCorrect;
                if (isCorrect) correctCount++;
            } else {
                sessionQ.isCorrect = false;
            }
        });

        // Compare the exact ratio: a rounded 60% must not pass when below 60%.
        const totalQuestions = session.questions.length;
        const rewardEligible = totalQuestions > 0 && correctCount * 5 >= totalQuestions * 3;
        const pointsEarned = rewardEligible ? correctCount * pointsPerQuestion : 0;
        const rewardMessage = rewardEligible ? null : '正确率未达到60%，本次不奖励积分';

        // 每日自由练习积分上限
        const DAILY_FREE_PRACTICE_LIMIT = 500;

        // 查询今日已获得的自由练习积分
        const Achievement = require('../models/Achievement');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const achievement = await Achievement.findOne({ studentId });
        let todayFreePracticePoints = 0;

        if (achievement && achievement.pointTransactions) {
            todayFreePracticePoints = achievement.pointTransactions
                .filter(tx =>
                    tx.type === 'free_practice' &&
                    tx.amount > 0 &&
                    new Date(tx.timestamp) >= today
                )
                .reduce((sum, tx) => sum + tx.amount, 0);
        }

        // 计算实际可获得的积分（不超过每日上限）
        const remainingAllowance = Math.max(0, DAILY_FREE_PRACTICE_LIMIT - todayFreePracticePoints);
        const actualPointsEarned = Math.min(pointsEarned, remainingAllowance);

        // 更新会话状态
        session.totalQuestions = totalQuestions;
        session.correctCount = correctCount;
        session.pointsEarned = actualPointsEarned; // 记录实际获得的积分
        session.status = 'COMPLETED';
        session.endTime = new Date();

        await session.save();

        // 奖励积分（只奖励实际可获得的部分）
        if (actualPointsEarned > 0) {
            await PointsManager.addPoints(
                studentId,
                actualPointsEarned,
                'free_practice',
                `自由练习奖励: 答对${correctCount}题`,
                session._id
            );
        }

        // 构建返回消息
        let limitMessage = null;
        if (pointsEarned > actualPointsEarned) {
            limitMessage = `今日自由练习积分已达上限(${DAILY_FREE_PRACTICE_LIMIT}分)，本次仅获得${actualPointsEarned}分`;
        }

        res.json({
            success: true,
            data: {
                correctCount,
                totalQuestions: session.totalQuestions,
                pointsEarned: actualPointsEarned,
                rewardEligible,
                rewardMessage,
                limitMessage,
                results: session.questions.map(q => ({
                    questionId: q.questionId,
                    isCorrect: q.isCorrect
                }))
            }
        });

    } catch (error) {
        logger.error('提交练习失败', { error: error.message, studentId: req.user.id });
        res.status(500).json({
            success: false,
            message: '提交练习失败',
            error: error.message
        });
    }
};

// 获取练习历史
exports.getHistory = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        const history = await PracticeSession.find({ studentId, status: 'COMPLETED' })
            .sort({ endTime: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-questions.questionSnapshot');

        const total = await PracticeSession.countDocuments({ studentId, status: 'COMPLETED' });

        res.json({
            success: true,
            data: {
                list: history,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        logger.error('获取练习历史失败', { error: error.message, studentId: req.user.id });
        res.status(500).json({
            success: false,
            message: '获取练习历史失败',
            error: error.message
        });
    }
};

// 获取练习详情
exports.getDetails = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { sessionId } = req.params;

        const session = await PracticeSession.findOne({ _id: sessionId, studentId });

        if (!session) {
            return res.status(404).json({ success: false, message: '未找到该练习记录' });
        }

        const details = session.questions.map(q => {
            const snapshot = q.questionSnapshot || {};
            const correctOption = snapshot.options?.find(opt => opt.isCorrect);

            return {
                questionId: q.questionId,
                title: snapshot.title,
                content: snapshot.content,
                type: snapshot.type,
                options: snapshot.options,
                userAnswer: q.selectedOption,
                correctAnswer: correctOption?._id,
                isCorrect: q.isCorrect,
                analysis: snapshot.analysis || '暂无解析',
                difficulty: snapshot.difficulty,
                tags: snapshot.tags
            };
        });

        res.json({
            success: true,
            data: {
                sessionInfo: {
                    startTime: session.startTime,
                    endTime: session.endTime,
                    score: session.correctCount,
                    total: session.totalQuestions,
                    points: session.pointsEarned
                },
                questions: details
            }
        });

    } catch (error) {
        logger.error('获取练习详情失败', { error: error.message, sessionId: req.params.sessionId });
        res.status(500).json({ success: false, message: '获取详情失败' });
    }
};

// 获取班级练习配置 (Teacher)
exports.getClassSettings = async (req, res) => {
    try {
        const { classId } = req.params;

        const classObj = await Class.findById(classId).select('freePracticeSettings');
        if (!classObj) {
            return res.status(404).json({ success: false, message: '班级不存在' });
        }

        res.json({
            success: true,
            data: classObj.freePracticeSettings || {
                isEnabled: true,
                timeLimit: 300,
                questionCount: 10,
                pointsPerQuestion: 5,
                allowedTypes: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'],
                allowedTags: [],
                difficultyRange: { min: 1, max: 5 }
            }
        });
    } catch (error) {
        logger.error('获取班级练习配置失败', { error: error.message, classId: req.params.classId });
        res.status(500).json({ success: false, message: '获取配置失败', error: error.message });
    }
};

// 更新班级练习配置 (Teacher)
exports.updateClassSettings = async (req, res) => {
    try {
        const { classId } = req.params;
        const settings = req.body;

        const classObj = await Class.findByIdAndUpdate(
            classId,
            { freePracticeSettings: settings },
            { new: true }
        );

        if (!classObj) {
            return res.status(404).json({ success: false, message: '班级不存在' });
        }

        res.json({
            success: true,
            message: '配置更新成功',
            data: classObj.freePracticeSettings
        });
    } catch (error) {
        logger.error('更新班级练习配置失败', { error: error.message, classId: req.params.classId });
        res.status(500).json({ success: false, message: '更新配置失败', error: error.message });
    }
};

// 批量更新班级练习配置 (Teacher)
exports.bulkUpdateClassSettings = async (req, res) => {
    try {
        const { classIds, settings } = req.body;
        const teacherId = req.user.id; // Optional: verify teacher owns these classes

        if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
            return res.status(400).json({ success: false, message: '请选择至少一个班级' });
        }

        // 可以添加权限检查：确保操作者是这些班级的老师或管理员
        // 简单起见，这里假设中间件 roleCheck(['teacher', 'admin']) 已经做好了基本角色控制
        // 如果需要严格控制，通过 Class.find({ _id: { $in: classIds }, teacher: teacherId }) 过滤

        const result = await Class.updateMany(
            { _id: { $in: classIds } },
            { $set: { freePracticeSettings: settings } }
        );

        res.json({
            success: true,
            message: `成功更新 ${result.modifiedCount} 个班级的配置`,
            data: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount
            }
        });
    } catch (error) {
        logger.error('批量更新班级练习配置失败', { error: error.message, body: req.body });
        res.status(500).json({ success: false, message: '批量更新配置失败', error: error.message });
    }
};

// 获取学生练习记录 (Teacher)
exports.getStudentRecords = async (req, res) => {
    try {
        const { page = 1, limit = 20, classId, grade, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 1. 获取老师所管理的班级
        const teacherClasses = await Class.find({ teacher: req.user.id }).select('_id grade name');
        const teacherClassIds = teacherClasses.map(c => c._id);

        if (teacherClassIds.length === 0) {
            return res.json({
                success: true,
                data: { list: [], total: 0, page: parseInt(page), totalPages: 0 }
            });
        }

        // 2. 构建学生筛选条件
        let studentFilter = { classId: { $in: teacherClassIds } };

        if (classId) {
            // 验证班级属于该老师
            if (!teacherClassIds.some(id => id.toString() === classId)) {
                return res.status(403).json({ success: false, message: '无权访问该班级' });
            }
            studentFilter.classId = new mongoose.Types.ObjectId(classId);
        }

        if (grade) {
            const gradeClasses = teacherClasses.filter(c => c.grade === parseInt(grade));
            studentFilter.classId = { $in: gradeClasses.map(c => c._id) };
        }

        // 获取符合条件的学生
        const students = await User.find({ ...studentFilter, role: 'student' }).select('_id name classId');
        const studentIds = students.map(s => s._id);
        const studentMap = new Map(students.map(s => [s._id.toString(), s]));

        // 3. 构建练习记录查询条件
        let sessionFilter = {
            studentId: { $in: studentIds },
            status: 'COMPLETED'
        };

        if (startDate || endDate) {
            sessionFilter.endTime = {};
            if (startDate) sessionFilter.endTime.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                sessionFilter.endTime.$lte = end;
            }
        }

        // 4. 查询记录
        const [records, total] = await Promise.all([
            PracticeSession.find(sessionFilter)
                .sort({ endTime: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('studentId correctCount totalQuestions pointsEarned startTime endTime questions')
                .lean(),
            PracticeSession.countDocuments(sessionFilter)
        ]);

        // 5. 补充学生和班级信息
        const classMap = new Map(teacherClasses.map(c => [c._id.toString(), c]));

        const enrichedRecords = records.map(r => {
            const student = studentMap.get(r.studentId.toString());
            const cls = student ? classMap.get(student.classId.toString()) : null;
            return {
                _id: r._id,
                studentName: student?.name || '未知',
                className: cls ? `${cls.grade}年级${cls.name}班` : '未知',
                grade: cls?.grade,
                correctCount: r.correctCount,
                totalQuestions: r.questions?.length || r.totalQuestions || 10,
                accuracy: r.questions?.length ? Math.round((r.correctCount / r.questions.length) * 100) : 0,
                pointsEarned: r.pointsEarned || 0,
                endTime: r.endTime
            };
        });

        res.json({
            success: true,
            data: {
                list: enrichedRecords,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('获取学生练习记录失败', { error: error.message, userId: req.user.id });
        res.status(500).json({ success: false, message: '获取记录失败', error: error.message });
    }
};

// 获取排行榜 (Teacher)
exports.getLeaderboard = async (req, res) => {
    try {
        const { classId, grade, timeRange = 'all' } = req.query;

        // 1. 获取老师所管理的班级
        const teacherClasses = await Class.find({ teacher: req.user.id }).select('_id grade name');
        const teacherClassIds = teacherClasses.map(c => c._id);

        if (teacherClassIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. 构建学生筛选条件
        let studentFilter = { classId: { $in: teacherClassIds }, role: 'student' };

        if (classId) {
            if (!teacherClassIds.some(id => id.toString() === classId)) {
                return res.status(403).json({ success: false, message: '无权访问该班级' });
            }
            studentFilter.classId = new mongoose.Types.ObjectId(classId);
        }

        if (grade) {
            const gradeClasses = teacherClasses.filter(c => c.grade === parseInt(grade));
            studentFilter.classId = { $in: gradeClasses.map(c => c._id) };
        }

        const students = await User.find(studentFilter).select('_id name classId');
        const studentIds = students.map(s => s._id);

        // 3. 构建时间筛选条件
        let timeFilter = {};
        const now = new Date();

        if (timeRange === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            timeFilter = { endTime: { $gte: weekAgo } };
        } else if (timeRange === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            timeFilter = { endTime: { $gte: monthAgo } };
        }

        // 4. 聚合排行榜数据
        const leaderboardData = await PracticeSession.aggregate([
            {
                $match: {
                    studentId: { $in: studentIds },
                    status: 'COMPLETED',
                    ...timeFilter
                }
            },
            {
                $group: {
                    _id: '$studentId',
                    totalPoints: { $sum: '$pointsEarned' },
                    totalCorrect: { $sum: '$correctCount' },
                    totalQuestions: { $sum: { $size: '$questions' } },
                    practiceCount: { $sum: 1 }
                }
            },
            {
                $sort: { totalPoints: -1 }
            },
            {
                $limit: 100
            }
        ]);

        // 5. 补充学生信息
        const studentMap = new Map(students.map(s => [s._id.toString(), s]));
        const classMap = new Map(teacherClasses.map(c => [c._id.toString(), c]));

        const leaderboard = leaderboardData.map((item, index) => {
            const student = studentMap.get(item._id.toString());
            const cls = student ? classMap.get(student.classId.toString()) : null;
            return {
                rank: index + 1,
                studentId: item._id,
                studentName: student?.name || '未知',
                className: cls ? `${cls.grade}年级${cls.name}班` : '未知',
                grade: cls?.grade,
                totalPoints: item.totalPoints,
                practiceCount: item.practiceCount,
                accuracy: item.totalQuestions > 0
                    ? Math.round((item.totalCorrect / item.totalQuestions) * 100)
                    : 0
            };
        });

        res.json({
            success: true,
            data: leaderboard
        });

    } catch (error) {
        logger.error('获取排行榜失败', { error: error.message, userId: req.user.id });
        res.status(500).json({ success: false, message: '获取排行榜失败', error: error.message });
    }
};
