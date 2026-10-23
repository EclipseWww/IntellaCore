/**
 * 测验和题目相关 API
 * 
 * 包含：
 * - 题目管理（创建、获取、更新、删除、AI解析、版本控制）
 * - 测验管理（创建、获取、更新、删除、发布、复制）
 * - 答题管理（提交、查询、导出）
 * - 测验分析
 */

import api from './api';

// ========== 题目管理 ==========

// 创建题目
export const createQuestion = async (questionData) => {
    const response = await api.post('/quiz/questions', questionData);
    return response.data;
};

// 获取题目列表
export const getQuestions = async (params = {}) => {
    const response = await api.get('/quiz/questions', { params });
    return response.data;
};

// 获取单个题目
export const getQuestionById = async (questionId) => {
    const response = await api.get(`/quiz/questions/${questionId}`);
    return response.data;
};

// 更新题目
export const updateQuestion = async (questionId, questionData) => {
    const response = await api.put(`/quiz/questions/${questionId}`, questionData);
    return response.data;
};

// 删除题目
export const deleteQuestion = async (questionId) => {
    const response = await api.delete(`/quiz/questions/${questionId}`);
    return response.data;
};

// AI 解析题目
export const parseQuestionWithAI = async (text, type, defaultTags = []) => {
    try {
        const response = await api.post('/quiz/questions/ai/parse', { text, type, defaultTags });
        return response.data;
    } catch (error) {
        console.error('AI 解析题目失败:', error);
        throw error;
    }
};

// 上传题目媒体
export const uploadQuestionMedia = async (formData) => {
    try {
        const response = await api.post('/quiz/media/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('上传题目媒体失败:', error);
        throw error;
    }
};

// 获取题目引用信息（被多少测验使用）
export const getQuestionReferences = async (questionId) => {
    try {
        const response = await api.get(`/quiz/questions/${questionId}/references`);
        return response.data;
    } catch (error) {
        console.error('获取题目引用信息失败:', error);
        throw error;
    }
};

// 获取题目版本历史
export const getQuestionVersionHistory = async (questionId) => {
    try {
        const response = await api.get(`/quiz/questions/${questionId}/versions`);
        return response.data;
    } catch (error) {
        console.error('获取题目版本历史失败:', error);
        throw error;
    }
};

// ========== 测验管理 ==========

// 创建测验
export const createQuiz = async (quizData) => {
    const response = await api.post('/quiz/quizzes', quizData);
    return response.data;
};

// 获取未完成测验
export const getPendingQuizzes = async () => {
    const response = await api.get('/quiz/pending');
    return response.data;
};

// 获取测验列表
export const getQuizzes = async (params = {}) => {
    const response = await api.get('/quiz/quizzes', { params });
    return response.data;
};

// 获取单个测验
export const getQuizById = async (quizId) => {
    const response = await api.get(`/quiz/quizzes/${quizId}`);
    return response.data;
};

// 更新测验
export const updateQuiz = async (quizId, quizData) => {
    const response = await api.put(`/quiz/quizzes/${quizId}`, quizData);
    return response.data;
};

// 删除测验
export const deleteQuiz = async (quizId) => {
    const response = await api.delete(`/quiz/quizzes/${quizId}`);
    return response.data;
};

// 发布测验
export const publishQuiz = async (quizId) => {
    const response = await api.put(`/quiz/quizzes/${quizId}/publish`);
    return response.data;
};

// 复制测验
export const duplicateQuiz = async (quizId) => {
    const response = await api.post(`/quiz/quizzes/${quizId}/duplicate`);
    return response.data;
};

// 添加题目到测验
export const addQuestionsToQuiz = async (quizId, questions) => {
    const response = await api.post(`/quiz/quizzes/${quizId}/questions`, { questions });
    return response.data;
};

// 更新题目顺序
export const updateQuizQuestionsOrder = async (quizId, questions) => {
    const response = await api.put(`/quiz/quizzes/${quizId}/questions`, { questions });
    return response.data;
};

// 从测验中移除题目
export const removeQuestionFromQuiz = async (quizId, questionId) => {
    const response = await api.delete(`/quiz/quizzes/${quizId}/questions/${questionId}`);
    return response.data;
};

// ========== 答题管理 ==========

// 提交测验（包含所有答案）
export const submitQuiz = async (data) => {
    const response = await api.post('/quiz/submissions/submit', data);
    return response.data;
};

// 获取答题记录
export const getSubmissionById = async (submissionId) => {
    const response = await api.get(`/quiz/submissions/${submissionId}`);
    return response.data;
};

// 获取测验的所有提交记录
export const getSubmissionsByQuiz = async (quizId) => {
    const response = await api.get(`/quiz/quizzes/${quizId}/submissions`);
    return response.data;
};

// 获取班级测验提交记录
export const getClassSubmissions = async (classId, quizId = null) => {
    let url = `/quiz/class/${classId}/submissions`;
    if (quizId) {
        url = `/quiz/class/${classId}/quiz/${quizId}/submissions`;
    }
    const response = await api.get(url);
    return response.data;
};

// 删除提交记录
export const deleteSubmission = async (submissionId) => {
    const response = await api.delete(`/quiz/submissions/${submissionId}`);
    return response.data;
};

// 导出测验提交记录到Excel
export const exportSubmissionsToExcel = async (quizId, classId = null) => {
    const params = classId ? { classId } : {};
    const response = await api.get(`/quiz/quizzes/${quizId}/submissions/export`, {
        params,
        responseType: 'blob'
    });
    return response.data;
};

// ========== 分析 ==========

// 获取测验分析数据
export const getQuizAnalytics = async (quizId, classId = null, refresh = undefined) => {
    try {
        const params = {};
        if (classId) params.classId = classId;
        if (refresh !== undefined) params.refresh = refresh;
        const response = await api.get(`/analytics/quizzes/${quizId}`, { params });
        return response.data;
    } catch (error) {
        console.error('获取测验分析数据失败:', error);
        throw error;
    }
};

// 获取问题分析数据
export const getQuestionAnalytics = async (questionId) => {
    try {
        const response = await api.get(`/analytics/questions/${questionId}`);
        return response.data;
    } catch (error) {
        console.error('获取问题分析数据失败:', error);
        throw error;
    }
};

// 获取心理量表分析数据
export const getScaleAnalytics = async (quizId) => {
    try {
        const response = await api.get(`/analytics/scales/${quizId}`);
        return response.data;
    } catch (error) {
        console.error('获取心理量表分析数据失败:', error);
        throw error;
    }
};

// ========== 题目分析 ==========

// 获取所有题目的分析数据列表
export const getAllQuestionsAnalytics = async (params = {}) => {
    try {
        const response = await api.get('/question-analytics/questions', { params });
        return response.data;
    } catch (error) {
        console.error('获取题目分析列表失败:', error);
        throw error;
    }
};

// 获取单个题目的详细分析数据
export const getQuestionDetailAnalytics = async (questionId) => {
    try {
        const response = await api.get(`/question-analytics/questions/${questionId}`);
        return response.data;
    } catch (error) {
        console.error('获取题目分析数据失败:', error);
        return { success: false };
    }
};

// ========== 兼容旧版 API 结构（保持向后兼容） ==========

export const quizAPI = {
    questions: {
        create: createQuestion,
        getList: getQuestions,
        getById: getQuestionById,
        update: updateQuestion,
        delete: deleteQuestion,
        parseWithAI: parseQuestionWithAI,
        uploadMedia: uploadQuestionMedia,
        getReferences: getQuestionReferences,
        getVersionHistory: getQuestionVersionHistory
    },
    quizzes: {
        create: createQuiz,
        getList: getQuizzes,
        getById: getQuizById,
        update: updateQuiz,
        delete: deleteQuiz,
        publish: publishQuiz,
        duplicate: duplicateQuiz,
        questions: {
            add: addQuestionsToQuiz,
            updateOrder: updateQuizQuestionsOrder,
            remove: removeQuestionFromQuiz
        }
    },
    submissions: {
        // 开始答题（创建或恢复进度）
        start: async (data) => {
            const response = await api.post('/quiz/submissions/start', data);
            return response.data;
        },
        // 保存答题进度
        saveProgress: async (submissionId, answers) => {
            const response = await api.put(`/quiz/submissions/${submissionId}/progress`, { answers });
            return response.data;
        },
        // 获取进行中的答题
        getInProgress: async (quizId, activityId = null) => {
            const params = activityId ? { activityId } : {};
            const response = await api.get(`/quiz/quizzes/${quizId}/in-progress`, { params });
            return response.data;
        },
        submit: submitQuiz,
        getById: getSubmissionById,
        getByQuiz: getSubmissionsByQuiz,
        getClassSubmissions: getClassSubmissions,
        delete: deleteSubmission,
        exportToExcel: exportSubmissionsToExcel
    },
    analytics: {
        getQuizAnalytics,
        getQuestionAnalytics,
        getScaleAnalytics
    },
    // 自由练习
    freePractice: {
        start: async () => {
            const response = await api.post('/quiz/free-practice/start');
            return response.data;
        },
        submit: async (sessionId, answers) => {
            const response = await api.post('/quiz/free-practice/submit', { sessionId, answers });
            return response.data;
        },
        getHistory: async (page = 1) => {
            const response = await api.get(`/quiz/free-practice/history?page=${page}`);
            return response.data;
        },
        getDetails: async (sessionId) => {
            const response = await api.get(`/quiz/free-practice/details/${sessionId}`);
            return response.data;
        },
        // 教师端接口
        getSettings: async (classId) => {
            const response = await api.get(`/quiz/free-practice/class/${classId}/settings`);
            return response.data;
        },
        updateSettings: async (classId, settings) => {
            const response = await api.put(`/quiz/free-practice/class/${classId}/settings`, settings);
            return response.data;
        },
        bulkUpdateSettings: async (classIds, settings) => {
            const response = await api.put('/quiz/free-practice/class/settings/bulk', { classIds, settings });
            return response.data;
        },
        // 教师端：获取学生练习记录
        getStudentRecords: async (params = {}) => {
            const response = await api.get('/quiz/free-practice/records', { params });
            return response.data;
        },
        // 教师端：获取排行榜
        getLeaderboard: async (params = {}) => {
            const response = await api.get('/quiz/free-practice/leaderboard', { params });
            return response.data;
        }
    }
};

export const questionAnalyticsAPI = {
    getAllQuestionsAnalytics,
    getQuestionAnalytics: getQuestionDetailAnalytics
};

export default {
    // 题目管理
    createQuestion,
    getQuestions,
    getQuestionById,
    updateQuestion,
    deleteQuestion,
    parseQuestionWithAI,
    uploadQuestionMedia,
    getQuestionReferences,
    getQuestionVersionHistory,
    // 测验管理
    createQuiz,
    getPendingQuizzes,
    getQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    publishQuiz,
    duplicateQuiz,
    addQuestionsToQuiz,
    updateQuizQuestionsOrder,
    removeQuestionFromQuiz,
    // 答题管理
    submitQuiz,
    getSubmissionById,
    getSubmissionsByQuiz,
    getClassSubmissions,
    deleteSubmission,
    exportSubmissionsToExcel,
    // 分析
    getQuizAnalytics,
    getQuestionAnalytics,
    getScaleAnalytics,
    getAllQuestionsAnalytics,
    getQuestionDetailAnalytics,
    // 兼容旧版结构
    quizAPI,
    questionAnalyticsAPI,
    // 自由练习
    freePractice: quizAPI.freePractice
};
