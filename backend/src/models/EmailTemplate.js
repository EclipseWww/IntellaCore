const mongoose = require('mongoose');

/**
 * 邮件模板模型
 * 用于存储邮件模板（教师/管理员可创建）
 */
const emailTemplateSchema = new mongoose.Schema({
    // 创建者
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 模板名称
    name: {
        type: String,
        required: true,
        trim: true
    },
    // 模板主题
    subject: {
        type: String,
        default: ''
    },
    // 模板内容
    content: {
        type: String,
        default: ''
    },
    // 是否为公共模板（所有用户可用）
    isPublic: {
        type: Boolean,
        default: false
    },
    // 模板分类
    category: {
        type: String,
        default: '通知'
    }
}, { timestamps: true });

// 索引
emailTemplateSchema.index({ createdBy: 1 });
emailTemplateSchema.index({ isPublic: 1 });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

module.exports = EmailTemplate;
