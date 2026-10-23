const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const spreadsheetSubmissionController = require('../controllers/spreadsheetSubmissionController');

router.use(auth);

// Student: Get or create their own submission for an activity
router.get('/lesson/:lessonId/activity/:activityId', spreadsheetSubmissionController.getOrCreateSubmission);

// Student: Update their own submission
router.put('/:id', spreadsheetSubmissionController.updateSubmission);

// Teacher: Get all student submissions for an activity
router.get('/lesson/:lessonId/activity/:activityId/all', spreadsheetSubmissionController.getActivitySubmissions);

module.exports = router;
