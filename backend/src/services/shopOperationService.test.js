const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Interpret the subset of aggregation expressions used by the standalone MongoDB saga.
function evaluate(expression, doc) {
  if (typeof expression === 'string' && expression.startsWith('$')) return doc[expression.slice(1)];
  if (Array.isArray(expression)) return expression.map(value => evaluate(value, doc));
  if (!expression || typeof expression !== 'object' || expression instanceof Date) return expression;
  if ('$literal' in expression) return expression.$literal;
  const operator = Object.keys(expression)[0];
  if (!operator.startsWith('$')) return Object.fromEntries(Object.entries(expression).map(([key, value]) => [key, evaluate(value, doc)]));
  const args = evaluate(expression[operator], doc);
  switch (operator) {
    case '$eq': return args[0] === args[1];
    case '$gt': return args[0] > args[1];
    case '$gte': return args[0] >= args[1];
    case '$and': return args.every(Boolean);
    case '$or': return args.some(Boolean);
    case '$ifNull': return args[0] ?? args[1];
    case '$cond': return args[0] ? args[1] : args[2];
    case '$concatArrays': return args.flat();
    case '$subtract': return args[0] - args[1];
    case '$add': return args[0] + args[1];
    case '$round': return Math.round(args[0] * 100) / 100;
    case '$slice': return args[0].slice(0, args[1]);
    default: throw new Error(`Unhandled operator ${operator}`);
  }
}
function fixture({ stock = 1, balance = 10 } = {}) {
  const item = { stock, isActive: true, shopReceipts: [], shopRefundIds: [] };
  const achievement = { totalPoints: balance, shopReceipts: [], pointTransactions: [] };
  const records = new Map(), statuses = new Map();
  let failRecord = false;
  const query = doc => ({ select: async () => doc });
  function update(doc, filter, pipeline) {
    if (filter['shopReceipts.id'] && doc.shopReceipts.some(receipt => receipt.id === filter['shopReceipts.id'].$ne)) return;
    if (filter.shopRefundIds && doc.shopRefundIds.includes(filter.shopRefundIds.$ne)) return;
    Object.assign(doc, evaluate(pipeline[0].$set, doc));
  }
  const models = {
    '../models/PointShop': {
      PointShopItem: { updateOne: async (filter, pipeline) => update(item, filter, pipeline), findById: () => query(item) },
      RedemptionRecord: { findById: async id => records.get(String(id)), findOneAndUpdate: async (filter, update) => {
        if (failRecord) { failRecord = false; throw new Error('simulated database disconnect'); }
        if (!records.has(String(filter._id))) records.set(String(filter._id), update.$setOnInsert);
        return records.get(String(filter._id));
      } }
    },
    '../models/Achievement': { updateOne: async (filter, pipeline) => update(achievement, filter, pipeline), findOne: () => query(achievement) },
    '../models/ShopOperation': { updateOne: async (filter, update) => statuses.set(String(filter._id), update.$set) },
    '../utils/pointPrecision': { roundPoints: value => Math.round(value * 100) / 100 },
    '../utils/logger': { error() {} },
    mongoose: { Types: { ObjectId: class {} } }
  };
  const context = { module: { exports: {} }, require: name => models[name], setInterval, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./shopOperationService'), 'utf8'), context);
  const operation = id => ({ _id: id, studentId: 'student', itemId: 'item', itemName: '$item', itemType: 'game', pointCost: 10, duration: 15, status: 'pending', createdAt: new Date() });
  return { ...context.module.exports, operation, item, achievement, records, statuses, failNextRecord: () => { failRecord = true; } };
}

test('one remaining item cannot be sold twice by concurrent requests', async () => {
  const f = fixture({ stock: 1, balance: 30 });
  const results = await Promise.all([f.settleOperation(f.operation('a')), f.settleOperation(f.operation('b'))]);
  assert.equal(results.filter(result => result.record).length, 1);
  assert.equal(f.item.stock, 0); assert.equal(f.achievement.totalPoints, 20); assert.equal(f.records.size, 1);
});
test('concurrent purchases cannot overdraw points; rejected debit restores stock once', async () => {
  const f = fixture({ stock: 2, balance: 10 });
  const a = f.operation('a'), b = f.operation('b');
  await Promise.all([f.settleOperation(a), f.settleOperation(b)]);
  await f.settleOperation(b);
  assert.equal(f.item.stock, 1); assert.equal(f.achievement.totalPoints, 0); assert.equal(f.records.size, 1);
});
test('a lost response after debit resumes without a second debit or stock decrement', async () => {
  const f = fixture(); const operation = f.operation('a'); f.failNextRecord();
  await assert.rejects(f.settleOperation(operation), /disconnect/);
  assert.equal(f.achievement.totalPoints, 0);
  await Promise.all([f.settleOperation(operation), f.settleOperation(operation)]);
  assert.equal(f.item.stock, 0); assert.equal(f.achievement.totalPoints, 0);
  assert.equal(f.achievement.pointTransactions.length, 1); assert.equal(f.records.size, 1);
});
test('unlimited stock stays unlimited, and a rejected decision never changes on retry', async () => {
  const f = fixture({ stock: -1, balance: 0 }); const operation = f.operation('a');
  assert.equal((await f.settleOperation(operation)).reason, '积分不足');
  f.achievement.totalPoints = 20;
  assert.equal((await f.settleOperation(operation)).reason, '积分不足');
  assert.equal(f.item.stock, -1); assert.equal(f.achievement.totalPoints, 20); assert.equal(f.records.size, 0);
});
test('stock zero and inactive items never debit points', async () => {
  for (const inactive of [false, true]) {
    const f = fixture({ stock: inactive ? 1 : 0 }); f.item.isActive = !inactive;
    assert.ok((await f.settleOperation(f.operation('a'))).reason);
    assert.equal(f.achievement.totalPoints, 10); assert.equal(f.records.size, 0);
  }
});
