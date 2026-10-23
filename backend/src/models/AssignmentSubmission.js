const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     FileSubmission:
 *       type: object
 *       properties:
 *         filename:
 *           type: string
 *           description: 存储的文件名
 *         originalName:
 *           type: string
 *           description: 原始文件名
 *         path:
 *           type: string
 *           description: 文件存储路径
 *         size:
 *           type: number
 *           description: 文件大小(字节)
 *         mimeType:
 *           type: string
 *           description: 文件MIME类型
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: 上传时间
 *         pdfPreviewPath:
 *           type: string
 *           description: PDF预览文件路径
 *         fileDeleted:
 *           type: boolean
 *           description: 原始文件是否已删除
 *         pdfPreviewDeleted:
 *           type: boolean
 *           description: PDF预览文件是否已删除
 *
 *     RubricScore:
 *       type: object
 *       properties:
 *         criterion:
 *           type: string
 *           description: 评分标准名称
 *         score:
 *           type: number
 *           description: 评分
 *         feedback:
 *           type: string
 *           description: 针对该标准的反馈
 *
 *     AIAnalysis:
 *       type: object
 *       properties:
 *         codeQuality:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 代码质量评分
 *             feedback:
 *               type: string
 *               description: 代码质量反馈
 *         functionality:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 功能性评分
 *             feedback:
 *               type: string
 *               description: 功能性反馈
 *         basicConcepts:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 基础概念掌握评分
 *             feedback:
 *               type: string
 *               description: 基础概念掌握反馈
 *         logicClarity:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 逻辑清晰度评分
 *             feedback:
 *               type: string
 *               description: 逻辑清晰度反馈
 *         readability:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 可读性评分
 *             feedback:
 *               type: string
 *               description: 可读性反馈
 *         efficiency:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 效率评分
 *             feedback:
 *               type: string
 *               description: 效率反馈
 *
 *     PreviousVersion:
 *       type: object
 *       properties:
 *         content:
 *           type: object
 *           description: 提交内容
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: 提交时间
 *         version:
 *           type: number
 *           description: 版本号
 *
 *     AssignmentSubmission:
 *       type: object
 *       required:
 *         - student
 *         - course
 *         - unit
 *         - lesson
 *         - activity
 *       properties:
 *         _id:
 *           type: string
 *           description: 提交ID
 *         student:
 *           type: string
 *           description: 学生ID
 *         course:
 *           type: string
 *           description: 课程ID
 *         unit:
 *           type: string
 *           description: 单元ID
 *         lesson:
 *           type: string
 *           description: 课时ID
 *         activity:
 *           type: string
 *           description: 活动ID
 *         content:
 *           type: object
 *           properties:
 *             text:
 *               type: string
 *               description: 文本答案
 *             file:
 *               $ref: '#/components/schemas/FileSubmission'
 *             code:
 *               type: string
 *               description: 代码答案
 *             links:
 *               type: array
 *               items:
 *                 type: string
 *               description: 链接提交
 *         status:
 *           type: string
 *           enum: [draft, submitted, graded, returned]
 *           description: 提交状态
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: 提交时间
 *         grade:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 得分
 *             feedback:
 *               type: string
 *               description: 教师反馈
 *             gradedBy:
 *               type: string
 *               description: 批阅教师ID
 *             gradedAt:
 *               type: string
 *               format: date-time
 *               description: 批阅时间
 *             rubricScores:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RubricScore'
 *         aiGrade:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: AI评分
 *             feedback:
 *               type: string
 *               description: AI总体反馈
 *             analysis:
 *               $ref: '#/components/schemas/AIAnalysis'
 *             suggestions:
 *               type: array
 *               items:
 *                 type: string
 *               description: 改进建议
 *             gradedAt:
 *               type: string
 *               format: date-time
 *               description: AI评分时间
 *         version:
 *           type: number
 *           description: 当前版本号
 *         previousVersions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PreviousVersion'
 *           description: 历史版本
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const assignmentSubmissionSchema = new mongoose.Schema({
  // 关联信息
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseUnit',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  activity: {
    type: String,  // 活动ID
    required: true
  },

  // 提交内容
  content: {
    text: String,           // 文本答案
    file: {                 // 文件提交（改为单个文件）
      filename: String,     // 存储的文件名
      originalName: String, // 原始文件名
      path: String,         // 文件存储路径
      size: Number,         // 文件大小
      mimeType: String,     // 文件类型
      uploadedAt: Date,     // 上传时间
      pdfPreviewPath: {     // PDF预览文件路径
        type: String,
        default: null
      },
      fileDeleted: {        // 原始文件是否已删除
        type: Boolean,
        default: false
      },
      pdfPreviewDeleted: {  // PDF预览文件是否已删除
        type: Boolean,
        default: false
      }
    },
    code: String,          // 代码答案
    links: [String],       // 链接提交
  },

  // 提交状态
  status: {
    type: String,
    enum: ['draft', 'submitted', 'graded', 'returned'],
    default: 'submitted'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },

  // 评分信息
  grade: {
    source: { type: String, enum: ['manual', 'ppt_auto', 'excel_auto'] },
    score: Number,
    feedback: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: Date,
    rubricScores: [{
      criterion: String,
      score: Number,
      feedback: String
    }]
  },

  // AI 评阅信息
  aiGrade: {
    score: Number,
    feedback: String,
    analysis: {
      codeQuality: {
        score: Number,
        feedback: String
      },
      functionality: {
        score: Number,
        feedback: String
      },
      basicConcepts: {
        score: Number,
        feedback: String
      },
      logicClarity: {
        score: Number,
        feedback: String
      },
      readability: {
        score: Number,
        feedback: String
      },
      efficiency: {
        score: Number,
        feedback: String
      }
    },
    suggestions: [String],
    gradedAt: Date
  },

  // PPT 自动批阅信息（基于原始PPT/参考答案PPT/学生PPT结构化对比）
  pptAutoGrade: {
    score: Number,
    maxScore: Number,
    rawScore: Number,
    feedback: String,
    passedCount: Number,
    totalRules: Number,
    results: [mongoose.Schema.Types.Mixed],
    gradedAt: Date
  },

  excelAutoGrade: {
    score: Number,
    maxScore: Number,
    rawScore: Number,
    feedback: String,
    passedCount: Number,
    totalRules: Number,
    results: [mongoose.Schema.Types.Mixed],
    gradedAt: Date
  },

  // 版本控制
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    content: mongoose.Schema.Types.Mixed,
    submittedAt: Date,
    version: Number
  }]
}, {
  timestamps: true
});

// 索引
assignmentSubmissionSchema.index({ course: 1, unit: 1, lesson: 1, activity: 1 });
assignmentSubmissionSchema.index({ student: 1 });
assignmentSubmissionSchema.index({ status: 1 });
assignmentSubmissionSchema.index({ submittedAt: -1 });

const AssignmentSubmission = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);

module.exports = AssignmentSubmission;
