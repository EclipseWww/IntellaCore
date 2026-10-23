import api from './api';

// 积分事件发布-订阅系统
const pointsEventListeners = [];

/**
 * 发布积分变化事件
 * @param {number} newPoints - 新的积分总额
 */
export const notifyPointsChange = (newPoints) => {
  pointsEventListeners.forEach(listener => listener(newPoints));
};

/**
 * 订阅积分变化事件
 * @param {Function} listener - 监听函数，接收新的积分总额
 * @returns {Function} 取消订阅的函数
 */
export const subscribeToPointsChange = (listener) => {
  pointsEventListeners.push(listener);
  
  // 返回取消订阅的函数
  return () => {
    const index = pointsEventListeners.indexOf(listener);
    if (index > -1) {
      pointsEventListeners.splice(index, 1);
    }
  };
};

/**
 * 获取学生当前积分余额
 * @returns {Promise<Object>} 包含 totalPoints 和 level 的对象
 */
export const getPointBalance = async () => {
  try {
    const response = await api.get('/achievements/points/balance');
    return response.data;
  } catch (error) {
    console.error('获取积分余额失败:', error);
    throw error;
  }
};

/**
 * 刷新积分并通知所有监听器
 * @returns {Promise<number>} 当前积分总额
 */
export const refreshPointBalance = async () => {
  try {
    const response = await getPointBalance();
    if (response.success) {
      notifyPointsChange(response.totalPoints);
      return response.totalPoints;
    }
    return null;
  } catch (error) {
    console.error('刷新积分失败:', error);
    return null;
  }
};

/**
 * 获取积分交易记录
 * @param {Object} params - 查询参数
 * @param {number} params.limit - 每页记录数
 * @param {number} params.skip - 跳过记录数
 * @returns {Promise<Object>} 包含 transactions 和 totalCount 的对象
 */
export const getPointTransactions = async (params = {}) => {
  try {
    const { limit = 20, skip = 0 } = params;
    const response = await api.get(`/achievements/points/transactions?limit=${limit}&skip=${skip}`);
    return response.data;
  } catch (error) {
    console.error('获取积分交易记录失败:', error);
    throw error;
  }
};

/**
 * 管理员/教师获取特定学生的积分交易记录
 * @param {string} studentId - 学生ID
 * @param {Object} params - 查询参数
 * @param {number} params.limit - 每页记录数
 * @param {number} params.skip - 跳过记录数
 * @returns {Promise<Object>} 包含 transactions 和 totalCount 的对象
 */
export const getStudentPointTransactions = async (studentId, params = {}) => {
  try {
    const { limit = 20, skip = 0 } = params;
    const response = await api.get(`/achievements/admin/student/${studentId}/transactions?limit=${limit}&skip=${skip}`);
    return response.data;
  } catch (error) {
    console.error('获取学生积分交易记录失败:', error);
    throw error;
  }
};

/**
 * 管理员/教师添加或减少学生积分
 * @param {string} studentId - 学生ID
 * @param {number} amount - 积分数量（正数增加，负数减少）
 * @param {string} reason - 原因描述
 * @returns {Promise<Object>} 包含操作结果的对象
 */
export const addStudentPoints = async (studentId, amount, reason) => {
  try {
    const response = await api.post('/achievements/points/add', {
      studentId,
      amount,
      reason
    });
    return response.data;
  } catch (error) {
    console.error('添加/减少学生积分失败:', error);
    throw error;
  }
}; 