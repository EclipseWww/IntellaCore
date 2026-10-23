const pending = new Map();
async function withSubmissionLock(key, operation) {
  const previous = pending.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  pending.set(key, current);
  await previous;
  try { return await operation(); } finally { release(); if (pending.get(key) === current) pending.delete(key); }
}
module.exports = { withSubmissionLock };
