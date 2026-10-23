import api from './api';

// 获取所有积分商店商品
export const getShopItems = async () => {
  try {
    const response = await api.get('/point-shop/items');
    return response.data;
  } catch (error) {
    console.error('获取积分商店商品失败:', error);
    throw error;
  }
};

// 获取单个商品详情
export const getShopItem = async (itemId) => {
  try {
    const response = await api.get(`/point-shop/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('获取商品详情失败:', error);
    throw error;
  }
};

// 兑换商品
export const redeemItem = async (itemId) => {
  try {
    const response = await api.post(`/point-shop/items/${itemId}/redeem`);
    return response.data;
  } catch (error) {
    console.error('兑换商品失败:', error);
    throw error;
  }
};

// 获取学生兑换记录
export const getRedemptionRecords = async () => {
  try {
    const response = await api.get('/point-shop/redemptions');
    return response.data;
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    throw error;
  }
};

// 使用网络时间
export const useNetworkTime = async (recordId) => {
  try {
    const response = await api.post(`/point-shop/redemptions/${recordId}/use-network-time`);
    return response.data;
  } catch (error) {
    console.error('使用网络时间失败:', error);
    throw error;
  }
};

// 更新游戏记录状态
export const updateGameRecord = async (recordId) => {
  try {
    const response = await api.post(`/point-shop/redemptions/${recordId}/use-game`);
    return response.data;
  } catch (error) {
    console.error('更新游戏记录失败:', error);
    throw error;
  }
};

// 管理员接口 - 创建商品
export const createShopItem = async (itemData) => {
  try {
    const response = await api.post('/point-shop/admin/items', itemData);
    return response.data;
  } catch (error) {
    console.error('创建商品失败:', error);
    throw error;
  }
};

// 管理员接口 - 更新商品
export const updateShopItem = async (itemId, itemData) => {
  try {
    const response = await api.put(`/point-shop/admin/items/${itemId}`, itemData);
    return response.data;
  } catch (error) {
    console.error('更新商品失败:', error);
    throw error;
  }
};

// 管理员接口 - 删除商品
export const deleteShopItem = async (itemId) => {
  try {
    const response = await api.delete(`/point-shop/admin/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('删除商品失败:', error);
    throw error;
  }
};

// 管理员接口 - 获取所有学生兑换记录
export const getAllStudentRedemptions = async (params = {}) => {
  try {
    const response = await api.get('/point-shop/admin/student-redemptions', { params });
    return response.data;
  } catch (error) {
    console.error('获取学生兑换记录失败:', error);
    throw error;
  }
};

// 管理员接口 - 获取学生积分余额
export const getStudentsPointBalance = async (params = {}) => {
  try {
    const response = await api.get('/achievements/admin/student-points', { params });
    return response.data;
  } catch (error) {
    console.error('获取学生积分余额失败:', error);
    throw error;
  }
}; 