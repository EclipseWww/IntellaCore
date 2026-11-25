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
 * 保存草稿（已提交的作业会另存为“未提交的修改”，不影响已提交版本）
 */
export const saveDraft = async (lessonId, activityId, code, output = '') => {
    const response = await api.post(`/python/${lessonId}/${activityId}/save`, { code, output });
    return response.data;
};

/**
 * 提交代码：由服务器运行全部测试点（含隐藏测试点）并自动评分
 */
export const submit = async (lessonId, activityId, code, output = '') => {
    const response = await api.post(`/python/${lessonId}/${activityId}/submit`, { code, output }, { timeout: 180000 });
    return response.data;
};

/**
 * 撤回提交
 */
export const withdraw = async (lessonId, activityId) => {
    const response = await api.post(`/python/${lessonId}/${activityId}/withdraw`);
    return response.data;
};

/**
 * 学生查看自己的历史提交（最近 30 次，新的在前）
 */
export const getMyAttempts = async (lessonId, activityId) => {
    const response = await api.get(`/python/${lessonId}/${activityId}/attempts`);
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
 * 查看某份提交的历史版本
 */
export const getSubmissionAttempts = async (submissionId) => {
    const response = await api.get(`/python/submissions/${submissionId}/attempts`);
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
    getMyAttempts,
    // 教师端
    getActivitySubmissions,
    getSubmissionAttempts,
    gradeSubmission,
    deleteSubmission
};

export default pythonAPI;
