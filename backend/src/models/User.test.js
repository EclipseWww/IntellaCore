const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('./User');

test('username declares a single unique index compatible with existing school databases', () => {
  const indexes = User.schema.indexes().filter(([key]) => Object.hasOwn(key, 'username'));
  assert.equal(indexes.length, 1, 'duplicate username indexes break initialization');
  assert.deepEqual(indexes[0][0], { username: 1 });
  assert.equal(indexes[0][1].unique, true);
  assert.equal(indexes[0][1].sparse, undefined);
  assert.equal(indexes[0][1].partialFilterExpression, undefined);
});
