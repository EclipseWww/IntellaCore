const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE', 'PSYCHOLOGICAL_SCALE'],
    required: true
  },
  options: [{
    content: {
      type: String,
      required: true
    },
    value: {
      type: Number,  // 用于心理量表的选项分值
    },
    isCorrect: {
      type: Boolean,
    }
  }],
  explanation: {
    type: String,
    default: ''
  },
  difficulty: {
    type: Number,
    min: 0,
    max: 10,
    default: 5,  // 默认中等难度
    validate: {
      validator: function (v) {
        return v >= 0 && v <= 10;
      },
      message: props => `${props.value} 不是有效的难度值！难度必须在0-10之间`
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  // 矩阵量表特有字段（可选，用于心理量表的矩阵模式）
  matrixRows: [{
    content: {
      type: String,
      required: false
    },
    id: {
      type: String,
      required: false
    }
  }],
  // 量表级数（如5级量表、7级量表）
  scaleLevel: {
    type: Number,
    min: 3,
    max: 10,
    required: function () {
      return this.type === 'PSYCHOLOGICAL_SCALE';
    }
  },
  // 量表标签（可选，如果不提供则使用默认的数字标签）
  scaleLabels: {
    type: [String],
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ========== 版本控制字段 ==========
  // 题目版本号（每次修改+1）
  version: {
    type: Number,
    default: 1
  },
  // 是否已归档（旧版本会被归档）
  isArchived: {
    type: Boolean,
    default: false
  },
  // 原始题目ID（版本链的起点，归档版本指向最新版本）
  originalQuestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    default: null
  },
  // 软删除时间戳（null表示未删除）
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// 添加索引以支持版本查询
questionSchema.index({ originalQuestionId: 1, version: 1 });
questionSchema.index({ isArchived: 1 });
questionSchema.index({ deletedAt: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question; 