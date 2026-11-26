// 把用户输入当作普通文字放进正则（MongoDB $regex 或 new RegExp）：
// 转义 . * + ? ^ $ { } ( ) | [ ] \ 等特殊字符，避免恶意正则卡死数据库或后端（ReDoS），也避免输入非法正则时报错。
// 非字符串（如 ?q=a&q=b 解析出的数组）先转成字符串。
function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
