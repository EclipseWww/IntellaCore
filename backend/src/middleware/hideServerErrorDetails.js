// 5xx 响应中的 error / stack 字段常带有数据库、文件路径等内部细节，默认不返回给浏览器。
// 面向用户的 message 保留；4xx 业务错误不受影响。错误详情仍由各控制器写入服务器日志。
// 调试时可设置 NODE_ENV=development 或 EXPOSE_ERROR_DETAILS=true 恢复原样。
function shouldExpose() {
  return process.env.NODE_ENV === 'development' || process.env.EXPOSE_ERROR_DETAILS === 'true';
}

function sanitize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!('error' in body) && !('stack' in body)) return body;
  const { error, stack, ...rest } = body;
  return rest;
}

module.exports = function hideServerErrorDetails(req, res, next) {
  if (shouldExpose()) return next();
  const json = res.json.bind(res);
  res.json = body => json(res.statusCode >= 500 ? sanitize(body) : body);
  next();
};
module.exports.sanitize = sanitize;
