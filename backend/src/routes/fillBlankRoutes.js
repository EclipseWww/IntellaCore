const express = require('express');
const router = express.Router();
const FillBlankSubmission = require('../models/FillBlankSubmission');
const Lesson = require('../models/Lesson');
const auth = require('../middleware/auth');
const PointsManager = require('../utils/pointsManager');

// 解析填空内容，提取所有{{blank:答案}}中的正确答案
function extractCorrectAnswers(content) {
    const regex = /\{\{blank:([^}]*)\}\}/g;
    const answers = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        answers.push(match[1].trim());
    }
    return answers;
}

// 获取学生的填空提交记录
router.get('/:lessonId/:activityId/submission', auth, async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user.id;

        let submission = await FillBlankSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        // 如果没有提交记录，创建一个草稿
        if (!submission) {
            submission = new FillBlankSubmission({
                lessonId,
                activityId,
                studentId,
                answers: {},
                status: 'draft'
            });
            await submission.save();
        }

        res.json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error('获取填空提交失败:', error);
        res.status(500).json({
            success: false,
            message: '获取填空提交失败'
        });
    }
});

// 保存草稿
router.post('/:lessonId/:activityId/save', auth, async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user.id;
        const { answers } = req.body;

        let submission = await FillBlankSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        if (!submission) {
            submission = new FillBlankSubmission({
                lessonId,
                activityId,
                studentId
            });
        }

        // 只有草稿状态才能保存
        if (submission.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: '已提交的答案不能修改'
            });
        }

        submission.answers = answers;
        await submission.save();

        res.json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error('保存填空草稿失败:', error);
        res.status(500).json({
            success: false,
            message: '保存草稿失败'
        });
    }
});

// 提交填空答案
router.post('/:lessonId/:activityId/submit', auth, async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user.id;
        const { answers } = req.body;

        // 获取活动信息以获取正确答案
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: '课时不存在'
            });
        }

        const activity = lesson.activities.find(a => a._id.toString() === activityId);
        if (!activity || activity.type !== 'fillblank') {
            return res.status(404).json({
                success: false,
                message: '填空活动不存在'
            });
        }

        // 提取正确答案
        const correctAnswers = extractCorrectAnswers(activity.fillBlankSettings?.content || '');
        const totalBlanks = correctAnswers.length;

        // 计算得分 - 只计算有正确答案的填空
        let correctCount = 0;
        let blanksWithAnswers = 0;
        for (let i = 0; i < totalBlanks; i++) {
            const correct = (correctAnswers[i] || '').trim();
            // 如果这个空格没有正确答案，跳过评分
            if (!correct) continue;

            blanksWithAnswers++;
            const studentAnswer = (answers[i.toString()] || '').trim().toLowerCase();
            if (studentAnswer === correct.toLowerCase()) {
                correctCount++;
            }
        }

        // 计算自动评分(0-10分)
        // 如果没有带答案的填空，则留空等待教师评分
        const autoScore = blanksWithAnswers > 0 ? Math.round((correctCount / blanksWithAnswers) * 10) : null;

        // 更新或创建提交记录
        let submission = await FillBlankSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        if (!submission) {
            submission = new FillBlankSubmission({
                lessonId,
                activityId,
                studentId
            });
        }

        submission.answers = answers;
        submission.autoScore = autoScore; // 自动评分
        submission.correctCount = correctCount;
        submission.blanksWithAnswers = blanksWithAnswers;
        submission.totalBlanks = totalBlanks;
        submission.submittedAt = new Date();

        // 状态处理：
        // - 有正确答案且全部有答案 -> submitted (自动评分完成)
        // - 部分有答案或全部无答案 -> submitted (等待教师确认/评分)
        submission.status = 'submitted';

        if (req.user.role === 'student') {
            await submission.save();
            console.log('填空题提交成功(已写入数据库)');
        } else {
            submission._id = new require('mongoose').Types.ObjectId();
            console.log('教师模拟：填空题提交成功(未写入数据库)');
        }

        res.json({
            success: true,
            data: submission,
            correctAnswers: activity.fillBlankSettings?.showCorrectAfterSubmit ? correctAnswers : null
        });
    } catch (error) {
        console.error('提交填空答案失败:', error);
        res.status(500).json({
            success: false,
            message: '提交失败'
        });
    }
});

// 教师获取所有学生的提交记录
router.get('/:lessonId/:activityId/submissions', auth, async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;

        // 验证是否为教师
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }

        let submissions = await FillBlankSubmission.find({
            lessonId,
            activityId,
            status: { $in: ['submitted', 'graded'] }
        }).populate({
            path: 'studentId',
            select: 'username name studentId classId',
            populate: {
                path: 'classId',
                select: 'grade name status'
            }
        }).sort({ createdAt: -1 });

        // 过滤掉所在班级已归档的学生
        submissions = submissions.filter(s => {
            const isArchived = s.studentId?.classId?.status === 'archived';
            return !isArchived;
        });

        res.json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('获取提交记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取提交记录失败'
        });
    }
});

// 学生撤回提交，重新填写
router.post('/:lessonId/:activityId/withdraw', auth, async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const studentId = req.user.id;

        const submission = await FillBlankSubmission.findOne({
            lessonId,
            activityId,
            studentId
        });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: '未找到提交记录'
            });
        }

        if (submission.status !== 'submitted') {
            return res.status(400).json({
                success: false,
                message: submission.status === 'graded' ? '已被教师评分，无法撤回' : '只能撤回已提交的答案'
            });
        }

        // 如果已被教师手动评分，不允许撤回
        if (submission.grade && submission.grade.gradedAt) {
            return res.status(400).json({
                success: false,
                message: '已被教师评分，无法撤回'
            });
        }

        // 重置状态为草稿
        submission.status = 'draft';
        submission.score = null;
        submission.correctCount = 0;
        submission.submittedAt = null;
        await submission.save();

        res.json({
            success: true,
            data: submission,
            message: '已撤回提交，可以重新填写'
        });
    } catch (error) {
        console.error('撤回提交失败:', error);
        res.status(500).json({
            success: false,
            message: '撤回失败'
        });
    }
});

// 教师评分
router.post('/grade/:submissionId', auth, async (req, res) => {
    try {
        // 验证是否为教师
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }

        const { submissionId } = req.params;
        const { bonusScore, feedback } = req.body;

        const submission = await FillBlankSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: '未找到提交记录'
            });
        }

        // 计算旧的积分基数（如果之前评过分）
        const oldStatus = submission.status;
        let oldTotalScore = 0;
        if (oldStatus === 'graded') {
            oldTotalScore = (submission.autoScore || 0) + (submission.grade?.bonusScore || 0);
            // 确保旧分数也在合理范围内(0-10)
            oldTotalScore = Math.min(10, Math.max(0, oldTotalScore));
        }

        // 如果bonusScore为null，则清除评分
        if (bonusScore === null) {
            submission.grade = null;
            submission.status = 'submitted';  // 恢复为已提交状态
            await submission.save();

            // 如果原先有评分，则需要扣除相应积分
            if (oldStatus === 'graded' && oldTotalScore > 0) {
                try {
                    await PointsManager.deductPoints(
                        submission.studentId,
                        oldTotalScore * 10,
                        'task_completion_revoked',
                        '填空作业评分已清除',
                        submissionId
                    );
                    console.log('填空作业评分已清除，积分已扣除', { submissionId, oldTotalScore });
                } catch (pointsError) {
                    console.error('清除评分时扣除积分失败:', pointsError);
                }
            }

            return res.json({
                success: true,
                data: submission,
                message: '评分已清除'
            });
        }

        // 正常评分流程
        submission.grade = {
            bonusScore: bonusScore || 0,
            feedback: feedback || '',
            gradedBy: req.user.id,
            gradedAt: new Date()
        };
        submission.status = 'graded';
        await submission.save();

        // 计算新的总分
        let newTotalScore = (submission.autoScore || 0) + (bonusScore || 0);
        // 限制分数在 0-10 之间
        newTotalScore = Math.min(10, Math.max(0, newTotalScore));

        // 更新积分
        try {
            await PointsManager.updatePoints(
                submission.studentId,
                newTotalScore * 10,  // 新积分
                oldStatus === 'graded' ? oldTotalScore * 10 : null, // 旧积分 (只有之前由于评分产生过积分才扣除)
                submissionId,
                'task_completion',
                `填空作业评分: ${newTotalScore}分`
            );
            console.log('填空作业评分积分更新成功', {
                submissionId,
                studentId: submission.studentId,
                score: newTotalScore
            });
        } catch (pointsError) {
            console.error('填空作业评分积分更新失败:', pointsError);
        }

        res.json({
            success: true,
            data: submission,
            message: '评分成功'
        });
    } catch (error) {
        console.error('评分失败:', error);
        res.status(500).json({
            success: false,
            message: '评分失败'
        });
    }
});


module.exports = router;
