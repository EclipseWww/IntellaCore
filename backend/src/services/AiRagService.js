const axios = require('axios');
const logger = require('../utils/logger');
const { generateAIResponse } = require('../config/ai');

class AiRagService {
  constructor() {
    this.baseUrl = process.env.AI_RAG_URL || 'http://localhost:8000/chat/';
    this.client = null;
    this.ragAvailable = true; // 标记RAG服务是否可用
    this.lastConnectionAttempt = 0;
    this.connectionRetryInterval = 60000; // 1分钟后重试连接
  }

  async connect() {
    // 如果RAG不可用，检查是否应该重试
    if (!this.ragAvailable) {
      const now = Date.now();
      if (now - this.lastConnectionAttempt < this.connectionRetryInterval) {
        return; // 还在冷却期，不重试
      }
      logger.info('尝试重新连接RAG服务...');
    }

    if (!this.client) {
      try {
        const { Client } = await import('@gradio/client');
        // 配置 events 选项以接收所有数据和状态事件
        this.client = await Client.connect(this.baseUrl, {
          events: ['data', 'status']
        });
        this.ragAvailable = true;
        logger.info('成功连接到 Gradio 服务器 (流式模式)');
      } catch (error) {
        this.ragAvailable = false;
        this.lastConnectionAttempt = Date.now();
        logger.warn('无法连接到RAG服务，将使用备用AI服务', {
          error: error.message,
          baseUrl: this.baseUrl
        });
      }
    }
  }

  /**
   * 获取模型响应（流式传输）
   * @param {Object} params - 请求参数
   * @param {Object} params.multiModalInput - 多模态输入，格式为 {text: "内容", files: []}
   * @param {Array} params.history - 聊天历史，格式为 [["用户消息", "助手回复"], ...]
   * @param {string} params.model - 模型名称
   * @param {number} params.temperature - 温度参数
   * @param {number} params.maxTokens - 最大回复长度
   * @param {number} params.historyRound - 携带上下文轮数
   * @param {string} params.dbName - 知识库名称
   * @param {number} params.similarityThreshold - 相似度阈值
   * @param {number} params.chunkCnt - 选择召回片段数
   * @param {function} onData - 流式数据回调函数，接收 [history, chunk_show] 格式的数据
   * @returns {Promise<void>} - 流式传输不返回最终结果
   */
  async getModelResponse(params, onData) {
    await this.connect();

    // 如果RAG服务不可用，使用备用AI服务
    if (!this.ragAvailable) {
      return this._fallbackGetModelResponse(params, onData);
    }

    try {
      logger.info('请求AI模型响应 (RAG模式)', {
        model: params.model,
        dbName: params.dbName,
        query: params.multiModalInput?.text || '未提供查询文本'
      });

      // 确保multiModalInput格式正确
      const multiModalInput = params.multiModalInput || { text: '', files: [] };

      // 确保历史记录格式正确 - 应为二维数组形式 [["用户消息", "助手回复"], ...]
      let formattedHistory = params.history || [];

      // 确保历史记录不为空，至少包含当前问题
      if (formattedHistory.length === 0 && multiModalInput.text) {
        formattedHistory = [[multiModalInput.text, null]];
      }

      // 创建流式预测 - submit 方法本身就支持流式输出，不需要额外参数
      const stream = await this.client.submit(
        '/get_model_response',
        {
          multi_modal_input: multiModalInput,
          history: formattedHistory,
          model: params.model || process.env.MODEL,
          temperature: params.temperature || 0.85,
          max_tokens: params.maxTokens || 1024,
          history_round: params.historyRound || 3,
          db_name: params.dbName || null,
          similarity_threshold: params.similarityThreshold || 0.2,
          chunk_cnt: params.chunkCnt || 5,
        }
      );

      // 记录请求参数
      logger.info('向Gradio服务器发送请求', {
        model: params.model || process.env.MODEL,
        dbName: params.dbName || '未指定',
        similarityThreshold: params.similarityThreshold || 0.2,
        chunkCnt: params.chunkCnt || 5,
        queryLength: multiModalInput.text?.length || 0
      });

      // 跟踪最新的响应
      let latestResponse = null;
      let responseCount = 0;
      let hasReferences = false;
      let hasLoggedReferences = false;

      // 处理流式数据
      for await (const result of stream) {
        responseCount++;

        // 跳过状态消息，只处理数据消息
        if (result.type === 'status') {
          continue;
        }

        if (result.data) {
          latestResponse = result.data;

          // 检查是否有知识库引用
          if (Array.isArray(result.data) && result.data.length >= 2) {
            // 处理第二个元素，可能是字符串或数组
            if (typeof result.data[1] === 'string') {
              // 检查是否包含知识库引用的特征
              if (result.data[1].includes('##') && result.data[1].includes('score:')) {
                // 解析字符串格式的知识库引用
                const parsedReferences = this.parseReferenceString(result.data[1]);
                if (parsedReferences.length > 0) {
                  hasReferences = true;
                  result.data[1] = parsedReferences; // 替换为解析后的对象数组

                  // 只在第一次收到引用时记录
                  if (!hasLoggedReferences) {
                    logger.info('检测到知识库引用（字符串格式）', {
                      count: parsedReferences.length,
                      dbName: params.dbName || '未指定'
                    });
                    console.log('===== 检测到知识库引用（字符串格式） =====');
                    console.log('知识库引用数量:', parsedReferences.length);
                    console.log('知识库名称:', params.dbName || '未指定');

                    // 记录前3个引用的详细信息
                    parsedReferences.slice(0, 3).forEach((ref, index) => {
                      console.log(`引用 #${index + 1}:`, {
                        index: ref.index,
                        score: ref.score,
                        content: ref.content?.substring(0, 100) + (ref.content?.length > 100 ? '...' : '')
                      });
                    });

                    hasLoggedReferences = true;
                  }
                }
              }
            } else if (Array.isArray(result.data[1]) && result.data[1].length > 0) {
              // 原有的数组格式处理逻辑
              hasReferences = true;

              // 只在第一次收到引用时记录
              if (!hasLoggedReferences) {
                console.log('===== 检测到知识库引用（数组格式） =====');
                console.log('知识库引用数量:', result.data[1].length);
                console.log('知识库名称:', params.dbName || '未指定');

                // 记录前3个引用的详细信息
                result.data[1].slice(0, 3).forEach((ref, index) => {
                  console.log(`引用 #${index + 1}:`, {
                    title: ref.title || '未提供标题',
                    score: ref.score || 0,
                    content: ref.content?.substring(0, 100) + (ref.content?.length > 100 ? '...' : '') || '未提供内容'
                  });
                });

                hasLoggedReferences = true;
              }
            }
          }

          // 返回格式为 [history, chunk_show]
          onData(result.data);
        }
      }

      // 输出最终的完整响应信息
      logger.info('流式传输完成', {
        responseCount,
        historyLength: latestResponse && latestResponse[0] ? latestResponse[0].length : 0,
        referencesCount: latestResponse && latestResponse[1] ? latestResponse[1].length : 0,
        hasReferences
      });

      // 添加控制台输出，显示最终结果
      console.log('===== AI模型响应结果 =====');
      console.log('响应总数:', responseCount);

      if (latestResponse) {
        // 输出历史记录信息
        if (Array.isArray(latestResponse[0]) && latestResponse[0].length > 0) {
          console.log('历史记录长度:', latestResponse[0].length);
          const lastMessage = latestResponse[0][latestResponse[0].length - 1];
          if (Array.isArray(lastMessage) && lastMessage.length >= 2) {
            console.log('最终回复 (前200字符):',
              lastMessage[1]?.substring(0, 200) + (lastMessage[1]?.length > 200 ? '...' : ''));
          }
        }

        // 输出知识库引用信息
        if (Array.isArray(latestResponse[1])) {
          console.log('知识库引用数量:', latestResponse[1].length);
          if (latestResponse[1].length > 0) {
            console.log('知识库引用详情:');
            latestResponse[1].forEach((ref, index) => {
              console.log(`- 引用 #${index + 1}:`, {
                title: ref.title || '未提供标题',
                score: ref.score || 0,
                content: ref.content?.substring(0, 100) + (ref.content?.length > 100 ? '...' : '') || '未提供内容'
              });
            });
          } else {
            console.log('没有知识库引用');
          }
        } else if (typeof latestResponse[1] === 'string' && latestResponse[1].includes('##')) {
          // 如果引用仍然是字符串格式，尝试解析并显示
          const parsedReferences = this.parseReferenceString(latestResponse[1]);
          console.log('知识库引用数量 (字符串格式):', parsedReferences.length);
          if (parsedReferences.length > 0) {
            console.log('知识库引用详情:');
            parsedReferences.forEach((ref, index) => {
              console.log(`- 引用 #${index + 1}:`, {
                score: ref.score || 0,
                content: ref.content?.substring(0, 100) + (ref.content?.length > 100 ? '...' : '') || '未提供内容'
              });
            });
          } else {
            console.log('解析知识库引用字符串失败或没有引用');
            console.log('原始字符串:', latestResponse[1].substring(0, 200) + (latestResponse[1].length > 200 ? '...' : ''));
          }
        } else {
          console.log('没有知识库引用或引用格式不支持');
        }
      } else {
        console.log('没有收到有效响应');
      }

      logger.info('获取AI模型响应成功（流式传输）', {
        responseCount,
        hasReferences,
        referencesCount: latestResponse && latestResponse[1] ? latestResponse[1].length : 0
      });
    } catch (error) {
      logger.error('获取AI模型响应失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 解析知识库引用字符串
   * @param {string} referenceString - 知识库引用字符串
   * @returns {Array} - 解析后的引用对象数组
   */
  parseReferenceString(referenceString) {
    if (!referenceString || typeof referenceString !== 'string') {
      return [];
    }

    try {


      // 首先检查是否包含引用标记
      if (!referenceString.includes('##') && !referenceString.includes('score:')) {
        logger.warn('知识库引用字符串不包含预期的标记', {
          hasHashtag: referenceString.includes('##'),
          hasScore: referenceString.includes('score:')
        });
        return [];
      }

      // 使用正则表达式匹配每个引用块
      // 格式: "## 数字:\n 【内容】\nscore: 数值"
      const regex = /##\s*(\d+):\s*([\s\S]*?)(?=(?:##\s*\d+:|score:|$))(score:\s*([\d.]+))?/gi;
      const references = [];
      let match;

      // 使用正则表达式提取所有匹配项
      while ((match = regex.exec(referenceString)) !== null) {
        const index = match[1] ? parseInt(match[1], 10) : 0;
        let content = match[2] ? match[2].trim() : '';
        const scoreText = match[3] || '';
        const scoreMatch = scoreText.match(/score:\s*([\d.]+)/i);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

        // 如果内容中包含score行，需要移除
        if (!scoreMatch && content.includes('score:')) {
          const contentParts = content.split(/score:\s*[\d.]+/i);
          content = contentParts[0].trim();
        }

        if (content) {
          references.push({
            index,
            content,
            score,
            // 为了与原有格式兼容，添加title字段
            title: `引用 #${index}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
          });
        }
      }

      // 如果正则表达式没有匹配到任何内容，尝试使用简单的分割方法
      if (references.length === 0) {
        logger.info('正则表达式未匹配到引用，尝试使用简单分割方法');

        // 尝试多种分隔符
        let blocks = [];
        if (referenceString.includes('##')) {
          blocks = referenceString.split(/##\s*\d+:/);
        } else if (referenceString.includes('参考')) {
          blocks = referenceString.split(/参考\s*\d+:/);
        } else {
          // 尝试按段落分割
          blocks = referenceString.split(/\n\s*\n/);
        }

        blocks.forEach((block, i) => {
          if (!block.trim()) return;

          const scoreMatch = block.match(/score:\s*([\d.]+)/i);
          const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

          // 提取内容 (去除score行)
          let content = block.replace(/score:\s*[\d.]+/i, '').trim();

          if (content) {
            references.push({
              index: i,
              content,
              score,
              title: `引用 #${i}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
            });
          }
        });
      }



      return references;
    } catch (error) {
      logger.error('解析知识库引用字符串失败', { error: error.message, stack: error.stack });
      // 出错时返回一个包含原始字符串的引用对象
      return [{
        index: 0,
        content: referenceString,
        score: 0,
        title: '解析失败 - 原始引用',
        parseError: true
      }];
    }
  }

  /**
   * 备用AI响应方法 - 当RAG服务不可用时使用
   * @param {Object} params - 请求参数
   * @param {function} onData - 流式数据回调函数
   */
  async _fallbackGetModelResponse(params, onData) {
    logger.info('使用备用AI服务响应 (非RAG模式)', {
      model: params.model,
      query: params.multiModalInput?.text || '未提供查询文本'
    });

    const query = params.multiModalInput?.text || '';

    // 构建历史消息
    const messages = [];
    if (params.history && Array.isArray(params.history)) {
      for (const [userMsg, assistantMsg] of params.history) {
        if (userMsg) messages.push({ role: 'user', content: userMsg });
        if (assistantMsg) messages.push({ role: 'assistant', content: assistantMsg });
      }
    }
    messages.push({ role: 'user', content: query });

    // 累积响应内容
    let accumulatedContent = '';
    const history = params.history ? [...params.history] : [];

    // 添加当前问题到历史
    if (history.length === 0 || history[history.length - 1][1] !== null) {
      history.push([query, '']);
    }

    try {
      await generateAIResponse(messages, (chunk) => {
        if (chunk === null) {
          // 流结束
          logger.info('备用AI响应完成', {
            responseLength: accumulatedContent.length
          });
          return;
        }

        accumulatedContent += chunk;

        // 更新历史记录中的最后一个回复
        if (history.length > 0) {
          history[history.length - 1][1] = accumulatedContent;
        }

        // 发送数据，格式与RAG服务一致: [history, references]
        // 备用模式没有知识库引用，所以第二个参数为空数组
        onData([history, []]);
      });

      logger.info('备用AI服务响应成功', {
        historyLength: history.length,
        responseLength: accumulatedContent.length
      });
    } catch (error) {
      logger.error('备用AI服务响应失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 更新知识库
   * @returns {Promise<string[]>} - 返回更新后的知识库列表
   */
  async updateKnowledgeBase() {
    await this.connect();

    // 如果RAG服务不可用，返回空数组
    if (!this.ragAvailable) {
      logger.warn('RAG服务不可用，无法获取知识库列表');
      return [];
    }

    try {
      logger.info('开始更新知识库');
      const result = await this.client.predict('/update_knowledge_base', {});
      logger.info('更新知识库成功');
      const choices = result.data[0]?.choices || [];
      return choices.map(choice => choice[0]);
    } catch (error) {
      logger.error('更新知识库失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 清理临时文件
   * @returns {Promise<any>} - 返回清理结果
   */
  async clearTemp() {
    await this.connect();

    // 如果RAG服务不可用，返回空结果
    if (!this.ragAvailable) {
      logger.warn('RAG服务不可用，无法清理临时文件');
      return { success: false, message: 'RAG服务不可用' };
    }

    try {
      logger.info('清理临时文件');
      const result = await this.client.predict('/clear_tmp', {});
      logger.info('清理临时文件成功');
      return result;
    } catch (error) {
      logger.error('清理临时文件失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 用户聊天
   * @param {Object} params - 请求参数
   * @param {Object} params.userMessage - 用户消息
   * @param {Array} params.history - 聊天历史
   * @returns {Promise<Array>} - 返回更新后的聊天历史
   */
  async userChat(params) {
    await this.connect();

    // 如果RAG服务不可用，使用备用方案
    if (!this.ragAvailable) {
      logger.warn('RAG服务不可用，用户聊天将使用备用AI服务');
      // 这里可以实现备用的聊天逻辑，目前保持与原来一致的接口
      throw new Error('RAG服务暂时不可用，请稍后重试');
    }

    try {
      logger.info('用户聊天请求', { message: params.userMessage.text });
      const result = await this.client.predict('/user', {
        user_message: params.userMessage,
        history: params.history || []
      });
      logger.info('用户聊天请求成功');
      return result;
    } catch (error) {
      logger.error('用户聊天请求失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 检查RAG服务是否可用
   * @returns {boolean} - RAG服务是否可用
   */
  isRagAvailable() {
    return this.ragAvailable;
  }
}

module.exports = new AiRagService(); 