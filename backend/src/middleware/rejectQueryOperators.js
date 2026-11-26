// Express 会把 ?a[$ne]=x 解析成对象 { a: { $ne: 'x' } }；JSON 请求体也可以直接传 { "studentId": { "$ne": null } }。
// 若直接放进 MongoDB 查询，会绕过精确匹配（NoSQL 注入）。正常页面从不发送以 $ 开头的键，这里统一拒绝。
function hasOperatorKey(value, maxDepth = 10, depth = 0) {
  if (!value || typeof value !== 'object' || depth > maxDepth) return false;
  return Object.keys(value).some(key => key.startsWith('$') || hasOperatorKey(value[key], maxDepth, depth + 1));
}

// 请求体只检查前几层：注入的操作符总在字段值或筛选条件这一级；
// 表格、流程图等整份保存的数据结构较深，深层的键不影响查询，也避免逐个遍历大块数据
const BODY_MAX_DEPTH = 2; // 检查第 0~2 层的键，如 studentId.$ne、filters.status.$ne、list[0].$gt

// 游戏存档的 data 由各游戏自行生成、只原样保存，不参与查询，不做检查
const BODY_EXEMPT_PATHS = new Set(['/api/games/play/_save']);

module.exports = function rejectQueryOperators(req, res, next) {
  if (hasOperatorKey(req.query)) return res.status(400).json({ message: '无效的查询参数' });
  if (!BODY_EXEMPT_PATHS.has(req.path) && hasOperatorKey(req.body, BODY_MAX_DEPTH)) {
    return res.status(400).json({ message: '无效的请求内容' });
  }
  next();
};
module.exports.hasOperatorKey = hasOperatorKey;
