/**
 * 题目版本控制服务
 * 
 * 实现 Reference with Versioning 策略：
 * - 支持题目版本管理
 * - 支持归档旧版本
 * - 支持软删除
 * - 支持懒迁移旧数据
 */

const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');

/**
 * 规范化题目数据（懒迁移 - 为旧数据填充默认值）
 * @param {Object} question - 题目文档
 * @returns {Object} 规范化后的题目
 */
function normalizeQuestion(question) {
    if (!question) return null;

    const normalized = question.toObject ? question.toObject() : { ...question };

    // 懒迁移：填充缺失的版本控制字段
    if (normalized.version === undefined || normalized.version === null) {
        normalized.version = 1;
    }
    if (normalized.isArchived === undefined || normalized.isArchived === null) {
        normalized.isArchived = false;
    }
    if (normalized.deletedAt === undefined) {
        normalized.deletedAt = null;
    }

    return normalized;
}

/**
 * 创建题目快照（用于保存到Quiz或QuizSubmission）
 * @param {Object} question - 题目文档
 * @returns {Object} 题目快照
 */
function createQuestionSnapshot(question) {
    const normalized = normalizeQuestion(question);
    if (!normalized) return null;

    return {
        _id: normalized._id,
        title: normalized.title,
        content: normalized.content,
        type: normalized.type,
        options: normalized.options,
        explanation: normalized.explanation,
        difficulty: normalized.difficulty,
        tags: normalized.tags,
        matrixRows: normalized.matrixRows,
        scaleLevel: normalized.scaleLevel,
        scaleLabels: normalized.scaleLabels,
        version: normalized.version,
        createdBy: normalized.createdBy, // 保留创建者信息
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt
    };
}

/**
 * 获取题目的引用信息（被多少测验使用）
 * @param {String} questionId - 题目ID
 * @returns {Object} { quizCount, quizzes, submissionCount }
 */
async function getQuestionReferences(questionId) {
    // 查找使用此题目的测验
    const quizzes = await Quiz.find(
        { 'questions.questionId': questionId },
        { title: 1, status: 1, 'questions.$': 1 }
    ).lean();

    // 查找关联的提交记录数量
    const submissionCount = await QuizSubmission.countDocuments({
        'answers.questionId': questionId,
        status: 'SUBMITTED'
    });

    return {
        quizCount: quizzes.length,
        quizzes: quizzes.map(q => ({
            _id: q._id,
            title: q.title,
            status: q.status
        })),
        submissionCount
    };
}

/**
 * 更新题目（带版本控制）
 * @param {String} questionId - 题目ID
 * @param {Object} updates - 更新内容
 * @param {String} updateMode - 更新模式: 'SYNC_ALL' | 'PROTECT_SUBMITTED' | 'CREATE_NEW'
 * @returns {Object} { question, archivedQuestion?, references }
 */
async function updateQuestionWithVersioning(questionId, updates, updateMode = 'SYNC_ALL') {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new Error('题目不存在');
    }

    // 获取引用信息
    const references = await getQuestionReferences(questionId);

    // 规范化（确保有版本号）
    const currentVersion = question.version ?? 1;

    if (references.quizCount === 0) {
        // 无引用，直接更新
        Object.assign(question, updates);
        question.version = currentVersion; // 保持版本号（首次规范化）
        await question.save();

        return { question, references };
    }

    // 有引用的情况
    switch (updateMode) {
        case 'SYNC_ALL':
            // 同步更新到所有测验（直接更新，版本号+1）
            Object.assign(question, updates);
            question.version = currentVersion + 1;
            await question.save();

            return { question, references };

        case 'PROTECT_SUBMITTED':
            // 保护已提交记录：归档旧版本，更新测验锁定版本
            const archivedQuestion = await archiveQuestion(question);

            // 更新原题目
            Object.assign(question, updates);
            question.version = currentVersion + 1;
            await question.save();

            // 为有提交记录的测验锁定旧版本
            await lockVersionForQuizzesWithSubmissions(questionId, archivedQuestion);

            return { question, archivedQuestion, references };

        case 'CREATE_NEW':
            // 创建为新题目（保持原题目不变）
            const newQuestion = new Question({
                ...updates,
                createdBy: question.createdBy,
                version: 1,
                isArchived: false,
                originalQuestionId: null
            });
            await newQuestion.save();

            return { question: newQuestion, originalQuestion: question, references };

        default:
            throw new Error(`未知的更新模式: ${updateMode}`);
    }
}

/**
 * 归档题目（创建旧版本的副本）
 * @param {Object} question - 原题目
 * @returns {Object} 归档的题目副本
 */
async function archiveQuestion(question) {
    const snapshot = createQuestionSnapshot(question);

    const archivedQuestion = new Question({
        ...snapshot,
        _id: undefined, // 创建新文档
        createdBy: question.createdBy, // 确保包含创建者信息（必填字段）
        isArchived: true,
        originalQuestionId: question._id,
        version: question.version ?? 1
    });

    await archivedQuestion.save();
    return archivedQuestion;
}

/**
 * 为有提交记录的测验锁定题目版本
 * @param {String} questionId - 原题目ID
 * @param {Object} archivedQuestion - 归档的题目
 */
async function lockVersionForQuizzesWithSubmissions(questionId, archivedQuestion) {
    const quizzes = await Quiz.find({ 'questions.questionId': questionId });

    for (const quiz of quizzes) {
        // 检查是否有提交记录
        const hasSubmissions = await QuizSubmission.exists({
            quizId: quiz._id,
            status: 'SUBMITTED'
        });

        if (hasSubmissions) {
            // 锁定版本并保存快照
            const questionIndex = quiz.questions.findIndex(
                q => q.questionId.toString() === questionId.toString()
            );

            if (questionIndex !== -1) {
                quiz.questions[questionIndex].lockedVersion = archivedQuestion.version;
                quiz.questions[questionIndex].questionSnapshot = createQuestionSnapshot(archivedQuestion);
                await quiz.save();
            }
        }
    }
}

/**
 * 软删除题目
 * @param {String} questionId - 题目ID
 * @returns {Object} { success, hasReferences, references }
 */
async function softDeleteQuestion(questionId) {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new Error('题目不存在');
    }

    const references = await getQuestionReferences(questionId);

    if (references.quizCount > 0 || references.submissionCount > 0) {
        // 有引用，执行软删除
        question.deletedAt = new Date();
        await question.save();

        // 为所有引用此题目的测验保存快照
        await saveSnapshotToQuizzes(questionId, question);

        return {
            success: true,
            softDeleted: true,
            references
        };
    } else {
        // 无引用，可以硬删除
        await Question.findByIdAndDelete(questionId);

        return {
            success: true,
            softDeleted: false,
            references
        };
    }
}

/**
 * 为所有使用此题目的测验保存快照
 * @param {String} questionId - 题目ID
 * @param {Object} question - 题目文档
 */
async function saveSnapshotToQuizzes(questionId, question) {
    const snapshot = createQuestionSnapshot(question);

    await Quiz.updateMany(
        { 'questions.questionId': questionId },
        {
            $set: {
                'questions.$[elem].questionSnapshot': snapshot,
                'questions.$[elem].lockedVersion': question.version ?? 1
            }
        },
        { arrayFilters: [{ 'elem.questionId': questionId }] }
    );
}

/**
 * 获取题目（考虑版本和快照）
 * 用于测验展示时获取正确版本的题目
 * @param {Object} quizQuestion - Quiz中的question对象 { questionId, lockedVersion, questionSnapshot }
 * @returns {Object} 题目数据
 */
async function getQuestionForQuiz(quizQuestion) {
    const { questionId, lockedVersion, questionSnapshot } = quizQuestion;

    // 如果有快照，优先使用快照（题目已被删除或锁定版本）
    if (questionSnapshot) {
        return normalizeQuestion(questionSnapshot);
    }

    // 获取题目
    const question = await Question.findById(questionId);

    if (!question) {
        // 题目已被硬删除，返回null
        return null;
    }

    // 如果锁定了版本，尝试获取对应版本
    if (lockedVersion !== null && lockedVersion !== undefined) {
        // 检查是否是归档版本
        const archivedQuestion = await Question.findOne({
            originalQuestionId: questionId,
            version: lockedVersion,
            isArchived: true
        });

        if (archivedQuestion) {
            return normalizeQuestion(archivedQuestion);
        }
    }

    // 返回当前版本
    return normalizeQuestion(question);
}

/**
 * 获取所有活跃题目（排除已归档和已删除）
 * @param {Object} filter - 额外的过滤条件
 * @returns {Array} 题目列表
 */
async function getActiveQuestions(filter = {}) {
    const questions = await Question.find({
        ...filter,
        isArchived: { $ne: true },
        deletedAt: null
    }).lean();

    return questions.map(normalizeQuestion);
}

/**
 * 获取题目的版本历史
 * @param {String} questionId - 原始题目ID
 * @returns {Array} 版本历史
 */
async function getQuestionVersionHistory(questionId) {
    // 获取原始题目
    const originalQuestion = await Question.findById(questionId).lean();

    // 获取所有归档版本
    const archivedVersions = await Question.find({
        originalQuestionId: questionId,
        isArchived: true
    }).sort({ version: -1 }).lean();

    const history = [];

    // 添加当前版本
    if (originalQuestion) {
        history.push({
            ...normalizeQuestion(originalQuestion),
            isCurrent: true
        });
    }

    // 添加历史版本
    archivedVersions.forEach(version => {
        history.push({
            ...normalizeQuestion(version),
            isCurrent: false
        });
    });

    return history;
}

module.exports = {
    normalizeQuestion,
    createQuestionSnapshot,
    getQuestionReferences,
    updateQuestionWithVersioning,
    archiveQuestion,
    softDeleteQuestion,
    getQuestionForQuiz,
    getActiveQuestions,
    getQuestionVersionHistory
};
