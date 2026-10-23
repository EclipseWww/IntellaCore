const test = require('node:test');
const assert = require('node:assert/strict');
const { isAutomaticGrade, isManualGrade } = require('./submissionGradePolicy');
const { withSubmissionLock } = require('./submissionLock');
test('manual grade blocks replacement, automatic and zero grades preserve provenance', () => {
  assert.equal(isManualGrade({grade:{score:0,source:'manual'}}),true);
  assert.equal(isManualGrade({grade:{score:0,source:'ppt_auto'}}),false);
  assert.equal(isManualGrade({grade:{score:3.33,source:'excel_auto'}}),false);
  assert.equal(isManualGrade({grade:{score:8}}),true);
  assert.equal(isManualGrade({}),false);
  const legacy={grade:{score:4,feedback:'正确',gradedAt:new Date(1000)},pptAutoGrade:{score:4,feedback:'正确',gradedAt:new Date(990)}};
  assert.equal(isAutomaticGrade(legacy),true);
  legacy.grade.source='manual'; assert.equal(isManualGrade(legacy),true);
  delete legacy.grade.source; legacy.grade.gradedAt=new Date(10000); assert.equal(isManualGrade(legacy),true);
});
test('uploads of the same assignment run in order and failure releases the lock',async()=>{
  const order=[];
  const a=withSubmissionLock('student:activity',async()=>{order.push('a');await Promise.resolve();throw new Error('failed');});
  const b=withSubmissionLock('student:activity',async()=>{order.push('b');return 2;});
  await assert.rejects(a,/failed/); assert.equal(await b,2); assert.deepEqual(order,['a','b']);
});
