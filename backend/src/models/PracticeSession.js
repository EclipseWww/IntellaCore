const mongoose = require('mongoose');

const practiceSessionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        },
        isCorrect: Boolean,
        selectedOption: mongoose.Schema.Types.ObjectId,
        // 版本控制字段
        questionVersion: {
            type: Number,
            required: true
        },
        questionSnapshot: {
            type: mongoose.Schema.Types.Mixed, // 保存题目快照，防止题目被修改/删除后无法查看
            default: null
        }
    }],
    totalQuestions: {
        type: Number,
        default: 10
    },
    correctCount: {
        type: Number,
        default: 0
    },
    pointsPerQuestion: {
        type: Number,
        default: 5
    },
    pointsEarned: {
        type: Number,
        default: 0
    },
    timeLimit: {
        type: Number,
        default: 300 // 5分钟 = 300秒
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date,
    status: {
        type: String,
        enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED'],
        default: 'IN_PROGRESS'
    }
}, {
    timestamps: true
});

const PracticeSession = mongoose.model('PracticeSession', practiceSessionSchema);

module.exports = PracticeSession;
