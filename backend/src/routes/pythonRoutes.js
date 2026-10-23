const express = require('express');
const router = express.Router();
const pythonController = require('../controllers/pythonController');
const auth = require('../middleware/auth');

// 学生端路由
router.get('/:lessonId/:activityId/submission', auth, pythonController.getSubmission);
router.post('/:lessonId/:activityId/save', auth, pythonController.saveDraft);
router.post('/:lessonId/:activityId/submit', auth, pythonController.submit);
router.post('/:lessonId/:activityId/withdraw', auth, pythonController.withdraw);

// 教师端路由 - 权限验证在controller中处理
router.get('/:lessonId/:activityId/submissions', auth, pythonController.getActivitySubmissions);
router.post('/grade/:submissionId', auth, pythonController.gradeSubmission);
router.delete('/submissions/:submissionId', auth, pythonController.deleteSubmission);

module.exports = router;
