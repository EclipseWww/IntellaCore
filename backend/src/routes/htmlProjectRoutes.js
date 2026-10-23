const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const htmlProjectController = require('../controllers/htmlProjectController');

// Public routes (no auth required)
// Get all published projects
router.get('/published', htmlProjectController.getPublishedProjects);

// View a published project (public) - MOVED to protected to allow creator access
// router.get('/published/:id', htmlProjectController.viewPublishedProject);

// Protected routes (auth required)
router.use(auth);

// View a published project (or own unpublished project)
router.get('/published/:id', htmlProjectController.viewPublishedProject);

// Create a new HTML project
router.post('/', htmlProjectController.createProject);

// Get all projects for current user
router.get('/', htmlProjectController.getProjects);

// Get a single project
router.get('/:id', htmlProjectController.getProject);

// Update a project
router.put('/:id', htmlProjectController.updateProject);

// Delete a project
router.delete('/:id', htmlProjectController.deleteProject);

// Publish a project
router.put('/:id/publish', htmlProjectController.publishProject);

// Unpublish a project
router.put('/:id/unpublish', htmlProjectController.unpublishProject);

// Link project to assignment
router.put('/:id/link-assignment', htmlProjectController.linkAssignment);

// Teacher publish a project (no points/quota)
router.put('/:id/teacher-publish', htmlProjectController.teacherPublishProject);

// Get projects for a specific assignment (Teacher view)
router.get('/assignment/:lessonId/:activityId', htmlProjectController.getProjectsByLesson);

module.exports = router;

