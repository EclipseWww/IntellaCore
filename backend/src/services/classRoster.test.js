const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { load } = require('../testing/reviewTestSupport');

const ADMIN = '507f1f77bcf86cd799439011';
const ELECTIVE = '507f1f77bcf86cd799439022';
const OTHER_ADMIN = '507f1f77bcf86cd799439044';
const S1 = '607f1f77bcf86cd799439001';
const S2 = '607f1f77bcf86cd799439002';
const S3 = '607f1f77bcf86cd799439003';

const chain = value => {
  const q = { select: () => q, lean: async () => value, sort: () => q, then: (r, j) => Promise.resolve(value).then(r, j) };
  return q;
};

function fixture({ classes, users, memberships = [] }) {
  const writes = [];
  const matches = (doc, filter) => Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return cond.some(f => matches(doc, f));
    const value = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof mongoose.Types.ObjectId)) {
      if ('$in' in cond) return cond.$in.map(String).includes(String(value));
      if ('$nin' in cond) return !cond.$nin.includes(value ?? null);
      if ('$gt' in cond) return value > cond.$gt;
      return true;
    }
    return String(value) === String(cond);
  });
  const Class = {
    find: filter => chain(classes.filter(c => matches(c, filter))),
    findById: id => chain(classes.find(c => String(c._id) === String(id)) || null)
  };
  const User = {
    find: filter => {
      const found = users.filter(u => matches(u, filter));
      const q = chain(found);
      q.distinct = async () => found.map(u => u._id);
      return q;
    },
    bulkWrite: async ops => { writes.push(...ops); return { modifiedCount: ops.length }; }
  };
  const ClassMembership = {
    find: filter => {
      const found = memberships.filter(m => matches(m, filter));
      const q = chain(found);
      q.distinct = async field => found.map(m => m[field]);
      return q;
    }
  };
  const roster = load(require.resolve('./classRoster'), {
    mongoose, '../models/Class': Class, '../models/User': User, '../models/ClassMembership': ClassMembership
  });
  return { roster, writes };
}

const future = () => new Date(Date.now() + 3600e3);

test('roster filter keeps the plain home-class query and adds elective members', async () => {
  const { roster } = fixture({
    classes: [{ _id: ADMIN, type: 'admin' }, { _id: ELECTIVE, type: 'elective' }],
    users: [], memberships: [{ class: ELECTIVE, student: S1 }, { class: ELECTIVE, student: S2 }]
  });
  const adminOnly = JSON.parse(JSON.stringify(await roster.rosterFilter([ADMIN])));
  assert.deepEqual(adminOnly, { classId: ADMIN });
  const electiveOnly = JSON.parse(JSON.stringify(await roster.rosterFilter([ELECTIVE])));
  assert.deepEqual(electiveOnly, { _id: { $in: [S1, S2] } });
  const both = JSON.parse(JSON.stringify(await roster.rosterFilter([ADMIN, ELECTIVE])));
  assert.deepEqual(both, { $or: [{ classId: ADMIN }, { _id: { $in: [S1, S2] } }] });
  assert.deepEqual(JSON.parse(JSON.stringify(await roster.rosterFilter(['bad-id']))), { _id: { $in: [] } });
});

test('starting an elective signs out members logged in elsewhere, even if that class already ended', async () => {
  const { roster, writes } = fixture({
    classes: [
      { _id: ELECTIVE, type: 'elective', scheduledEndTime: future() },
      { _id: ADMIN, type: 'admin', isInClass: true },
      { _id: OTHER_ADMIN, type: 'admin', isInClass: false }
    ],
    memberships: [{ class: ELECTIVE, student: S1 }, { class: ELECTIVE, student: S2 }, { class: ELECTIVE, student: S3 }],
    users: [
      { _id: S1, role: 'student', classId: ADMIN, sessionClassId: null, sessionId: 'a', sessionExpiresAt: future(), loginHistory: [{ ip: '10.0.0.1' }] },
      { _id: S2, role: 'student', classId: OTHER_ADMIN, sessionClassId: OTHER_ADMIN, sessionId: 'b', sessionExpiresAt: future(), loginHistory: [{ ip: '10.0.0.2' }] },
      { _id: S3, role: 'student', classId: ADMIN, sessionClassId: ELECTIVE, sessionId: 'c', sessionExpiresAt: future(), loginHistory: [{ ip: '10.0.0.3' }] }
    ]
  });
  const count = await roster.signOutFromOtherClasses(ELECTIVE);
  assert.equal(count, 2);
  const byId = new Map(writes.map(w => [String(w.updateOne.filter._id), w.updateOne]));
  assert.ok(byId.has(S1), 'home class still in session: signed out');
  assert.ok(byId.has(S2), 'home class already ended: signed out too');
  assert.ok(!byId.has(S3), 'already in this elective: untouched');
  assert.equal(byId.get(S1).filter.sessionId, 'a', 'only the session that was seen is cleared');
  assert.equal(byId.get(S1).update.$set.loginHandoff.ip, '10.0.0.1', 'pass bound to the computer they were on');
  assert.equal(String(byId.get(S1).update.$set.loginHandoff.classId), ELECTIVE);
});

test('starting a home class does not interrupt an elective that is still running', async () => {
  const { roster, writes } = fixture({
    classes: [
      { _id: ADMIN, type: 'admin', scheduledEndTime: future() },
      { _id: ELECTIVE, type: 'elective', isInClass: true }
    ],
    memberships: [],
    users: [
      { _id: S1, role: 'student', classId: ADMIN, sessionClassId: ELECTIVE, sessionId: 'a', sessionExpiresAt: future(), loginHistory: [] },
      { _id: S2, role: 'student', classId: ADMIN, sessionClassId: null, sessionId: 'b', sessionExpiresAt: future(), loginHistory: [] }
    ]
  });
  assert.equal(await roster.signOutFromOtherClasses(ADMIN), 0);
  assert.equal(writes.length, 0);
});

test('starting a home class signs students back from an elective that has ended', async () => {
  const { roster, writes } = fixture({
    classes: [
      { _id: ADMIN, type: 'admin', scheduledEndTime: future() },
      { _id: ELECTIVE, type: 'elective', isInClass: false }
    ],
    memberships: [],
    users: [{ _id: S1, role: 'student', classId: ADMIN, sessionClassId: ELECTIVE, sessionId: 'a', sessionExpiresAt: future(), loginHistory: [{ ip: '10.0.0.1' }] }]
  });
  assert.equal(await roster.signOutFromOtherClasses(ADMIN), 1);
  assert.equal(String(writes[0].updateOne.filter._id), S1);
});

test('login pass only applies to the same class, same computer and before it expires', () => {
  const { roster } = fixture({ classes: [], users: [] });
  const user = { loginHandoff: { classId: ELECTIVE, ip: '10.0.0.1', expiresAt: future() } };
  assert.equal(roster.handoffApplies(user, ELECTIVE, '10.0.0.1'), true);
  assert.equal(roster.handoffApplies(user, ADMIN, '10.0.0.1'), false);
  assert.equal(roster.handoffApplies(user, ELECTIVE, '10.0.0.2'), false);
  assert.equal(roster.handoffApplies({ loginHandoff: { ...user.loginHandoff, expiresAt: new Date(Date.now() - 1) } }, ELECTIVE, '10.0.0.1'), false);
  assert.equal(roster.handoffApplies({}, ELECTIVE, '10.0.0.1'), false);
});

test('bound IP is per class: home class uses its own login records, electives use the membership', () => {
  const { roster } = fixture({ classes: [], users: [] });
  const user = { classId: ADMIN, loginHistory: [{ ip: '10.0.0.9', classId: ELECTIVE }, { ip: '10.0.0.1' }] };
  assert.equal(roster.boundIpFor(user, { _id: ADMIN, type: 'admin' }), '10.0.0.1');
  assert.equal(roster.boundIpFor(user, { _id: ELECTIVE, type: 'elective' }, { boundIp: '10.0.0.5' }), '10.0.0.5');
  assert.equal(roster.boundIpFor(user, { _id: ELECTIVE, type: 'elective' }, { boundIp: null }), null);
  assert.equal(roster.contextClassId({ classId: ADMIN, sessionClassId: ELECTIVE }), ELECTIVE);
  assert.equal(roster.contextClassId({ classId: ADMIN, sessionClassId: null }), ADMIN);
});
