const PracticeSession = require('../models/PracticeSession');
const Question = require('../models/Question');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Class = require('../models/Class');
const PointsManager = require('../utils/pointsManager');
const logger = require('../utils/logger');
const { gradeChoiceAnswer, getSelectedOptionIds } = require('../utils/choiceAnswer');
const mongoose = require('mongoose');
const wrongQuestionService = require('../services/wrongQuestionService');
const roster = require('../services/classRoster');

const WRONG_RETRY_COUNT = 10;
const WRONG_RETRY_SECONDS_PER_QUESTION = 60;
// 统计与排行只看自由练习；旧记录没有 mode 字段，按自由练习处理
const FREE_MODE = { mode: { $ne: 'wrong_retry' } };

// 创建练习会话并返回去掉答案的题目
// 学生的薄弱知识点；老师限定了标签时只取其中允许的。出错不影响开始练习
async function weakTagsFor(studentId, allowedTags = []) {
    try {
        const tags = await wrongQuestionService.getWeakTags(studentId);
        return allowedTags.length ? tags.filter(tag => allowedTags.includes(tag)) : tags;
    } catch (error) {
        logger.warn('获取薄弱知识点失败，改为随机抽题', { studentId, error: error.message });
        return [];
    }
}

// 有薄弱知识点时，先从这些标签中抽约一半，再从其余题目中随机补足，最后打乱顺序
async function drawQuestions(matchCondition, count, focusTags = []) {
    if (!focusTags.length) {
        return Question.aggregate([{ $match: matchCondition }, { $sample: { size: count } }]);
    }
    const focused = await Question.aggregate([
        { $match: { ...matchCondition, tags: { $in: focusTags } } },
        { $sample: { size: Math.ceil(count / 2) } }
    ]);
    const rest = await Question.aggregate([
        { $match: { ...matchCondition, _id: { $nin: focused.map(q => q._id) } } },
        { $sample: { size: count - focused.length } }
    ]);
    const all = [...focused, ...rest];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
}

async function createSession(res, { studentId, questions, pointsPerQuestion, timeLimit, mode = 'free', focusTags = [] }) {
    const session = await PracticeSession.create({
        studentId,
        questions: questions.map(q => ({
            questionId: q._id,
            questionVersion: q.version || 1,
            questionSnapshot: q
        })),
        totalQuestions: questions.length,
        startTime: new Date(),
        pointsPerQuestion,
        timeLimit,
        mode,
        status: 'IN_PROGRESS'
    });

    const questionsForFrontend = questions.map(q => ({
        _id: q._id,
        title: q.title,
        content: q.content,
        type: q.type,
        // 移除 isCorrect 字段
        options: (q.options || []).map(({ isCorrect, ...rest }) => rest),
        difficulty: q.difficulty,
        tags: q.tags
    }));

    return res.status(201).json({
        success: true,
        data: {
            sessionId: session._id,
            questions: questionsForFrontend,
            timeLimit: session.timeLimit,
            totalQuestions: questions.length,
            mode,
            focusTags
        }
    });
}

// 开始练习
exports.startPractice = async (req, res) => {
    try {
        const studentId = req.user.id;

        // 1. 获取学生班级及练习配置
        const user = await User.findById(studentId).select('classId sessionClassId');
        if (!roster.contextClassId(user)) {
            return res.status(403).json({ success: false, message: '未分配班级，无法进行练习' });
        }

        // 按本次登录所在班级（行政班或教学班）的练习配置
        const classObj = await Class.findById(roster.contextClassId(user)).select('freePracticeSettings');

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

        // 3. 抽取题目：约一半来自学生错题本中未掌握的知识点（须在老师允许的标签内），其余随机
        const focusTags = await weakTagsFor(studentId, practiceConfig.allowedTags);
        const questions = await drawQuestions(matchCondition, practiceConfig.questionCount, focusTags);

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
        return createSession(res, {
            studentId,
            questions,
            pointsPerQuestion: practiceConfig.pointsPerQuestion,
            timeLimit: practiceConfig.timeLimit,
            focusTags
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

            const graded = question ? gradeChoiceAnswer(question, submittedOption) : null;

            if (graded) {
                // 多选题保存全部选项，并要求全部选对
                sessionQ.selectedOption = graded.selectedOption;
                sessionQ.selectedOptions = graded.selectedOptions;
                sessionQ.isCorrect = graded.isCorrect;
                if (graded.isCorrect) correctCount++;
            } else {
                sessionQ.isCorrect = false;
            }
        });

        // Compare the exact ratio: a rounded 60% must not pass when below 60%.
        const totalQuestions = session.questions.length;
        const isWrongRetry = session.mode === 'wrong_retry';
        const rewardEligible = !isWrongRetry && totalQuestions > 0 && correctCount * 5 >= totalQuestions * 3;
        const pointsEarned = rewardEligible ? correctCount * pointsPerQuestion : 0;
        const rewardMessage = isWrongRetry
            ? '错题重练不计积分，答对的题会在错题本中标为已掌握'
            : (rewardEligible ? null : '正确率未达到60%，本次不奖励积分');

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
                mode: session.mode || 'free',
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
                    pages: Math.ceil(total / limit),
                    total
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
                userAnswers: getSelectedOptionIds(q),
                correctAnswer: correctOption?._id,
                correctAnswers: (snapshot.options || []).filter(opt => opt.isCorrect).map(opt => String(opt._id)),
                isCorrect: q.isCorrect,
                analysis: snapshot.explanation || snapshot.analysis || '暂无解析',
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
                    points: session.pointsEarned,
                    mode: session.mode || 'free'
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

        // 2. 构建学生筛选条件（教学班按成员）
        let scopeIds = teacherClassIds;

        if (classId) {
            // 验证班级属于该老师
            if (!teacherClassIds.some(id => id.toString() === classId)) {
                return res.status(403).json({ success: false, message: '无权访问该班级' });
            }
            scopeIds = [classId];
        }

        if (grade) {
            scopeIds = teacherClasses.filter(c => c.grade === parseInt(grade)).map(c => c._id);
        }

        // 获取符合条件的学生
        const students = await User.find({ ...await roster.rosterFilter(scopeIds), role: 'student' }).select('_id name classId');
        const studentIds = students.map(s => s._id);
        const studentMap = new Map(students.map(s => [s._id.toString(), s]));

        // 3. 构建练习记录查询条件
        let sessionFilter = {
            studentId: { $in: studentIds },
            status: 'COMPLETED',
            ...FREE_MODE
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

        // 5. 补充学生和班级信息（标注学生所在的行政班）
        const classMap = await roster.classMapOf(students.map(s => s.classId));

        const enrichedRecords = records.map(r => {
            const student = studentMap.get(r.studentId.toString());
            const cls = student && student.classId ? classMap.get(student.classId.toString()) : null;
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

        // 2. 构建学生筛选条件（教学班按成员）
        let scopeIds = teacherClassIds;

        if (classId) {
            if (!teacherClassIds.some(id => id.toString() === classId)) {
                return res.status(403).json({ success: false, message: '无权访问该班级' });
            }
            scopeIds = [classId];
        }

        if (grade) {
            scopeIds = teacherClasses.filter(c => c.grade === parseInt(grade)).map(c => c._id);
        }

        const students = await User.find({ ...await roster.rosterFilter(scopeIds), role: 'student' }).select('_id name classId');
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
                    ...FREE_MODE,
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
        const classMap = await roster.classMapOf(students.map(s => s.classId));

        const leaderboard = leaderboardData.map((item, index) => {
            const student = studentMap.get(item._id.toString());
            const cls = student && student.classId ? classMap.get(student.classId.toString()) : null;
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

// 获取错题本 (Student)
exports.getWrongQuestions = async (req, res) => {
    try {
        const list = await wrongQuestionService.getWrongBook(req.user.id);
        res.json({
            success: true,
            data: {
                list,
                activeCount: list.filter(i => !i.mastered).length,
                masteredCount: list.filter(i => i.mastered).length,
                retryableCount: list.filter(i => !i.mastered && i.canRetry).length
            }
        });
    } catch (error) {
        logger.error('获取错题本失败', { error: error.message, studentId: req.user.id });
        res.status(500).json({ success: false, message: '获取错题本失败' });
    }
};

// 开始错题重练 (Student)：抽取最近答错且未掌握的题目，不计积分
exports.startWrongRetry = async (req, res) => {
    try {
        const studentId = req.user.id;
        const user = await User.findById(studentId).select('classId sessionClassId');
        if (!user?.classId) {
            return res.status(403).json({ success: false, message: '未分配班级，无法进行练习' });
        }
        // 老师关闭自由练习时，错题重练一并关闭（错题本仍可查看）
        const classObj = await Class.findById(roster.contextClassId(user)).select('freePracticeSettings');
        if (classObj?.freePracticeSettings?.isEnabled === false) {
            return res.status(403).json({ success: false, message: '当前班级未开启自由练习，暂不能错题重练' });
        }

        const questions = await wrongQuestionService.pickRetryQuestions(studentId, WRONG_RETRY_COUNT);
        if (questions.length === 0) {
            return res.status(404).json({ success: false, message: '没有可以重练的错题' });
        }

        return createSession(res, {
            studentId,
            questions,
            pointsPerQuestion: 0,
            timeLimit: questions.length * WRONG_RETRY_SECONDS_PER_QUESTION,
            mode: 'wrong_retry'
        });
    } catch (error) {
        logger.error('开始错题重练失败', { error: error.message, studentId: req.user.id });
        res.status(500).json({ success: false, message: '开始错题重练失败' });
    }
};

// 班级高频错题 (Teacher)：?days=7|30（默认全部）&source=all|quiz|practice
exports.getClassWrongQuestions = async (req, res) => {
    try {
        const { classId } = req.params;
        if (!mongoose.isValidObjectId(classId)) {
            return res.status(400).json({ success: false, message: '班级编号无效' });
        }
        const classQuery = req.user.role === 'admin' ? { _id: classId } : { _id: classId, teacher: req.user.id };
        const classObj = await Class.findOne(classQuery).select('_id');
        if (!classObj) {
            return res.status(404).json({ success: false, message: '未找到该班级或无权查看' });
        }

        const days = parseInt(req.query.days, 10);
        const since = days > 0 ? new Date(Date.now() - days * 24 * 3600 * 1000) : undefined;
        const source = ['quiz', 'practice'].includes(req.query.source) ? req.query.source : 'all';

        const students = await roster.findRoster(classId, { select: '_id name username' });
        const nameMap = new Map(students.map(s => [String(s._id), s.name || s.username]));
        const items = await wrongQuestionService.getClassWrongStats(students.map(s => s._id), { since, source });

        res.json({
            success: true,
            data: {
                studentCount: students.length,
                list: items.slice(0, 100).map(({ unmasteredStudentIds, ...item }) => ({
                    ...item,
                    unmasteredStudents: unmasteredStudentIds.map(id => nameMap.get(id)).filter(Boolean)
                }))
            }
        });
    } catch (error) {
        logger.error('获取班级高频错题失败', { error: error.message, classId: req.params.classId });
        res.status(500).json({ success: false, message: '获取班级高频错题失败' });
    }
};
