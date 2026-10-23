const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const Setting = require('../models/Setting');
const logger = require('../utils/logger');

// 创建一个带有重试机制的 axios 实例
const axiosInstance = axios.create({
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
});

// 添加重试拦截器
axiosInstance.interceptors.response.use(null, async (error) => {
  const config = error.config;
  config.retryCount = config.retryCount || 0;

  if (config.retryCount >= config.maxRetries) {
    return Promise.reject(error);
  }

  config.retryCount += 1;
  console.log(`Retrying request (${config.retryCount}/${config.maxRetries})...`);

  await new Promise(resolve => setTimeout(resolve, config.retryDelay));
  return axiosInstance(config);
});

// 动态AI配置缓存
let aiConfigCache = {
  value: null,
  loadedAt: 0
};
const AI_CONFIG_TTL_MS = 60 * 1000; // 60s

async function loadAIConfig(force = false) {
  const now = Date.now();
  if (!force && aiConfigCache.value && now - aiConfigCache.loadedAt < AI_CONFIG_TTL_MS) {
    return aiConfigCache.value;
  }

  try {
    const [baseUrlDoc, apiKeyDoc, modelDoc] = await Promise.all([
      Setting.findOne({ key: 'ai.baseUrl' }),
      Setting.findOne({ key: 'ai.apiKey' }),
      Setting.findOne({ key: 'ai.model' })
    ]);

    // 标准化配置，去除首尾空白，避免因粘贴多余空格导致 401
    const baseUrlRaw = (baseUrlDoc && baseUrlDoc.value) || process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const apiKeyRaw = (apiKeyDoc && apiKeyDoc.value) || process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || '';
    const modelRaw = (modelDoc && modelDoc.value) || process.env.MODEL || 'gpt-4o-mini';

    const baseUrl = typeof baseUrlRaw === 'string' ? baseUrlRaw.trim() : String(baseUrlRaw || '');
    const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : String(apiKeyRaw || '');
    const model = typeof modelRaw === 'string' ? modelRaw.trim() : String(modelRaw || '');

    const config = { baseUrl, apiKey, model };
    aiConfigCache = { value: config, loadedAt: now };

    logger.info('AI配置已加载', { baseUrl, hasApiKey: !!apiKey, model });
    return config;
  } catch (error) {
    logger.error('加载AI配置失败', { error: error.message });
    // 兜底返回环境变量
    return {
      baseUrl: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || '',
      model: process.env.MODEL || 'qwen-turbo'
    };
  }
}

async function getOpenAIClient() {
  const cfg = await loadAIConfig();
  const configuration = new Configuration({
    apiKey: cfg.apiKey,
    basePath: cfg.baseUrl
  });
  try {
    const client = new OpenAIApi(configuration);
    // 记录关键请求头（不包含敏感信息），确认Authorization是否被正确注入
    if (!cfg.apiKey) {
      logger.warn('OpenAI客户端创建时发现空API Key');
    }
    return client;
  } catch (e) {
    logger.error('创建OpenAI客户端失败', { error: e.message, basePath: cfg.baseUrl, hasApiKey: !!cfg.apiKey });
    throw e;
  }
}

async function getAIModel() {
  const cfg = await loadAIConfig();
  return cfg.model;
}

async function generateAIResponse(prompt, onData) {
  try {
    // 检查prompt是否为数组，如果不是，则转换为数组形式
    const messages = Array.isArray(prompt)
      ? prompt
      : [{ role: "user", content: prompt }];

    const openai = await getOpenAIClient();
    const model = await getAIModel();

    console.log('Creating chat completion with:', {
      model,
      messagesCount: messages.length,
      firstMessageRole: messages[0]?.role,
      lastMessageRole: messages[messages.length - 1]?.role,
      temperature: 0.7,
      // 限制生成长度，避免回答过长
      max_tokens: 400,
      stream: true
    });

    const response = await openai.createChatCompletion({
      model,
      messages: messages,
      temperature: 0.7,
      // 限制生成长度，避免回答过长
      max_tokens: 400,
      stream: true
    }, { responseType: 'stream' });

    for await (const chunk of response.data) {
      const lines = chunk
        .toString('utf8')
        .split('\n')
        .filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.includes('[DONE]')) {
          onData(null);  // 调用 onData(null) 来表示流结束
          return;
        }

        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5));
            if (data.choices[0].delta.content) {
              onData(data.choices[0].delta.content);
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        }
      }
    }
  } catch (error) {
    // 详细记录 axios/openai 错误，便于部署环境排查
    const isAxios = !!error?.isAxiosError;
    const status = error?.response?.status;
    const data = error?.response?.data;
    const headers = error?.response?.headers;
    console.error('Error in generateAIResponse:', {
      message: error?.message,
      isAxiosError: isAxios,
      status,
      data,
      headers: headers ? {
        'content-type': headers['content-type'],
        'x-request-id': headers['x-request-id'] || headers['x-requestid']
      } : undefined
    });
    throw error;
  }
}

async function generateCodeReview(codeContent, lessonInfo) {
  try {
    const openai = await getOpenAIClient();
    const model = await getAIModel();
    console.log('Creating code review with model:', model);

    const systemPrompt = `你是一个专门面向初中生的Python编程老师。你需要以鼓励和引导的方式对学生的代码进行分析和评分。评分时要严格考虑到学生的当前学习阶段，重点关注功能实现和对本节课学习目标相关概念的掌握。
请严格按照以下JSON格式输出，所有字段都必须存在，不要输出任何其他内容。评分必须严格遵循以下规则：
1. 所有分数字段只能是 0、2、4、6、8、10 中的一个
2. 总分计算规则：如果功能实现得分为10分，总分就是10分；否则，以三个维度的平均值四舍五入到最近的偶数作为总分
3. 如果学生提交的代码与题目要求完全不相关（例如提交了错误的Python文件），所有维度必须给0分

评分标准：
- 10分：完全达到要求，代码能实现功能
- 8分：基本达到要求，有小瑕疵
- 6分：达到要求，但有明显不足
- 4分：基本功能实现，但问题较多
- 2分：代码有严重问题，但有尝试
- 0分：完全没有完成要求或提交了错误的文件

{
  "score": number,        // 总体评分，只能是 0、2、4、6、8、10
                         // 如果功能实现得分为10分，总分就是10分
  "feedback": string,     // 总体评价，使用鼓励性的语言，指出亮点，对不足之处给出具体改进建议。
                         // 如果提交了错误的文件，需要明确指出这一点。
  "analysis": {
    "codeQuality": {
      "score": number,    // 基础规范得分，只能是 0、2、4、6、8、10
      "feedback": string  // 评价以下几点：
                         // 1. 代码缩进是否整齐（0-无缩进，10-完全正确）
                         // 2. 变量名是否有意义好理解（0-完全不合理，10-非常合理）
    },
    "functionality": {
      "score": number,    // 功能实现得分，只能是 0、2、4、6、8、10
      "feedback": string  // 评价以下几点：
                         // 1. 程序是否能正常运行（0-不能运行，10-完全正常）
                         // 2. 是否完成了题目要求的功能（0-未完成，10-全部完成）
                         // 3. 输入输出是否符合要求（0-完全不符合，10-完全符合）
                         // 4. 如果提交了错误的文件，说明代码与题目要求不符
                         // 注意：如果代码能完成题目要求的功能，这一项必须给10分
    },
    "basicConcepts": {
      "score": number,    // 基础概念掌握得分，只能是 0、2、4、6、8、10
      "feedback": string  // 评价以下几点：
                         // 1. 是否正确使用了本节学习目标相关的概念
    },
    "logicClarity": {
      "score": number,    // 逻辑清晰度得分，只能是 0、2、4、6、8、10
      "feedback": string  // 评价以下几点：
                         // 1. 代码逻辑是否清晰易懂（0-混乱，10-非常清晰）
                         // 2. 代码结构是否有条理（0-杂乱无章，10-结构合理）
                         // 3. 解决问题的思路是否正确（0-完全错误，10-思路正确）
    }
  },
  "suggestions": string[] // 改进建议数组，每条建议要具体且易于理解，适合初学者的水平。
                         // 如果提交了错误的文件，第一条建议应该是提醒学生检查是否提交了正确的文件。
                         // 不要建议学生添加注释
                         // 重要：所有建议必须严格围绕本节课的学习目标，不要提及或建议使用学生尚未学习的概念
}

示例输出：
{
  "score": 10,
  "feedback": "你在这次'变量与输出'的练习中出色地完成了任务！你的代码使用了正确的变量赋值和print语句，完美实现了要求的功能。你的解决方法简单直接，非常符合初学者阶段的编程思路。",
  "analysis": {
    "codeQuality": {
      "score": 8,
      "feedback": "代码的基本结构很好，缩进保持一致。变量名 'name' 和 'age' 非常直观，很容易理解它们的用途，这是一个很好的编程习惯。"
    },
    "functionality": {
      "score": 10,
      "feedback": "程序能够完全正常运行，成功实现了获取用户姓名和年龄并输出问候语的功能。输入和输出的格式也符合要求，完全符合题目的要求。"
    },
    "basicConcepts": {
      "score": 8,
      "feedback": "你正确使用了变量赋值和字符串连接，很好地应用了input()函数获取用户输入和print()函数输出结果。你对本课所学Python基本语法的理解很扎实。"
    },
    "logicClarity": {
      "score": 8,
      "feedback": "代码逻辑清晰，解决问题的思路正确。你获取输入并构建输出的方式直接有效。代码结构简单明了，很容易理解你的解题思路。"
    }
  },
  "suggestions": [
    "可以添加一个欢迎信息，让程序使用体验更友好",
    "考虑添加对年龄的简单验证，确保输入的是有效数字"
  ]
}`;

    const userPrompt = `本节课的学习目标是：${lessonInfo.objectives && lessonInfo.objectives.length > 0 ? lessonInfo.objectives.join('、') : '无'}

题目要求：${lessonInfo.description || '无'}

参考答案：
${lessonInfo.referenceAnswer || '无'}

学生答案：
${codeContent}

请对学生的代码进行评审，输出json格式的评审结果。评审时请注意：
1. 对比参考答案，检查学生是否实现了所有要求的功能
2. 重点关注本节课的学习目标是否达成
3. 给出具体的改进建议，帮助学生提高
4. 如果题目要求为空或参考答案为空，说明数据获取可能有问题，请在反馈中提醒教师检查课程配置
5. 重要：如果学生的代码可以正确实现要求的功能，即使代码风格或结构有问题，也必须给功能实现维度满分（10分）
6. 极其重要：所有评分和建议必须严格基于本节课的学习目标和题目要求，不要提及或建议使用超出当前学习阶段的概念或技术。例如，如果本节课只教了print和变量，不要建议使用循环或函数`;

    // 输出完整的 prompt 日志
    console.log('完整的 system prompt:', systemPrompt);
    console.log('完整的 user prompt:', userPrompt);

    const response = await openai.createChatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    const isAxios = !!error?.isAxiosError;
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('Error in generateCodeReview:', {
      message: error?.message,
      isAxiosError: isAxios,
      status,
      data
    });
    throw error;
  }
}

module.exports = {
  generateAIResponse,
  generateCodeReview,
  getOpenAIClient,
  getAIModel,
  loadAIConfig
};