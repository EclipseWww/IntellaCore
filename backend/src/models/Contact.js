const mongoose = require('mongoose');

/**
 * 联系人模型
 * 用于存储用户的常用联系人
 */
const contactSchema = new mongoose.Schema({
    // 所属用户
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 联系人姓名
    name: {
        type: String,
        required: true,
        trim: true
    },
    // 联系人邮箱
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    // 备注
    note: {
        type: String,
        default: ''
    },
    // 分组
    group: {
        type: String,
        default: '默认'
    }
}, { timestamps: true });

// 索引
contactSchema.index({ userId: 1, email: 1 }, { unique: true });
contactSchema.index({ userId: 1, group: 1 });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
