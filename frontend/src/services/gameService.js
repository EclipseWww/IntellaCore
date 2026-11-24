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
  },

  // 开始游戏：服务器签发游戏票（Cookie），返回游戏地址
  async openSession(gameId) {
    const { data } = await api.post('/games/session', { gameId });
    return data; // { success, url }
  },

  // 心跳：计时并续期游戏票
  async heartbeat() {
    const { data } = await api.post('/games/session/heartbeat');
    return data;
  },

  // 关闭游戏：收回游戏票
  async closeSession() {
    const { data } = await api.delete('/games/session');
    return data;
  },

  // 页面关闭时尽力通知服务器（普通请求可能来不及发出）
  closeSessionOnUnload() {
    try {
      fetch('/api/games/session', {
        method: 'DELETE', keepalive: true,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (e) { /* 忽略 */ }
  },

  // 热度榜
  async getStats() {
    const { data } = await api.get('/games/stats');
    return data; // { success, data: [{ gameId, totalSeconds, sessions, playerCount }] }
  },

  // 当前用户在各游戏里的进度摘要
  async getProgress() {
    const { data } = await api.get('/games/progress');
    return data; // { success, data: { [gameId]: { text, percent, updatedAt } } }
  },

  // 教师：设置对自己班级关闭的游戏
  async setDisabled(disabled) {
    const { data } = await api.put('/games/disabled', { disabled });
    return data;
  },

  coverUrl: (gameId) => `/api/games/cover/${gameId}`
};

/** 从旧的 /games/<id>/index.html 形式地址中取出游戏目录名 */
export const gameIdFromUrl = (url) => {
  const m = /\/games\/([a-z0-9_-]+)\//i.exec(url || '');
  return m ? m[1] : null;
};

export default gameService;








