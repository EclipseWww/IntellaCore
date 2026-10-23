import api from './api';

// 获取众筹活动列表
export const getCrowdfundingList = async (params = {}) => {
  try {
    const response = await api.get('/crowdfunding/list', { params });
    return response.data;
  } catch (error) {
    console.error('获取众筹活动列表失败:', error);
    throw error;
  }
};

// 获取众筹活动详情
export const getCrowdfundingDetail = async (id) => {
  try {
    const response = await api.get(`/crowdfunding/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取众筹活动详情失败:', error);
    throw error;
  }
};

// 参与众筹活动
export const contributeToCrowdfunding = async (id, data) => {
  try {
    const response = await api.post(`/crowdfunding/${id}/contribute`, data);
    return response.data;
  } catch (error) {
    console.error('参与众筹活动失败:', error);
    throw error;
  }
};

// 获取我参与的众筹活动
export const getMyParticipations = async () => {
  try {
    const response = await api.get('/crowdfunding/my/participations');
    return response.data;
  } catch (error) {
    console.error('获取我参与的众筹记录失败:', error);
    throw error;
  }
};

// 管理员方法 - 创建众筹活动
export const createCrowdfunding = async (data) => {
  try {
    const response = await api.post('/crowdfunding/create', data);
    return response.data;
  } catch (error) {
    console.error('创建众筹活动失败:', error);
    throw error;
  }
};

// 管理员方法 - 批量创建众筹活动
export const batchCreateCrowdfunding = async (data) => {
  try {
    const response = await api.post('/crowdfunding/batch-create', data);
    return response.data;
  } catch (error) {
    console.error('批量创建众筹活动失败:', error);
    throw error;
  }
};

// 管理员方法 - 更新众筹活动
export const updateCrowdfunding = async (id, data) => {
  try {
    const response = await api.put(`/crowdfunding/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('更新众筹活动失败:', error);
    throw error;
  }
};

// 管理员方法 - 激活众筹活动
export const activateCrowdfunding = async (id) => {
  try {
    const response = await api.put(`/crowdfunding/${id}/activate`);
    return response.data;
  } catch (error) {
    console.error('激活众筹活动失败:', error);
    throw error;
  }
};

// 管理员方法 - 完成众筹活动
export const completeCrowdfunding = async (id) => {
  try {
    const response = await api.put(`/crowdfunding/${id}/complete`);
    return response.data;
  } catch (error) {
    console.error('完成众筹活动失败:', error);
    throw error;
  }
};

// 管理员方法 - 删除众筹活动
export const deleteCrowdfunding = async (id) => {
  try {
    const response = await api.delete(`/crowdfunding/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除众筹活动失败:', error);
    throw error;
  }
};

// 获取众筹活动贡献记录
export const getCrowdfundingContributions = async (crowdfundingId) => {
  try {
    const response = await api.get(`/crowdfunding/${crowdfundingId}/contributions`);
    return response.data;
  } catch (error) {
    console.error('获取众筹贡献记录失败:', error);
    throw error;
  }
};

// 删除众筹贡献记录
export const deleteCrowdfundingContribution = async (contributionId) => {
  try {
    const response = await api.delete(`/crowdfunding/contribution/${contributionId}`);
    return response.data;
  } catch (error) {
    console.error('删除众筹贡献记录失败:', error);
    throw error;
  }
}; 