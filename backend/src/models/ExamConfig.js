const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     ExamConfig:
 *       type: object
 *       required:
 *         - title
 *         - course
 *         - class
 *         - lessons
 *       properties:
 *         title:
 *           type: string
 *           description: 考试名称
 *         course:
 *           type: string
 *           description: 关联课程ID
 *         class:
 *           type: string
 *           description: 关联班级ID
 *         lessons:
 *           type: array
 *           items:
 *             type: string
 *           description: 关联的课时ID列表
 *         weights:
 *           type: object
 *           properties:
 *             activities:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   activityId:
 *                     type: string
 *                   lessonId:
 *                     type: string
 *                   weight:
 *                     type: number
 *             dailyPerformance:
 *               type: number
 *               description: 平日成绩占比
 *         dailyScoreSource:
 *           type: string
 *           enum: [manual, analytics]
 *           default: manual
 *           description: 平日成绩来源
 *         semester:
 *           type: string
 *           description: 学期（如：2023-2024-1），用于analytics来源
 *         studentDailyScores:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               student:
 *                 type: string
 *               score:
 *                 type: number
 *           description: 手动输入的平日成绩
 */

const examConfigSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    // Supports multiple classes
    classes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    }],
    // Deprecated single class field (keep for safety if needed, but logic will use classes)
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    lessons: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson'
    }],
    // 平日成绩配置
    dailyPerformanceWeight: {
        type: Number,
        required: true,
        default: 30, // Default 30%
        min: 0,
        max: 100
    },
    dailyScoreSource: {
        type: String,
        enum: ['manual', 'analytics'],
        default: 'analytics'
    },

    // 课时配置 (Hierarchical)
    lessonConfigs: [{
        lessonId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lesson',
            required: true
        },
        weight: { // 课时在"考试部分"中的权重 (0-100)
            type: Number,
            required: true,
            default: 0
        },
        activityConfigs: [{
            _id: false, // Don't create _id for this subdoc to avoid confusion
            activityId: {
                type: String,
                required: true
            },
            weight: { // 活动在"课时"中的权重 (0-100)
                type: Number,
                required: true,
                default: 0
            }
        }]
    }],
    semester: {
        type: String, // e.g., "2023-2024-1"
        default: ''
    },
    studentDailyScores: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        score: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for easier lookup
examConfigSchema.index({ course: 1, class: 1 });

const ExamConfig = mongoose.model('ExamConfig', examConfigSchema);

module.exports = ExamConfig;
