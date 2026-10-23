const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture() {
  const calls = [];
  let initialized = false;
  const context = { exports: {}, Date, URL, require: name => name.includes('adminInitialization') ? {
    getInitializationStatus: async () => ({ initialized, requiresTeacherVerification: false }),
    initializeAdmin: async (input, options) => {
      if (initialized) throw Object.assign(new Error('系统已初始化'), { status: 409 });
      calls.push({ input, options }); initialized = true;
      return { username: input.username };
    }
  } : { error() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./initializationController'), 'utf8'), context);
  const request = overrides => ({ is: () => true, get: name => ({ 'X-Setup-Request': '1', Origin: 'http://school.local:3000', Host: 'school.local' }[name]),
    body: { username: 'admin', password: 'strong-password', confirmPassword: 'strong-password', role: 'teacher' }, ...overrides });
  const response = () => ({ code: 200, headers: {}, status(value) { this.code = value; return this; },
    set(key, value) { this.headers[key] = value; return this; }, json(value) { this.body = value; return this; } });
  return { ...context.exports, calls, request, response };
}
test('web setup uses the verified service, closes after success, and never accepts a caller role', async () => {
  const f = fixture(), first = f.response();
  await f.initialize(f.request(), first);
  assert.equal(first.code, 201); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].options.web, true);
  assert.equal(f.calls[0].input.role, undefined);
  const status = f.response(); await f.status({}, status); assert.equal(status.body.initialized, true); assert.equal(status.headers['Cache-Control'], 'no-store');
  const second = f.response(); await f.initialize(f.request(), second); assert.equal(second.code, 409);
});
test('setup rejects third-party requests, missing setup header and mismatched passwords', async () => {
  const f = fixture();
  const badOrigin = f.response();
  await f.initialize(f.request({ get: name => ({ 'X-Setup-Request': '1', Origin: 'https://evil.example', Host: 'school.local' }[name]) }), badOrigin);
  assert.equal(badOrigin.code, 403);
  const badHeader = f.response(); await f.initialize(f.request({ get: () => undefined }), badHeader); assert.equal(badHeader.code, 403);
  const badPassword = f.response(); await f.initialize(f.request({ body: { password: 'a', confirmPassword: 'b' } }), badPassword); assert.equal(badPassword.code, 400);
  assert.equal(f.calls.length, 0);
});
test('setup limits repeated verification attempts', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) await f.initialize(f.request({ body: { password: 'a', confirmPassword: 'b' } }), f.response());
  const limited = f.response(); await f.initialize(f.request(), limited);
  assert.equal(limited.code, 429); assert.equal(limited.headers['Retry-After'], '60'); assert.equal(f.calls.length, 0);
});
