/**
 * 仅用于 npm start 开发服务器（生产环境由 Nginx 代理 /api，不使用本文件）。
 *
 * package.json 的 "proxy" 不会代理浏览器直接打开的网页请求（Accept: text/html），
 * 而游戏页面是在 iframe 里直接打开的 /api/games/play/... 网页，需要在这里显式转发到后端。
 * 其他 API 请求仍由 "proxy" 处理。
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(createProxyMiddleware({
    target: process.env.DEV_BACKEND_URL || 'http://localhost:5003',
    pathFilter: '/api/games/play',
    changeOrigin: true
  }));
};
