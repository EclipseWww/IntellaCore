/**
 * Python编程活动相关API
 * 独立模块，用于Python编程活动的学生端和教师端功能
 */
import api from './api';

/**
 * 获取学生的Python提交记录
 */
export const getSubmission = async (lessonId, activityId) => {
    const response = await api.get(`/python/${lessonId}/${activityId}/submission`);
    return response.data;
};

/**
 * 保存草稿
 */
export const saveDraft = async (lessonId, activityId, code, output = '', turtleGraphics = null) => {
    const response = await api.post(`/python/${lessonId}/${activityId}/save`, {
        code,
        output,
        turtleGraphics
    });
    return response.data;
};

/**
 * 提交代码（支持自动评分和测试结果保存）
 */
export const submit = async (lessonId, activityId, code, output = '', autoScore = null, testResults = null) => {
    const response = await api.post(`/python/${lessonId}/${activityId}/submit`, {
        code,
        output,
        autoScore,
        testResults
    });
    return response.data;
};

/**
 * 撤回提交
 */
export const withdraw = async (lessonId, activityId) => {
    const response = await api.post(`/python/${lessonId}/${activityId}/withdraw`);
    return response.data;
};

// ========== 教师端API ==========

/**
 * 获取活动的所有学生提交记录
 */
export const getActivitySubmissions = async (lessonId, activityId, classId = null) => {
    const params = classId ? { classId } : {};
    const response = await api.get(`/python/${lessonId}/${activityId}/submissions`, { params });
    return response.data;
};

/**
 * 教师评分
 */
export const gradeSubmission = async (submissionId, score, feedback) => {
    const response = await api.post(`/python/grade/${submissionId}`, { score, feedback });
    return response.data;
};

/**
 * 教师删除提交记录
 */
export const deleteSubmission = async (submissionId) => {
    const response = await api.delete(`/python/submissions/${submissionId}`);
    return response.data;
};

// 导出为对象形式，便于统一引用
export const pythonAPI = {
    // 学生端
    getSubmission,
    saveDraft,
    submit,
    withdraw,
    // 教师端
    getActivitySubmissions,
    gradeSubmission,
    deleteSubmission
};

export default pythonAPI;
