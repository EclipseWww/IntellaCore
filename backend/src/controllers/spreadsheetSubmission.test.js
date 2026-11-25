const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('../testing/reviewTestSupport');

function setup(doc) {
  let saves = 0;
  const submission = { userId: 'stu', status: 'submitted', markModified() {}, save: async () => { saves++; }, ...doc };
  const controller = load(require.resolve('./spreadsheetSubmissionController'), {
    '../models/SpreadsheetSubmission': { findById: async () => submission },
    mongoose: require('mongoose')
  });
  const call = async body => { const res = response(); await controller.updateSubmission({ params: { id: 's' }, body, user: { id: 'stu', role: 'student' } }, res); return res; };
  return { call, submission, saves: () => saves };
}

test('students can save their spreadsheet as draft or submitted', async () => {
  const { call, submission, saves } = setup();
  assert.equal((await call({ spreadsheetData: { a: 1 }, status: 'submitted' })).statusCode, 200);
  assert.equal(submission.status, 'submitted'); assert.equal(saves(), 1);
});

test('students cannot mark their own spreadsheet graded or edit after grading', async () => {
  const fresh = setup();
  assert.equal((await fresh.call({ status: 'graded' })).statusCode, 400);
  assert.equal(fresh.submission.status, 'submitted'); assert.equal(fresh.saves(), 0);
  const graded = setup({ status: 'graded', spreadsheetData: { a: 1 } });
  assert.equal((await graded.call({ spreadsheetData: { a: 2 }, status: 'submitted' })).statusCode, 409);
  assert.deepEqual(graded.submission.spreadsheetData, { a: 1 }); assert.equal(graded.saves(), 0);
});
