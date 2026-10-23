const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * 邮箱账号模型
 * 用于存储用户的模拟邮箱信息
 */
const emailAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    emailAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    emailUsername: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    signature: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// 邮箱域名常量
emailAccountSchema.statics.EMAIL_DOMAIN = 'learnsite.edu';

// 密码加密中间件
emailAccountSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 验证密码方法
emailAccountSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// 生成完整邮箱地址
emailAccountSchema.statics.generateEmailAddress = function (username) {
    return `${username.toLowerCase()}@${this.EMAIL_DOMAIN}`;
};

// 索引
emailAccountSchema.index({ userId: 1 });
emailAccountSchema.index({ emailAddress: 1 });
emailAccountSchema.index({ emailUsername: 1 });

const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);

module.exports = EmailAccount;
