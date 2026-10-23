const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');

function setup({ history = [{ ip: '192.168.1.10' }], existing = null } = {}) {
  const saved = [];
  const student = { name: '学生', loginHistory: history };
  class LoginRequest {
    constructor(data) {
      Object.assign(this, data, { _id: 'request-id', expiresAt: new Date(Date.now() + 300000) });
    }
    async save() { saved.push(this); }
    static async hasPendingRequest() { return existing; }
  }
  const controller = load(require.resolve('./loginRequestController'), {
    '../models/LoginRequest': LoginRequest,
    '../models/User': { findOne: async () => student },
    '../models/Class': {},
    '../utils/logger': logger,
    '../utils/getClientIp': { getClientIp: req => req.ip }
  });
  return { controller, saved };
}

const body = requestType => ({
  username: 'student', studentId: 'student-id', studentName: '学生',
  classId: 'class-id', requestType
});

for (const requestType of ['ip_change', 'device_conflict', 'ip_and_device_conflict']) {
  test(`creates ${requestType} request using server IP data`, async () => {
    const { controller, saved } = setup();
    const res = response();
    await controller.createRequest({ body: { ...body(requestType), oldIp: 'forged-old', newIp: 'forged-new' }, ip: '192.168.1.20' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requestId, 'request-id');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].requestType, requestType);
    assert.equal(saved[0].oldIp, '192.168.1.10');
    assert.equal(saved[0].newIp, '192.168.1.20');
  });
}

test('device conflict request works without prior IP history or client IP fields', async () => {
  const noHistory = setup({ history: [] });
  const res = response();
  await noHistory.controller.createRequest({ body: body('device_conflict'), ip: '192.168.1.20' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(noHistory.saved[0].oldIp, null);
});

test('reuses pending requests instead of creating another request', async () => {
  const existing = { _id: 'pending-id', expiresAt: new Date(Date.now() + 60000) };
  const { controller, saved } = setup({ existing });
  const res = response();
  await controller.createRequest({ body: body('ip_change'), ip: '192.168.1.20' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.requestId, existing._id);
  assert.equal(saved.length, 0);
});

test('missing fields return validation error instead of an undefined IP error', async () => {
  const { controller, saved } = setup();
  const res = response();
  await controller.createRequest({ body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(saved.length, 0);
});
