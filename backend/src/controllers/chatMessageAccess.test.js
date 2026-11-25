const test = require('node:test');
const assert = require('node:assert/strict');
const Message = require('../models/Message');
const chatController = require('./chatController');
const { response } = require('../testing/reviewTestSupport');

test('students can only fetch their own chat message (filter must include student id)', async () => {
  const original = Message.findOne;
  const filters = [];
  Message.findOne = async filter => { filters.push(filter); return null; };
  try {
    await chatController.getMessage({ params: { id: 'm1' }, user: { _id: 's1', id: 's1', role: 'student' } }, response());
    await chatController.getMessage({ params: { id: 'm1' }, user: { _id: 'a1', id: 'a1', role: 'admin' } }, response());
  } finally { Message.findOne = original; }
  assert.deepEqual(filters[0], { _id: 'm1', student: 's1' });
  assert.deepEqual(filters[1], { _id: 'm1' });
});
