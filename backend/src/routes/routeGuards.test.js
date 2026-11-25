const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

// 不连数据库：查询立即失败，只验证路由层的权限与参数校验
mongoose.set('bufferCommands', false);

// 用请求头模拟登录身份，替换真实 auth 中间件
const authPath = require.resolve('../middleware/auth');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: (req, res, next) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ message: 'no token' });
    req.user = { _id: '000000000000000000000001', id: '000000000000000000000001', role };
    next();
  }
};

const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/courses', require('./courseRoutes'));
app.use('/api/course-management', require('./courseManagement'));
app.use('/api/course-units', require('./courseUnitRoutes'));
app.use('/api/lessons', require('./lessonRoutes'));
app.use('/api/media', require('./mediaRoutes'));
app.use('/api', require('./resourceRoutes'));
app.use('/api', require('./aiGradeRoutes'));
app.use('/api/spreadsheet-submissions', require('./spreadsheetSubmission'));
app.use('/api/email', require('./emailRoutes'));

const ID = '665f1c2a9b1e8a0012345678';
const writes = [
  ['POST', '/api/courses/create-samples', 'admin'],
  ['PUT', `/api/lessons/${ID}/activities/${ID}/publish`, 'teacher'],
  ['PUT', `/api/lessons/${ID}/activities/${ID}/details`, 'teacher'],
  ['POST', '/api/course-management', 'teacher'],
  ['DELETE', `/api/course-management/${ID}`, 'teacher'],
  ['POST', `/api/course-management/${ID}/units`, 'teacher'],
  ['POST', `/api/course-units/course/${ID}/units`, 'teacher'],
  ['PUT', `/api/course-units/units/${ID}`, 'teacher'],
  ['DELETE', `/api/course-units/units/${ID}`, 'teacher'],
  ['PUT', `/api/course-units/lessons/${ID}`, 'teacher'],
  ['DELETE', `/api/course-units/lessons/${ID}`, 'teacher'],
  ['DELETE', `/api/media/courses/${ID}/units/${ID}/lessons/${ID}/media/a.png`, 'teacher'],
  ['DELETE', `/api/courses/${ID}/units/${ID}/lessons/${ID}/resources/a.pdf`, 'teacher'],
  ['POST', `/api/submissions/${ID}/ai-grade`, 'teacher'],
  ['GET', `/api/spreadsheet-submissions/lesson/${ID}/activity/${ID}/all`, 'teacher']
];

let base, server;
test.before(() => new Promise(resolve => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());

const send = (method, url, role) => fetch(base + url, {
  method, headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: method === 'GET' ? undefined : '{}'
}).then(r => r.status);

test('students cannot modify course structure, lessons or teaching files', async () => {
  for (const [method, url] of writes) assert.equal(await send(method, url, 'student'), 403, `${method} ${url}`);
});

test('teachers/admins still pass the permission check', async () => {
  for (const [method, url, role] of writes) {
    const status = await send(method, url, role);
    assert.ok(status !== 401 && status !== 403, `${method} ${url} -> ${status}`);
  }
});

// fetch 会把 %2e%2e 规范化掉，攻击者可直接发送原始路径，这里用 http 原样发送
const sendRaw = (method, rawPath, role) => new Promise((resolve, reject) => {
  const req = http.request(base + '/', { method, path: rawPath, headers: { 'x-test-role': role } }, res => { res.resume(); resolve(res.statusCode); });
  req.on('error', reject); req.end();
});

test('path params with traversal are rejected before touching the disk', async () => {
  for (const url of [
    `/api/media/courses/${ID}/units/%2e%2e/lessons/%2e%2e/media/.env`,
    `/api/courses/${ID}/units/${ID}/lessons/%2e%2e/resources/%2e%2e`,
    `/api/media/courses/${ID}/units/${ID}/lessons/${ID}/media/a%5C..%5Cb`
  ]) assert.equal(await sendRaw('DELETE', url, 'teacher'), 400, url);
  // 邮件附件：任何登录用户都能访问，%2F 解码后的 ../ 不得读出附件目录外的文件
  for (const url of ['/api/email/attachment/..%2F..%2F..%2Fpackage.json', '/api/email/attachment/%2e%2e'])
    assert.equal(await sendRaw('GET', url, 'student'), 400, url);
});
