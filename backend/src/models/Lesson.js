const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     LessonResource:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: 资源标题
 *         type:
 *           type: string
 *           enum: [document, image, video, audio, other]
 *           description: 资源类型
 *         filename:
 *           type: string
 *           description: 文件名
 *         path:
 *           type: string
 *           description: 文件存储路径
 *         size:
 *           type: number
 *           description: 文件大小(字节)
 *         uploadTime:
 *           type: string
 *           format: date-time
 *           description: 上传时间
 *
 *     TypingSettings:
 *       type: object
 *       properties:
 *         text:
 *           type: string
 *           description: 打字文本ID
 *         targetSpeed:
 *           type: number
 *           description: 目标打字速度
 *         targetAccuracy:
 *           type: number
 *           description: 目标准确率(%)
 *         timeLimit:
 *           type: number
 *           description: 时间限制(分钟)
 *
 *     QuizSettings:
 *       type: object
 *       properties:
 *         quiz:
 *           type: string
 *           description: 测验ID
 *
 *     LessonActivity:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: 活动标题
 *         type:
 *           type: string
 *           enum: [video, reading, quiz, practice, discussion, typing]
 *           description: 活动类型
 *         description:
 *           type: string
 *           description: 活动描述
 *         content:
 *           type: string
 *           description: 活动内容
 *         duration:
 *           type: number
 *           description: 预计时长(分钟)
 *         requireSubmission:
 *           type: boolean
 *           description: 是否需要提交
 *         allowedFormats:
 *           type: array
 *           items:
 *             type: string
 *             enum: [XLS, XLSX, PPT, PPTX, DOC, DOCX, PY, PDF, ZIP, RAR, TXT, C, CPP]
 *           description: 允许的文件格式
 *         referenceAnswer:
 *           type: string
 *           description: 参考答案
 *         quizSettings:
 *           $ref: '#/components/schemas/QuizSettings'
 *         typingSettings:
 *           $ref: '#/components/schemas/TypingSettings'
 *         resources:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LessonResource'
 *           description: 活动相关资源
 *         isPublished:
 *           type: boolean
 *           description: 是否发布
 *
 *     Lesson:
 *       type: object
 *       required:
 *         - title
 *         - order
 *         - course
 *         - unit
 *       properties:
 *         _id:
 *           type: string
 *           description: 课时ID
 *         title:
 *           type: string
 *           description: 课时标题
 *         description:
 *           type: string
 *           description: 课时描述
 *         objectives:
 *           type: array
 *           items:
 *             type: string
 *           description: 学习目标
 *         activities:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LessonActivity'
 *           description: 学习活动
 *         order:
 *           type: number
 *           description: 课时顺序
 *         course:
 *           type: string
 *           description: 所属课程ID
 *         unit:
 *           type: string
 *           description: 所属单元ID
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *           description: 课时状态
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const lessonSchema = new mongoose.Schema({
  migrationMedia: [{ _id: false, name: String, size: Number }],
  title: {
    type: String,
    required: true
  },
  description: String,
  objectives: [String],  // 学习目标直接放在根级别

  // 学习活动
  activities: [{
    title: String,        // 活动标题
    type: {
      type: String,
      enum: ['video', 'reading', 'quiz', 'practice', 'discussion', 'typing', 'flowchart', 'spreadsheet', 'html', 'fillblank', 'python']
    },
    description: String,  // 活动描述/作业要求
    content: String,      // 活动内容
    duration: Number,     // 预计时长（分钟）
    requireSubmission: {  // 是否需要学生提交
      type: Boolean,
      default: false
    },
    allowedFormats: [{   // 允许的文件格式
      type: String,
      enum: ['XLS', 'XLSX', 'PPT', 'PPTX', 'DOC', 'DOCX', 'PY', 'PDF', 'ZIP', 'RAR', 'TXT', 'C', 'CPP']
    }],
    referenceAnswer: String,   // 参考答案（仅用于编程题）
    quizSettings: {
      quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: function () {
          return this.type === 'quiz';
        }
      },
      // 测验配置设置 (从Quiz模型移动到此处，支持活动级配置)
      allowMultipleAttempts: {
        type: Boolean,
        default: false
      },
      maxAttempts: {
        type: Number,
        min: 1,
        default: 1
      },
      randomizeQuestions: {
        type: Boolean,
        default: false
      },
      randomizeOptions: {
        type: Boolean,
        default: false
      },
      showAnswerAfterSubmit: {
        type: Boolean,
        default: false
      },
      showScoreAfterSubmit: {
        type: Boolean,
        default: true
      },
      timeLimit: {
        type: Number,
        min: 0,  // 0 表示无时间限制
        default: 0
      }
    },
    typingSettings: {
      text: {                   // 改为单个text引用
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypingText',
        required: function () {  // 当活动类型为typing时必填
          return this.type === 'typing';
        }
      },
      targetSpeed: {           // 改名：minSpeed -> targetSpeed
        type: Number,
        min: 0,
        required: function () {
          return this.type === 'typing';
        }
      },
      targetAccuracy: {        // 改名：minAccuracy -> targetAccuracy
        type: Number,
        min: 0,
        max: 100,
        required: function () {
          return this.type === 'typing';
        }
      },
      timeLimit: {             // 添加验证
        type: Number,
        min: 1,
        required: function () {
          return this.type === 'typing';
        }
      },
      allowOnce: {
        type: Boolean,
        default: false
      }
    },
    flowchartSettings: {
      instructions: String,
      maxNodes: Number,
      timeLimit: Number,
      allowedNodeTypes: [String],
      template: String,
      referenceAnswer: String
    },
    spreadsheetSettings: {
      instructions: String,
      spreadsheetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Spreadsheet'
      },
      timeLimit: Number
    },
    fillBlankSettings: {
      instructions: String,           // 活动说明
      content: String,                // 带有{{blank:答案}}标记的Markdown内容
      showCorrectAfterSubmit: {       // 提交后是否显示正确答案
        type: Boolean,
        default: true
      }
    },
    pythonSettings: {
      instructions: String,           // 活动说明（Markdown）
      starterCode: {                  // 初始代码模板
        type: String,
        default: '# 在这里编写你的Python代码\n'
      },
      testCases: [{                   // OJ测试用例
        input: String,                // 输入数据
        expectedOutput: String,       // 预期输出
        isHidden: {                   // 是否隐藏（学生看不到具体内容）
          type: Boolean,
          default: false
        }
      }]
    },
    pptGradingSettings: {
      enabled: {
        type: Boolean,
        default: false
      },
      originalFile: {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: Date
      },
      referenceFile: {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: Date
      },
      rules: [mongoose.Schema.Types.Mixed],
      updatedAt: Date
    },
    excelGradingSettings: {
      enabled: {
        type: Boolean,
        default: false
      },
      originalFile: {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: Date
      },
      referenceFile: {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: Date
      },
      rules: [mongoose.Schema.Types.Mixed],
      updatedAt: Date
    },
    resources: [{        // 活动相关资源
      title: String,     // 资源标题
      type: {           // 资源类型
        type: String,
        enum: ['document', 'image', 'video', 'audio', 'other']
      },
      filename: String,  // 文件名
      path: String,      // 文件存储路径
      size: Number,      // 文件大小(bytes)
      uploadTime: {      // 上传时间
        type: Date,
        default: Date.now
      }
    }],
    isPublished: {  // 是否发布
      type: Boolean,
      default: true
    }
  }],

  // 元数据
  order: {
    type: Number,
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
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// 添加索引
lessonSchema.index({ course: 1, unit: 1, order: 1 });

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
