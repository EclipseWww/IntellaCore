/**
 * 游戏访问控制
 *
 * 游戏文件放在 backend/games/<id>/，只通过 /api/games/play/<id>/... 提供。
 * 从游戏中心开始游戏时签发「游戏票」：一个短期、HttpOnly、只对 /api/games/play 生效的 Cookie，
 * 票据同时记在用户的 gameSession 上。每个游戏文件请求都要校验票据：
 * - 直接输入网址、收藏链接、复制给同学 -> 没有有效票据，打不开
 * - 关闭游戏 / 时间用完 / 在别处开了另一个游戏 -> 旧票据立即失效
 * 课程视频、图片、课时文件走 /public/media、/api/download 等其他路径，不受影响。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const GAMES_ROOT = path.resolve(__dirname, '../../games');
const COOKIE_NAME = 'game_ticket';
const COOKIE_PATH = '/api/games/play';
const TICKET_TTL_SECONDS = 120;   // 心跳每 30 秒续期一次
const ID_RE = /^[a-z0-9_-]{1,40}$/;

const secret = () => process.env.JWT_SECRET;

/** 已安装的游戏（backend/games 下含 index.html 的目录） */
let gameIdsCache = null;
function listGameIds() {
  if (!gameIdsCache) {
    gameIdsCache = fs.existsSync(GAMES_ROOT)
      ? fs.readdirSync(GAMES_ROOT, { withFileTypes: true })
        .filter(d => d.isDirectory() && ID_RE.test(d.name) && fs.existsSync(path.join(GAMES_ROOT, d.name, 'index.html')))
        .map(d => d.name)
      : [];
  }
  return gameIdsCache;
}
const isGameId = (id) => typeof id === 'string' && ID_RE.test(id) && listGameIds().includes(id);

/** 安全解析游戏内文件路径；越界、隐藏文件、不存在都返回 null */
function resolveGameFile(gameId, relPath) {
  if (!isGameId(gameId)) return null;
  const rel = (relPath || 'index.html').replace(/\\/g, '/');
  if (rel.split('/').some(seg => seg === '..' || seg.startsWith('.'))) return null;
  const base = path.join(GAMES_ROOT, gameId);
  const abs = path.resolve(base, rel);
  if (!abs.startsWith(base + path.sep)) return null;
  try { if (!fs.statSync(abs).isFile()) return null; } catch { return null; }
  return abs;
}

const newTicket = () => crypto.randomBytes(16).toString('hex');

function signCookie(userId, gameId, ticket) {
  return jwt.sign({ uid: String(userId), gid: gameId, tid: ticket }, secret(), { expiresIn: TICKET_TTL_SECONDS, audience: 'game' });
}

function setTicketCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=${COOKIE_PATH}; Max-Age=${TICKET_TTL_SECONDS}; HttpOnly; SameSite=Strict`);
}
function clearTicketCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Strict`);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// 票据与数据库比对的短缓存：一个游戏首次加载会请求几十个文件
const ticketCache = new Map();
const CACHE_MS = 5000;
const forgetTicket = (userId) => ticketCache.delete(String(userId));

/** 校验请求携带的游戏票；成功返回 { userId, gameId }，失败返回 null */
async function verifyRequest(req, gameId) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, secret(), { audience: 'game' }); } catch { return null; }
  if (gameId && payload.gid !== gameId) return null;

  const now = Date.now();
  let cached = ticketCache.get(payload.uid);
  if (!cached || now - cached.at > CACHE_MS) {
    const u = await User.findById(payload.uid).select('gameSession').lean();
    cached = { at: now, ticket: u && u.gameSession && u.gameSession.ticket, gameId: u && u.gameSession && u.gameSession.gameId };
    ticketCache.set(payload.uid, cached);
  }
  if (!cached.ticket || cached.ticket !== payload.tid || cached.gameId !== payload.gid) return null;
  return { userId: payload.uid, gameId: payload.gid };
}

/**
 * 注入到每个游戏页面 <head> 最前面的守卫脚本：
 * - 不是嵌在本系统的游戏中心里（直接打开、被学生网页嵌入）-> 跳回首页
 * - 每 20 秒确认票据仍有效；关闭游戏或时间用完后页面立即停止
 */
/**
 * 需要按用户同步到服务器的 localStorage 键（前缀匹配）。
 * 页面脚本运行前，守卫脚本先用服务器上本账号的存档替换这些键，之后每次改动自动上传，
 * 所以游戏本身不用改，也不会和同一台电脑上别的账号串进度。
 * 没列出的游戏（贪吃蛇之外的纯内存游戏等）没有可保存的内容。
 */
const GAME_STORAGE = {
  '2048': ['bestScore2048', 'gameState2048'],
  snake: ['snakeHighScore'],
  memory: ['Tank Wars'],
  ztype: ['highscore', 'soundVolume', 'musicVolume'],
  binary: ['binary_best'],
  linkup: ['linkup_best'],
  klotski: ['klotski_best_'],
  robot: ['robot_']
};

const guardScript = (gameId) => `<script>(function(){
  var ok = false;
  try { ok = window.top !== window.self && window.parent.location.origin === location.origin && /^\\/(student|teacher)(\\/|$)/.test(window.parent.location.pathname); } catch (e) { ok = false; }
  function block(msg){ try { window.stop(); } catch (e) {} document.documentElement.innerHTML = '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font:18px sans-serif;color:#555;background:#f5f5f5">' + msg + '</body>'; }
  if (!ok) { block('请从游戏中心进入游戏'); return; }
  /* 每个用户自己的游戏存档（保存在服务器，换电脑、换浏览器也在） */
  window.GameSave = {
    load: function(){ return fetch('${COOKIE_PATH}/_save', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : { data: null }; }).then(function(j){ return j.data === undefined ? null : j.data; }).catch(function(){ return null; }); },
    save: function(data){ return fetch('${COOKIE_PATH}/_save', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: data }), keepalive: true }).then(function(r){ return r.ok; }).catch(function(){ return false; }); }
  };
  var PREFIXES = ${JSON.stringify(GAME_STORAGE[gameId] || [])};
  if (PREFIXES.length) (function(){
    var ls = window.localStorage, timer = null;
    function mine(k){ if (typeof k !== 'string') return false; for (var i = 0; i < PREFIXES.length; i++) if (k.indexOf(PREFIXES[i]) === 0) return true; return false; }
    function snapshot(){ var o = {}; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (mine(k)) o[k] = ls.getItem(k); } return o; }
    function flush(){ timer = null; window.GameSave.save({ ls: snapshot() }); }
    function later(){ if (timer) clearTimeout(timer); timer = setTimeout(flush, 1500); }
    var rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem, rawClear = Storage.prototype.clear;
    // 页面脚本运行前同步读取服务器存档，替换本地的同名键（同一台电脑上别人的进度不会串过来）
    try {
      var x = new XMLHttpRequest(); x.open('GET', '${COOKIE_PATH}/_save', false); x.send();
      var d = x.status === 200 ? JSON.parse(x.responseText).data : null;
      var old = []; for (var i = 0; i < ls.length; i++) if (mine(ls.key(i))) old.push(ls.key(i));
      old.forEach(function(k){ rawRemove.call(ls, k); });
      if (d && d.ls) Object.keys(d.ls).forEach(function(k){ if (mine(k)) rawSet.call(ls, k, String(d.ls[k])); });
    } catch (e) {}
    Storage.prototype.setItem = function(k, v){ rawSet.call(this, k, v); if (this === ls && mine(k)) later(); };
    Storage.prototype.removeItem = function(k){ rawRemove.call(this, k); if (this === ls && mine(k)) later(); };
    Storage.prototype.clear = function(){ rawClear.call(this); if (this === ls) later(); };
    window.addEventListener('pagehide', function(){ if (timer) { clearTimeout(timer); flush(); } });
  })();
  setInterval(function(){
    fetch('${COOKIE_PATH}/_alive', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ if (r.status === 401) block('游戏已结束，请回到游戏中心'); }).catch(function(){});
  }, 20000);
})();</script>`;

function injectGuard(html, gameId) {
  const guard = guardScript(gameId);
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + guard + html.slice(m.index + m[0].length);
  return guard + html;
}

module.exports = {
  GAMES_ROOT, COOKIE_NAME, COOKIE_PATH, TICKET_TTL_SECONDS, listGameIds, isGameId, resolveGameFile,
  newTicket, signCookie, setTicketCookie, clearTicketCookie, readCookie, verifyRequest, forgetTicket, injectGuard
};
