const mongoose = require('mongoose');

const HtmlProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: '未命名网页'
    },
    code: {
        type: String,
        default: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>这是我的第一个网页！</p>
</body>
</html>`
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    // 发布相关
    isPublished: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date,
        default: null
    },
    viewCount: {
        type: Number,
        default: 0
    },
    thumbnail: {
        type: String,
        default: ''
    },
    // 作业关联
    linkedAssignment: {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course'
        },
        unit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CourseUnit'
        },
        lesson: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lesson'
        },
        activityId: String,
        submittedAt: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
HtmlProjectSchema.index({ creator: 1, createdAt: -1 });
HtmlProjectSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('HtmlProject', HtmlProjectSchema);

