const mongoose = require('mongoose');

/**
 * Python代码提交模型
 * 用于存储学生的Python编程活动提交记录
 */
const pythonSubmissionSchema = new mongoose.Schema({
    // 关联的课时ID
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true
    },
    // 活动ID（课时中的活动索引或唯一标识）
    activityId: {
        type: String,
        required: true
    },
    // 学生ID
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Python代码（已提交时为提交版本，教师批改的就是这一份）
    code: {
        type: String,
        default: ''
    },
    // 提交后学生继续编辑并保存的草稿（未提交）；为 null 表示没有未提交的修改
    draftCode: {
        type: String,
        default: null
    },
    // 执行输出
    output: {
        type: String,
        default: ''
    },
    // Turtle图形数据（如果有）
    turtleGraphics: {
        type: String,
        default: null
    },
    // 提交状态
    status: {
        type: String,
        enum: ['draft', 'submitted'],
        default: 'draft'
    },
    // 教师评分（0-10）
    score: {
        type: Number,
        min: 0,
        max: 10,
        default: null
    },
    // 教师反馈
    feedback: {
        type: String,
        default: ''
    },
    // 测评结果（用于持久化OJ测试结果）
    testResults: {
        passedCount: { type: Number, default: 0 },
        totalCount: { type: Number, default: 0 },
        // 由服务器判题生成；旧数据可能含 input / expectedOutput，返回给学生前会去掉隐藏测试点的这两项
        results: [{
            index: Number,
            passed: Boolean,
            status: String,          // AC / WA / RE / TLE / OLE
            input: String,
            expectedOutput: String,
            actualOutput: String,
            isHidden: Boolean,
            error: String,
            errorType: String,
            errorLine: Number,
            timeMs: Number
        }],
        judgedAt: Date
    },
    // 历史提交（最近 30 次）
    attempts: [{
        code: String,
        passedCount: Number,
        totalCount: Number,
        score: Number,
        submittedAt: Date
    }],
    // 已计入学生积分的分值（score×10）；用于自动评分与教师改分时正确计算积分差额
    awardedPoints: {
        type: Number,
        default: null
    },
    // 提交时间
    submittedAt: {
        type: Date,
        default: null
    },
    // 评分时间
    gradedAt: {
        type: Date,
        default: null
    },
    // 评分教师
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// 复合索引：确保每个学生在每个活动中只有一个提交记录
pythonSubmissionSchema.index({ lessonId: 1, activityId: 1, studentId: 1 }, { unique: true });
// 用于教师查询活动的所有提交
pythonSubmissionSchema.index({ lessonId: 1, activityId: 1 });

const PythonSubmission = mongoose.model('PythonSubmission', pythonSubmissionSchema);

module.exports = PythonSubmission;
