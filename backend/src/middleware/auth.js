const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// 登录令牌只有这三种身份；游戏票据等同密钥签发的其他令牌不能当登录令牌使用
const LOGIN_ROLES = ['student', 'teacher', 'admin'];

const isSSERequest = (req) => req.headers.accept === 'text/event-stream';

// 鉴权失败的响应：不向浏览器返回内部原因（原因只写入服务器日志）。
// SSE 的 error 固定为 'auth_failed'，前端据此（含 'auth'）清除登录状态并回到登录页。
function reject(req, res, message) {
  if (isSSERequest(req)) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'error', content: { message, error: 'auth_failed' } })}\n\n`);
    res.end();
  } else {
    res.status(401).json({ message });
  }
}

async function verify(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!LOGIN_ROLES.includes(decoded.role)) throw new Error('不是登录令牌');
  const userId = decoded._id || decoded.id;

  // 教师、管理员：账号被停用或身份被修改后，已签发的令牌立即失效
  if (decoded.role === 'admin' || decoded.role === 'teacher') {
    const account = userId && await User.findById(userId).select('role isActive');
    if (!account || account.role !== decoded.role || !account.isActive) throw new Error('账号已停用或身份已变更');
  }

  // 学生单点登录校验：令牌中的 sessionId 需与数据库一致且未过期
  if (decoded.role === 'student') {
    const user = await User.findById(userId).select('sessionId sessionExpiresAt');
    if (!decoded.sessionId || !user || !user.sessionId || user.sessionId !== decoded.sessionId || !user.sessionExpiresAt || user.sessionExpiresAt <= new Date()) {
      throw new Error('会话已失效或在其他设备登录');
    }
  }
  return decoded;
}

module.exports = async (req, res, next) => {
  // 令牌来自 Authorization 头，或网址参数 ?token=（视频、文件下载、SSE 等无法设置请求头的场景）；
  // 因此日志只记 req.path，不记带参数的完整网址
  const header = req.header('Authorization');
  const token = header ? header.replace('Bearer ', '') : req.query.token;

  if (!token) {
    // 未携带令牌（如未登录时的请求）非常常见，仅在 LOG_LEVEL=debug 时记录
    logger.debug('请求未携带令牌', { path: req.path });
    return reject(req, res, isSSERequest(req) ? '认证失败，请重新登录' : '请先登录');
  }

  let decoded;
  try {
    decoded = await verify(token);
  } catch (error) {
    // 令牌过期、在其他设备登录等属于正常情况：只记一行原因，不输出堆栈
    logger.warn('令牌校验未通过', { reason: error.message, path: req.path });
    return reject(req, res, 'Token已过期或无效，请重新登录');
  }

  req.user = decoded;
  next();
};
