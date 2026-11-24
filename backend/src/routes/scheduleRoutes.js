const express = require('express');
const router = express.Router();
const c = require('../controllers/scheduleController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(auth);

// 节次配置：所有登录用户可读，管理员可改
router.get('/config', c.getConfig);
router.put('/config', roleCheck(['admin']), c.updateConfig);

// 以下均为教师功能
router.use(roleCheck(['teacher']));

router.get('/slots', c.listSlots);
router.put('/slots', c.upsertSlot);
router.post('/slots/move', c.moveSlot);
router.delete('/slots/:id', c.deleteSlot);

router.post('/adjustments', c.createAdjustment);
router.delete('/adjustments/:id', c.deleteAdjustment);

router.get('/occurrences', c.listOccurrences);
router.post('/occurrences/start', c.startOccurrence);
router.post('/occurrences/skip', c.skipOccurrence);
router.post('/occurrences/record', c.recordOccurrence);

router.get('/sessions', c.listSessions);
router.get('/sessions/:id', c.getSession);
router.patch('/sessions/:id', c.updateSession);
router.delete('/sessions/:id/skip', c.unskipOccurrence);
router.put('/sessions/:id/judgement', c.setJudgement);
router.put('/sessions/:id/attendance', c.saveAttendance);

router.get('/now', c.nowStatus);
router.get('/my-courses', c.listMyCourses);
router.get('/courses/:courseId/lessons', c.listCourseLessons);
router.get('/progress', c.getProgress);
router.get('/export/roster', c.exportRoster);

module.exports = router;
