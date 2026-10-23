const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');

// Get or create a submission for a student for a specific activity
exports.getOrCreateSubmission = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;
        const userId = req.user.id;

        let submission = await SpreadsheetSubmission.findOne({ userId, lessonId, activityId });

        if (!submission) {
            submission = new SpreadsheetSubmission({
                userId,
                lessonId,
                activityId,
                spreadsheetData: [{
                    name: 'Sheet1',
                    celldata: [],
                    config: {},
                    index: 0,
                    status: 1,
                    order: 0,
                    row: 50,
                    column: 26
                }],
                status: 'draft'
            });
            if (req.user.role === 'student') {
                await submission.save();
                console.log('创建新的电子表格草稿(已写入数据库)');
            } else {
                submission._id = new require('mongoose').Types.ObjectId();
                console.log('教师模拟：创建新的电子表格草稿(未写入数据库)');
            }
        }

        res.json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error('Get/Create spreadsheet submission error:', error);
        res.status(500).json({
            success: false,
            message: '获取/创建作业提交失败',
            error: error.message
        });
    }
};

// Update spreadsheet submission
exports.updateSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { spreadsheetData, status, duration } = req.body;

        const submission = await SpreadsheetSubmission.findById(id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: '作业提交不存在'
            });
        }

        // Check permission
        if (submission.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '无权编辑此提交'
            });
        }

        if (spreadsheetData !== undefined) {
            submission.spreadsheetData = spreadsheetData;
            // Mark as modified since it's a Mixed type
            submission.markModified('spreadsheetData');
        }
        if (status !== undefined) submission.status = status;
        if (duration !== undefined) submission.duration = duration;

        if (req.user.role === 'student') {
            await submission.save();
            console.log('更新电子表格(已写入数据库)');
        } else {
            console.log('教师模拟：更新电子表格(未写入数据库)');
        }

        res.json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error('Update spreadsheet submission error:', error);
        res.status(500).json({
            success: false,
            message: '更新作业保存失败',
            error: error.message
        });
    }
};

// Get all submissions for an activity (for teacher)
exports.getActivitySubmissions = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;

        // Check if teacher (assumed handled by middleware/route)
        let submissions = await SpreadsheetSubmission.find({ lessonId, activityId })
            .populate({
                path: 'userId',
                select: 'name username role classId',
                populate: {
                    path: 'classId',
                    select: 'grade name status'
                }
            })
            .sort({ submittedAt: -1 });

        // 过滤掉所在班级已归档的学生
        submissions = submissions.filter(s => {
            const isArchived = s.userId?.classId?.status === 'archived';
            return !isArchived;
        });

        res.json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('Get activity submissions error:', error);
        res.status(500).json({
            success: false,
            message: '获取作业列表失败',
            error: error.message
        });
    }
};
