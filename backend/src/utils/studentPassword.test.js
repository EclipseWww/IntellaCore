const test = require('node:test');
const assert = require('node:assert/strict');
const { studentPassword } = require('./studentPassword');

test('student passwords are optional; a random one fills the required field', () => {
  for (const empty of [undefined, null, '', '   ']) assert.match(studentPassword(empty).password, /^[0-9a-f]{24}$/);
  assert.notEqual(studentPassword('').password, studentPassword('').password);
  assert.equal(studentPassword(123456).password, '123456', 'numbers from Excel become text');
  assert.ok(studentPassword('123').error);
  assert.ok(studentPassword('x'.repeat(73)).error);
});
