const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     FlowchartSubmission:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: 用户ID
 *         lessonId:
 *           type: string
 *           description: 课时ID
 *         activityId:
 *           type: string
 *           description: 活动ID
 *         flowchartData:
 *           type: string
 *           description: 流程图数据(JSON格式，包含nodes和edges)
 *         nodeCount:
 *           type: number
 *           description: 节点数量
 *         edgeCount:
 *           type: number
 *           description: 连线数量
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: 提交时间
 *         status:
 *           type: string
 *           enum: [draft, submitted, graded]
 *           description: 状态
 *         grade:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               description: 评分
 *             feedback:
 *               type: string
 *               description: 评语
 *             gradedAt:
 *               type: string
 *               format: date-time
 *               description: 评分时间
 *             gradedBy:
 *               type: string
 *               description: 评分人ID
 */

const flowchartSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  flowchartData: {
    type: String,  // JSON格式，包含 { nodes: [], edges: [] }
    required: true
  },
  nodeCount: {
    type: Number,
    default: 0
  },
  edgeCount: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'graded'],
    default: 'submitted'
  },
  grade: {
    score: {
      type: Number,
      min: 0,
      max: 10
    },
    feedback: String,
    gradedAt: Date,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // 用于记录流程图的时间数据
  duration: {
    type: Number,  // 绘制耗时（秒）
    default: 0
  }
}, {
  timestamps: true
});

// 添加索引
flowchartSubmissionSchema.index({ userId: 1, lessonId: 1, activityId: 1 });
flowchartSubmissionSchema.index({ lessonId: 1, activityId: 1 });
flowchartSubmissionSchema.index({ userId: 1, submittedAt: -1 });

// 保存前自动计算节点和连线数量
flowchartSubmissionSchema.pre('save', function (next) {
  if (this.flowchartData) {
    try {
      const data = JSON.parse(this.flowchartData);
      this.nodeCount = data.nodes ? data.nodes.length : 0;
      this.edgeCount = data.edges ? data.edges.length : 0;
    } catch (e) {
      // JSON解析失败，保持默认值
    }
  }
  next();
});

const FlowchartSubmission = mongoose.model('FlowchartSubmission', flowchartSubmissionSchema);

module.exports = FlowchartSubmission;

