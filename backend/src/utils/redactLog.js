const sensitive = /password|^(token|authorization|apiKey|jwtSecret|secret)$/i;
function redactLog(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) result[key] = sensitive.test(key) ? '[REDACTED]' : redactLog(value[key], seen);
  return result;
}
module.exports = { redactLog };
