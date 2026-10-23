import api from './api';

const gameService = {
  // 获取当前用户的游戏剩余时长（秒）
  async getRemainingTime() {
    const { data } = await api.get('/games/time');
    return data; // { success: true, remainingSeconds }
  },

  // 更新当前用户的游戏剩余时长（秒）
  async updateRemainingTime(remainingSeconds) {
    const { data } = await api.put('/games/time', { remainingSeconds });
    return data; // { success: true }
  }
};

export default gameService;








