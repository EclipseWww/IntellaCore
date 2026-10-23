const mongoose = require('mongoose');

const fillBlankSubmissionSchema = new mongoose.Schema({
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true
    },
    activityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 学生填写的答案，key为空格索引(0,1,2...)，value为学生答案
    answers: {
        type: Map,
        of: String,
        default: {}
    },
    // 自动评分结果(0-10分)，null表示无法自动评分(全部是开放题)
    autoScore: {
        type: Number,
        min: 0,
        max: 10,
        default: null
    },
    correctCount: {
        type: Number,
        default: 0
    },
    blanksWithAnswers: {
        type: Number,
        default: 0
    },
    totalBlanks: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'graded'],
        default: 'draft'
    },
    // 教师评分
    grade: {
        bonusScore: { type: Number, min: 0, max: 10, default: 0 },
        feedback: { type: String, default: '' },
        gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        gradedAt: { type: Date }
    },
    submittedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// 复合索引，确保每个学生每个活动只有一条记录
fillBlankSubmissionSchema.index({ lessonId: 1, activityId: 1, studentId: 1 }, { unique: true });

const FillBlankSubmission = mongoose.model('FillBlankSubmission', fillBlankSubmissionSchema);

module.exports = FillBlankSubmission;
