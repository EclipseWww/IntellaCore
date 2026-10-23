/**
 * 邮件系统 API
 * 
 * 从独立的 axios 实例改为使用共享的 api 客户端
 */

import api from './api';

// API 基础 URL（仅用于构建附件下载链接）
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 邮件 API 基础路径
const EMAIL_BASE = '/email';

// 获取邮件系统状态
export const getSystemStatus = async () => {
    const response = await api.get(`${EMAIL_BASE}/status`);
    return response.data;
};

// 设置邮件系统开关（教师/管理员）
export const setSystemStatus = async (enabled) => {
    const response = await api.put(`${EMAIL_BASE}/status`, { enabled });
    return response.data;
};

// 设置命令行模式开关（教师/管理员）
export const setTerminalMode = async (enabled) => {
    const response = await api.put(`${EMAIL_BASE}/terminal-mode`, { enabled });
    return response.data;
};

// 注册邮箱
export const register = async (username, password, signature = '') => {
    const response = await api.post(`${EMAIL_BASE}/register`, { username, password, signature });
    return response.data;
};

// 获取账号信息
export const getAccount = async () => {
    const response = await api.get(`${EMAIL_BASE}/account`);
    return response.data;
};

// 更新签名
export const updateSignature = async (signature) => {
    const response = await api.put(`${EMAIL_BASE}/signature`, { signature });
    return response.data;
};

// 搜索邮箱（自动完成）
export const searchAccounts = async (query) => {
    const response = await api.get(`${EMAIL_BASE}/search`, { params: { q: query } });
    return response.data;
};

// 搜索邮件内容
export const searchEmails = async (query, page = 1, limit = 20) => {
    const response = await api.get(`${EMAIL_BASE}/search-emails`, { params: { q: query, page, limit } });
    return response.data;
};

// 保存草稿
export const saveDraft = async (draftData) => {
    const response = await api.post(`${EMAIL_BASE}/draft`, draftData);
    return response.data;
};

// 附件管理
export const getAttachmentStats = async () => {
    const response = await api.get(`${EMAIL_BASE}/attachments/stats`);
    return response.data;
};

export const clearAttachments = async (type) => {
    const response = await api.post(`${EMAIL_BASE}/attachments/clear`, { type });
    return response.data;
};

// 发送邮件
export const sendEmail = async (emailData, attachments = []) => {
    const formData = new FormData();
    formData.append('to', Array.isArray(emailData.to) ? emailData.to.join(',') : emailData.to);
    if (emailData.cc) {
        formData.append('cc', Array.isArray(emailData.cc) ? emailData.cc.join(',') : emailData.cc);
    }
    formData.append('subject', emailData.subject);
    formData.append('content', emailData.content);

    // 添加附件
    attachments.forEach((file) => {
        formData.append('attachments', file);
    });

    const response = await api.post(`${EMAIL_BASE}/send`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

// 获取邮件列表
export const getEmails = async (folder = 'inbox', page = 1, limit = 20) => {
    const response = await api.get(`${EMAIL_BASE}/list`, { params: { folder, page, limit } });
    return response.data;
};

// 获取邮件详情
export const getEmailById = async (id) => {
    const response = await api.get(`${EMAIL_BASE}/${id}`);
    return response.data;
};

// 标记已读/未读
export const markReadStatus = async (id, isRead) => {
    const response = await api.put(`${EMAIL_BASE}/${id}/read`, { isRead });
    return response.data;
};

// 标星/取消标星
export const toggleStar = async (id) => {
    const response = await api.put(`${EMAIL_BASE}/${id}/star`);
    return response.data;
};

// 删除邮件
export const deleteEmail = async (id) => {
    const response = await api.delete(`${EMAIL_BASE}/${id}`);
    return response.data;
};

// 获取未读数量
export const getUnreadCount = async () => {
    const response = await api.get(`${EMAIL_BASE}/unread-count`);
    return response.data;
};

// 下载附件URL
export const getAttachmentUrl = (filename) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/email/attachment/${filename}?token=${token}`;
};

// 获取同班同学邮箱列表
export const getClassmates = async () => {
    const response = await api.get(`${EMAIL_BASE}/classmates`);
    return response.data;
};

// 获取班级列表（教师群发用）
export const getTeacherClasses = async () => {
    const response = await api.get(`${EMAIL_BASE}/classes`);
    return response.data;
};

// 教师群发邮件
export const sendBroadcast = async (classId, subject, content, attachments = []) => {
    const formData = new FormData();
    formData.append('classId', classId);
    formData.append('subject', subject);
    formData.append('content', content);

    attachments.forEach((file) => {
        formData.append('attachments', file);
    });

    const response = await api.post(`${EMAIL_BASE}/broadcast`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

// ========== 联系人 ==========

// 获取联系人列表
export const getContacts = async () => {
    const response = await api.get(`${EMAIL_BASE}/contacts`);
    return response.data;
};

// 添加联系人
export const addContact = async (contactData) => {
    const response = await api.post(`${EMAIL_BASE}/contacts`, contactData);
    return response.data;
};

// 删除联系人
export const deleteContact = async (id) => {
    const response = await api.delete(`${EMAIL_BASE}/contacts/${id}`);
    return response.data;
};

// ========== 模板 ==========

// 获取模板列表
export const getTemplates = async () => {
    const response = await api.get(`${EMAIL_BASE}/templates`);
    return response.data;
};

// 创建模板
export const createTemplate = async (templateData) => {
    const response = await api.post(`${EMAIL_BASE}/templates`, templateData);
    return response.data;
};

// 删除模板
export const deleteTemplate = async (id) => {
    const response = await api.delete(`${EMAIL_BASE}/templates/${id}`);
    return response.data;
};

export default {
    getSystemStatus,
    setSystemStatus,
    setTerminalMode,
    register,
    getAccount,
    updateSignature,
    searchAccounts,
    searchEmails,
    saveDraft,
    getAttachmentStats,
    clearAttachments,
    sendEmail,
    getEmails,
    getEmailById,
    markReadStatus,
    toggleStar,
    deleteEmail,
    getUnreadCount,
    getAttachmentUrl,
    getClassmates,
    getTeacherClasses,
    sendBroadcast,
    getContacts,
    addContact,
    deleteContact,
    getTemplates,
    createTemplate,
    deleteTemplate
};
