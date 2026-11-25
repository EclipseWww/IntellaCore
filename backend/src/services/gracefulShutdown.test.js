const test = require('node:test');
const assert = require('node:assert/strict');
const { createShutdown } = require('./gracefulShutdown');
const quiet = { log() {}, warn() {}, error() {} };

test('closes HTTP server then database, exits once even if signalled twice', async () => {
  const order = []; let exits = [];
  const server = { close(cb) { order.push('http'); setImmediate(cb); }, closeIdleConnections() { order.push('idle'); } };
  const done = new Promise(resolve => {
    const shutdown = createShutdown({ server, closeDatabase: async () => order.push('db'), exit: code => { exits.push(code); resolve(); }, log: quiet });
    shutdown('SIGTERM'); shutdown('SIGINT');
  });
  await done;
  assert.deepEqual(order, ['http', 'idle', 'db']);
  assert.deepEqual(exits, [0]);
});

test('database close errors still exit; hung connections are force-exited after timeout', async () => {
  let code;
  await new Promise(resolve => createShutdown({ server: { close: cb => cb() }, closeDatabase: async () => { throw new Error('x'); }, exit: c => { code = c; resolve(); }, log: quiet })('SIGTERM'));
  assert.equal(code, 0);
  const start = Date.now();
  const keepAlive = setTimeout(() => {}, 1000); // 真实环境中由 HTTP 服务保持事件循环
  await new Promise(resolve => createShutdown({ server: { close() {} }, closeDatabase: async () => {}, exit: resolve, timeoutMs: 50, log: quiet })('SIGTERM'));
  clearTimeout(keepAlive);
  assert.ok(Date.now() - start >= 45);
});
