const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOfficeRuleScores } = require('./officeRuleScores');
test('office default scores are one and legacy equal weights preserve proportions', () => {
  assert.deepEqual(normalizeOfficeRuleScores([{score:10},{score:'10',enabled:false}]).map(r=>r.score), [1,1]);
  assert.deepEqual(normalizeOfficeRuleScores([{}, {score:2}]).map(r=>r.score), [1,2]);
  assert.deepEqual(normalizeOfficeRuleScores([{score:10},{score:2},{score:0}]).map(r=>r.score), [10,2,0]);
});
