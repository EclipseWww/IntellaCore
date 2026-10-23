const express = require('express');
const router = express.Router();
const loginRequestController = require('../controllers/loginRequestController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// 学生发起登录请求 (无需认证，因为学生尚未登录)
router.post('/request', loginRequestController.createRequest);

// 学生查询请求状态 (无需认证)
router.get('/status/:id', loginRequestController.getRequestStatus);

// 教师获取班级的待处理登录请求 (需要教师认证)
router.get('/pending/:classId', auth, roleCheck(['teacher', 'admin']), loginRequestController.getPendingRequests);

// 教师同意登录请求 (需要教师认证)
router.post('/approve/:id', auth, roleCheck(['teacher', 'admin']), loginRequestController.approveRequest);

// 教师拒绝登录请求 (需要教师认证)
router.post('/reject/:id', auth, roleCheck(['teacher', 'admin']), loginRequestController.rejectRequest);

// 批量同意 (需要教师认证)
router.post('/bulk-approve', auth, roleCheck(['teacher', 'admin']), loginRequestController.bulkApprove);

// 批量拒绝 (需要教师认证)
router.post('/bulk-reject', auth, roleCheck(['teacher', 'admin']), loginRequestController.bulkReject);

module.exports = router;
