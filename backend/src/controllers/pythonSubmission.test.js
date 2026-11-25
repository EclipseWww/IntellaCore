const test = require('node:test');
const assert = require('node:assert/strict');
const { load, response } = require('../testing/reviewTestSupport');

class JudgeBusyError extends Error {}
class JudgeUnavailableError extends Error {}

function setup({ existing = null, judged, judgeError, testCases = [{ input: '1', expectedOutput: '1', isHidden: true }], maxAttempts = 0 } = {}) {
  const calls = { updates: [], points: [], judge: [] };
  const lesson = { activities: [{ _id: 'act', type: 'python', pythonSettings: { testCases, maxAttempts } }] };
  const PythonSubmission = {
    findOne: () => {
      const query = Promise.resolve(existing);
      query.select = () => Promise.resolve(existing);
      return query;
    },
    findOneAndUpdate: async (filter, update, options) => {
      calls.updates.push({ filter, update, options });
      if (filter.$or && existing && existing.gradedBy && existing.score != null) return null;
      return { _id: 'sub', studentId: 'stu', ...(existing || {}), ...update.$set, attempts: [...(existing?.attempts || []), ...(update.$push?.attempts.$each || [])] };
    },
    updateOne: async () => {}
  };
  const controller = load(require.resolve('./pythonController'), {
    mongoose: { isValidObjectId: () => true, Types: { ObjectId: class {} } },
    '../models/PythonSubmission': PythonSubmission,
    '../models/Lesson': { findById: () => ({ select: async () => lesson }) },
    '../utils/pointsManager': { updatePoints: async (...args) => calls.points.push(args) },
    '../services/pythonJudge': {
      JudgeBusyError,
      JudgeUnavailableError,
      judge: async (code, cases) => {
        calls.judge.push({ code, cases });
        if (judgeError) throw judgeError;
        return judged;
      }
    }
  });
  const submit = async (body = {}, role = 'student', user = 'stu') => {
    const res = response();
    await controller.submit({ user: { role, id: user }, params: { lessonId: 'lesson', activityId: 'act' }, body: { code: 'print(1)', ...body } }, res);
    return res;
  };
  return { controller, calls, submit };
}

const judgedResult = {
  passedCount: 1,
  totalCount: 2,
  score: 5,
  results: [
    { index: 0, passed: true, status: 'AC', isHidden: false, actualOutput: '1' },
    { index: 1, passed: false, status: 'WA', isHidden: true, actualOutput: '2', input: 'secret', expectedOutput: 'secret' }
  ]
};

test('提交以服务器判题为准，忽略前端传来的分数', async () => {
  const { calls, submit } = setup({ judged: judgedResult });
  const res = await submit({ autoScore: 10, testResults: { passedCount: 9, totalCount: 9 } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.judge.length, 1);
  const set = calls.updates[0].update.$set;
  assert.equal(set.score, 5);
  assert.equal(set.testResults.passedCount, 1);
  assert.equal(set.gradedBy, null);
  assert.deepEqual(calls.points[0].slice(1, 3), [50, 0]);
  // 隐藏测试点的输入与预期输出不返回给学生
  const hidden = res.body.data.testResults.results[1];
  assert.equal(hidden.input, undefined);
  assert.equal(hidden.expectedOutput, undefined);
  assert.equal(res.body.data.attempts, undefined);
  assert.equal(res.body.data.attemptCount, 1);
});

test('教师已评分的作业不能再提交', async () => {
  const { calls, submit } = setup({ existing: { _id: 'sub', score: 8, gradedBy: 'teacher', attempts: [] }, judged: judgedResult });
  const res = await submit({}, 'student', 'stu-locked');
  assert.equal(res.statusCode, 409);
  assert.equal(calls.judge.length, 0);
  assert.equal(calls.updates.length, 0);
});

test('达到提交次数上限后拒绝提交', async () => {
  const { calls, submit } = setup({ existing: { _id: 'sub', score: 5, gradedBy: null, attempts: [{}, {}] }, judged: judgedResult, maxAttempts: 2 });
  const res = await submit({}, 'student', 'stu-max');
  assert.equal(res.statusCode, 409);
  assert.equal(calls.judge.length, 0);
});

test('判题服务不可用时提交转为待教师评分', async () => {
  const { calls, submit } = setup({ judgeError: new JudgeUnavailableError('down') });
  const res = await submit({}, 'student', 'stu-down');
  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].update.$set.score, null);
  assert.match(res.body.message, /等待教师评分/);
});

test('判题队列已满时返回 503 且不写库', async () => {
  const { calls, submit } = setup({ judgeError: new JudgeBusyError('busy') });
  const res = await submit({}, 'student', 'stu-busy');
  assert.equal(res.statusCode, 503);
  assert.equal(calls.updates.length, 0);
});

test('同一学生连续快速提交会被限流', async () => {
  const { submit } = setup({ judged: judgedResult });
  assert.equal((await submit({}, 'student', 'stu-fast')).statusCode, 200);
  assert.equal((await submit({}, 'student', 'stu-fast')).statusCode, 429);
});

test('教师预览提交只判题不写库', async () => {
  const { calls, submit } = setup({ judged: judgedResult });
  const res = await submit({}, 'teacher', 'teacher-preview');
  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates.length, 0);
  assert.equal(res.body.data.score, 5);
});

test('已提交后保存的修改存为 draftCode，不覆盖提交版本', async () => {
  const { controller, calls } = setup({ existing: { _id: 'sub', status: 'submitted' } });
  const res = response();
  await controller.saveDraft({ user: { role: 'student', id: 'stu' }, params: { lessonId: 'lesson', activityId: 'act' }, body: { code: 'print(2)' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.stringify(calls.updates[0].update), JSON.stringify({ $set: { draftCode: 'print(2)' } }));
});

test('旧数据的已发积分：教师评分计入，旧版自动评分不计入', () => {
  const { controller } = setup();
  const { awardedPointsOf } = controller._internals;
  assert.equal(awardedPointsOf({ score: 7, gradedBy: 'teacher', awardedPoints: null }), 70);
  assert.equal(awardedPointsOf({ score: 7, gradedBy: null, awardedPoints: null }), 0);
  assert.equal(awardedPointsOf({ score: 7, gradedBy: null, awardedPoints: 70 }), 70);
});
