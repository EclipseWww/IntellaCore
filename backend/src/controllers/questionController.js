const Question = require('../models/Question');
const { getOpenAIClient, getAIModel } = require('../config/ai');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const fsExists = promisify(fs.exists);
const fsRename = promisify(fs.rename);
const fsAccess = promisify(fs.access);
const fsMkdir = promisify(fs.mkdir);

// 版本控制服务
const questionVersionService = require('../services/questionVersionService');

// 媒体文件根目录
const MEDIA_ROOT = path.join(__dirname, '../../uploads/public/media');

// OpenAI 客户端由 config/ai 动态提供

/**
 * 移动草稿题目关联的媒体文件到正式题目目录
 * @param {string} type 题目类型
 * @param {string} draftId 草稿ID
 * @param {string} questionId 正式题目ID
 */
const moveDraftMediaFiles = async (type, draftId, questionId) => {
  try {
    // 构建源目录和目标目录路径
    const srcDir = path.join(MEDIA_ROOT, 'question-bank', type, draftId);
    const targetDir = path.join(MEDIA_ROOT, 'question-bank', type, questionId);

    logger.info('查找草稿媒体目录', { srcDir, targetDir });

    // 检查源目录是否存在
    const srcExists = await fsExists(srcDir);
    if (!srcExists) {
      logger.info('草稿媒体目录不存在，无需移动', { srcDir });
      return true;
    }

    // 确保目标目录存在
    try {
      await fsAccess(targetDir);
    } catch (err) {
      // 目标目录不存在，创建它
      await fsMkdir(targetDir, { recursive: true });
      logger.info('创建目标媒体目录', { targetDir });
    }

    // 获取源目录中的所有文件
    const files = await fs.promises.readdir(srcDir);
    if (files.length === 0) {
      logger.info('草稿媒体目录为空，无需移动文件', { srcDir });
      return true;
    }

    logger.info('开始移动媒体文件', { fileCount: files.length });

    // 逐个移动文件，而不是移动整个目录
    for (const file of files) {
      const srcFile = path.join(srcDir, file);
      const targetFile = path.join(targetDir, file);

      try {
        // 确保是文件而不是目录
        const stat = await fs.promises.stat(srcFile);
        if (stat.isFile()) {
          await fsRename(srcFile, targetFile);
          logger.info('媒体文件移动成功', { from: srcFile, to: targetFile });
        }
      } catch (error) {
        logger.error('移动单个文件失败', { file, error: error.message });
        // 继续处理其他文件，不中断
      }
    }

    // 尝试删除源目录（如果为空）
    try {
      await fs.promises.rmdir(srcDir);
      logger.info('删除空的草稿媒体目录', { srcDir });
    } catch (error) {
      logger.warn('无法删除草稿媒体目录', { srcDir, error: error.message });
      // 忽略错误，不影响主流程
    }

    return true;
  } catch (error) {
    logger.error('移动媒体文件失败', { error: error.message, stack: error.stack });
    return false;
  }
};

/**
 * 更新Markdown文本中的媒体文件URL引用
 * @param {string} text Markdown文本
 * @param {string} type 题目类型
 * @param {string} draftId 草稿ID
 * @param {string} questionId 题目ID
 * @returns {string} 更新后的Markdown文本
 */
const updateMediaUrlsInMarkdown = (text, type, draftId, questionId) => {
  if (!text || !draftId) return text;

  // 图片和视频的URL模式
  const urlPatterns = [
    // Markdown图片: ![alt](url)
    new RegExp(`!\\[([^\\]]*)\\]\\(([^)]*question-bank/${type}/${draftId}[^)]*)\\)`, 'g'),
    // Markdown链接: [text](url)
    new RegExp(`\\[([^\\]]*)\\]\\(([^)]*question-bank/${type}/${draftId}[^)]*)\\)`, 'g'),
    // HTML图片: <img src="url">
    new RegExp(`<img[^>]*src=["']([^"']*question-bank/${type}/${draftId}[^"']*)["'][^>]*>`, 'g'),
    // HTML视频: <video src="url">
    new RegExp(`<video[^>]*src=["']([^"']*question-bank/${type}/${draftId}[^"']*)["'][^>]*>`, 'g'),
    // 直接URL引用
    new RegExp(`([\s"':=])(/[^"'<>\\s]*question-bank/${type}/${draftId}[^"'<>\\s]*)`, 'g')
  ];

  let updatedText = text;

  // 对每种模式进行替换
  urlPatterns.forEach(pattern => {
    updatedText = updatedText.replace(pattern, (match, ...args) => {
      // 根据不同的正则模式进行不同的替换
      if (pattern.toString().includes('!\\[')) {
        // Markdown图片
        const alt = args[0];
        const url = args[1].replace(draftId, questionId);
        return `![${alt}](${url})`;
      } else if (pattern.toString().includes('\\[')) {
        // Markdown链接
        const text = args[0];
        const url = args[1].replace(draftId, questionId);
        return `[${text}](${url})`;
      } else if (pattern.toString().includes('<img')) {
        // HTML图片
        return match.replace(draftId, questionId);
      } else if (pattern.toString().includes('<video')) {
        // HTML视频
        return match.replace(draftId, questionId);
      } else {
        // 直接URL引用
        const prefix = args[0];
        const url = args[1].replace(draftId, questionId);
        return `${prefix}${url}`;
      }
    });
  });

  return updatedText;
};

// 创建新题目
exports.createQuestion = async (req, res) => {
  try {
    let { title, content, type, options, explanation, tags, difficulty, draftId, scaleLevel, scaleLabels, matrixRows } = req.body;

    logger.info('创建题目请求', { type, tagsCount: tags?.length, hasDraftId: !!draftId, scaleLevel, hasMatrixRows: Array.isArray(matrixRows) ? matrixRows.length : 0 });

    // 创建题目
    const question = await Question.create({
      title,
      content,
      type,
      options,
      // 心理量表相关字段
      scaleLevel,
      scaleLabels,
      matrixRows,
      explanation,
      tags,
      difficulty,
      createdBy: req.user._id
    });

    // 如果存在草稿ID，处理关联的媒体文件
    if (draftId) {
      const questionId = question._id.toString();
      logger.info('处理草稿题目媒体文件', { draftId, questionId });

      // 1. 移动媒体文件
      const moveResult = await moveDraftMediaFiles(type, draftId, questionId);

      if (!moveResult) {
        logger.warn('媒体文件移动失败，但题目已创建', { draftId, questionId });
      } else {
        // 2. 更新Markdown中的URL引用
        let needsUpdate = false;

        // 更新题目内容中的URL
        if (content) {
          const updatedContent = updateMediaUrlsInMarkdown(content, type, draftId, questionId);
          if (updatedContent !== content) {
            content = updatedContent;
            needsUpdate = true;
          }
        }

        // 更新选项中的URL
        if (options && Array.isArray(options)) {
          let optionsUpdated = false;
          options = options.map(option => {
            if (option.content) {
              const updatedContent = updateMediaUrlsInMarkdown(option.content, type, draftId, questionId);
              if (updatedContent !== option.content) {
                optionsUpdated = true;
                return { ...option, content: updatedContent };
              }
            }
            return option;
          });

          if (optionsUpdated) {
            needsUpdate = true;
          }
        }

        // 更新解析中的URL
        if (explanation) {
          const updatedExplanation = updateMediaUrlsInMarkdown(explanation, type, draftId, questionId);
          if (updatedExplanation !== explanation) {
            explanation = updatedExplanation;
            needsUpdate = true;
          }
        }

        // 如果有更新，保存题目
        if (needsUpdate) {
          logger.info('更新题目中的媒体URL引用', { questionId });
          await Question.findByIdAndUpdate(questionId, {
            content,
            options,
            explanation
          });
        }
      }
    }

    logger.info('题目创建成功', { id: question._id });
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    logger.error('创建题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '创建题目失败',
      error: error.message
    });
  }
};

// 获取题目列表（排除已归档和已删除的题目）
exports.getQuestions = async (req, res) => {
  try {
    const { type, tags, includeArchived } = req.query;
    const query = {
      // 默认排除已归档和已删除的题目（懒迁移兼容：没有字段的旧数据也会被返回）
      $or: [
        { isArchived: { $ne: true } },
        { isArchived: { $exists: false } }
      ],
      $and: [
        { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
      ]
    };

    // 如果请求包含已归档题目（用于版本历史查询）
    if (includeArchived === 'true') {
      delete query.$or;
    }

    if (type) query.type = type;
    if (tags) query.tags = { $in: tags.split(',') };

    logger.info('获取题目列表', { type, tags, includeArchived });

    const questions = await Question.find(query)
      .populate('createdBy', 'name')
      .sort('-createdAt');

    // 规范化数据（懒迁移）
    const normalizedQuestions = questions.map(q => questionVersionService.normalizeQuestion(q));

    logger.info('题目列表获取成功', { count: normalizedQuestions.length });
    res.status(200).json({ success: true, data: normalizedQuestions });
  } catch (error) {
    logger.error('获取题目列表失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取题目列表失败',
      error: error.message
    });
  }
};

// 获取单个题目
exports.getQuestion = async (req, res) => {
  try {
    logger.info('获取题目详情', { id: req.params.id });

    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'name');

    if (!question) {
      logger.warn('题目不存在', { id: req.params.id });
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    logger.info('题目详情获取成功', { id: question._id });
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    logger.error('获取题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取题目失败',
      error: error.message
    });
  }
};

// 获取题目引用信息（被多少测验使用）
exports.getQuestionReferences = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('获取题目引用信息', { id });

    const references = await questionVersionService.getQuestionReferences(id);

    logger.info('题目引用信息获取成功', { id, ...references });
    res.status(200).json({ success: true, data: references });
  } catch (error) {
    logger.error('获取题目引用信息失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '获取题目引用信息失败',
      error: error.message
    });
  }
};

// 获取题目版本历史
exports.getQuestionVersionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('获取题目版本历史', { id });

    const history = await questionVersionService.getQuestionVersionHistory(id);

    logger.info('题目版本历史获取成功', { id, versionCount: history.length });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    logger.error('获取题目版本历史失败', { error: error.message });
    res.status(500).json({
      success: false,
      message: '获取题目版本历史失败',
      error: error.message
    });
  }
};

// 更新题目（带版本控制）
exports.updateQuestion = async (req, res) => {
  try {
    let { title, content, type, options, explanation, tags, scaleLevel, scaleLabels, matrixRows, updateMode } = req.body;

    // 更新模式: 'SYNC_ALL' | 'PROTECT_SUBMITTED' | 'CREATE_NEW'
    // 默认使用 SYNC_ALL（同步更新到所有测验）
    updateMode = updateMode || 'SYNC_ALL';

    logger.info('更新题目请求', { id: req.params.id, type, updateMode });

    const question = await Question.findById(req.params.id);

    if (!question) {
      logger.warn('题目不存在', { id: req.params.id });
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 处理 options 的结构，保留原始ID
    if (options && Array.isArray(options)) {
      if (type === 'PSYCHOLOGICAL_SCALE') {
        options = options.map((option, index) => {
          const originalOption = index < question.options.length ? question.options[index] : null;
          return {
            _id: option._id || (originalOption ? originalOption._id : undefined),
            content: option.content,
            value: option.value
          };
        });
      } else {
        options = options.map((option, index) => {
          const originalOption = index < question.options.length ? question.options[index] : null;
          return {
            _id: option._id || (originalOption ? originalOption._id : undefined),
            content: option.content,
            isCorrect: option.isCorrect
          };
        });
      }
    } else {
      options = [];
      logger.info('未提供options或options不是数组，设为空数组', { type, optionsReceived: req.body.options });
    }

    // 记录选项ID变化情况
    const originalIds = question.options.map(opt => opt._id.toString());
    const newIds = options.map(opt => opt._id ? opt._id.toString() : 'new');
    const preservedIds = options.filter(o => o._id && originalIds.includes(o._id.toString())).length;

    logger.info('更新题目选项', {
      questionId: req.params.id,
      originalOptionsCount: question.options.length,
      newOptionsCount: options.length,
      preservedIds,
      addedOptionsCount: options.length - preservedIds
    });

    // 构建更新数据
    const updateData = { title, content, type, options, explanation, tags };

    // 如果是量表题目，添加量表相关字段
    if (type === 'PSYCHOLOGICAL_SCALE') {
      updateData.scaleLevel = scaleLevel;
      updateData.scaleLabels = scaleLabels;
      updateData.matrixRows = matrixRows;

      logger.info('更新量表题目字段', {
        questionId: req.params.id,
        scaleLevel,
        scaleLabelsCount: scaleLabels ? scaleLabels.length : 0,
        matrixRowsCount: matrixRows ? matrixRows.length : 0
      });
    }

    // 使用版本控制服务更新题目
    const result = await questionVersionService.updateQuestionWithVersioning(
      req.params.id,
      updateData,
      updateMode
    );

    logger.info('题目更新成功', {
      id: result.question._id,
      version: result.question.version,
      updateMode,
      hasArchivedVersion: !!result.archivedQuestion
    });

    res.status(200).json({
      success: true,
      data: result.question,
      references: result.references,
      archivedQuestion: result.archivedQuestion ? { _id: result.archivedQuestion._id, version: result.archivedQuestion.version } : null
    });
  } catch (error) {
    logger.error('更新题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '更新题目失败',
      error: error.message
    });
  }
};

// 删除题目（使用软删除，保护已引用的题目）
exports.deleteQuestion = async (req, res) => {
  try {
    logger.info('删除题目请求', { id: req.params.id });

    const question = await Question.findById(req.params.id);

    if (!question) {
      logger.warn('题目不存在', { id: req.params.id });
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 使用版本控制服务的软删除功能
    const result = await questionVersionService.softDeleteQuestion(req.params.id);

    // 如果是硬删除（无引用），同时删除媒体文件
    if (!result.softDeleted) {
      try {
        const mediaDir = path.join(MEDIA_ROOT, 'question-bank', question.type, question._id.toString());
        logger.info('尝试删除题目媒体文件夹', { mediaDir });

        const mediaDirExists = await fsExists(mediaDir);

        if (mediaDirExists) {
          await fs.promises.rm(mediaDir, { recursive: true, force: true });
          logger.info('题目媒体文件夹删除成功', { mediaDir });
        }
      } catch (mediaError) {
        logger.error('删除题目媒体文件夹失败', { error: mediaError.message, id: req.params.id });
      }
    }

    logger.info('题目删除成功', {
      id: req.params.id,
      softDeleted: result.softDeleted,
      references: result.references
    });

    res.status(200).json({
      success: true,
      data: {
        softDeleted: result.softDeleted,
        message: result.softDeleted
          ? `题目已被 ${result.references.quizCount} 个测验引用，已执行软删除`
          : '题目已完全删除'
      }
    });
  } catch (error) {
    logger.error('删除题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '删除题目失败',
      error: error.message
    });
  }
};

// AI 解析题目
exports.parseQuestionWithAI = async (req, res) => {
  try {
    const { text, type, defaultTags = [] } = req.body;

    if (!text) {
      logger.warn('AI解析题目失败：缺少文本内容');
      return res.status(400).json({
        success: false,
        message: '请提供题目文本'
      });
    }

    logger.info('AI解析题目请求', { textLength: text.length, type, hasDefaultTags: defaultTags.length > 0 });

    // 根据题目类型构建不同的提示词
    let systemPrompt = '';

    // 构建标签提示部分
    let tagsPrompt = '';
    if (defaultTags && defaultTags.length > 0) {
      tagsPrompt = `以下是可选的标签列表，请从中选择最合适的1-3个标签：
${defaultTags.map(tag => `- ${tag}`).join('\n')}

请注意，tags字段必须从上述列表中选择，不要创建新标签。`;
    }

    if (type === 'SINGLE_CHOICE') {
      systemPrompt = `你是一个专业的题目解析助手。请分析以下文本，将其解析为一道单选题。
请按照以下JSON格式返回结果：
{
  "content": "题目内容",
  "options": [
    {"content": "选项A内容", "isCorrect": true/false},
    {"content": "选项B内容", "isCorrect": true/false},
    {"content": "选项C内容", "isCorrect": true/false},
    {"content": "选项D内容", "isCorrect": true/false}
  ],
  "explanation": "题目解析（如果有）",
  "difficulty": 1, // 难度（1-10）
  "tags": ["标签1", "标签2"] // 标签
}

注意：
1. 只能有一个选项的isCorrect为true
2. 如果无法确定正确答案，请将第一个选项设为正确
3. 如果文本中没有明确的选项，请尝试从题目内容中提取可能的选项
4. 请确保返回的是有效的JSON格式
5. 对于题目内容和解析中的代码，必须使用Markdown代码块格式，例如：
   \`\`\`python
   print("Hello World")
   \`\`\`
6. 在选项中如果包含代码，也应使用Markdown的内联代码格式，例如：\`code\`
${tagsPrompt}`;
    } else if (type === 'TRUE_FALSE') {
      systemPrompt = `你是一个专业的题目解析助手。请分析以下文本，将其解析为一道判断题。
请按照以下JSON格式返回结果：
{
  "content": "题目内容",
  "correctAnswer": true/false,
  "explanation": "题目解析（如果有）",
  "difficulty": 1, // 难度（1-10）
  "tags": ["标签1", "标签2"] // 标签
}

注意：
1. correctAnswer必须是布尔值true或false
2. 如果无法确定正确答案，请根据题目内容做出最合理的判断
3. 请确保返回的是有效的JSON格式
4. 对于题目内容和解析中的代码，必须使用Markdown代码块格式，例如：
   \`\`\`python
   print("Hello World")
   \`\`\`
5. 如果包含代码片段，也应使用Markdown的内联代码格式，例如：\`code\`
${tagsPrompt}`;
    } else if (type === 'PSYCHOLOGICAL_SCALE') {
      systemPrompt = `你是一个专业的心理量表题目解析助手。请分析以下文本，将其解析为一道心理量表题目。
请按照以下JSON格式返回结果：
{
  "content": "题目内容",
  "options": [
    {"content": "选项1内容", "value": 1},
    {"content": "选项2内容", "value": 2},
    {"content": "选项3内容", "value": 3},
    {"content": "选项4内容", "value": 4},
    {"content": "选项5内容", "value": 5}
  ],
  "explanation": "题目解析（如果有）",
  "difficulty": 1, // 难度（1-10）
  "tags": ["标签1", "标签2"] // 标签
}

注意：
1. 心理量表题目通常是李克特量表形式，选项从"非常不同意"到"非常同意"
2. 如果文本中没有明确的选项，请使用标准的5点李克特量表选项
3. 请确保返回的是有效的JSON格式
4. 对于题目内容和解析中的代码，必须使用Markdown代码块格式，例如：
   \`\`\`python
   print("Hello World")
   \`\`\`
5. 如果包含代码片段，也应使用Markdown的内联代码格式，例如：\`code\`
${tagsPrompt}`;
    }

    // 调用AI接口解析题目
    const openai = await getOpenAIClient();
    const model = await getAIModel();
    const response = await openai.createChatCompletion({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000
    });

    const result = JSON.parse(response.data.choices[0].message.content);

    // 确保返回的标签在预设标签列表中
    if (defaultTags && defaultTags.length > 0 && result.tags && Array.isArray(result.tags)) {
      // 过滤出合法的标签（在预设标签列表中的标签）
      result.tags = result.tags.filter(tag => defaultTags.includes(tag));

      // 如果没有匹配到任何标签，尝试基于题目内容选择最相关的标签
      if (result.tags.length === 0) {
        const contentLower = (result.content || '').toLowerCase();

        // 简单的相关性匹配，可以根据需要扩展
        for (const tag of defaultTags) {
          const keywordMatch = tag.match(/：(.+)$/);
          const keyword = keywordMatch ? keywordMatch[1] : tag;

          if (contentLower.includes(keyword.toLowerCase())) {
            result.tags.push(tag);
            if (result.tags.length >= 3) break; // 最多添加3个标签
          }
        }
      }
    }

    logger.info('AI解析题目成功', { type, tagsCount: result.tags?.length || 0 });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('AI解析题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'AI解析题目失败',
      error: error.message
    });
  }
};

// 获取已删除的题目列表（回收站）
exports.getDeletedQuestions = async (req, res) => {
  try {
    const { type } = req.query;
    const query = {
      deletedAt: { $ne: null }
    };

    if (type) query.type = type;

    logger.info('获取已删除题目列表', { type });

    const questions = await Question.find(query)
      .populate('createdBy', 'name')
      .sort('-deletedAt');

    // 为每个题目添加引用信息
    const questionsWithReferences = await Promise.all(
      questions.map(async (q) => {
        const normalized = questionVersionService.normalizeQuestion(q);
        const references = await questionVersionService.getQuestionReferences(q._id);
        return {
          ...normalized,
          references
        };
      })
    );

    res.status(200).json({
      success: true,
      data: questionsWithReferences
    });
  } catch (error) {
    logger.error('获取已删除题目列表失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取已删除题目列表失败',
      error: error.message
    });
  }
};

// 还原已删除的题目
exports.restoreQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('还原题目请求', { id });

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    if (!question.deletedAt) {
      return res.status(400).json({
        success: false,
        message: '题目未被删除，无需还原'
      });
    }

    // 清除删除标记
    question.deletedAt = null;
    await question.save();

    logger.info('题目还原成功', { id });

    res.status(200).json({
      success: true,
      message: '题目已成功还原',
      data: questionVersionService.normalizeQuestion(question)
    });
  } catch (error) {
    logger.error('还原题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '还原题目失败',
      error: error.message
    });
  }
};

// 永久删除题目（从回收站彻底删除）
exports.permanentDeleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('永久删除题目请求', { id });

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 检查是否有引用
    const references = await questionVersionService.getQuestionReferences(id);

    if (references.quizCount > 0 || references.submissionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `题目仍被 ${references.quizCount} 个测验引用，有 ${references.submissionCount} 份提交记录，无法永久删除`
      });
    }

    // 删除媒体文件
    try {
      const mediaDir = path.join(MEDIA_ROOT, 'question-bank', question.type, question._id.toString());
      const mediaDirExists = await fsExists(mediaDir);
      if (mediaDirExists) {
        await fs.promises.rm(mediaDir, { recursive: true, force: true });
        logger.info('题目媒体文件夹删除成功', { mediaDir });
      }
    } catch (mediaError) {
      logger.error('删除题目媒体文件夹失败', { error: mediaError.message, id });
    }

    // 硬删除题目
    await Question.findByIdAndDelete(id);

    logger.info('题目永久删除成功', { id });

    res.status(200).json({
      success: true,
      message: '题目已永久删除'
    });
  } catch (error) {
    logger.error('永久删除题目失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '永久删除题目失败',
      error: error.message
    });
  }
}; 