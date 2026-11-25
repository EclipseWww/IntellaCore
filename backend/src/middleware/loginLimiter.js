const rateLimit = require('express-rate-limit');

// 只统计"用户名或密码错误"(401)的登录请求，成功登录、需要确认的 409 等不计入。
// 以 IP + 用户名 为键：教室内多名学生共用同一出口 IP 时，互不影响。
const WINDOW_MS = 10 * 60 * 1000;

// 只有 401 视为“失败”并计数；其余状态码在响应结束后退还额度
const notWrongPassword = (req, res) => res.statusCode !== 401;
const tooMany = (req, res) => res.status(429).json({ message: '登录失败次数过多，请 10 分钟后再试' });

const perAccount = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.LOGIN_MAX_FAILS_PER_ACCOUNT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: notWrongPassword,
  validate: { trustProxy: false }, // 项目需 trust proxy 获取真实 IP；已知伪造 X-Forwarded-For 可绕过
  keyGenerator: (req) => `${req.ip}|${String((req.body && req.body.username) || '').toLowerCase()}`,
  handler: tooMany
});

// 单 IP 总上限放得很宽，仅用于挡住对大量账号的撞库
const perIp = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.LOGIN_MAX_FAILS_PER_IP) || 300,
  standardHeaders: false,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skipSuccessfulRequests: true,
  requestWasSuccessful: notWrongPassword,
  handler: tooMany
});

module.exports = [perIp, perAccount];
