/**
 * 把各游戏的存档（GameSave.data）整理成学生能看懂的进度摘要。
 * 返回 { text, percent } 或 null（没有可显示的进度）。
 */
const summarizers = {
  sokoban(data) {
    if (!data || typeof data !== 'object') return null;
    const total = 100;
    const cleared = data.best && typeof data.best === 'object' ? Object.keys(data.best).length : 0;
    const level = Math.min(total, Math.max(0, parseInt(data.level, 10) || 0) + 1);
    if (!cleared && level <= 1) return null;
    return { text: `已通关 ${cleared} 关，当前第 ${level} 关`, percent: Math.round(cleared / total * 100) };
  },

  // 坦克大战：存档键为 "Tank Wars" + "Level_Stars_<关卡号>"，值为该关星数
  memory(data) {
    const ls = data && data.ls;
    if (!ls || typeof ls !== 'object') return null;
    const total = 120;
    let cleared = 0, stars = 0;
    for (const [k, v] of Object.entries(ls)) {
      const m = /^Tank WarsLevel_Stars_\d+$/.exec(k);
      const n = m && Number(v);
      if (n > 0) { cleared++; stars += n; }
    }
    if (!cleared) return Object.keys(ls).length ? { text: '已有存档', percent: 0 } : null;
    return { text: `已通关 ${cleared} 关，共 ${stars} 颗星`, percent: Math.min(100, Math.round(cleared / total * 100)) };
  }
};

// 以 localStorage 键值同步的游戏（见 gameAccess.GAME_STORAGE）
const lsOf = (data) => (data && typeof data.ls === 'object' && data.ls) || {};
const num = (v) => Number(v) || 0;
const bestScore = (key, label = '最高分') => (data) => {
  const n = num(lsOf(data)[key]);
  return n > 0 ? { text: `${label} ${n}`, percent: null } : null;
};
Object.assign(summarizers, {
  '2048': bestScore('bestScore2048'),
  snake: bestScore('snakeHighScore'),
  ztype: bestScore('highscore'),
  binary: bestScore('binary_best'),
  linkup: bestScore('linkup_best'),
  // 华容道：klotski_best_<关> 为该关最少步数，共 5 关
  klotski(data) {
    const total = 5;
    const cleared = Object.keys(lsOf(data)).filter(k => /^klotski_best_\d+$/.test(k) && num(lsOf(data)[k]) > 0).length;
    return cleared ? { text: `已通关 ${cleared}/${total} 关`, percent: Math.min(100, Math.round(cleared / total * 100)) } : null;
  },
  // 机器人编程：robot_done 为已完成关卡下标数组，共 8 关
  robot(data) {
    const total = 8;
    let done = [];
    try { done = JSON.parse(lsOf(data).robot_done || '[]'); } catch { /* 忽略 */ }
    const cleared = Array.isArray(done) ? new Set(done).size : 0;
    return cleared ? { text: `已完成 ${cleared}/${total} 关`, percent: Math.min(100, Math.round(cleared / total * 100)) } : null;
  },
  // 扫雷：minesweeper_best_<难度> 为该难度最快用时（秒）
  minesweeper(data) {
    const ls = lsOf(data);
    const parts = [['easy', '初级'], ['medium', '中级'], ['hard', '高级']]
      .map(([key, label]) => {
        const n = num(ls[`minesweeper_best_${key}`]);
        return n > 0 ? `${label} ${n} 秒` : null;
      })
      .filter(Boolean);
    return parts.length ? { text: `最快 ${parts.join('，')}`, percent: null } : null;
  }
});

function summarize(gameId, data) {
  const fn = summarizers[gameId];
  try { return fn ? fn(data) : null; } catch { return null; }
}

module.exports = { summarize };
