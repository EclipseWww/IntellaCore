const Message = require('../models/Message');
const { generateAIResponse, getOpenAIClient, getAIModel } = require('../config/ai');
const Course = require('../models/Course');
const Progress = require('../models/Progress');
const Setting = require('../models/Setting');
const Chat = require('../models/Chat');
const logger = require('../utils/logger');
const Class = require('../models/Class');
const User = require('../models/User');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const { loadAIConfig } = require('../config/ai');
const { getClientIp } = require('../utils/getClientIp');

// 创建生成课程系统提示的函数
const generateSystemPrompt = (courseName, currentContent) => {
  let prompt = `作为一个AI学习助手，你正在帮助学生理解课程内容。`;

  // 只有当courseName存在且不为空时才添加课程名称
  if (courseName && courseName !== '未知课程') {
    prompt += `\n\n当前课程：${courseName}`;
  }

  // 只有当currentContent存在且不为空时才添加当前内容
  if (currentContent) {
    prompt += `\n\n${currentContent}`;
  }

  prompt += `\n\n给出专业、准确、易懂且精炼的回答。保持自然的教师口吻，避免过度格式化。建议遵循：

1. 对于编程相关问题，不要直接提供完整代码解决方案，而是引导学生思考和探索。
2. 可以提供思路、算法步骤、伪代码来启发学生思考，绝不给学生直接代码！
3. 鼓励学生独立解决问题，提供指导性建议而非直接答案。
4. 如果学生明确要求提示而非完整答案，可以给出部分提示。
5. 如果学生陷入困境，可以逐步增加提示的具体程度，但始终保持对学习过程的尊重。
6. 解释概念时要清晰易懂，可使用比喻或类比帮助理解。
7. 可以适度口语化，允许使用1-2个自然段落，不必强制使用列表。
8. 总体长度不超过350字，重点突出要点。`;

  // 只有当courseName存在且不为空时才添加拒绝回答不相关问题的指示
  if (courseName && courseName !== '未知课程') {
    prompt += `\n\n如果学生的提问与${courseName}无关，或要求你给出代码答案，请直接拒绝回答。`;
  }

  return prompt;
};

const chatController = {
  // 教师端：按学生聚合待审核消息数量
  async getPendingStudentsAggregate(req, res) {
    try {
      const teacherId = req.user?.id;
      const { type, courseId, lessonId, courseUnitId, grade, className, page = 1, limit = 20 } = req.query || {};

      logger.info('教师获取待审核学生汇总', {
        teacherId,
        filters: { type, courseId, lessonId, courseUnitId, grade, className, page, limit }
      });

      // 找到该教师负责的班级与学生
      const classQuery = { teacher: teacherId };
      if (grade) classQuery.grade = Number(grade);
      if (className) classQuery.name = Number(className);
      const classes = await Class.find(classQuery).select('_id');
      const classIds = classes.map(c => c._id);
      const studentIds = await User.find({ classId: { $in: classIds } }).distinct('_id');

      // 构建匹配条件
      const match = {
        status: 'pending',
        student: { $in: studentIds }
      };
      if (type) match.type = type;
      if (courseId) match.courseId = courseId;
      if (lessonId) match.lessonId = lessonId;
      if (courseUnitId) match.courseUnitId = courseUnitId;

      const basePipeline = [
        { $match: match },
        {
          $group: {
            _id: '$student',
            count: { $sum: 1 },
            latestAt: { $max: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },
        {
          $project: {
            _id: 0,
            id: '$_id',
            name: { $ifNull: ['$student.name', '$student.username'] },
            username: '$student.username',
            count: 1,
            latestAt: 1
          }
        },
        { $sort: { latestAt: -1 } }
      ];

      const skip = (Number(page) - 1) * Number(limit);

      // 统计总数
      const countPipeline = [...basePipeline, { $count: 'total' }];
      const totalResult = await Message.aggregate(countPipeline);
      const total = totalResult[0]?.total || 0;

      // 分页数据
      const dataPipeline = [...basePipeline, { $skip: skip }, { $limit: Number(limit) }];
      const aggregates = await Message.aggregate(dataPipeline);

      logger.info('待审核学生汇总完成', { teacherId, studentCount: aggregates.length, total });
      res.json({ success: true, data: { students: aggregates, pagination: { total, page: Number(page), limit: Number(limit) } } });
    } catch (error) {
      logger.error('获取待审核学生汇总失败', { error: error.message, stack: error.stack, teacherId: req.user?.id });
      res.status(500).json({ success: false, message: '获取学生汇总失败' });
    }
  },

  // 教师端：按学生获取消息（可按状态/类型筛选，不分页，返回全部）
  async getMessagesByStudent(req, res) {
    try {
      const teacherId = req.user?.id;
      const { studentId } = req.params;
      const { status, type, courseId, lessonId, courseUnitId } = req.query || {};

      logger.info('教师按学生获取消息', {
        teacherId,
        studentId,
        filters: { status, type, courseId, lessonId, courseUnitId }
      });

      // 校验该学生是否属于当前教师的班级
      const classes = await Class.find({ teacher: teacherId }).select('_id');
      const classIds = classes.map(c => c._id);
      const studentInScope = await User.exists({ _id: studentId, classId: { $in: classIds } });
      if (!studentInScope) {
        logger.warn('学生不属于该教师的班级，拒绝访问', { teacherId, studentId });
        return res.status(403).json({ success: false, message: '无权访问该学生的数据' });
      }

      const query = { student: studentId };
      if (status) query.status = status;
      if (type) query.type = type;
      if (courseId) query.courseId = courseId;
      if (lessonId) query.lessonId = lessonId;
      if (courseUnitId) query.courseUnitId = courseUnitId;

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .populate('student', 'username name')
        .populate('courseId', 'title');

      const formatted = messages.map(message => ({
        _id: message._id,
        student: {
          _id: message.student?._id,
          username: message.student?.username,
          name: message.student?.name || message.student?.username
        },
        courseId: message.courseId,
        lessonId: message.lessonId,
        courseUnitId: message.courseUnitId,
        status: message.status,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        type: message.type,
        conversations: message.messages || []
      }));

      logger.info('按学生获取消息成功', { teacherId, studentId, count: formatted.length });
      res.json({ success: true, data: { messages: formatted } });
    } catch (error) {
      logger.error('按学生获取消息失败', { error: error.message, stack: error.stack, teacherId: req.user?.id, studentId: req.params?.studentId });
      res.status(500).json({ success: false, message: '获取消息失败' });
    }
  },
  // 发送消息并获取AI回复（流式输出）
  async sendMessage(req, res) {
    try {
      const content = req.method === 'GET' ? req.query.content : req.body.content;
      const courseId = req.method === 'GET' ? req.query.courseId : req.body.courseId;
      const lessonId = req.method === 'GET' ? req.query.lessonId : req.body.lessonId;
      const courseUnitId = req.method === 'GET' ? req.query.courseUnitId : req.body.courseUnitId;
      const messageId = req.method === 'GET' ? req.query.messageId : req.body.messageId; // 新增：现有消息ID
      const currentContent = req.method === 'GET' ? req.query.contextContent : req.body.contextContent;
      const studentId = req.user?.id;

      logger.info('收到新的消息请求', { 
        studentId, 
        courseId, 
        lessonId,
        courseUnitId,
        messageId,
        method: req.method 
      });

      // 验证用户是否已认证
      if (!studentId) {
        const clientIp = getClientIp(req);
        logger.warn('未认证用户尝试发送消息', { ip: clientIp });
        return res.status(401).json({ message: '用户未认证，无法发送消息' });
      }

      if (!content) {
        logger.warn('收到空消息内容', { studentId });
        return res.status(400).json({ message: '消息内容不能为空' });
      }

      // 设置 SSE 响应头（禁用代理缓冲，避免断流）
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no');

      let message;
      let courseName = '';
      let contentToUse = currentContent || '';

      // 如果有课程ID，获取课程信息
      if (courseId) {
        try {
          // 查询课程信息
          const course = await Course.findById(courseId);
          if (course && course.title) {
            courseName = course.title;
          }
          
          // 如果有课时ID，查询课时信息并添加课时标题到内容
          // 处理课时内容的格式
          if (lessonId) {
            const lesson = await Lesson.findById(lessonId);
            if (lesson && lesson.title) {
              // 使用更清晰的格式
              if (currentContent) {
                contentToUse = `【课时】${lesson.title}\n\n【学习内容】\n${currentContent}`;
              } else {
                contentToUse = `【课时】${lesson.title}`;
              }
            }
          } else if (currentContent) {
            // 没有课时信息但有内容
            contentToUse = `【学习内容】\n${currentContent}`;
          }
        } catch (error) {
          logger.error('获取课程信息失败', { 
            error: error.message, 
            courseId 
          });
        }
      }

      // 生成系统提示信息
      const systemPrompt = generateSystemPrompt(courseName, contentToUse);
      
      // 检查是否有现有消息ID
      if (messageId) {
        // 尝试查找现有的消息记录
        message = await Message.findOne({
          _id: messageId, 
          student: studentId, // 确保消息属于当前学生
          courseId: courseId || { $exists: false } // 确保课程ID匹配或不存在
        });
        
        if (message) {
          logger.info('找到现有消息记录，将在此基础上添加新消息', { messageId: message._id });
          
          // 添加用户消息到现有记录
          message.messages.push({
            role: 'user',
            content: content,
            timestamp: new Date()
          });
          
          // 更新消息时间戳
          message.updatedAt = new Date();
          await message.save();
          
          logger.info('已添加用户消息到现有记录', { messageId: message._id });
        } else {
          logger.warn('未找到指定的消息记录或没有权限', { messageId, studentId });
          // 消息不存在或不属于当前学生，将创建新消息
        }
      }
      
      // 如果没有现有消息或找不到指定消息，创建新消息
      if (!message) {
        // 初始化消息数据，根据是否有 courseId 来判断类型
        const messageData = {
          student: studentId,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
              timestamp: new Date()
            },
            {
              role: 'user',
              content: content,
              timestamp: new Date()
            }
          ],
          status: 'pending', // 默认状态为待审核
          type: courseId ? 'course' : 'general', // 根据是否有 courseId 设置类型
        };

        // 如果是课程相关的消息，添加课程和章节信息
        if (courseId) {
          messageData.courseId = courseId;
          // 只有当lessonId不为空字符串时才添加
          if (lessonId && lessonId !== '' && lessonId !== 'undefined') {
            messageData.lessonId = lessonId;
          }
          // 只有当courseUnitId不为空字符串时才添加
          if (courseUnitId && courseUnitId !== '' && courseUnitId !== 'undefined') {
            messageData.courseUnitId = courseUnitId;
          }
        }

        message = new Message(messageData);
        await message.save();
        logger.info('新消息已创建', { 
          messageId: message._id,
          studentId,
          type: messageData.type
        });
      }

      // 向客户端发送初始消息
      res.write(`data: ${JSON.stringify({
        type: 'init',
        message: '消息已发送，等待教师审核',
        data: {
          messageId: message._id,
          content: message.messages.find(m => m.role === 'user')?.content || '',
          status: message.status,
          createdAt: message.createdAt,
        }
      })}\n\n`);

      // 准备向AI发送的消息
      let messagesToSend = [];
      
      // 始终添加系统消息
      const systemMessage = message.messages.find(m => m.role === 'system');
      if (systemMessage) {
        messagesToSend.push({ role: 'system', content: systemMessage.content });
      }
      
      // 最近的对话（不包括系统消息）
      const conversationMessages = message.messages
        .filter(m => m.role !== 'system')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 6); // 获取最新的6条，对应3轮对话
      
      // 按时间顺序添加消息
      conversationMessages.reverse().forEach(m => {
        messagesToSend.push({ role: m.role, content: m.content });
      });
      
      // 记录AI配置与请求要点，便于部署环境排查
      try {
        const aiCfg = await loadAIConfig();
        logger.info('准备请求AI流', {
          model: aiCfg.model,
          baseUrl: aiCfg.baseUrl,
          hasApiKey: !!aiCfg.apiKey,
          messagesToSendCount: messagesToSend.length
        });
      } catch (cfgErr) {
        logger.warn('加载AI配置用于日志记录失败', { error: cfgErr.message });
      }

      logger.debug('向AI发送的消息', { 
        messageCount: messagesToSend.length,
        firstMessage: messagesToSend[0]?.content.substring(0, 50) + '...',
        lastMessage: messagesToSend[messagesToSend.length - 1]?.content.substring(0, 50) + '...'
      });

      // 获取AI响应流
      let fullResponse = '';
      
      let firstChunk = true;
      await generateAIResponse(messagesToSend, async (chunk) => {
        if (chunk === null) {
          // Stream 结束
          logger.debug('AI响应流结束', { messageId: message._id });
          // 先生成后续追问建议，再一并保存
          let suggestedQuestions = [];
          try {
            const openai = await getOpenAIClient();
            const model = await getAIModel();
            const sys = '你是大模型教学助教。基于学生的问题与你的回答，提出3条“下一步追问建议”，学生是初学者 容易犯基础错误。要求：中文，简洁，每条不超过20字。只返回JSON数组，如 ["...","...","..."]，不要包含任何其他文字。';
            const lastUserMsg = (message.messages || []).slice().reverse().find(m => m.role === 'user');
            const userQ = lastUserMsg?.content || '';
            const sResp = await openai.createChatCompletion({
              model,
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: `学生问题：${userQ}\n你的回答：${fullResponse}\n请给出3条下一步追问建议，严格只返回JSON数组。` }
              ],
              temperature: 0.35,
              max_tokens: 120
            });
            const text = (sResp.data.choices?.[0]?.message?.content || '').trim();
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                suggestedQuestions = parsed.filter(Boolean).map(String).slice(0, 3);
              }
            } catch (e) {
              suggestedQuestions = text
                .split('\n')
                .map(s => s.replace(/^[\-\d\.\)\s]+/, '').trim())
                .filter(Boolean)
                .slice(0, 3);
            }
            logger.info('已生成后续提问建议', { messageId: message._id, count: suggestedQuestions.length });
          } catch (e) {
            logger.warn('生成后续提问建议失败', { error: e.message, messageId: message._id });
          }

          Message.findByIdAndUpdate(
            message._id,
            { 
              $push: { 
                messages: {
                  role: 'assistant',
                  content: fullResponse,
                  suggestedQuestions,
                  timestamp: new Date()
                } 
              } 
            },
            { new: true }
          ).then(async (updatedMessage) => {
            logger.info('消息更新成功', { 
              messageId: updatedMessage._id,
              responseLength: fullResponse.length 
            });
            res.write(`data: ${JSON.stringify({
              type: 'done',
              message: 'AI响应已完成',
              data: {
                messageId: updatedMessage._id,
                aiResponse: fullResponse,
                suggestedQuestions
              }
            })}\n\n`);
            res.end();
          }).catch(updateError => {
            logger.error('更新消息失败', { 
              error: updateError.message,
              messageId: message._id 
            });
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: '更新消息失败',
              error: updateError.message
            })}\n\n`);
            res.end();
          });
          return;
        }

        fullResponse += chunk;
        if (firstChunk) {
          logger.info('AI流首个分片已到达', { messageId: message._id, chunkPreview: chunk.substring(0, 50) + '...' });
          firstChunk = false;
        }
        // 发送 SSE 格式的数据
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          content: chunk
        })}\n\n`);
      });

    } catch (error) {
      logger.error('发送消息处理失败', { 
        error: error.message,
        stack: error.stack,
        studentId: req.user?.id 
      });
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: '发送消息失败',
        error: error.message
      })}\n\n`);
      res.end();
    }
  },

  // 获取单个消息详情
  async getMessage(req, res) {
    try {
      const messageId = req.params.id;
      const studentId = req.user.userId;

      logger.info('获取消息详情', { messageId, studentId });

      const message = await Message.findOne({
        _id: messageId,
        student: studentId
      });

      if (!message) {
        logger.warn('消息不存在或无权访问', { messageId, studentId });
        return res.status(404).json({ message: '消息不存在' });
      }

      logger.debug('消息获取成功', { 
        messageId,
        status: message.status 
      });

      // 优化返回结构
      res.json({
        id: message._id,
        student: message.student,
        courseId: message.courseId,
        lessonId: message.lessonId,
        courseUnitId: message.courseUnitId,
        type: message.type,
        status: message.status,
        createdAt: message.createdAt,
        reviewedAt: message.reviewedAt,
        // 重命名为conversations，更符合实际用途
        conversations: message.messages || []
      });
    } catch (error) {
      logger.error('获取消息详情失败', { 
        error: error.message,
        stack: error.stack,
        messageId: req.params.id,
        studentId: req.user.userId 
      });
      res.status(500).json({ message: '获取消息失败', error: error.message });
    }
  },

  // 处理课程相关的问题
  async handleCourseQuestion(req, res) {
    try {
      const { question, courseId, lessonId, context } = req.method === 'GET' ? req.query : req.body;
      const userId = req.user.id;

      // 获取课程信息
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: '课程不存在' });
      }

      // 获取当前课程进度
      const progress = await Progress.findOne({
        studentId: userId,
        courseId
      });

      // 构建上下文信息
      let contextInfo = `当前课程：${course.title}\n`;
      if (lessonId) {
        const lesson = course.lessons.find(l => l._id.toString() === lessonId);
        if (lesson) {
          contextInfo += `当前课程章节：${lesson.title}\n`;
          contextInfo += `章节内容：${lesson.content}\n`;
        }
      }

      // 构建提示信息
      const prompt = `
作为一个AI学习助手，你正在帮助学生理解课程内容。以下是相关信息：

${contextInfo}

学生问题：${question}

请使用Markdown格式给出专业、准确、易懂的回答。遵循以下规则：

1. 使用列表(-)来列举要点
2. 使用代码块(\`\`\`)来展示代码示例
3. 使用粗体(**)和斜体(*)来强调重要内容
4. 使用表格(|)来展示表格数据
5. 如果需要引用，使用引用格式(>)

如果问题涉及课程内容之外的知识，也可以补充说明。如果学生的提问与本课无关，请不要回答，不需在除了本课的领域之外延伸。
`;

      // 设置响应头以支持 SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let fullResponse = '';

      // 使用 Promise 来处理流式响应
      await new Promise((resolve, reject) => {
        const sendChunk = (chunk) => {
          return new Promise((resolveSend) => {
            res.write(chunk, () => {
              resolveSend();
            });
          });
        };

        // 调用 AI 接口并直接处理流式响应
        generateAIResponse(prompt, async (content, error) => {
          try {
            if (error) {
              console.error('AI响应错误:', error);
              await sendChunk(`data: ${JSON.stringify({ error: '处理问题时出错，请稍后重试' })}\n\n`);
              resolve();
              return;
            }

            if (content === null) {
              // Stream ended
              try {
                // 保存对话记录
                const messageData = {
                  student: userId,
                  messages: [
                    {
                      role: 'user',
                      content: question,
                      timestamp: new Date()
                    },
                    {
                      role: 'assistant',
                      content: fullResponse,
                      timestamp: new Date()
                    }
                  ],
                  courseId
                };
                
                // 只有当lessonId不为空时才添加
                if (lessonId && lessonId !== '' && lessonId !== 'undefined') {
                  messageData.lessonId = lessonId;
                }
                
                const message = new Message(messageData);
                await message.save();

                // 查找相关的课程内容作为参考
                const references = course.lessons
                  .filter(lesson => 
                    lesson.content.toLowerCase().includes(question.toLowerCase()) ||
                    lesson.title.toLowerCase().includes(question.toLowerCase())
                  )
                  .map(lesson => lesson.title);

                await sendChunk(`data: ${JSON.stringify({ references })}\n\n`);
                await sendChunk('data: [DONE]\n\n');
              } catch (error) {
                console.error('保存消息时出错:', error);
                await sendChunk(`data: ${JSON.stringify({ error: '保存消息时出错' })}\n\n`);
              }
              resolve();
            } else {
              // 发送新的内容块
              fullResponse += content;
              await sendChunk(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      res.end();
    } catch (error) {
      console.error('处理课程问题时出错:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: '处理问题时出错，请稍后重试' });
      } else {
        res.write(`data: ${JSON.stringify({ error: '处理问题时出错，请稍后重试' })}\n\n`);
        res.end();
      }
    }
  },

  // 获取当前会话消息
  async getCurrentSession(req, res) {
    try {
      const studentId = req.user?.id;
      const { reviewEnabled } = req.query;

      if (!studentId) {
        return res.status(401).json({ message: '用户未认证' });
      }

      // 获取今天的开始时间
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const query = {
        student: studentId,
        createdAt: { $gte: today }
      };

      const messages = await Message.find(query)
        .sort({ createdAt: 1 });

      // 优化返回的消息结构
      const formattedMessages = messages.map(message => {
        const { _id, student, courseId, lessonId, courseUnitId, status, createdAt, type } = message;
        
        return {
          _id,
          student,
          courseId,
          lessonId,
          courseUnitId,
          status,
          createdAt,
          type,
          conversations: message.messages || []
        };
      });

      res.json({ messages: formattedMessages });
    } catch (error) {
      logger.error('获取当前会话失败:', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ message: '获取当前会话失败' });
    }
  },

  // 获取待审核消息（带分页）
  async getPendingMessages(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;

      const [messages, total] = await Promise.all([
        Message.find({ status: 'pending' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .populate('student', 'username')
          .populate('courseId', 'title'),
        Message.countDocuments({ status: 'pending' })
      ]);

      // 优化返回结构
      const formattedMessages = messages.map(message => {
        const { _id, student, courseId, lessonId, courseUnitId, status, createdAt, type } = message;
        
        return {
          _id,
          student,
          courseId,
          lessonId,
          courseUnitId,
          status,
          createdAt,
          type,
          conversations: message.messages || []
        };
      });

      res.json({
        messages: formattedMessages,
        pagination: {
          current: page,
          pageSize,
          total
        }
      });
    } catch (error) {
      logger.error('获取待审核消息失败:', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ message: '获取待审核消息失败' });
    }
  },

  async getMessageHistory(req, res) {
    try {
      const userId = req.user?.id; // 获取当前用户ID
      const { courseId, courseUnitId, lessonId, status, page = 1, limit = 20 } = req.query;

      // 构建查询条件
      const query = {};

      // 检查用户角色
      const isTeacher = req.user.role === 'teacher'; // 假设用户角色存储在 req.user.role 中

      if (isTeacher) {
        // 如果是教师，获取他们所教班级的所有学生的消息
        const classes = await Class.find({ teacher: userId }); // 获取教师所教的班级
        const studentIds = await User.find({ classId: { $in: classes.map(cls => cls._id) } }).distinct('_id'); // 从用户模型中获取所有学生的ID
        query.student = { $in: studentIds }; // 查询条件中包含所有学生的ID
      } else {
        query.student = userId; // 仅限当前用户
      }

      if (courseId) query.courseId = courseId;
      if (courseUnitId) query.courseUnitId = courseUnitId;
      if (lessonId) query.lessonId = lessonId;
      if (status) query.status = status; // 可选状态过滤

      // 学生只能看到未被拒绝的消息
      if (!isTeacher) {
        query.status = { $ne: 'rejected' }; // 排除已拒绝的消息
      }

      // 添加调试日志
      logger.info('查询条件:', query);

      // 计算总数
      const totalCount = await Message.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);
      
      // 获取消息
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('student', 'username name')
        .populate('courseId', 'title');

      // 处理返回数据，优化消息结构
      const formattedMessages = messages.map(message => {
        const { _id, student, courseId, lessonId, courseUnitId, status, createdAt, updatedAt, type } = message;
        
        return {
          _id,
          student: {
            _id: student._id,
            username: student.username,
            name: student.name || student.username
          },
          courseId,
          lessonId,
          courseUnitId,
          status,
          createdAt,
          updatedAt,
          type,
          // 直接将对话内容作为顶层数组
          conversations: message.messages || []
        };
      });

      // 添加日志输出返回的消息数量
      logger.info('返回的消息数量:', { count: messages.length });

      res.json({
        success: true,
        data: {
          messages: formattedMessages,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasMore: page < totalPages
          }
        }
      });
    } catch (error) {
      logger.error('获取消息历史失败:', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.id 
      });
      res.status(500).json({ success: false, message: '获取消息历史失败' });
    }
  },

  // 导出聊天记录为 CSV（教师：导出所带班级学生；管理员：导出全部）
  async exportAllMessagesCSV(req, res) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      logger.info('导出聊天记录CSV请求', { userId, role });

      const query = {};
      if (role === 'teacher') {
        const classes = await Class.find({ teacher: userId }).select('_id');
        const classIds = classes.map(c => c._id);
        const studentIds = await User.find({ classId: { $in: classIds } }).distinct('_id');
        query.student = { $in: studentIds };
      } else if (role === 'student') {
        query.student = userId;
      }

      const messages = await Message.find(query)
        .sort({ createdAt: 1 })
        .populate('student', 'username name')
        .populate('courseId', 'title')
        .populate('lessonId', 'title');

      const csvEscape = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value).replace(/"/g, '""');
        return '"' + str + '"';
      };

      const header = [
        'messageId',
        'studentId',
        'studentName',
        'studentUsername',
        'status',
        'type',
        'courseTitle',
        'lessonId',
        'lessonTitle',
        'createdAt',
        'reviewedAt',
        'reviewComment',
        'conversationId',
        'prevConversationId',
        'conversationIndex',
        'role',
        'content',
        'suggestedQuestions',
        'timestamp'
      ];

      const lines = [header.join(',')];

      for (const m of messages) {
        const base = {
          messageId: m._id,
          studentId: m.student?._id || '',
          studentName: (m.student?.name || m.student?.username || ''),
          studentUsername: (m.student?.username || ''),
          status: m.status,
          type: m.type,
          courseTitle: m.courseId?.title || '',
          lessonId: m.lessonId?._id || '',
          lessonTitle: m.lessonId?.title || '',
          createdAt: m.createdAt?.toISOString?.() || '',
          reviewedAt: m.reviewedAt?.toISOString?.() || '',
          reviewComment: m.reviewComment || ''
        };

        const conversations = Array.isArray(m.messages) ? m.messages : [];
        if (conversations.length === 0) {
        const row = [
            csvEscape(base.messageId),
            csvEscape(base.studentId),
            csvEscape(base.studentName),
            csvEscape(base.studentUsername),
            csvEscape(base.status),
            csvEscape(base.type),
            csvEscape(base.courseTitle),
            csvEscape(base.lessonId),
            csvEscape(base.lessonTitle),
            csvEscape(base.createdAt),
            csvEscape(base.reviewedAt),
            csvEscape(base.reviewComment),
            csvEscape(''),
            csvEscape(''),
          csvEscape(''), csvEscape(''), csvEscape(''), csvEscape(''), csvEscape('')
          ];
          lines.push(row.join(','));
          continue;
        }

        conversations.forEach((c, idx) => {
          const prev = idx > 0 ? conversations[idx - 1] : null;
        const row = [
            csvEscape(base.messageId),
            csvEscape(base.studentId),
            csvEscape(base.studentName),
            csvEscape(base.studentUsername),
            csvEscape(base.status),
            csvEscape(base.type),
            csvEscape(base.courseTitle),
            csvEscape(base.lessonId),
            csvEscape(base.lessonTitle),
            csvEscape(base.createdAt),
            csvEscape(base.reviewedAt),
            csvEscape(base.reviewComment),
            csvEscape(c?._id || ''),
            csvEscape(prev?._id || ''),
            csvEscape(idx),
            csvEscape(c.role || ''),
          csvEscape(c.content || ''),
          csvEscape(Array.isArray(c.suggestedQuestions) ? c.suggestedQuestions.join(' | ') : ''),
            csvEscape((c.timestamp && new Date(c.timestamp).toISOString()) || '')
          ];
          lines.push(row.join(','));
        });
      }

      const csvContent = '\ufeff' + lines.join('\n');
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const filename = `chat_export_${ts}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      logger.error('导出聊天记录CSV失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ message: '导出失败', error: error.message });
    }
  }
};

module.exports = chatController; 