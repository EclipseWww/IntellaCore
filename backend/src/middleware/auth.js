const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // 尝试从 header、query 参数或 Authorization header 中获取 token
    let token = req.header('Authorization');
    
    // 检查是否是 SSE 请求
    const isSSE = req.headers.accept === 'text/event-stream' || 
                 req.headers['accept'] === 'text/event-stream';

    if (token) {
      token = token.replace('Bearer ', '');
    } else if (req.query.token) {
      token = req.query.token;
    } else {
      throw new Error('No token provided');
    }

    // 验证 token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Reject old synthetic administrator tokens; administrators now have database identities.
      if (decoded.role === 'admin') {
        const admin = (decoded._id || decoded.id) && await User.findById(decoded._id || decoded.id).select('role isActive');
        if (!admin || admin.role !== 'admin' || !admin.isActive) throw new Error('管理员账号已失效');
      }

      // 学生单点登录校验：若payload含有sessionId，则需与数据库一致且未过期
      if (decoded && decoded.role === 'student') {
        const user = await User.findById(decoded._id || decoded.id).select('sessionId sessionExpiresAt');
        const now = new Date();
        if (!decoded.sessionId || !user || !user.sessionId || user.sessionId !== decoded.sessionId || !user.sessionExpiresAt || user.sessionExpiresAt <= now) {
          throw new Error('会话已失效或在其他设备登录');
        }
      }

      req.user = decoded;
      next();
    } catch (jwtError) {
      console.error('JWT验证错误:', jwtError);
      if (isSSE) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({
          type: 'error',
          content: {
            message: 'Token已过期或无效，请重新登录',
            error: jwtError.message
          }
        })}\n\n`);
        res.end();
      } else {
        res.status(401).json({ 
          message: 'Token已过期或无效，请重新登录',
          error: jwtError.message 
        });
      }
    }
  } catch (error) {
    console.error('认证错误:', error);
    
    // 检查是否是 SSE 请求
    const isSSE = req.headers.accept === 'text/event-stream' || 
                 req.headers['accept'] === 'text/event-stream';
                 
    if (isSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: {
          message: '认证失败，请重新登录',
          error: error.message
        }
      })}\n\n`);
      res.end();
    } else {
      res.status(401).json({ 
        message: '请先登录',
        error: error.message 
      });
    }
  }
};
