const test = require('node:test');
const assert = require('node:assert/strict');
const { load, apply, logger } = require('../testing/reviewTestSupport');
function fixture({ balance = 100, target = 100 } = {}) {
  const campaign = { _id: 'campaign', classId: 'class', targetPoints: target, currentPoints: 0, reservedPoints: 0,
    status: 'active', startDate: new Date(0), endDate: new Date(Date.now() + 60000), contributionReceipts: [], settledContributionIds: [], participants: [], contributionsCount: 0 };
  const account = { totalPoints: balance, shopReceipts: [], pointTransactions: [] };
  const operations = new Map(), contributions = new Map();
  let failure;
  const check = phase => { if (failure === phase) { failure = null; throw new Error('lost acknowledgement: ' + phase); } };
  const crowdfunding = {
    updateOne: async (filter, pipeline) => {
      if (filter['contributionReceipts.id'] && campaign.contributionReceipts.some(r => r.id === filter['contributionReceipts.id'].$ne)) return;
      if (filter.settledContributionIds && campaign.settledContributionIds.includes(filter.settledContributionIds.$ne)) return;
      apply(campaign, pipeline); check(filter.settledContributionIds ? 'finalize' : 'reserve');
    },
    findById: () => ({ select: async () => campaign, then: (resolve, reject) => Promise.resolve(campaign).then(resolve, reject) })
  };
  const shop = load(require.resolve('./shopOperationService'), {
    mongoose: { Types: { ObjectId: class {} } }, '../models/ShopOperation': {}, '../models/PointShop': {},
    '../models/Achievement': {
      updateOne: async (filter, pipeline) => {
        if (account.shopReceipts.some(r => r.id === filter['shopReceipts.id'].$ne)) return;
        apply(account, pipeline); check('debit');
      }, findOne: () => ({ select: async () => account })
    }, '../utils/pointPrecision': { roundPoints: value => Math.round(value * 100) / 100 }, '../utils/logger': logger
  });
  const service = load(require.resolve('./crowdfundingOperationService'), {
    '../models/Crowdfunding': { Crowdfunding: crowdfunding, CrowdfundingContribution: {
      findById: async id => contributions.get(id),
      findOneAndUpdate: async (filter, update) => { if (!contributions.has(filter._id)) contributions.set(filter._id, update.$setOnInsert); check('record'); return contributions.get(filter._id); }
    } },
    '../models/CrowdfundingOperation': {
      create: async data => { const op = { ...data, _id: 'op' + operations.size, status: 'pending' }; operations.set(op._id, op); return op; },
      updateOne: async (filter, update) => { const op = operations.get(filter._id); if (op && op.status === 'pending') Object.assign(op, update.$set); }
    },
    '../models/Achievement': { exists: async () => true },
    '../models/User': { findById: async () => ({ role: 'student', classId: 'class' }) },
    './shopOperationService': shop, '../utils/logger': logger
  });
  const operation = (id, points = 100) => { const op = { _id: id, crowdfundingId: 'campaign', studentId: 'student', points, status: 'pending' }; operations.set(id, op); return op; };
  return { ...service, campaign, account, contributions, operations, operation, fail: phase => { failure = phase; } };
}

test('concurrent contributions cannot exceed the target or overdraw the account', async () => {
  const f = fixture({ target: 150, balance: 200 });
  await Promise.all([f.settle(f.operation('a')), f.settle(f.operation('b'))]);
  assert.equal(f.campaign.currentPoints, 150);
  assert.equal(f.account.totalPoints, 50);
  assert.equal(f.campaign.reservedPoints, 0);
  assert.equal(f.campaign.status, 'ready_to_complete');
  assert.equal([...f.contributions.values()].reduce((sum, row) => sum + row.points, 0), 150);
});
test('insufficient funds releases capacity without recording a contribution', async () => {
  const f = fixture({ balance: 50 });
  assert.equal((await f.settle(f.operation('a'))).reason, '积分不足');
  assert.equal(f.campaign.currentPoints, 0);
  assert.equal(f.campaign.reservedPoints, 0);
  assert.equal(f.campaign.contributionsCount, 0);
  assert.equal(f.contributions.size, 0);
  assert.equal(f.account.totalPoints, 50);
});
for (const phase of ['reserve', 'debit', 'finalize', 'record']) {
  test('retry after lost ' + phase + ' acknowledgement changes each resource once', async () => {
    const f = fixture(); const op = f.operation('a'); f.fail(phase);
    await assert.rejects(f.settle(op), /lost acknowledgement/);
    await Promise.all([f.settle(op), f.settle(op)]);
    assert.equal(f.campaign.currentPoints, 100);
    assert.equal(f.campaign.reservedPoints, 0);
    assert.equal(f.account.totalPoints, 0);
    assert.equal(f.account.pointTransactions.length, 1);
    assert.equal(f.campaign.contributionsCount, 1);
    assert.equal(f.contributions.size, 1);
  });
}
test('rejects non-finite, fractional and non-numeric input before creating operations', async () => {
  const f = fixture();
  for (const value of [NaN, Infinity, '100', -1, 0, 1.1]) await assert.rejects(f.contribute('campaign', 'student', value), /正整数/);
  assert.equal(f.operations.size, 0);
});
