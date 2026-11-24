const User = require('../models/User');
const logger = require('../utils/logger');

// 获取当前用户的游戏剩余时长（秒）
// 同时检查学生是否登录满35分钟
const LOGIN_MINUTES_REQUIRED = 35;

/** 班级是否被教师提前开放了游戏中心 */
async function classOpenedEarly(classId) {
  if (!classId) return false;
  const cls = await require('../models/Class').findById(classId).select('gameOpenUntil').lean();
  return !!(cls && cls.gameOpenUntil && new Date(cls.gameOpenUntil) > new Date());
}

/** 教师关闭的游戏（对其班级的学生不显示、不能打开） */
const disabledKey = (teacherId) => `games.disabled.${teacherId}`;
async function disabledGamesFor(teacherId) {
  if (!teacherId) return [];
  const doc = await require('../models/Setting').findOne({ key: disabledKey(teacherId) }).lean();
  return Array.isArray(doc && doc.value) ? doc.value : [];
}
async function disabledGamesForStudent(classId) {
  if (!classId) return [];
  const cls = await require('../models/Class').findById(classId).select('teacher').lean();
  return disabledGamesFor(cls && cls.teacher);
}

exports.getRemainingTime = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const userRole = req.user?.role;
    logger.info('获取游戏剩余时长', { userId, role: userRole });

    const user = await User.findById(userId).select('gameTimeRemainingSeconds lastLogin role classId');
    if (!user) {
      logger.warn('未找到用户', { userId });
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 教师不受限制
    if (user.role === 'teacher') {
      return res.status(200).json({
        success: true,
        remainingSeconds: user.gameTimeRemainingSeconds || 0,
        isLocked: false
      });
    }

    // 学生：检查登录时间是否满足要求
    const now = new Date();
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    let isLocked = false;
    let minutesPassed = 0;
    let unlockTime = null;
    let lockMessage = null;

    if (lastLogin) {
      minutesPassed = Math.floor((now - lastLogin) / 60000);
      if (minutesPassed < LOGIN_MINUTES_REQUIRED) {
        isLocked = true;
        unlockTime = new Date(lastLogin.getTime() + LOGIN_MINUTES_REQUIRED * 60000);
        lockMessage = `游戏将在登录后${LOGIN_MINUTES_REQUIRED}分钟解锁，您已登录${minutesPassed}分钟`;
        logger.info('游戏中心被锁定', { userId, minutesPassed, unlockTime });
      }
    } else {
      // 如果没有登录时间记录，也锁定
      isLocked = true;
      lockMessage = '无法获取登录时间，请重新登录';
      logger.warn('未找到用户登录时间', { userId });
    }

    // 教师已为本班提前开放游戏中心
    if (isLocked && await classOpenedEarly(user.classId)) { isLocked = false; lockMessage = null; unlockTime = null; }

    return res.status(200).json({
      success: true,
      remainingSeconds: user.gameTimeRemainingSeconds || 0,
      isLocked,
      minutesPassed,
      unlockTime: unlockTime ? unlockTime.toISOString() : null,
      lockMessage
    });
  } catch (error) {
    logger.error('获取游戏剩余时长失败', { error: error.message, stack: error.stack, userId: req.user?.id });
    return res.status(500).json({ success: false, message: '获取失败' });
  }
};

// 更新当前用户的游戏剩余时长（秒）
exports.updateRemainingTime = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { remainingSeconds } = req.body || {};
    logger.info('更新游戏剩余时长', { userId, remainingSeconds });

    if (typeof remainingSeconds !== 'number' || Number.isNaN(remainingSeconds) || remainingSeconds < 0) {
      return res.status(400).json({ success: false, message: '无效的剩余时长' });
    }

    const user = await User.findById(userId).select('_id');
    if (!user) {
      logger.warn('未找到用户', { userId });
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 学生只能减少剩余时长（时长只能通过积分商店兑换增加），防止在浏览器里篡改
    const value = Math.floor(remainingSeconds);
    if (req.user.role === 'student') {
      await User.updateOne({ _id: userId, gameTimeRemainingSeconds: { $gt: value } }, { $set: { gameTimeRemainingSeconds: value } });
    } else {
      await User.findByIdAndUpdate(userId, { gameTimeRemainingSeconds: value }, { new: false });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('更新游戏剩余时长失败', { error: error.message, stack: error.stack, userId: req.user?.id });
    return res.status(500).json({ success: false, message: '更新失败' });
  }
};










// ───────────────────────── 游戏会话（防止绕过游戏中心）与热度统计 ─────────────────────────
const fs = require('fs');
const path = require('path');
const Class = require('../models/Class');
const GameStat = require('../models/GameStat');
const access = require('../services/gameAccess');

const MAX_BEAT_GAP_SECONDS = 45; // 心跳间隔 30 秒；断线、挂起期间不计时

/** 学生能否开始/继续游戏：剩余时长、登录满 35 分钟、班级允许 */
async function studentGate(userId, gameId) {
  const user = await User.findById(userId).select('gameTimeRemainingSeconds lastLogin classId gameSession role');
  if (!user) return { error: '用户不存在', code: 404 };
  if (user.role !== 'student') return { user };
  if (gameId && (await disabledGamesForStudent(user.classId)).includes(gameId)) return { error: '老师暂未开放这个游戏', code: 403 };
  const tooEarly = !user.lastLogin || Date.now() - new Date(user.lastLogin) < LOGIN_MINUTES_REQUIRED * 60000;
  if (tooEarly && !await classOpenedEarly(user.classId)) {
    return { error: `游戏将在登录后${LOGIN_MINUTES_REQUIRED}分钟解锁`, code: 403 };
  }
  if (user.classId) {
    const cls = await Class.findById(user.classId).select('allowGameCenter').lean();
    if (cls && cls.allowGameCenter === false) return { error: '老师已关闭本班的游戏中心', code: 403 };
  }
  if (!(user.gameTimeRemainingSeconds > 0)) return { error: '游戏时间已用完', code: 403 };
  return { user };
}

/** 把上次心跳以来的游戏时间记入热度，并在服务器端扣减剩余时长 */
async function accountPlay(user, now = new Date()) {
  const s = user.gameSession;
  if (!s || !s.ticket || !s.lastBeatAt) return 0;
  const gap = Math.max(0, Math.min(MAX_BEAT_GAP_SECONDS, (now - new Date(s.lastBeatAt)) / 1000));
  const played = (s.playedSeconds || 0) + gap;
  const set = { 'gameSession.lastBeatAt': now, 'gameSession.playedSeconds': played };
  if (user.role === 'student') {
    // 服务器估算的剩余 = 开始时剩余 - 本次已玩；与浏览器上报的取较小值，二者不会重复扣
    const serverRemaining = Math.max(0, Math.floor((s.startRemaining || 0) - played));
    await User.updateOne({ _id: user._id, gameTimeRemainingSeconds: { $gt: serverRemaining } }, { $set: { gameTimeRemainingSeconds: serverRemaining } });
    if (gap > 0 && access.isGameId(s.gameId)) {
      await GameStat.updateOne(
        { gameId: s.gameId },
        { $inc: { totalSeconds: gap }, $set: { lastPlayedAt: now } },
        { upsert: true }
      );
    }
  }
  await User.updateOne({ _id: user._id, 'gameSession.ticket': s.ticket }, { $set: set });
  return gap;
}

/** 开始游戏：签发游戏票 */
exports.openSession = async (req, res) => {
  try {
    const { gameId } = req.body || {};
    if (!access.isGameId(gameId)) return res.status(404).json({ success: false, message: '游戏不存在' });
    const gate = await studentGate(req.user._id || req.user.id, gameId);
    if (gate.error) return res.status(gate.code).json({ success: false, message: gate.error });
    const user = gate.user;

    await accountPlay(user); // 结算之前未正常关闭的会话
    const ticket = access.newTicket();
    const now = new Date();
    await User.updateOne({ _id: user._id }, {
      $set: {
        gameSession: {
          ticket, gameId, startedAt: now, lastBeatAt: now,
          startRemaining: user.gameTimeRemainingSeconds || 0, playedSeconds: 0
        }
      }
    });
    access.forgetTicket(user._id);
    if (user.role === 'student') {
      await GameStat.updateOne(
        { gameId },
        { $inc: { sessions: 1 }, $addToSet: { players: user._id }, $set: { lastPlayedAt: now } },
        { upsert: true }
      );
    }
    access.setTicketCookie(res, access.signCookie(user._id, gameId, ticket));
    res.json({ success: true, url: `${access.COOKIE_PATH}/${gameId}/index.html` });
  } catch (error) {
    logger.error('开始游戏失败', { error: error.message });
    res.status(500).json({ success: false, message: '开始游戏失败' });
  }
};

/** 游戏中心每 30 秒心跳：计时、续期游戏票；时间用完等情况下收回游戏票 */
exports.heartbeat = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('gameSession gameTimeRemainingSeconds role');
    const s = user && user.gameSession;
    if (!s || !s.ticket) { access.clearTicketCookie(res); return res.status(409).json({ success: false, message: '游戏已在其他地方结束' }); }
    await accountPlay(user);
    const gate = await studentGate(userId, s.gameId);
    if (gate.error) {
      await User.updateOne({ _id: userId }, { $set: { gameSession: {} } });
      access.forgetTicket(userId); access.clearTicketCookie(res);
      return res.status(403).json({ success: false, message: gate.error });
    }
    access.setTicketCookie(res, access.signCookie(userId, s.gameId, s.ticket));
    res.json({ success: true, remainingSeconds: gate.user.gameTimeRemainingSeconds || 0 });
  } catch (error) {
    logger.error('游戏心跳失败', { error: error.message });
    res.status(500).json({ success: false });
  }
};

/** 关闭游戏：结算时长并收回游戏票 */
exports.closeSession = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('gameSession gameTimeRemainingSeconds role');
    if (user && user.gameSession && user.gameSession.ticket) {
      await accountPlay(user);
      await User.updateOne({ _id: userId }, { $set: { gameSession: {} } });
    }
    access.forgetTicket(userId);
    access.clearTicketCookie(res);
    res.json({ success: true });
  } catch (error) {
    logger.error('关闭游戏失败', { error: error.message });
    res.status(500).json({ success: false });
  }
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webm': 'video/webm', '.mp4': 'video/mp4'
};

/** 提供游戏文件：必须持有本游戏的有效游戏票 */
exports.serveGameFile = async (req, res) => {
  try {
    const { gameId } = req.params;
    const rel = req.params[0] || 'index.html';
    // 不允许游戏注册 Service Worker：否则浏览器可能把游戏缓存下来，离线绕过游戏票
    if (req.headers['service-worker']) return res.status(403).end();
    const ok = await access.verifyRequest(req, gameId);
    if (!ok) {
      res.status(401).set('Cache-Control', 'no-store');
      return rel.endsWith('.html')
        ? res.type('html').send('<!DOCTYPE html><meta charset="utf-8"><body style="font:18px sans-serif;color:#555;text-align:center;padding-top:20vh">请从游戏中心进入游戏</body>')
        : res.end();
    }
    const abs = access.resolveGameFile(gameId, rel);
    if (!abs) return res.status(404).end();
    const ext = path.extname(abs).toLowerCase();
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Robots-Tag', 'noindex');
    if (ext === '.html') {
      res.set('Cache-Control', 'no-store');
      res.type('html').send(access.injectGuard(fs.readFileSync(abs, 'utf8'), gameId));
      return;
    }
    res.set('Cache-Control', 'private, max-age=600');
    if (MIME[ext]) res.type(MIME[ext]);
    res.sendFile(abs);
  } catch (error) {
    logger.error('提供游戏文件失败', { error: error.message });
    res.status(500).end();
  }
};

/** 游戏页面内的守卫脚本定期确认游戏票仍有效 */
exports.alive = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status((await access.verifyRequest(req)) ? 204 : 401).end();
};

const GameSave = require('../models/GameSave');
const MAX_SAVE_BYTES = 64 * 1024;

/** 游戏存档：用游戏票识别用户和游戏，游戏页面里的脚本可直接读写自己的存档 */
exports.loadSave = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const t = await access.verifyRequest(req);
    if (!t) return res.status(401).json({ success: false });
    const doc = await GameSave.findOne({ user: t.userId, gameId: t.gameId }).select('data').lean();
    res.json({ success: true, data: doc ? doc.data : null });
  } catch (error) {
    logger.error('读取游戏存档失败', { error: error.message });
    res.status(500).json({ success: false });
  }
};

exports.writeSave = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const t = await access.verifyRequest(req);
    if (!t) return res.status(401).json({ success: false });
    const data = req.body && req.body.data;
    if (data === undefined || Buffer.byteLength(JSON.stringify(data)) > MAX_SAVE_BYTES) {
      return res.status(400).json({ success: false, message: '存档无效或过大' });
    }
    await GameSave.updateOne({ user: t.userId, gameId: t.gameId }, { $set: { data } }, { upsert: true });
    res.json({ success: true });
  } catch (error) {
    logger.error('保存游戏存档失败', { error: error.message });
    res.status(500).json({ success: false });
  }
};

/** 当前用户在各游戏里的进度摘要，显示在个人游戏中心 */
exports.getProgress = async (req, res) => {
  try {
    const docs = await GameSave.find({ user: req.user._id || req.user.id }).select('gameId data updatedAt').lean();
    const progress = {};
    for (const d of docs) {
      if (!access.isGameId(d.gameId)) continue;
      const sum = require('../services/gameProgress').summarize(d.gameId, d.data);
      if (sum) progress[d.gameId] = { ...sum, updatedAt: d.updatedAt };
    }
    res.json({ success: true, data: progress });
  } catch (error) {
    logger.error('获取游戏进度失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取游戏进度失败' });
  }
};

/** 封面图（公开，供游戏中心列表显示） */
exports.cover = (req, res) => {
  const abs = access.resolveGameFile(req.params.gameId, 'cover.png');
  if (!abs) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(abs);
};

/** 热度榜：每个游戏的累计游玩时长 */
exports.getStats = async (req, res) => {
  try {
    const stats = await GameStat.aggregate([
      { $project: { _id: 0, gameId: 1, totalSeconds: 1, sessions: 1, lastPlayedAt: 1, playerCount: { $size: { $ifNull: ['$players', []] } } } }
    ]);
    const data = stats.filter(x => access.isGameId(x.gameId));
    const totalSeconds = data.reduce((a, x) => a + (x.totalSeconds || 0), 0);
    // 学生：返回其任课教师关闭的游戏；教师：返回自己关闭的游戏
    const disabled = req.user.role === 'student'
      ? await disabledGamesForStudent((await User.findById(req.user._id || req.user.id).select('classId').lean() || {}).classId)
      : await disabledGamesFor(req.user._id || req.user.id);
    res.json({ success: true, data, totalSeconds, disabled });
  } catch (error) {
    logger.error('获取游戏热度失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取游戏热度失败' });
  }
};


/** 教师：设置对自己班级开放哪些游戏 */
exports.setDisabledGames = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ success: false, message: '只有教师可以管理游戏' });
    const { disabled } = req.body || {};
    if (!Array.isArray(disabled)) return res.status(400).json({ success: false, message: '参数错误' });
    const value = [...new Set(disabled.filter(access.isGameId))];
    const teacherId = req.user._id || req.user.id;
    await require('../models/Setting').findOneAndUpdate(
      { key: disabledKey(teacherId) },
      { key: disabledKey(teacherId), value, description: '教师关闭的游戏（对其班级不开放）' },
      { upsert: true }
    );
    res.json({ success: true, disabled: value });
  } catch (error) {
    logger.error('设置游戏开放失败', { error: error.message });
    res.status(500).json({ success: false, message: '保存失败' });
  }
};
