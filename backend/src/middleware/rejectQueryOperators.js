// Express 会把 ?a[$ne]=x 解析成对象 { a: { $ne: 'x' } }，若直接放进 MongoDB 查询会绕过精确匹配（NoSQL 注入）。
// 正常页面从不在网址参数中使用以 $ 开头的键，这里统一拒绝。
function hasOperatorKey(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 10) return false;
  return Object.keys(value).some(key => key.startsWith('$') || hasOperatorKey(value[key], depth + 1));
}

module.exports = function rejectQueryOperators(req, res, next) {
  if (hasOperatorKey(req.query)) return res.status(400).json({ message: '无效的查询参数' });
  next();
};
module.exports.hasOperatorKey = hasOperatorKey;
