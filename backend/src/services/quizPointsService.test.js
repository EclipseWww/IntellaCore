const test = require('node:test');
const assert = require('node:assert/strict');
const { load, apply, logger } = require('../testing/reviewTestSupport');
function fixture({ balance = 0, rows = [] } = {}) {
  const account = { _id: 'account', totalPoints: balance, quizAwards: {}, pointTransactions: [] };
  let lost = false;
  const service = load(require.resolve('./quizPointsService'), {
    mongoose: { Types: { ObjectId: class {} } },
    '../models/Quiz': { findById: async () => ({ questions: Array(10).fill({}), isScaleTest: false }) },
    '../models/Achievement': {
      exists: async () => true,
      findOne: () => ({ select: async () => ({ _id: account._id, quizAwards: new Map(Object.entries(account.quizAwards)) }) }),
      updateOne: async (filter, pipeline) => {
        const expected = filter['quizAwards.quiz']; const actual = account.quizAwards.quiz;
        if (typeof expected === 'object' ? actual != null : expected !== actual) return { matchedCount: 0 };
        apply(account, pipeline);
        if (lost) { lost = false; throw new Error('lost write acknowledgement'); }
        return { matchedCount: 1 };
      }
    },
    '../models/QuizSubmission': {
      find: () => ({ select: async () => rows.map(row => ({ ...row })) }),
      updateOne: async (filter, update) => { const row = rows.find(r => r._id === filter._id); if (row) Object.assign(row, update.$set); }
    }, '../utils/logger': logger
  });
  const submission = row => ({ quizId: 'quiz', studentId: 'student', ...row });
  return { ...service, rows, account, submission, loseAcknowledgement: () => { lost = true; } };
}
test('concurrent settlements award the best percentage once', async () => {
  const f = fixture({ rows: [{ _id: 'a', status: 'SUBMITTED', score: 8, pointsTarget: 80 }, { _id: 'b', status: 'SUBMITTED', score: 10, pointsTarget: 100 }] });
  await Promise.all(f.rows.map(row => f.settleQuizPoints(f.submission(row))));
  assert.equal(f.account.totalPoints, 100);
  assert.equal(f.account.quizAwards.quiz, 100);
  assert.equal(f.account.pointTransactions.length, 1);
});
test('retry after committed award never duplicates points', async () => {
  const row = { _id: 'a', status: 'SUBMITTED', pointsTarget: 80, pointsPending: true };
  const f = fixture({ rows: [row] }); f.loseAcknowledgement();
  await assert.rejects(f.settleQuizPoints(f.submission(row)), /lost write/);
  assert.equal(row.pointsPending, true);
  await f.settleQuizPoints(f.submission(row));
  assert.equal(f.account.totalPoints, 80);
  assert.equal(f.account.pointTransactions.length, 1);
  assert.equal(row.pointsPending, false);
});
test('deleting the highest result revokes only the difference and later retakes can earn it back', async () => {
  const high = { _id: 'high', status: 'SUBMITTED', pointsTarget: 100 };
  const low = { _id: 'low', status: 'SUBMITTED', pointsTarget: 60 };
  const f = fixture({ rows: [high, low] });
  await f.settleQuizPoints(f.submission(high));
  high.status = 'DELETED';
  await f.settleQuizPoints(f.submission(high));
  assert.equal(f.account.totalPoints, 60);
  const retake = { _id: 'retake', status: 'SUBMITTED', pointsTarget: 90 };
  f.rows.push(retake);
  await f.settleQuizPoints(f.submission(retake));
  assert.equal(f.account.totalPoints, 90);
});
test('legacy paid results initialize the ledger without re-awarding their points', async () => {
  const legacy = { _id: 'legacy', status: 'SUBMITTED', score: 8 };
  const newRow = { _id: 'new', status: 'SUBMITTED', pointsTarget: 100 };
  const f = fixture({ balance: 80, rows: [legacy, newRow] });
  await f.settleQuizPoints(f.submission(newRow));
  assert.equal(f.account.totalPoints, 100);
  assert.equal(f.account.pointTransactions[0].amount, 20);
});
test('revoking spent points does not make the balance negative', async () => {
  const row = { _id: 'a', status: 'DELETED', pointsTarget: 100 };
  const f = fixture({ balance: 5, rows: [row] }); f.account.quizAwards.quiz = 100;
  await f.settleQuizPoints(f.submission(row));
  assert.equal(f.account.totalPoints, 0);
  assert.equal(f.account.pointTransactions[0].amount, -5);
});
