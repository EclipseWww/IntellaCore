const mongoose = require('mongoose');

const loginRequestSchema = new mongoose.Schema({
    // 请求的学生信息
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },

    // 所属班级
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },

    // 请求类型
    requestType: {
        type: String,
        enum: ['ip_change', 'device_conflict', 'ip_and_device_conflict'],
        required: true
    },

    // IP信息 (用于IP变更场景)
    oldIp: {
        type: String,
        default: null
    },
    newIp: {
        type: String,
        default: null
    },

    // 请求状态
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    // 过期时间 (创建时间 + 5分钟)
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期
    },

    // 处理信息
    processedAt: {
        type: Date,
        default: null
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// TTL索引：自动删除过期的请求
loginRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 复合索引：按班级和状态快速查询待处理请求
loginRequestSchema.index({ classId: 1, status: 1 });

// 索引：按学生ID查询
loginRequestSchema.index({ studentId: 1 });

// 静态方法：获取班级的所有待处理请求
loginRequestSchema.statics.getPendingByClass = function (classId) {
    return this.find({
        classId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// 静态方法：检查学生是否有待处理的请求
loginRequestSchema.statics.hasPendingRequest = function (studentId) {
    return this.findOne({
        studentId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
    });
};

module.exports = mongoose.model('LoginRequest', loginRequestSchema);
