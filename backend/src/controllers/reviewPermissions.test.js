const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');

test('login approvals reject students and other teachers before mutating sessions', async () => {
  let writes = 0;
  const request = { classId: 'class', studentId: 'student', requestType: 'device_conflict', status: 'pending', expiresAt: new Date(Date.now() + 60000), save: async () => writes++ };
  const controller = load(require.resolve('./loginRequestController'), {
    '../models/LoginRequest': { findById: async () => request, getPendingByClass: async () => [request], updateMany: async () => { writes++; return { modifiedCount: 1 }; } },
    '../models/User': { findByIdAndUpdate: async () => writes++ },
    '../models/Class': { exists: async query => query.teacher === 'owner' },
    '../utils/getClientIp': { getClientIp: () => '127.0.0.1' }, '../utils/logger': logger
  });
  for (const user of [{ role: 'student', id: 'student' }, { role: 'teacher', id: 'other' }]) {
    for (const method of ['approveRequest', 'rejectRequest', 'getPendingRequests', 'bulkApprove', 'bulkReject']) {
      const res = response();
      await controller[method]({ user, params: { id: 'request', classId: 'class' }, body: { classId: 'class' } }, res);
      assert.equal(res.statusCode, 403, method);
    }
  }
  assert.equal(writes, 0);
  const res = response();
  await controller.approveRequest({ user: { role: 'teacher', id: 'owner' }, params: { id: 'request' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes, 2);
});

test('item modifications include teacher ownership and preserve administrator access', async () => {
  const filters = [];
  const controller = load(require.resolve('./pointShopController'), {
    '../models/PointShop': { PointShopItem: { findOneAndUpdate: async filter => { filters.push(filter); return {}; } } },
    '../models/ShopOperation': {}, '../models/User': {}, '../models/Class': {}, '../models/Achievement': {},
    '../services/shopOperationService': {}, '../utils/logger': logger,
    '../utils/pointPrecision': { roundPoints: value => value }
  });
  for (const role of ['teacher', 'admin']) {
    for (const method of ['updateItem', 'deleteItem']) {
      const res = response();
      await controller[method]({ user: { role, _id: 'owner' }, params: { itemId: 'item' }, body: { name: 'new' } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(filters.at(-1).createdBy, role === 'teacher' ? 'owner' : undefined);
    }
  }
});

test('fixed email endpoints are matched before the email id route', () => {
  const express = require('express');
  const controller = new Proxy({}, { get: (_, key) => Object.assign(() => {}, { handlerName: key }) });
  const router = load(require.resolve('../routes/emailRoutes'), {
    express, multer: Object.assign(() => ({ array: () => (_, __, next) => next() }), { diskStorage: () => ({}) }),
    path: require('node:path'), fs: { existsSync: () => true },
    '../middleware/auth': (_, __, next) => next(), '../controllers/emailController': controller
  });
  for (const [url, expected] of [['/contacts', 'getContacts'], ['/templates', 'getTemplates'], ['/abc', 'getEmailById']]) {
    const layer = router.stack.find(layer => layer.route?.methods.get && layer.match(url));
    assert.equal(layer.route.stack.at(-1).handle.handlerName, expected);
  }
});
