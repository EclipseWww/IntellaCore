/**
 * 批阅相关API
 * 用于作业批阅功能的接口调用
 */
import api from './api';

/**
 * 获取Excel文件数据，用于SpreadsheetEditor显示
 * @param {string} submissionId - 提交ID
 * @returns {Promise} Excel数据
 */
export const getExcelData = async (submissionId) => {
    const token = localStorage.getItem('token');
    const response = await api.get(`/submissions/${submissionId}/excel-data?token=${token}`);
    return response.data;
};

/**
 * 批阅作业
 * @param {string} submissionId - 提交ID
 * @param {object} gradeData - 评分数据 { grade: { score, feedback } }
 * @returns {Promise}
 */
export const gradeSubmission = async (submissionId, gradeData) => {
    const response = await api.post(`/submissions/${submissionId}/grade`, gradeData);
    return response.data;
};

/**
 * PPT自动批阅
 * @param {string} submissionId - 提交ID
 * @returns {Promise}
 */
export const autoGradePptSubmission = async (submissionId) => {
    const response = await api.post(`/submissions/${submissionId}/ppt-auto-grade`);
    return response.data;
};

export const autoGradeExcelSubmission = async (id) => (await api.post(`/submissions/${id}/excel-auto-grade`)).data;

export const getOfficeGradingReports = async id => (await api.get(`/submissions/${id}/office-grading-reports`)).data;

export const reviewAPI = {
    getOfficeGradingReports,
    autoGradeExcelSubmission,
    getExcelData,
    gradeSubmission,
    autoGradePptSubmission,
};

export default reviewAPI;
