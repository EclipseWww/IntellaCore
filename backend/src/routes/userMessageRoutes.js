const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const userMessageController = require('../controllers/userMessageController');

// 获取或创建私聊会话
router.post('/conversations/direct', auth, roleCheck(['student','teacher','admin']), userMessageController.getOrCreateDirectConversation);

// 创建群聊
router.post('/conversations/group', auth, roleCheck(['student','teacher','admin']), userMessageController.createGroupConversation);

// 我的会话列表
router.get('/conversations', auth, roleCheck(['student','teacher','admin']), userMessageController.getMyConversations);

// 会话消息（分页）
router.get('/conversations/:conversationId/messages', auth, roleCheck(['student','teacher','admin']), userMessageController.getConversationMessages);

// 标记会话消息为已读
router.post('/conversations/:conversationId/read', auth, roleCheck(['student','teacher','admin']), userMessageController.markConversationRead);

// 发送消息
router.post('/messages', auth, roleCheck(['student','teacher','admin']), userMessageController.sendMessage);

// 群聊成员管理
router.post('/conversations/:conversationId/members/add', auth, roleCheck(['student','teacher','admin']), userMessageController.addMembers);
router.delete('/conversations/:conversationId/members/:memberId', auth, roleCheck(['student','teacher','admin']), userMessageController.removeMember);

// 退出会话
router.post('/conversations/:conversationId/leave', auth, roleCheck(['student','teacher','admin']), userMessageController.leaveConversation);

// 教师审查：学生会话与消息
router.get('/teacher/students/:studentId/conversations', auth, roleCheck(['teacher','admin']), userMessageController.getStudentConversationsForTeacher);
router.get('/teacher/conversations/:conversationId/messages', auth, roleCheck(['teacher','admin']), userMessageController.getConversationMessagesForTeacher);
router.get('/teacher/classes/:classId/groups', auth, roleCheck(['teacher','admin']), userMessageController.getClassGroupConversationsForTeacher);

module.exports = router;


