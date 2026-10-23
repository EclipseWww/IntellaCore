const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const emailController = require('../controllers/emailController');

// 确保附件目录存在
const attachmentDir = path.join(__dirname, '../../uploads/email-attachments');
if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true });
}

// 配置附件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, attachmentDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB 限制
        files: 5 // 最多5个附件
    }
});

// 系统状态
router.get('/status', auth, emailController.getSystemStatus);
router.put('/status', auth, emailController.setSystemStatus);
router.put('/terminal-mode', auth, emailController.setTerminalMode);

// 附件管理 (教师端)
router.get('/attachments/stats', auth, emailController.getAttachmentStats);
router.post('/attachments/clear', auth, emailController.clearAttachments);

// 账号管理
router.post('/register', auth, emailController.registerEmail);
router.get('/account', auth, emailController.getAccount);
router.put('/signature', auth, emailController.updateSignature);

// 搜索邮箱（自动完成）
router.get('/search', auth, emailController.searchAccounts);

// 同班同学列表
router.get('/classmates', auth, emailController.getClassmates);

// 教师功能
router.get('/classes', auth, emailController.getTeacherClasses);
router.post('/broadcast', auth, upload.array('attachments', 5), emailController.sendBroadcast);

// 邮件操作
router.post('/draft', auth, emailController.saveDraft);
router.post('/send', auth, upload.array('attachments', 5), emailController.sendEmail);
router.get('/search-emails', auth, emailController.searchEmails);
router.get('/list', auth, emailController.getEmails);
router.get('/unread-count', auth, emailController.getUnreadCount);
router.put('/:id/read', auth, emailController.markReadStatus);
router.put('/:id/star', auth, emailController.toggleStar);
router.delete('/:id', auth, emailController.deleteEmail);

// 附件下载
router.get('/attachment/:filename', auth, (req, res) => {
    const filePath = path.join(attachmentDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: '附件不存在' });
    }
});

// 联系人管理
router.get('/contacts', auth, emailController.getContacts);
router.post('/contacts', auth, emailController.addContact);
router.delete('/contacts/:id', auth, emailController.deleteContact);

// 邮件模板管理
router.get('/templates', auth, emailController.getTemplates);
router.post('/templates', auth, emailController.createTemplate);
router.delete('/templates/:id', auth, emailController.deleteTemplate);

// Keep fixed paths above the single-segment email identifier.
router.get('/:id', auth, emailController.getEmailById);
module.exports = router;
