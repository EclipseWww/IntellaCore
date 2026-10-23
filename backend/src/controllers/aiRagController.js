const aiRagService = require('../services/AiRagService');
const logger = require('../utils/logger');

/**
 * AI备课控制器
 */
exports.generateLessonPlan = async (req, res) => {
  // 记录请求开始时间和基本信息
  const startTime = Date.now();
  logger.info('AI备课流式请求开始', {
    userId: req.user?._id,
    requestTime: new Date().toISOString(),
    method: req.method
  });

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 立即发送响应头，禁用任何缓冲
  res.flushHeaders();

  // 发送初始化消息
  res.write('data: {"type":"init","content":"连接已建立"}\n\n');
  if (res.flush) res.flush(); // 如果可用，立即刷新

  try {
    // 从查询参数中获取数据
    let requestData = {};

    try {
      if (req.query.data) {
        requestData = JSON.parse(decodeURIComponent(req.query.data));
        logger.info('从GET请求查询参数中获取数据', { dataSize: JSON.stringify(requestData).length });
      } else {
        requestData = req.query;
      }
    } catch (parseError) {
      logger.error('解析请求数据失败', { error: parseError.message });
      res.write(`data: {"type":"error","content":{"error":"解析请求数据失败: ${parseError.message}"}}\n\n`);
      res.end();
      return;
    }

    const {
      courseInfo,
      targetStudents,
      teachingGoals,
      additionalRequirements,
      model = process.env.MODEL,
      dbName = null
    } = requestData;

    // 构建提示词 - 要求返回详细的大单元教学设计，使用信息科技核心素养
    const prompt = `你是一位资深的信息技术教师和课程设计专家。请根据以下信息设计一个详细的、可直接用于课堂教学的大单元教学方案，并以JSON格式返回。

【课程信息】${courseInfo || ''}
【目标学生】${targetStudents || ''}
【教学目标】${teachingGoals || ''}
【额外要求】${additionalRequirements || ''}

【重要要求】
1. 教案必须非常详细，教师可以直接拿去上课使用
2. 采用大单元教学设计理念，需要有明确的单元主题和真实情境创设
3. 必须明确本课是大单元的第几课时，并提供完整的大单元课程目录
4. 教学目标必须基于【信息科技核心素养】四个维度：信息意识、计算思维、数字化学习与创新、信息社会责任
5. 教学过程由你自由设计，不用固定格式，根据教学内容灵活安排，可以创新教学流程
6. 课堂练习和活动不要单独列出，应该直接融入教学过程的各个环节中，作为学生活动的一部分
7. 每个教学环节都应该具体到教师说什么、做什么，学生做什么
8. 包含具体的代码示例、评价标准等
9. 【重要】代码示例和参考答案(codeExample/referenceAnswer)中不要使用markdown代码块格式(如\`\`\`python)，直接使用纯文本，用\\n表示换行

请严格按照以下JSON格式返回（只返回JSON，不要其他文字）：
{
  "title": "课程标题（如：Python条件判断语句）",
  "unitTheme": "大单元主题（如：程序的逻辑结构）",
  "grade": "适用年级",
  "totalPeriods": "总课时数（如：共4课时）",
  "currentPeriod": "当前课时（如：第1课时）",
  "duration": "本课时时长（如：45分钟）",
  
  "unitOutline": [
    {
      "period": "第1课时",
      "title": "该课时标题",
      "isCurrent": true或false,
      "brief": "该课时主要内容简述"
    },
    {
      "period": "第2课时",
      "title": "该课时标题",
      "isCurrent": true或false,
      "brief": "该课时主要内容简述"
    }
  ],
  
  "realContext": {
    "scenario": "真实情境描述（如：开发一个智能问答系统，帮助学校图书馆解答同学们的常见问题）",
    "connection": "情境与本课内容的关联（如：在智能问答系统中，需要根据用户的不同问题做出不同的回复，这就需要用到条件判断语句）",
    "drivingQuestion": "驱动性问题（如：如何让程序根据不同的输入给出不同的回答？）"
  },
  
  "coreCompetencies": {
    "informationAwareness": ["信息意识目标1：具体描述学生应形成的信息敏感性和判断力", "信息意识目标2"],
    "computationalThinking": ["计算思维目标1：具体描述学生应掌握的抽象、分解、算法等思维能力", "计算思维目标2"],
    "digitalLearning": ["数字化学习与创新目标1：具体描述学生应具备的数字化工具使用和创新能力", "数字化学习与创新目标2"],
    "socialResponsibility": ["信息社会责任目标1：具体描述学生应形成的信息道德和责任意识", "信息社会责任目标2"]
  },
  
  "keyPoints": ["教学重点1：具体明确", "教学重点2"],
  "difficulties": ["教学难点1：具体明确", "教学难点2"],
  "breakthroughStrategies": ["突破难点的具体策略1", "突破难点的具体策略2"],
  
  "preparation": {
    "teacher": ["教师准备1：如准备XX课件、XX示例代码", "教师准备2"],
    "student": ["学生准备1：如预习XX内容", "学生准备2"],
    "environment": ["环境准备1：如计算机教室、Python环境", "环境准备2"]
  },
  
  "teachingProcess": [
    {
      "stage": "第一个教学环节名称（由你自由设计，如：情境导入/问题探究/编程挑战/分组竞赛等）",
      "duration": "时长（如：5分钟）",
      "objective": "本环节的具体教学目标",
      "teacherActivities": [
        "【教师】详细描述教师的每一个教学行为",
        "【教师】包括语言引导、操作演示、巡视指导等"
      ],
      "studentActivities": [
        "【学生】详细描述学生的学习活动",
        "【学生】包括思考、讨论、练习、展示等"
      ],
      "codeExample": "",
      "designIntent": "设计意图说明"
    },
    {
      "stage": "第二个教学环节名称",
      "duration": "时长",
      "objective": "本环节的具体教学目标",
      "teacherActivities": ["【教师】教学行为描述"],
      "studentActivities": ["【学生】学习活动描述"],
      "exercise": {
        "title": "如果本环节有练习任务，在这里描述",
        "description": "练习任务的详细要求",
        "difficulty": "基础/提高/挑战",
        "referenceAnswer": "参考代码或答案"
      },
      "codeExample": "本环节涉及的代码示例（如果有）",
      "designIntent": "设计意图说明"
    },
    {
      "stage": "...更多教学环节，根据教学内容自由设计，一般3-6个环节",
      "duration": "...",
      "objective": "...",
      "teacherActivities": ["..."],
      "studentActivities": ["..."],
      "codeExample": "",
      "designIntent": "..."
    }
  ],
  
  "evaluation": {
    "criteria": [
      "评价指标1，包含权重如（30%）",
      "评价指标2，包含权重如（30%）",
      "评价指标3，包含权重如（25%）",
      "评价指标4，包含权重如（15%）"
    ],
    "methods": ["课堂观察", "练习完成情况", "学生自评互评"]
  },
  
  "homework": [
    {
      "title": "必做作业",
      "content": "作业内容描述"
    },
    {
      "title": "选做作业（提高）",
      "content": "拓展作业内容描述"
    }
  ],
  
  "boardDesign": "板书设计要点（可以是结构化的文字描述）",
  
  "reflection": "预设教学反思要点：\\n1. 预判可能出现的教学问题\\n2. 针对不同层次学生的教学建议\\n3. 课堂生成性资源的利用思路"
}

【特别注意】
1. teachingProcess必须包含多个教学环节（一般3-6个），环节设计由你自由发挥，根据教学内容创新设计
2. 课堂练习直接融入teachingProcess各环节的studentActivities中，同时可以在exercise字段详细描述
3. 只返回JSON格式，不要添加任何其他文字说明`;

    // 用于存储最新的响应内容
    let latestHistory = [];
    let latestReferences = [];
    let lastSentContent = '';

    // 调用AI服务获取响应
    await aiRagService.getModelResponse({
      multiModalInput: { text: prompt, files: [] },
      history: [],
      model,
      temperature: 0.7,
      maxTokens: 8192,
      historyRound: 1,
      dbName,
      similarityThreshold: 0.3,
      chunkCnt: 5
    }, (data) => {
      try {
        // 更新最新的数据
        latestHistory = data[0];
        latestReferences = data[1];

        // 获取最新的AI回复内容
        const latestContent = latestHistory.length > 0 ? latestHistory[latestHistory.length - 1][1] : '';

        // 如果内容有更新，则发送更新
        if (latestContent && latestContent !== lastSentContent) {
          lastSentContent = latestContent;

          // 发送内容更新
          const chunkData = [latestContent, latestReferences];
          res.write(`data: {"type":"chunk","content":${JSON.stringify(chunkData)}}\n\n`);

          // 添加填充数据以强制冲刷缓冲区 (2KB)
          res.write(':' + ' '.repeat(2048) + '\n\n');

          if (res.flush) res.flush();
        }
      } catch (streamError) {
        logger.error('处理流式数据失败', { error: streamError.message });
        res.write(`data: {"type":"error","content":{"error":"处理流式数据失败: ${streamError.message}"}}\n\n`);
        if (res.flush) res.flush();
      }
    }).then(() => {
      // 流式传输完成，发送完成消息
      const finalData = {
        lessonPlan: latestHistory.length > 0 ? latestHistory[latestHistory.length - 1][1] : '',
        references: latestReferences
      };

      res.write(`data: {"type":"complete","content":${JSON.stringify(finalData)}}\n\n`);
      if (res.flush) res.flush();

      // 记录请求完成信息
      const endTime = Date.now();
      logger.info('AI备课流式请求完成', {
        userId: req.user?._id,
        duration: endTime - startTime,
        status: 'success'
      });

      res.end();
    }).catch(error => {
      logger.error('AI备课流式请求失败', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id
      });

      res.write(`data: {"type":"error","content":{"error":"生成教学方案失败: ${error.message}"}}\n\n`);
      if (res.flush) res.flush();
      res.end();
    });
  } catch (error) {
    logger.error('AI备课流式请求处理失败', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });

    res.write(`data: {"type":"error","content":{"error":"处理请求失败: ${error.message}"}}\n\n`);
    if (res.flush) res.flush();
    res.end();
  }
};

/**
 * AI出题控制器
 */
exports.generateQuestions = async (req, res) => {
  // 记录请求开始时间和基本信息
  const startTime = Date.now();
  logger.info('AI出题流式请求开始', {
    userId: req.user?._id,
    requestTime: new Date().toISOString(),
    method: req.method
  });

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 发送初始化消息
  res.write('data: {"type":"init","content":"连接已建立"}\n\n');

  try {
    // 从查询参数中获取数据
    let requestData = {};

    try {
      if (req.query.data) {
        requestData = JSON.parse(decodeURIComponent(req.query.data));
        // 简化日志输出
        logger.info('从GET请求查询参数中获取数据', { dataSize: JSON.stringify(requestData).length });
      } else {
        requestData = req.query;
      }
    } catch (parseError) {
      logger.error('解析请求数据失败', { error: parseError.message });
      res.write(`data: {"type":"error","content":{"error":"解析请求数据失败: ${parseError.message}"}}\n\n`);
      res.end();
      return;
    }

    const {
      subject,
      topic,
      difficulty,
      questionTypes,
      count,
      model = process.env.MODEL,
      dbName = null,
      customPrompt = null
    } = requestData;

    // 保留关键日志信息，但减少详细输出
    logger.info('AI出题请求参数', {
      userId: req.user?._id,
      dbName,
      model,
      subject,
      topic,
      difficulty,
      questionTypes: Array.isArray(questionTypes) ? questionTypes.join(',') : questionTypes,
      count,
      hasCustomPrompt: !!customPrompt
    });

    // 构建提示词
    const prompt = customPrompt || `请以JSON格式生成${count || 5}道${subject || ''}题目。

要求：
1. 返回格式必须是合法的JSON，格式如下：
{
  "questions": [
    {
      "id": "1",
      "type": "选择题/填空题/...", 
      "content": "题目内容",
      "options": ["A. 选项1", "B. 选项2", ...],  // 选择题才有此字段
      "answer": "正确答案",
      "analysis": "详细解析"
    }
  ]
}

2. 题目要求：
- 主题：${topic || ''}
- 难度：${difficulty || '中等'}
- 题型：${questionTypes ? (Array.isArray(questionTypes) ? questionTypes.join('、') : questionTypes) : '选择题、填空题'}
- 每道题必须包含完整的题干、选项（如适用）、答案和解析
- 题目难度要符合指定的难度级别
- 题目内容要覆盖指定的主题

请确保返回的是规范的JSON格式，不要包含任何其他说明文字。`;

    // 用于存储最新的响应内容
    let latestHistory = [];
    let latestReferences = [];
    let lastSentContent = '';
    let responseCount = 0;

    // 调用AI服务获取响应
    await aiRagService.getModelResponse({
      multiModalInput: { text: prompt, files: [] },
      history: [],
      model,
      temperature: 0.7,
      maxTokens: 4096,
      historyRound: 1,
      dbName,
      similarityThreshold: 0.2,
      chunkCnt: 10
    }, (data) => {
      try {
        responseCount++;
        // 更新最新的数据
        latestHistory = data[0];
        latestReferences = data[1];

        // 记录每次流式响应中的引用信息
        if (responseCount % 50 === 0 || responseCount < 5) {
          logger.info('AI出题流式响应进度', {
            responseCount,
            hasReferences: Array.isArray(latestReferences) && latestReferences.length > 0,
            referencesCount: Array.isArray(latestReferences) ? latestReferences.length : 0,
            dbName
          });
        }

        // 获取最新的AI回复内容
        const latestContent = latestHistory.length > 0 ? latestHistory[latestHistory.length - 1][1] : '';

        // 如果内容有更新，则发送更新
        if (latestContent && latestContent !== lastSentContent) {
          lastSentContent = latestContent;

          // 发送内容更新
          const chunkData = [latestContent, latestReferences];
          res.write(`data: {"type":"chunk","content":${JSON.stringify(chunkData)}}\n\n`);
        }
      } catch (streamError) {
        logger.error('处理流式数据失败', { error: streamError.message });
        res.write(`data: {"type":"error","content":{"error":"处理流式数据失败: ${streamError.message}"}}\n\n`);
      }
    }).then(() => {
      // 生成完成，发送完成信号
      logger.info('AI出题完成', {
        subject,
        topic,
        difficulty,
        questionTypes,
        responseCount,
        hasReferences: Array.isArray(latestReferences) && latestReferences.length > 0,
        referencesCount: Array.isArray(latestReferences) ? latestReferences.length : 0,
        dbName
      });

      // 记录最终的引用详情
      if (Array.isArray(latestReferences) && latestReferences.length > 0) {
        logger.info('最终知识库引用详情', {
          count: latestReferences.length,
          dbName,
          references: latestReferences.slice(0, 3).map(ref => ({
            title: ref.title || '未提供标题',
            score: ref.score || 0,
            contentPreview: ref.content?.substring(0, 50) + (ref.content?.length > 50 ? '...' : '') || '未提供内容'
          }))
        });
      } else if (typeof latestReferences === 'string' && latestReferences.trim()) {
        logger.info('最终知识库引用为字符串格式', {
          length: latestReferences.length,
          preview: latestReferences.substring(0, 100) + (latestReferences.length > 100 ? '...' : '')
        });
      } else {
        logger.warn('未检测到知识库引用', { dbName });
      }

      // 流式传输完成，发送完成消息
      const finalData = {
        questions: latestHistory.length > 0 ? latestHistory[latestHistory.length - 1][1] : '',
        references: latestReferences
      };

      res.write(`data: {"type":"complete","content":${JSON.stringify(finalData)}}\n\n`);

      // 记录请求完成信息
      const endTime = Date.now();
      logger.info('AI出题流式请求完成', {
        userId: req.user?._id,
        duration: endTime - startTime,
        status: 'success',
        referencesCount: Array.isArray(latestReferences) ? latestReferences.length : 0
      });

      res.end();
    }).catch((error) => {
      logger.error('AI出题流式请求失败', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id
      });

      res.write(`data: {"type":"error","content":{"error":"生成题目失败: ${error.message}"}}\n\n`);
      res.end();
    });
  } catch (error) {
    logger.error('AI出题流式请求处理失败', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });

    res.write(`data: {"type":"error","content":{"error":"处理请求失败: ${error.message}"}}\n\n`);
    res.end();
  }
};

/**
 * 获取知识库列表
 */
exports.getKnowledgeBases = async (req, res) => {
  try {
    logger.info('请求获取知识库列表', { userId: req.user?._id });

    const knowledgeBases = await aiRagService.updateKnowledgeBase();

    logger.info('获取知识库列表成功', { userId: req.user?._id });

    return res.status(200).json({
      success: true,
      data: knowledgeBases
    });
  } catch (error) {
    logger.error('获取知识库列表失败', { error: error.message, stack: error.stack, userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: '获取知识库列表失败',
      error: error.message
    });
  }
};

/**
 * 清理临时文件
 */
exports.clearTemporaryFiles = async (req, res) => {
  try {
    logger.info('请求清理临时文件', { userId: req.user?._id });

    const result = await aiRagService.clearTemp();

    logger.info('清理临时文件成功', { userId: req.user?._id });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('清理临时文件失败', { error: error.message, stack: error.stack, userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: '清理临时文件失败',
      error: error.message
    });
  }
};

/**
 * AI聊天
 */
exports.aiChat = async (req, res) => {
  // 记录请求开始时间和基本信息
  const startTime = Date.now();
  logger.info('AI聊天请求开始', {
    userId: req.user?._id,
    requestTime: new Date().toISOString(),
    method: req.method
  });

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 发送初始化消息
  res.write('data: {"type":"init","content":"连接已建立"}\n\n');

  try {
    // 从请求中获取参数（支持GET和POST请求）
    let requestData = {};

    if (req.method === 'GET') {
      // 从查询参数中获取数据
      try {
        if (req.query.data) {
          requestData = JSON.parse(decodeURIComponent(req.query.data));
          logger.info('从GET请求查询参数中获取数据', { dataSize: JSON.stringify(requestData).length });
        } else {
          requestData = req.query;
          logger.info('从GET请求查询参数中获取数据（未编码）', { dataSize: JSON.stringify(requestData).length });
        }
      } catch (error) {
        logger.error('解析GET请求参数失败', { error: error.message });
        throw new Error('无效的请求参数格式');
      }
    } else {
      // 从POST请求体中获取数据
      requestData = req.body;
      logger.info('从POST请求体中获取数据', { dataSize: JSON.stringify(requestData).length });
    }

    // 提取必要参数
    const { message, history, model, dbName } = requestData;

    // 记录请求详情
    logger.info('AI聊天请求详情', {
      userId: req.user?._id,
      messageLength: message?.length || 0,
      historyLength: Array.isArray(history) ? history.length : 0,
      model: model || 'default',
      dbName: dbName || 'none'
    });

    // 格式化历史记录
    const formattedHistory = formatHistoryForApi(history);

    // 添加当前消息到历史记录
    if (message) {
      formattedHistory.push([message, null]);
    }

    // 跟踪完整响应
    let finalResponse = null;
    let responseCount = 0;

    // 调用AI服务获取响应
    await aiRagService.getModelResponse(
      {
        multiModalInput: { text: message, files: [] },
        history: formattedHistory,
        model,
        dbName
      },
      (data) => {
        responseCount++;
        finalResponse = data;

        // 发送流式数据
        const responseData = {
          type: 'chunk',
          content: data
        };
        res.write(`data: ${JSON.stringify(responseData)}\n\n`);
      }
    );

    // 流式传输完成，发送完成消息
    const completionTime = Date.now() - startTime;

    // 记录最终结果的关键信息
    if (finalResponse) {
      logger.info('AI聊天流式传输完成', {
        referencesCount: finalResponse[1]?.length || 0,
        historyLength: finalResponse[0]?.length || 0,
        responseCount
      });
    }

    // 发送完成消息
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      content: {
        message: '流式传输完成',
        processingTime: completionTime
      }
    })}\n\n`);

    // 结束响应
    res.end();

    logger.info('AI聊天请求完成', {
      userId: req.user?._id,
      processingTime: completionTime,
      responseCount
    });
  } catch (error) {
    logger.error('AI聊天请求失败', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    // 发送错误消息
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: {
        message: '处理请求时发生错误',
        error: error.message
      }
    })}\n\n`);

    // 结束响应
    res.end();
  }
};

/**
 * 格式化聊天历史记录为API所需格式
 * @param {Array|Object} history - 聊天历史记录
 * @returns {Array} - 格式化后的历史记录，格式为 [["用户消息", "助手回复"], ...]
 */
const formatHistoryForApi = (history) => {
  logger.debug('原始历史记录', { historyLength: history ? JSON.stringify(history).length : 0 });

  // 如果历史记录为空，返回空数组
  if (!history || (Array.isArray(history) && history.length === 0)) {
    logger.debug('历史记录为空，返回空数组');
    return [];
  }

  let formattedHistory = [];

  try {
    // 处理不同格式的历史记录
    if (Array.isArray(history)) {
      // 检查是否已经是二维数组格式 [["用户消息", "助手回复"], ...]
      if (history.length > 0 && Array.isArray(history[0]) && history[0].length === 2) {
        logger.debug('历史记录已经是二维数组格式');
        formattedHistory = [...history];
      }
      // 检查是否是对象数组格式 [{role: "user", content: "..."}, {role: "assistant", content: "..."}, ...]
      else if (history.length > 0 && typeof history[0] === 'object' && history[0].content) {
        logger.debug('历史记录是对象数组格式，转换为二维数组');

        // 将对象数组转换为二维数组
        for (let i = 0; i < history.length; i += 2) {
          if (i + 1 < history.length) {
            const userMessage = history[i].content;
            const assistantMessage = history[i + 1].content;
            if (userMessage && assistantMessage) {
              formattedHistory.push([userMessage, assistantMessage]);
            }
          }
        }
      }
      // 其他数组格式，尝试转换
      else {
        logger.debug('历史记录是其他数组格式，尝试转换');

        for (let i = 0; i < history.length; i++) {
          const item = history[i];

          // 如果是字符串数组，尝试两两配对
          if (typeof item === 'string') {
            if (i + 1 < history.length && typeof history[i + 1] === 'string') {
              formattedHistory.push([item, history[i + 1]]);
              i++; // 跳过下一个元素，因为已经处理了
            } else {
              formattedHistory.push([item, null]);
            }
          }
          // 如果是对象，尝试提取内容
          else if (typeof item === 'object' && item !== null) {
            if (item.content) {
              formattedHistory.push([item.content, null]);
            } else if (item.message) {
              formattedHistory.push([item.message, null]);
            } else if (item.text) {
              formattedHistory.push([item.text, null]);
            }
          }
        }
      }
    }
    // 如果是字符串，尝试解析为JSON
    else if (typeof history === 'string') {
      logger.debug('历史记录是字符串，尝试解析为JSON');
      try {
        const parsedHistory = JSON.parse(history);
        return formatHistoryForApi(parsedHistory); // 递归处理解析后的历史记录
      } catch (error) {
        logger.warn('解析历史记录字符串失败', { error: error.message });
        formattedHistory = [[history, null]]; // 将整个字符串作为一条消息
      }
    }
    // 如果是对象，尝试提取内容
    else if (typeof history === 'object' && history !== null) {
      logger.debug('历史记录是对象，尝试提取内容');
      if (history.content) {
        formattedHistory = [[history.content, null]];
      } else if (history.message) {
        formattedHistory = [[history.message, null]];
      } else if (history.text) {
        formattedHistory = [[history.text, null]];
      }
    }
  } catch (error) {
    logger.error('格式化历史记录时发生错误', { error: error.message });
    // 发生错误时返回空数组
    return [];
  }

  // 过滤掉无效的条目
  formattedHistory = formattedHistory.filter(item =>
    Array.isArray(item) &&
    item.length === 2 &&
    (item[0] !== null || item[1] !== null)
  );

  logger.debug('格式化后的历史记录', { historyLength: formattedHistory.length });
  return formattedHistory;
}; 