/**
 * 获取客户端真实 IP。
 *
 * 只信任代理设置的请求头，不信任浏览器可以自行填写的请求头：
 * 1. X-Real-IP：项目自带的各份 Nginx 配置（前端镜像内、宿主机代理、npm 部署）都会用
 *    proxy_set_header 覆盖它，经过 Nginx 的请求无法伪造。
 * 2. X-Forwarded-For 第一项：仅当请求来自本机时（开发时 npm start 的代理）才采用。
 * 3. TCP 连接地址。
 *
 * 不再读取 CF-Connecting-IP、True-Client-IP 以及外部请求带来的 X-Forwarded-For，
 * 这些头学生可随意伪造，用于绕过登录限流和 IP 绑定。
 * 注意：后端端口（如 8080）若对学生电脑开放，学生直连后端仍可自填 X-Real-IP，
 * 需在 Compose 中将后端端口限制为只监听本机。
 */

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const normalize = (ip) => {
  const value = String(ip || '').trim();
  // IPv6 映射的 IPv4 地址：::ffff:192.168.1.1 -> 192.168.1.1
  return value.startsWith('::ffff:') ? value.substring(7) : value;
};

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return normalize(realIp);

  const peer = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  if (LOOPBACK.has(peer)) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = typeof forwarded === 'string' && forwarded.split(',')[0].trim();
    if (first) return normalize(first);
  }

  return normalize(peer) || '未知IP';
}

module.exports = {
  getClientIp,
};
