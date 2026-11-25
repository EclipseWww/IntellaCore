const mongoose = require('mongoose');
const PythonSubmission = require('../models/PythonSubmission');
const Lesson = require('../models/Lesson');
const PointsManager = require('../utils/pointsManager');
const pythonJudge = require('../services/pythonJudge');

/**
 * Python编程活动控制器
 *
 * 评分以服务器判题为准：测试点（含隐藏测试点）只保存在服务器，分数由服务器计算，前端传来的分数一律忽略。
 * 教师手动评分后作业锁定，学生不能再提交或撤回；教师清除评分后解锁。
 */

const MAX_CODE_LENGTH = 64 * 1024;
const MAX_OUTPUT_LENGTH = 100 * 1024;
const MAX_ATTEMPTS_KEPT = 30;
const DEFAULT_STARTER = '# 在这里编写你的Python代码\n';
const MIN_SUBMIT_INTERVAL_MS = 3000;

// 同一用户同时只能有一次判题，且两次提交间隔不少于 3 秒，避免连点占满判题队列
const judgingUsers = new Set();
const lastSubmitAt = new Map();
function claimSubmitSlot(userId) {
    const now = Date.now();
    if (judgingUsers.has(userId) || now - (lastSubmitAt.get(userId) || 0) < MIN_SUBMIT_INTERVAL_MS) return false;
    judgingUsers.add(userId);
    lastSubmitAt.set(userId, now);
    if (lastSubmitAt.size > 5000) {
        for (const [id, at] of lastSubmitAt) if (now - at > MIN_SUBMIT_INTERVAL_MS) lastSubmitAt.delete(id);
    }
    return true;
}

const userIdOf = req => String(req.user._id || req.user.id);
const isStaff = user => user.role === 'teacher' || user.role === 'admin';
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const isManuallyGraded = submission => submission?.score != null && !!submission.gradedBy;

// 旧数据没有 awardedPoints：教师评过的分当时已发过积分，自动评分当时没有发
const awardedPointsOf = submission => {
    if (submission.awardedPoints != null) return submission.awardedPoints;
    return submission.score != null && submission.gradedBy ? submission.score * 10 : 0;
};

async function syncPoints(submission, newPoints, description) {
    const oldPoints = awardedPointsOf(submission);
    if (oldPoints === newPoints && submission.awardedPoints != null) return;
    try {
        if (oldPoints !== newPoints) {
            await PointsManager.updatePoints(submission.studentId?._id || submission.studentId, newPoints, oldPoints, submission._id, 'task_completion', description);
        }
        await PythonSubmission.updateOne({ _id: submission._id }, { $set: { awardedPoints: newPoints } });
        submission.awardedPoints = newPoints;
    } catch (error) {
        console.error('Python作业积分更新失败:', error);
    }
}

function validateCode(code) {
    if (typeof code !== 'string') return '代码格式不正确';
    if (code.length > MAX_CODE_LENGTH) return `代码过长（最多 ${MAX_CODE_LENGTH / 1024}KB）`;
    return null;
}

const clampOutput = output => (typeof output === 'string' ? output.slice(0, MAX_OUTPUT_LENGTH) : '');

async function findPythonActivity(lessonId, activityId) {
    if (!mongoose.isValidObjectId(lessonId)) return { error: [400, '课时ID无效'] };
    const lesson = await Lesson.findById(lessonId).select('activities');
    if (!lesson) return { error: [404, '课时不存在'] };
    const activity = lesson.activities.find(a => String(a._id) === String(activityId));
    if (!activity || activity.type !== 'python') return { error: [404, '活动不存在'] };
    return { activity };
}

/** 返回给学生的提交记录：去掉隐藏测试点的输入/预期输出与历史代码 */
function toStudentView(submission) {
    const data = submission.toObject ? submission.toObject() : { ...submission };
    data.attemptCount = data.attempts?.length || 0;
    delete data.attempts;
    delete data.awardedPoints;
    if (data.testResults?.results) {
        data.testResults.results = data.testResults.results.map(result => {
            if (!result.isHidden) return result;
            const { input, expectedOutput, ...rest } = result;
            return rest;
        });
    }
    data.locked = isManuallyGraded(data);
    return data;
}

// 获取学生的提交记录（没有则用初始代码创建草稿）
exports.getSubmission = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = userIdOf(req);
        let submission = await PythonSubmission.findOne({ lessonId, activityId, studentId });

        if (!submission) {
            const { activity, error } = await findPythonActivity(lessonId, activityId);
            if (error) return fail(res, ...error);
            submission = await PythonSubmission.findOneAndUpdate(
                { lessonId, activityId, studentId },
                { $setOnInsert: { code: activity.pythonSettings?.starterCode || DEFAULT_STARTER, status: 'draft' } },
                { new: true, upsert: true }
            );
        }

        res.json({ success: true, data: toStudentView(submission) });
    } catch (error) {
        console.error('获取Python提交记录失败:', error);
        res.status(500).json({ success: false, message: '获取提交记录失败' });
    }
};

// 保存草稿；已提交的作业另存为 draftCode，不影响教师看到的提交版本
exports.saveDraft = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const { code, output } = req.body;
        const invalid = validateCode(code);
        if (invalid) return fail(res, 400, invalid);
        if (!mongoose.isValidObjectId(lessonId)) return fail(res, 400, '课时ID无效');
        const studentId = userIdOf(req);

        const existing = await PythonSubmission.findOne({ lessonId, activityId, studentId }).select('status');
        const update = existing?.status === 'submitted'
            ? { $set: { draftCode: code } }
            : { $set: { code, output: clampOutput(output), status: 'draft', draftCode: null } };
        const submission = await PythonSubmission.findOneAndUpdate(
            { lessonId, activityId, studentId },
            update,
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            data: toStudentView(submission),
            message: existing?.status === 'submitted' ? '修改已保存（尚未提交）' : '草稿已保存'
        });
    } catch (error) {
        console.error('保存Python草稿失败:', error);
        res.status(500).json({ success: false, message: '保存草稿失败' });
    }
};

async function runJudge(activity, code) {
    const testCases = activity.pythonSettings?.testCases || [];
    if (testCases.length === 0) return { judged: null, judgeError: null };
    try {
        return { judged: await pythonJudge.judge(code, testCases), judgeError: null };
    } catch (error) {
        if (error instanceof pythonJudge.JudgeBusyError) return { busy: true, judgeError: error.message };
        console.error('Python判题失败:', error);
        return { judged: null, judgeError: '服务器判题暂时不可用，已提交等待教师评分' };
    }
}

// 提交代码：服务器运行全部测试点并自动评分
exports.submit = async (req, res) => {
    const userId = userIdOf(req);
    if (!claimSubmitSlot(userId)) return fail(res, 429, '提交太频繁，请稍等几秒再试');
    try {
        const { lessonId, activityId } = req.params;
        const { code, output } = req.body;
        const invalid = validateCode(code);
        if (invalid) return fail(res, 400, invalid);
        if (!code.trim()) return fail(res, 400, '请先编写代码');

        const { activity, error } = await findPythonActivity(lessonId, activityId);
        if (error) return fail(res, ...error);

        const asStudent = req.user.role === 'student';
        const studentId = userId;
        const existing = asStudent ? await PythonSubmission.findOne({ lessonId, activityId, studentId }) : null;

        if (isManuallyGraded(existing)) return fail(res, 409, '老师已评分，不能再提交；如需修改请联系老师');
        const maxAttempts = activity.pythonSettings?.maxAttempts || 0;
        const usedAttempts = existing?.attempts?.length || 0;
        if (asStudent && maxAttempts > 0 && usedAttempts >= maxAttempts) {
            return fail(res, 409, `已达到最多提交次数（${maxAttempts} 次）`);
        }

        const { judged, judgeError, busy } = await runJudge(activity, code);
        if (busy) return fail(res, 503, judgeError);

        const now = new Date();
        const set = {
            code,
            output: clampOutput(output),
            status: 'submitted',
            submittedAt: now,
            draftCode: null,
            gradedBy: null
        };
        if (judged) {
            Object.assign(set, {
                score: judged.score,
                gradedAt: now,
                feedback: '自动评测',
                testResults: { passedCount: judged.passedCount, totalCount: judged.totalCount, results: judged.results, judgedAt: now }
            });
        } else {
            Object.assign(set, { score: null, gradedAt: null, feedback: '', testResults: { passedCount: 0, totalCount: 0, results: [] } });
        }
        const attempt = {
            code,
            passedCount: judged?.passedCount ?? null,
            totalCount: judged?.totalCount ?? null,
            score: judged?.score ?? null,
            submittedAt: now
        };
        const autoMessage = judged
            ? `提交成功：通过 ${judged.passedCount}/${judged.totalCount} 个测试点，自动评分 ${judged.score}/10`
            : (judgeError || '代码已提交，等待教师评分');

        if (!asStudent) {
            // 教师预览：只返回判题结果，不写数据库
            return res.json({
                success: true,
                data: { ...set, _id: new mongoose.Types.ObjectId(), lessonId, activityId, studentId, attemptCount: 0, locked: false },
                message: `${autoMessage}（教师预览，未保存）`
            });
        }

        const submission = await PythonSubmission.findOneAndUpdate(
            existing
                ? { _id: existing._id, $or: [{ gradedBy: null }, { score: null }] }
                : { lessonId, activityId, studentId },
            { $set: set, $push: { attempts: { $each: [attempt], $slice: -MAX_ATTEMPTS_KEPT } } },
            { new: true, upsert: !existing }
        );
        if (!submission) return fail(res, 409, '老师已评分，不能再提交；如需修改请联系老师');

        await syncPoints(submission, judged ? judged.score * 10 : 0, `Python作业自动评分: ${judged?.score ?? 0}分`);

        res.json({ success: true, data: toStudentView(submission), message: autoMessage });
    } catch (error) {
        console.error('提交Python代码失败:', error);
        res.status(500).json({ success: false, message: '提交代码失败' });
    } finally {
        judgingUsers.delete(userId);
    }
};

// 撤回提交（教师已评分的不能撤回；自动评分随之清除）
exports.withdraw = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = userIdOf(req);
        const submission = await PythonSubmission.findOne({ lessonId, activityId, studentId });

        if (!submission) return fail(res, 404, '提交记录不存在');
        if (submission.status !== 'submitted') return fail(res, 400, '当前状态无法撤回');
        if (isManuallyGraded(submission)) return fail(res, 400, '老师已评分的提交无法撤回');

        if (submission.draftCode != null) submission.code = submission.draftCode;
        submission.draftCode = null;
        submission.status = 'draft';
        submission.submittedAt = null;
        submission.score = null;
        submission.gradedAt = null;
        submission.feedback = '';
        await submission.save();
        await syncPoints(submission, 0, 'Python作业撤回');

        res.json({ success: true, data: toStudentView(submission), message: '已撤回提交' });
    } catch (error) {
        console.error('撤回Python提交失败:', error);
        res.status(500).json({ success: false, message: '撤回提交失败' });
    }
};

// 学生查看自己的历史提交
exports.getMyAttempts = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const submission = await PythonSubmission.findOne({ lessonId, activityId, studentId: userIdOf(req) }).select('attempts');
        res.json({ success: true, data: (submission?.attempts || []).slice().reverse() });
    } catch (error) {
        console.error('获取Python提交历史失败:', error);
        res.status(500).json({ success: false, message: '获取提交历史失败' });
    }
};

// 教师端 - 获取活动的所有提交记录（历史提交只带统计信息，不带代码）
exports.getActivitySubmissions = async (req, res) => {
    try {
        if (!isStaff(req.user)) return fail(res, 403, '权限不足');

        const { lessonId, activityId } = req.params;
        const { classId } = req.query;

        let submissions = await PythonSubmission.find({ lessonId, activityId, status: 'submitted' })
            .select('-attempts.code')
            .populate({
                path: 'studentId',
                select: 'name studentId classId role',
                populate: { path: 'classId', select: 'grade name status' }
            })
            .populate('gradedBy', 'name')
            .sort({ submittedAt: -1 });

        // 只显示真正学生的提交，并过滤掉所在班级已归档的学生
        submissions = submissions.filter(s => {
            const isStudent = s.studentId && s.studentId.role !== 'teacher' && s.studentId.role !== 'admin';
            const isArchived = s.studentId?.classId?.status === 'archived';
            return isStudent && !isArchived;
        });

        if (classId) {
            submissions = submissions.filter(s => s.studentId?.classId?._id?.toString() === classId);
        }

        res.json({ success: true, data: submissions });
    } catch (error) {
        console.error('获取Python提交列表失败:', error);
        res.status(500).json({ success: false, message: '获取提交列表失败' });
    }
};

// 教师端 - 查看某份提交的历史版本
exports.getSubmissionAttempts = async (req, res) => {
    try {
        if (!isStaff(req.user)) return fail(res, 403, '权限不足');
        if (!mongoose.isValidObjectId(req.params.submissionId)) return fail(res, 400, '提交ID无效');
        const submission = await PythonSubmission.findById(req.params.submissionId).select('attempts');
        if (!submission) return fail(res, 404, '提交记录不存在');
        res.json({ success: true, data: submission.attempts.slice().reverse() });
    } catch (error) {
        console.error('获取Python提交历史失败:', error);
        res.status(500).json({ success: false, message: '获取提交历史失败' });
    }
};

// 教师端 - 评分（score 为 null 表示清除评分，学生可重新提交）
exports.gradeSubmission = async (req, res) => {
    try {
        if (!isStaff(req.user)) return fail(res, 403, '权限不足');

        const { submissionId } = req.params;
        const { feedback } = req.body;
        const score = req.body.score === null || req.body.score === undefined ? null : Number(req.body.score);
        if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) {
            return fail(res, 400, '分数必须在0-10之间');
        }
        if (!mongoose.isValidObjectId(submissionId)) return fail(res, 400, '提交ID无效');

        const submission = await PythonSubmission.findById(submissionId).select('-attempts');
        if (!submission) return fail(res, 404, '提交记录不存在');

        // 修改评分前记下已发积分，保存后据此计算差额
        const previouslyAwarded = awardedPointsOf(submission);
        if (score === null) {
            submission.score = null;
            submission.feedback = '';
            submission.gradedAt = null;
            submission.gradedBy = null;
        } else {
            submission.score = score;
            submission.feedback = typeof feedback === 'string' ? feedback : '';
            submission.gradedAt = new Date();
            submission.gradedBy = userIdOf(req);
        }
        await submission.save();
        submission.awardedPoints = previouslyAwarded;
        await syncPoints(
            submission,
            score === null ? 0 : score * 10,
            score === null ? 'Python作业评分已清除' : `Python作业评分: ${score}分`
        );

        const populated = await PythonSubmission.findById(submissionId).select('-attempts.code').populate('studentId', 'name studentId');
        res.json({ success: true, data: populated, message: score === null ? '评分已清除' : '评分成功' });
    } catch (error) {
        console.error('Python评分失败:', error);
        res.status(500).json({ success: false, message: '评分失败' });
    }
};

// 教师端 - 删除提交记录
exports.deleteSubmission = async (req, res) => {
    try {
        if (!isStaff(req.user)) return fail(res, 403, '权限不足');
        if (!mongoose.isValidObjectId(req.params.submissionId)) return fail(res, 400, '提交ID无效');

        const submission = await PythonSubmission.findByIdAndDelete(req.params.submissionId);
        if (!submission) return fail(res, 404, '提交记录不存在');

        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        console.error('删除Python提交记录失败:', error);
        res.status(500).json({ success: false, message: '删除失败' });
    }
};

exports._internals = { toStudentView, awardedPointsOf, isManuallyGraded };
