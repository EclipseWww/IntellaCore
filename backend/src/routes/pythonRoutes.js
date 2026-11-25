const express = require('express');
const router = express.Router();
const pythonController = require('../controllers/pythonController');
const auth = require('../middleware/auth');

// 教师端固定前缀路由需在 /:lessonId/:activityId/* 之前注册，避免 "submissions" 被当作课时ID
router.get('/submissions/:submissionId/attempts', auth, pythonController.getSubmissionAttempts);
router.delete('/submissions/:submissionId', auth, pythonController.deleteSubmission);
router.post('/grade/:submissionId', auth, pythonController.gradeSubmission);

// 学生端路由
router.get('/:lessonId/:activityId/submission', auth, pythonController.getSubmission);
router.get('/:lessonId/:activityId/attempts', auth, pythonController.getMyAttempts);
router.post('/:lessonId/:activityId/save', auth, pythonController.saveDraft);
router.post('/:lessonId/:activityId/submit', auth, pythonController.submit);
router.post('/:lessonId/:activityId/withdraw', auth, pythonController.withdraw);

// 教师端路由 - 权限验证在controller中处理
router.get('/:lessonId/:activityId/submissions', auth, pythonController.getActivitySubmissions);

module.exports = router;
