const mongoose = require('mongoose');

/**
 * 邮件模型
 * 用于存储模拟邮件
 */
const emailSchema = new mongoose.Schema({
    // 发件人邮箱地址
    from: {
        type: String,
        required: true,
        lowercase: true
    },
    // 发件人姓名
    senderName: {
        type: String,
        default: ''
    },
    // 收件人邮箱地址数组
    to: [{
        type: String,
        required: true,
        lowercase: true
    }],
    // 收件人信息（含姓名）
    recipients: [{
        email: { type: String, lowercase: true },
        name: { type: String, default: '' }
    }],
    // 抄送邮箱地址数组
    cc: [{
        type: String,
        lowercase: true
    }],
    // 抄送人信息（含姓名）
    ccRecipients: [{
        email: { type: String, lowercase: true },
        name: { type: String, default: '' }
    }],
    // 邮件主题
    subject: {
        type: String,
        required: true,
        trim: true
    },
    // 邮件正文（支持HTML）
    content: {
        type: String,
        default: ''
    },
    // 附件
    attachments: [{
        filename: String,       // 存储的文件名
        originalName: String,   // 原始文件名
        size: Number,           // 文件大小（字节）
        mimeType: String        // 文件类型
    }],
    // 是否已读（针对收件人）
    isRead: {
        type: Boolean,
        default: false
    },
    // 是否标星
    isStarred: {
        type: Boolean,
        default: false
    },
    // 文件夹
    folder: {
        type: String,
        enum: ['inbox', 'sent', 'drafts', 'trash'],
        default: 'inbox'
    },
    // 邮件所属用户（收件人的userId，用于区分不同用户的邮件副本）
    ownerEmail: {
        type: String,
        required: true,
        lowercase: true
    },
    // 发送时间
    sentAt: {
        type: Date,
        default: Date.now
    },
    // 删除时间（用于回收站功能）
    deletedAt: {
        type: Date,
        default: null
    }
});

// 索引
emailSchema.index({ ownerEmail: 1, folder: 1, sentAt: -1 });
emailSchema.index({ from: 1 });
emailSchema.index({ to: 1 });
emailSchema.index({ cc: 1 });
emailSchema.index({ isRead: 1 });

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;
