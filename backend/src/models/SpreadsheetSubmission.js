const mongoose = require('mongoose');

const spreadsheetSubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true
    },
    activityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    spreadsheetData: {
        type: mongoose.Schema.Types.Mixed, // FortuneSheet sheet data - needs Mixed for deeply nested objects
        required: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'graded'],
        default: 'submitted'
    },
    grade: {
        score: {
            type: Number,
            min: 0,
            max: 100
        },
        feedback: String,
        gradedAt: Date,
        gradedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    duration: {
        type: Number, // 耗时（秒）
        default: 0
    }
}, {
    timestamps: true
});

// 添加索引
spreadsheetSubmissionSchema.index({ userId: 1, lessonId: 1, activityId: 1 });
spreadsheetSubmissionSchema.index({ lessonId: 1, activityId: 1 });
spreadsheetSubmissionSchema.index({ userId: 1, submittedAt: -1 });

const SpreadsheetSubmission = mongoose.model('SpreadsheetSubmission', spreadsheetSubmissionSchema);

module.exports = SpreadsheetSubmission;
