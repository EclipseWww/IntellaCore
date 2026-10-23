/**
 * 获取客户端真实IP地址的工具函数
 * 
 * 在Docker环境中，请求经过多层代理（nginx、docker网络等），
 * 需要按正确的优先级获取真实IP
 * 
 * IP头优先级（从高到低）：
 * 1. X-Real-IP: 通常由最外层代理设置的真实客户端IP
 * 2. X-Forwarded-For: 代理链中的IP列表，第一个是原始客户端IP
 * 3. req.ip: Express获取的IP（需要配合trust proxy）
 * 4. req.connection.remoteAddress: 直接连接的IP
 */

/**
 * 获取客户端真实IP
 * @param {Object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
function getClientIp(req) {
  // 按优先级获取IP
  let clientIp = 
    // 1. Cloudflare/CDN的真实IP头
    req.headers['cf-connecting-ip'] ||
    req.headers['true-client-ip'] ||
    // 2. Nginx设置的真实IP
    req.headers['x-real-ip'] ||
    // 3. X-Forwarded-For的第一个IP（原始客户端）
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    // 4. Express的IP（需要trust proxy）
    req.ip ||
    // 5. 直接连接IP
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '未知IP';

  // 处理IPv6映射的IPv4地址 (::ffff:192.168.1.1 -> 192.168.1.1)
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  return clientIp;
}

module.exports = {
  getClientIp,
};
