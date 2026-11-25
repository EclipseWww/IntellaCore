const sensitive = /password|^(token|authorization|apiKey|jwtSecret|secret)$/i;
function redactLog(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} 字节]`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  // Mongoose 文档、ObjectId 等先转成普通数据，避免输出内部字段
  if (!Array.isArray(value) && typeof value.toJSON === 'function') {
    const plain = value.toJSON();
    if (plain !== value) return redactLog(plain, seen);
  }
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) result[key] = sensitive.test(key) ? '[REDACTED]' : redactLog(value[key], seen);
  return result;
}
module.exports = { redactLog };
