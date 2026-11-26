const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';
const silent = { debug() {}, info() {}, warn() {}, error() {} };

// users: id -> 数据库中的账号；未列出的 id 视为不存在
function loadAuth(users) {
  const User = { findById: (id) => ({ select: async () => users[id] || null }) };
  const context = { module: { exports: {} }, require: (name) => ({ jsonwebtoken: jwt, '../models/User': User, '../utils/logger': silent })[name],
    process: { env: { JWT_SECRET: SECRET } }, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./auth'), 'utf8'), context);
  return context.module.exports;
}

function call(auth, { header, query = {}, accept } = {}) {
  const res = { statusCode: 200, chunks: [], status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; },
    writeHead(code, headers) { this.statusCode = code; this.headers = headers; }, write(c) { this.chunks.push(c); }, end() { this.ended = true; } };
  const req = { header: (n) => (n === 'Authorization' ? header : undefined), headers: { accept }, query, originalUrl: '/api/x' };
  let passed = false;
  return auth(req, res, () => { passed = true; }).then(() => ({ req, res, passed }));
}

const future = new Date(Date.now() + 3600e3);
const student = { sessionId: 's1', sessionExpiresAt: future };

test('学生用网址参数 ?token= 访问（视频、下载、预览）仍可通过，会话校验不变', async () => {
  const auth = loadAuth({ stu: student });
  const token = jwt.sign({ _id: 'stu', id: 'stu', role: 'student', sessionId: 's1' }, SECRET);
  const viaQuery = await call(auth, { query: { token } });
  assert.equal(viaQuery.passed, true);
  assert.equal(viaQuery.req.user.id, 'stu');
  const viaHeader = await call(auth, { header: `Bearer ${token}` });
  assert.equal(viaHeader.passed, true);

  const stale = jwt.sign({ _id: 'stu', role: 'student', sessionId: 'old' }, SECRET);
  const rejected = await call(auth, { query: { token: stale } });
  assert.equal(rejected.passed, false);
  assert.equal(rejected.res.statusCode, 401);
});

test('停用或身份被修改的教师，已签发的令牌立即失效', async () => {
  const auth = loadAuth({ t1: { role: 'teacher', isActive: true }, t2: { role: 'teacher', isActive: false }, t3: { role: 'student', isActive: true } });
  const sign = (id) => jwt.sign({ _id: id, id, role: 'teacher' }, SECRET);
  assert.equal((await call(auth, { header: `Bearer ${sign('t1')}` })).passed, true);
  for (const id of ['t2', 't3', 'missing']) {
    const { passed, res } = await call(auth, { header: `Bearer ${sign(id)}` });
    assert.equal(passed, false, id);
    assert.equal(res.statusCode, 401);
  }
});

test('游戏票据等非登录令牌不能当登录令牌使用', async () => {
  const auth = loadAuth({});
  const ticket = jwt.sign({ uid: 'stu', gid: 'snake', tid: 'x' }, SECRET, { audience: 'game' });
  const { passed, res } = await call(auth, { query: { token: ticket } });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
});

test('鉴权失败不向浏览器返回内部原因；SSE 返回 auth_failed 供前端回到登录页', async () => {
  const auth = loadAuth({});
  const expired = jwt.sign({ _id: 'stu', role: 'student', sessionId: 's1' }, SECRET, { expiresIn: -10 });

  const plain = await call(auth, { header: `Bearer ${expired}` });
  assert.equal(plain.res.statusCode, 401);
  assert.equal(JSON.stringify(Object.keys(plain.res.body)), '["message"]');

  const missing = await call(auth, {});
  assert.equal(missing.res.statusCode, 401);
  assert.equal(JSON.stringify(missing.res.body), JSON.stringify({ message: '请先登录' }));

  for (const options of [{ header: `Bearer ${expired}` }, {}]) {
    const sse = await call(auth, { ...options, accept: 'text/event-stream' });
    const data = JSON.parse(sse.res.chunks[0].replace(/^data: /, ''));
    assert.equal(data.type, 'error');
    assert.equal(data.content.error, 'auth_failed');
    assert.ok(data.content.error.includes('auth'));
    assert.equal(sse.res.ended, true);
  }
});
