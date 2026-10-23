const EmailAccount = require('../models/EmailAccount');
const Email = require('../models/Email');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Contact = require('../models/Contact');

const EmailTemplate = require('../models/EmailTemplate');
const fs = require('fs');
const path = require('path');

// 邮件系统开关设置键
const EMAIL_SYSTEM_KEY = 'emailSystemEnabled';
// 命令行模式设置键
const EMAIL_TERMINAL_MODE_KEY = 'emailTerminalMode';

/**
 * 检查邮件系统是否启用
 */
const checkEmailSystemEnabled = async () => {
    const setting = await Setting.findOne({ key: EMAIL_SYSTEM_KEY });
    return setting ? setting.value === true : true; // 默认启用
};

/**
 * 检查是否启用命令行模式
 */
const checkTerminalModeEnabled = async () => {
    const setting = await Setting.findOne({ key: EMAIL_TERMINAL_MODE_KEY });
    return setting ? setting.value === true : false; // 默认关闭
};

/**
 * 获取邮件系统状态
 */
exports.getSystemStatus = async (req, res) => {
    try {
        const enabled = await checkEmailSystemEnabled();
        const terminalMode = await checkTerminalModeEnabled();

        // 检查当前用户是否已注册邮箱
        let hasAccount = false;
        let emailAddress = null;

        if (req.user) {
            const account = await EmailAccount.findOne({ userId: req.user._id });
            if (account) {
                hasAccount = true;
                emailAddress = account.emailAddress;
            }
        }

        res.json({
            enabled,
            terminalMode,
            hasAccount,
            emailAddress,
            domain: EmailAccount.EMAIL_DOMAIN
        });
    } catch (error) {
        console.error('获取邮件系统状态失败:', error);
        res.status(500).json({ message: '获取邮件系统状态失败' });
    }
};

/**
 * 设置邮件系统开关（仅管理员/教师）
 */
exports.setSystemStatus = async (req, res) => {
    try {
        const { enabled } = req.body;

        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ message: '无权限' });
        }

        await Setting.findOneAndUpdate(
            { key: EMAIL_SYSTEM_KEY },
            { key: EMAIL_SYSTEM_KEY, value: enabled },
            { upsert: true, new: true }
        );

        res.json({ message: enabled ? '邮件系统已启用' : '邮件系统已禁用', enabled });
    } catch (error) {
        console.error('设置邮件系统状态失败:', error);
        res.status(500).json({ message: '设置失败' });
    }
};

/**
 * 设置命令行模式开关（仅管理员/教师）
 */
exports.setTerminalMode = async (req, res) => {
    try {
        const { enabled } = req.body;

        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ message: '无权限' });
        }

        await Setting.findOneAndUpdate(
            { key: EMAIL_TERMINAL_MODE_KEY },
            { key: EMAIL_TERMINAL_MODE_KEY, value: enabled },
            { upsert: true, new: true }
        );

        res.json({ message: enabled ? '已切换到命令行模式' : '已切换到现代模式', terminalMode: enabled });
    } catch (error) {
        console.error('设置命令行模式失败:', error);
        res.status(500).json({ message: '设置失败' });
    }
};

/**
 * 注册邮箱账号
 */
exports.registerEmail = async (req, res) => {
    try {
        const enabled = await checkEmailSystemEnabled();
        if (!enabled && req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: '邮件系统维护中，暫停注册' });
        }


        const { username, password, signature } = req.body;
        const userId = req.user._id;

        // 检查是否已有邮箱
        const existingAccount = await EmailAccount.findOne({ userId });
        if (existingAccount) {
            return res.status(400).json({ message: '您已注册邮箱账号' });
        }

        // 验证用户名格式
        const usernameRegex = /^[a-zA-Z][a-zA-Z0-9._-]{2,19}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                message: '用户名格式无效。要求：以字母开头，3-20个字符，只能包含字母、数字、点、下划线、连字符'
            });
        }

        // 检查用户名是否已被占用
        const existingUsername = await EmailAccount.findOne({
            emailUsername: username.toLowerCase()
        });
        if (existingUsername) {
            return res.status(400).json({ message: '该邮箱用户名已被占用' });
        }

        // 创建邮箱账号
        const emailAddress = EmailAccount.generateEmailAddress(username);
        const account = new EmailAccount({
            userId,
            emailAddress,
            emailUsername: username.toLowerCase(),
            password,
            signature: signature || ''
        });

        await account.save();

        res.status(201).json({
            message: '邮箱注册成功',
            emailAddress: account.emailAddress
        });
    } catch (error) {
        console.error('注册邮箱失败:', error);
        res.status(500).json({ message: '注册失败' });
    }
};

/**
 * 获取账号信息
 */
exports.getAccount = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(404).json({ message: '未注册邮箱' });
        }

        res.json({
            emailAddress: account.emailAddress,
            emailUsername: account.emailUsername,
            signature: account.signature,
            createdAt: account.createdAt
        });
    } catch (error) {
        console.error('获取账号信息失败:', error);
        res.status(500).json({ message: '获取账号信息失败' });
    }
};

/**
 * 更新签名
 */
exports.updateSignature = async (req, res) => {
    try {
        const { signature } = req.body;

        const account = await EmailAccount.findOneAndUpdate(
            { userId: req.user._id },
            { signature },
            { new: true }
        );

        if (!account) {
            return res.status(404).json({ message: '未注册邮箱' });
        }

        res.json({ message: '签名已更新', signature: account.signature });
    } catch (error) {
        console.error('更新签名失败:', error);
        res.status(500).json({ message: '更新失败' });
    }
};

/**
 * 保存草稿
 */
exports.saveDraft = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const { draftId, to, cc, subject, content } = req.body;
        const senderUser = await User.findById(req.user._id).select('name');
        const senderName = senderUser?.name || account.emailUsername;

        const draftData = {
            from: account.emailAddress,
            senderName,
            to: to ? (Array.isArray(to) ? to : to.split(',').map(e => e.trim().toLowerCase())) : [],
            cc: cc ? (Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim().toLowerCase())) : [],
            subject: subject || '',
            content: content || '',
            folder: 'drafts',
            ownerEmail: account.emailAddress,
            isRead: true,
            sentAt: new Date()
        };

        let draft;
        if (draftId) {
            // 更新现有草稿
            draft = await Email.findOneAndUpdate(
                { _id: draftId, ownerEmail: account.emailAddress, folder: 'drafts' },
                draftData,
                { new: true }
            );
        } else {
            // 创建新草稿
            draft = await Email.create(draftData);
        }

        res.json({ message: '草稿已保存', draft });
    } catch (error) {
        console.error('保存草稿失败:', error);
        res.status(500).json({ message: '保存失败' });
    }
};

/**
 * 发送邮件
 */
exports.sendEmail = async (req, res) => {
    try {
        const enabled = await checkEmailSystemEnabled();

        // 如果系统未启用，且用户不是教师/管理员，则需要检查收件人是否为教师
        if (!enabled && req.user.role !== 'teacher' && req.user.role !== 'admin') {
            const { to, cc } = req.body;
            const recipientEmails = [
                ...(Array.isArray(to) ? to : (to ? to.split(',') : [])),
                ...(Array.isArray(cc) ? cc : (cc ? cc.split(',') : []))
            ].map(e => e.trim().toLowerCase());

            if (recipientEmails.length === 0) {
                return res.status(400).json({ message: '请指定收件人' });
            }

            // 查找这些邮箱对应的用户
            const accounts = await EmailAccount.find({ emailAddress: { $in: recipientEmails } });
            if (accounts.length === 0) {
                return res.status(403).json({ message: '系统维护中，仅允许联系老师' });
            }

            const userIds = accounts.map(a => a.userId);
            const users = await User.find({ _id: { $in: userIds } });

            // 检查是否所有收件人都是老师或管理员
            const allTeachers = users.every(u => u.role === 'teacher' || u.role === 'admin');

            if (!allTeachers) {
                return res.status(403).json({ message: '系统维护中，仅允许向老师发送邮件' });
            }
        }

        const { to, cc, subject, content } = req.body;
        const attachments = req.files || [];

        // 获取发件人邮箱和姓名
        const senderAccount = await EmailAccount.findOne({ userId: req.user._id });
        if (!senderAccount) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        // 获取发件人姓名
        const senderUser = await User.findById(req.user._id).select('name');
        const senderName = senderUser?.name || senderAccount.emailUsername;

        // 解析收件人和抄送
        const toList = Array.isArray(to) ? to : to.split(',').map(e => e.trim().toLowerCase());
        const ccList = cc ? (Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim().toLowerCase())) : [];

        // 验证所有收件人邮箱存在
        const allRecipients = [...new Set([...toList, ...ccList])];
        const existingAccounts = await EmailAccount.find({
            emailAddress: { $in: allRecipients }
        });

        const existingEmails = existingAccounts.map(a => a.emailAddress);
        const invalidEmails = allRecipients.filter(e => !existingEmails.includes(e));

        if (invalidEmails.length > 0) {
            return res.status(400).json({
                message: `以下邮箱不存在: ${invalidEmails.join(', ')}`
            });
        }

        // 处理附件
        const attachmentData = attachments.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype
        }));

        // 获取所有收件人和抄送人的姓名
        const recipientUserIds = existingAccounts.map(a => a.userId);
        const recipientUsers = await User.find({ _id: { $in: recipientUserIds } }).select('_id name');
        const recipientNameMap = {};
        recipientUsers.forEach(u => { recipientNameMap[u._id.toString()] = u.name; });

        // 构建收件人信息（含姓名）
        const recipientsData = toList.map(email => {
            const account = existingAccounts.find(a => a.emailAddress === email);
            return {
                email,
                name: account ? (recipientNameMap[account.userId.toString()] || account.emailUsername) : email
            };
        });

        // 构建抄送人信息（含姓名）
        const ccRecipientsData = ccList.map(email => {
            const account = existingAccounts.find(a => a.emailAddress === email);
            return {
                email,
                name: account ? (recipientNameMap[account.userId.toString()] || account.emailUsername) : email
            };
        });

        const now = new Date();
        const emailsToCreate = [];

        // 为每个收件人创建邮件副本（收件箱）
        for (const recipient of toList) {
            emailsToCreate.push({
                from: senderAccount.emailAddress,
                senderName,
                to: toList,
                recipients: recipientsData,
                cc: ccList,
                ccRecipients: ccRecipientsData,
                subject,
                content,
                attachments: attachmentData,
                folder: 'inbox',
                ownerEmail: recipient,
                isRead: false,
                sentAt: now
            });
        }

        // 为每个抄送人创建邮件副本（收件箱）
        for (const recipient of ccList) {
            if (!toList.includes(recipient)) { // 避免重复
                emailsToCreate.push({
                    from: senderAccount.emailAddress,
                    senderName,
                    to: toList,
                    recipients: recipientsData,
                    cc: ccList,
                    ccRecipients: ccRecipientsData,
                    subject,
                    content,
                    attachments: attachmentData,
                    folder: 'inbox',
                    ownerEmail: recipient,
                    isRead: false,
                    sentAt: now
                });
            }
        }

        // 为发件人创建已发送副本
        emailsToCreate.push({
            from: senderAccount.emailAddress,
            senderName,
            to: toList,
            recipients: recipientsData,
            cc: ccList,
            ccRecipients: ccRecipientsData,
            subject,
            content,
            attachments: attachmentData,
            folder: 'sent',
            ownerEmail: senderAccount.emailAddress,
            isRead: true,
            sentAt: now
        });

        await Email.insertMany(emailsToCreate);

        res.json({ message: '邮件发送成功' });
    } catch (error) {
        console.error('发送邮件失败:', error);
        res.status(500).json({ message: '发送失败' });
    }
};

/**
 * 获取邮件列表
 */
exports.getEmails = async (req, res) => {
    try {


        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const { folder = 'inbox', page = 1, limit = 20 } = req.query;

        const query = {
            ownerEmail: account.emailAddress,
            folder
        };

        const emails = await Email.find(query)
            .sort({ sentAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Email.countDocuments(query);

        res.json({
            emails,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('获取邮件列表失败:', error);
        res.status(500).json({ message: '获取邮件失败' });
    }
};

/**
 * 搜索邮件
 */
exports.searchEmails = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const { q, page = 1, limit = 20 } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({ emails: [], total: 0 });
        }

        const searchRegex = new RegExp(q.trim(), 'i');

        const query = {
            ownerEmail: account.emailAddress,
            folder: { $ne: 'trash' }, // 不搜索回收站
            $or: [
                { subject: searchRegex },
                { content: searchRegex },
                { from: searchRegex },
                { senderName: searchRegex },
                { to: searchRegex }
            ]
        };

        const emails = await Email.find(query)
            .sort({ sentAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Email.countDocuments(query);

        res.json({
            emails,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('搜索邮件失败:', error);
        res.status(500).json({ message: '搜索失败' });
    }
};

/**
 * 获取邮件详情
 */
exports.getEmailById = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const email = await Email.findOne({
            _id: req.params.id,
            ownerEmail: account.emailAddress
        });

        if (!email) {
            return res.status(404).json({ message: '邮件不存在' });
        }

        // 标记为已读
        if (!email.isRead) {
            email.isRead = true;
            await email.save();
        }

        res.json(email);
    } catch (error) {
        console.error('获取邮件详情失败:', error);
        res.status(500).json({ message: '获取邮件失败' });
    }
};

/**
 * 标记已读/未读
 */
exports.markReadStatus = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const { isRead } = req.body;

        const email = await Email.findOneAndUpdate(
            { _id: req.params.id, ownerEmail: account.emailAddress },
            { isRead },
            { new: true }
        );

        if (!email) {
            return res.status(404).json({ message: '邮件不存在' });
        }

        res.json({ message: isRead ? '已标记为已读' : '已标记为未读' });
    } catch (error) {
        console.error('标记已读状态失败:', error);
        res.status(500).json({ message: '操作失败' });
    }
};

/**
 * 标星/取消标星
 */
exports.toggleStar = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const email = await Email.findOne({
            _id: req.params.id,
            ownerEmail: account.emailAddress
        });

        if (!email) {
            return res.status(404).json({ message: '邮件不存在' });
        }

        email.isStarred = !email.isStarred;
        await email.save();

        res.json({ message: email.isStarred ? '已标星' : '已取消标星', isStarred: email.isStarred });
    } catch (error) {
        console.error('标星操作失败:', error);
        res.status(500).json({ message: '操作失败' });
    }
};

/**
 * 删除邮件（移到回收站）
 */
exports.deleteEmail = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const email = await Email.findOne({
            _id: req.params.id,
            ownerEmail: account.emailAddress
        });

        if (!email) {
            return res.status(404).json({ message: '邮件不存在' });
        }

        if (email.folder === 'trash') {
            // 已在回收站，永久删除
            await Email.deleteOne({ _id: email._id });
            res.json({ message: '邮件已永久删除' });
        } else {
            // 移到回收站
            email.folder = 'trash';
            email.deletedAt = new Date();
            await email.save();
            res.json({ message: '邮件已移到回收站' });
        }
    } catch (error) {
        console.error('删除邮件失败:', error);
        res.status(500).json({ message: '删除失败' });
    }
};

/**
 * 获取未读数量
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ userId: req.user._id });
        if (!account) {
            return res.json({ count: 0 });
        }

        const count = await Email.countDocuments({
            ownerEmail: account.emailAddress,
            folder: 'inbox',
            isRead: false
        });

        res.json({ count });
    } catch (error) {
        console.error('获取未读数量失败:', error);
        res.status(500).json({ message: '获取失败' });
    }
};

/**
 * 搜索邮箱用户（用于自动完成）- 优先同班同学
 */
exports.searchAccounts = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) {
            return res.json([]);
        }

        // 获取当前用户的班级
        const currentUser = await User.findById(req.user._id).select('classId role');

        let query = {
            $or: [
                { emailAddress: { $regex: q, $options: 'i' } },
                { emailUsername: { $regex: q, $options: 'i' } }
            ]
        };

        // 如果是学生，优先搜索同班同学
        let classmates = [];
        if (currentUser.role === 'student' && currentUser.classId) {
            // 获取同班同学的userId
            const classmateUsers = await User.find({
                classId: currentUser.classId,
                _id: { $ne: req.user._id }
            }).select('_id name');

            const classmateUserIds = classmateUsers.map(u => u._id);

            // 搜索同班同学的邮箱
            const classmateAccounts = await EmailAccount.find({
                userId: { $in: classmateUserIds },
                $or: [
                    { emailAddress: { $regex: q, $options: 'i' } },
                    { emailUsername: { $regex: q, $options: 'i' } }
                ]
            }).limit(10).select('emailAddress emailUsername userId');

            const classmateUserMap = {};
            classmateUsers.forEach(u => { classmateUserMap[u._id.toString()] = u.name; });

            classmates = classmateAccounts.map(a => ({
                emailAddress: a.emailAddress,
                name: classmateUserMap[a.userId.toString()] || a.emailUsername,
                isClassmate: true
            }));
        }

        // 如果同班结果不够，搜索全部（用于教师或手动输入其他班级）
        let others = [];
        if (classmates.length < 10) {
            const excludeIds = classmates.map(c => c.emailAddress);
            const otherAccounts = await EmailAccount.find({
                emailAddress: {
                    $nin: excludeIds,
                    $regex: q,
                    $options: 'i'
                }
            }).limit(10 - classmates.length).select('emailAddress emailUsername userId');

            const userIds = otherAccounts.map(a => a.userId);
            const users = await User.find({ _id: { $in: userIds } }).select('name');
            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u.name; });

            others = otherAccounts.map(a => ({
                emailAddress: a.emailAddress,
                name: userMap[a.userId.toString()] || a.emailUsername,
                isClassmate: false
            }));
        }

        res.json([...classmates, ...others]);
    } catch (error) {
        console.error('搜索邮箱失败:', error);
        res.status(500).json({ message: '搜索失败' });
    }
};

/**
 * 获取同班同学邮箱列表
 */
exports.getClassmates = async (req, res) => {
    try {
        // 获取当前用户的班级
        const currentUser = await User.findById(req.user._id).select('classId');

        if (!currentUser.classId) {
            return res.json([]);
        }

        // 获取同班同学
        const classmateUsers = await User.find({
            classId: currentUser.classId,
            _id: { $ne: req.user._id }
        }).select('_id name');

        const classmateUserIds = classmateUsers.map(u => u._id);

        // 获取有邮箱的同学
        const classmateAccounts = await EmailAccount.find({
            userId: { $in: classmateUserIds }
        }).select('emailAddress emailUsername userId');

        const classmateUserMap = {};
        classmateUsers.forEach(u => { classmateUserMap[u._id.toString()] = u.name; });

        const results = classmateAccounts.map(a => ({
            emailAddress: a.emailAddress,
            name: classmateUserMap[a.userId.toString()] || a.emailUsername
        }));

        res.json(results);
    } catch (error) {
        console.error('获取同班同学失败:', error);
        res.status(500).json({ message: '获取失败' });
    }
};

/**
 * 教师获取班级列表（用于群发）
 */
exports.getTeacherClasses = async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: '无权限' });
        }

        const Class = require('../models/Class');
        const classes = await Class.find().select('_id name grade');

        res.json(classes);
    } catch (error) {
        console.error('获取班级列表失败:', error);
        res.status(500).json({ message: '获取失败' });
    }
};

/**
 * 教师群发邮件给班级
 */
exports.sendBroadcast = async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: '无权限' });
        }

        const enabled = await checkEmailSystemEnabled();
        if (!enabled) {
            return res.status(403).json({ message: '邮件系统未启用' });
        }

        const { classId, subject, content } = req.body;
        const attachments = req.files || [];

        // 获取发件人邮箱和姓名
        const senderAccount = await EmailAccount.findOne({ userId: req.user._id });
        if (!senderAccount) {
            return res.status(400).json({ message: '请先注册邮箱' });
        }

        const senderUser = await User.findById(req.user._id).select('name');
        const senderName = senderUser?.name || senderAccount.emailUsername;

        // 获取班级所有学生
        const students = await User.find({ classId, role: 'student' }).select('_id name');
        const studentIds = students.map(s => s._id);

        // 获取有邮箱的学生
        const studentAccounts = await EmailAccount.find({
            userId: { $in: studentIds }
        }).select('emailAddress userId');

        if (studentAccounts.length === 0) {
            return res.status(400).json({ message: '该班级没有已注册邮箱的学生' });
        }

        // 构建学生姓名映射
        const studentNameMap = {};
        students.forEach(s => { studentNameMap[s._id.toString()] = s.name; });

        const toList = studentAccounts.map(a => a.emailAddress);

        // 构建收件人信息（含姓名）
        const recipientsData = studentAccounts.map(account => ({
            email: account.emailAddress,
            name: studentNameMap[account.userId.toString()] || account.emailAddress
        }));

        // 处理附件
        const attachmentData = attachments.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype
        }));

        const now = new Date();
        const emailsToCreate = [];

        // 为每个学生创建邮件副本
        for (const account of studentAccounts) {
            const recipientName = studentNameMap[account.userId.toString()] || account.emailAddress;
            emailsToCreate.push({
                from: senderAccount.emailAddress,
                senderName,
                to: [account.emailAddress],
                recipients: [{ email: account.emailAddress, name: recipientName }],
                cc: [],
                ccRecipients: [],
                subject,
                content,
                attachments: attachmentData,
                folder: 'inbox',
                ownerEmail: account.emailAddress,
                isRead: false,
                sentAt: now
            });
        }

        // 为发件人创建已发送副本
        emailsToCreate.push({
            from: senderAccount.emailAddress,
            senderName,
            to: toList,
            recipients: recipientsData,
            cc: [],
            ccRecipients: [],
            subject: `[群发] ${subject}`,
            content,
            attachments: attachmentData,
            folder: 'sent',
            ownerEmail: senderAccount.emailAddress,
            isRead: true,
            sentAt: now
        });

        await Email.insertMany(emailsToCreate);

        res.json({
            message: `邮件已发送给 ${toList.length} 名学生`,
            count: toList.length
        });
    } catch (error) {
        console.error('群发邮件失败:', error);
        res.status(500).json({ message: '发送失败' });
    }
};

// ========== 联系人管理 ==========

/**
 * 获取联系人列表
 */
exports.getContacts = async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user._id }).sort({ name: 1 });
        res.json(contacts);
    } catch (error) {
        console.error('获取联系人失败:', error);
        res.status(500).json({ message: '获取失败' });
    }
};

/**
 * 添加联系人
 */
exports.addContact = async (req, res) => {
    try {
        const { name, email, note, group } = req.body;

        const existing = await Contact.findOne({ userId: req.user._id, email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: '该联系人已存在' });
        }

        const contact = await Contact.create({
            userId: req.user._id,
            name,
            email: email.toLowerCase(),
            note: note || '',
            group: group || '默认'
        });

        res.json({ message: '联系人已添加', contact });
    } catch (error) {
        console.error('添加联系人失败:', error);
        res.status(500).json({ message: '添加失败' });
    }
};

/**
 * 删除联系人
 */
exports.deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        await Contact.findOneAndDelete({ _id: id, userId: req.user._id });
        res.json({ message: '联系人已删除' });
    } catch (error) {
        console.error('删除联系人失败:', error);
        res.status(500).json({ message: '删除失败' });
    }
};

// ========== 邮件模板管理 ==========

/**
 * 获取模板列表
 */
exports.getTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.find({
            $or: [
                { createdBy: req.user._id },
                { isPublic: true }
            ]
        }).sort({ createdAt: -1 });

        res.json(templates);
    } catch (error) {
        console.error('获取模板失败:', error);
        res.status(500).json({ message: '获取失败' });
    }
};

/**
 * 创建模板
 */
exports.createTemplate = async (req, res) => {
    try {
        const { name, subject, content, isPublic, category } = req.body;
        const canCreatePublic = req.user.role === 'teacher' || req.user.role === 'admin';

        const template = await EmailTemplate.create({
            createdBy: req.user._id,
            name,
            subject: subject || '',
            content: content || '',
            isPublic: canCreatePublic ? (isPublic || false) : false,
            category: category || '通知'
        });

        res.json({ message: '模板已创建', template });
    } catch (error) {
        console.error('创建模板失败:', error);
        res.status(500).json({ message: '创建失败' });
    }
};

/**
 * 删除模板
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await EmailTemplate.findOneAndDelete({ _id: id, createdBy: req.user._id });
        res.json({ message: '模板已删除' });
    } catch (error) {
        console.error('删除模板失败:', error);
        res.status(500).json({ message: '删除失败' });
    }
};
/**
 * 获取附件统计
 */
exports.getAttachmentStats = async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: '权限不足' });
        }

        const dir = path.join(__dirname, '../../uploads/email-attachments');
        if (!fs.existsSync(dir)) {
            return res.json({ totalSize: '0 B', count: 0, rawSize: 0, debug_path: dir, status: 'dir_not_found' });
        }

        let totalSize = 0;
        let count = 0;
        const files = fs.readdirSync(dir);
        const errors = [];

        files.forEach(file => {
            try {
                const stats = fs.statSync(path.join(dir, file));
                totalSize += stats.size;
                count++;
            } catch (e) {
                errors.push({ file, error: e.message });
            }
        });

        // 格式化大小
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = totalSize;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        res.json({
            totalSize: size.toFixed(2) + ' ' + units[unitIndex],
            count,
            rawSize: totalSize,
            debug_path: dir,
            debug_files: files,
            debug_errors: errors
        });
    } catch (error) {
        console.error('获取附件统计失败:', error);
        res.status(500).json({ message: '获取统计失败', error: error.message });
    }
};

/**
 * 清理附件
 */
exports.clearAttachments = async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: '权限不足' });
        }

        const { type } = req.body; // 'all' or 'olderThan3M'
        const dir = path.join(__dirname, '../../uploads/email-attachments');

        if (!fs.existsSync(dir)) {
            return res.json({ message: '清理完成', details: { deletedCount: 0, freedSpace: '0 B' } });
        }

        const files = fs.readdirSync(dir);
        let deletedCount = 0;
        let freedSpace = 0;
        const now = Date.now();
        const threeMonths = 90 * 24 * 60 * 60 * 1000;

        files.forEach(file => {
            try {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);

                let shouldDelete = false;
                if (type === 'all') {
                    shouldDelete = true;
                } else if (type === 'olderThan3M') {
                    if (now - stats.mtimeMs > threeMonths) {
                        shouldDelete = true;
                    }
                }

                if (shouldDelete) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    freedSpace += stats.size;
                }
            } catch (e) {
                console.error('删除文件失败:', file, e);
            }
        });

        // Format freed space
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = freedSpace;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        res.json({
            message: '清理完成',
            details: {
                deletedCount,
                freedSpace: size.toFixed(2) + ' ' + units[unitIndex]
            }
        });
    } catch (error) {
        console.error('清理附件失败:', error);
        res.status(500).json({ message: '清理附件失败' });
    }
};
