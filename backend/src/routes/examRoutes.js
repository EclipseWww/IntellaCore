const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const auth = require('../middleware/auth');

// Protect all routes
router.use(auth);

// Simple role authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

router.use(authorize('teacher', 'admin'));

router.get('/', examController.getTeacherExamConfigs);
router.post('/', examController.createExamConfig);
router.get('/:id', examController.getExamConfig);
router.put('/:id', examController.updateExamConfig);
router.post('/:id/calculate', examController.calculateGrades);
router.get('/:id/export', examController.exportGrades);

module.exports = router;
