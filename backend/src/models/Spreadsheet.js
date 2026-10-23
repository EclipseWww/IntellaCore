const mongoose = require('mongoose');

const SpreadsheetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: '未命名表格'
    },
    data: {
        type: Array, // FortuneSheet sheet data array
        default: [{}]
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        default: null
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for faster queries
SpreadsheetSchema.index({ creator: 1, createdAt: -1 });
SpreadsheetSchema.index({ courseId: 1 });

module.exports = mongoose.model('Spreadsheet', SpreadsheetSchema);
