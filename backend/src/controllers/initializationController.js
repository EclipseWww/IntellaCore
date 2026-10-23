const { initializeAdmin, getInitializationStatus } = require('../services/adminInitialization');
const logger = require('../utils/logger');
let windowStartedAt = Date.now();
let attempts = 0;

exports.status = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { return res.json(await getInitializationStatus()); }
  catch (error) {
    logger.error('读取初始化状态失败', { error: error.message });
    return res.status(503).json({ message: '暂时无法连接系统，请稍后重试' });
  }
};

// A browser sends this custom header only after a CORS preflight. Together with
// the origin check this prevents a third-party page from submitting setup.
exports.initialize = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.is('application/json') || req.get('X-Setup-Request') !== '1') {
    return res.status(403).json({ message: '请通过系统首次设置页面操作' });
  }
  const origin = req.get('Origin');
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      // nginx forwards $host without the public port, so compare hostnames.
      const serverHostname = new URL(`http://${req.get('Host')}`).hostname;
      if (hostname !== serverHostname) return res.status(403).json({ message: '请在本系统页面完成首次设置' });
    } catch { return res.status(403).json({ message: '无效的请求来源' }); }
  }
  // Only one administrator is ever bootstrapped; cap password-verification attempts
  // globally so a spoofed forwarding header cannot bypass the limit.
  if (Date.now() - windowStartedAt >= 60000) { windowStartedAt = Date.now(); attempts = 0; }
  if (++attempts > 20) return res.status(429).set('Retry-After', '60').json({ message: '尝试次数过多，请一分钟后重试' });
  try {
    const { username, password, confirmPassword, name, teacherUsername, teacherPassword } = req.body;
    if (password !== confirmPassword) return res.status(400).json({ message: '两次输入的密码不一致' });
    const result = await initializeAdmin({ username, password, name, teacherUsername, teacherPassword }, { web: true });
    return res.status(201).json({ success: true, username: result.username, message: '管理员设置成功，请登录' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: '账号已存在或系统已完成初始化，请刷新页面' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error('网页初始化失败', { error: error.message });
    return res.status(503).json({ message: '暂时无法完成设置，请刷新页面检查状态后再试' });
  }
};
