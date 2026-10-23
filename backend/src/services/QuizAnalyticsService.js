const mongoose = require('mongoose');
const QuizSubmission = require('../models/QuizSubmission');
const QuizAnalytics = require('../models/QuizAnalytics');
const logger = require('../utils/logger');

class QuizAnalyticsService {
  /**
   * 更新测验的分析数据
   * @param {string} quizId - 测验ID
   */
  static async updateQuizAnalytics(quizId) {
    try {
      logger.info('开始更新测验分析数据', { quizId });
      
      // 获取上次更新的时间
      const quizAnalytics = await QuizAnalytics.findOne({ quizId });
      const lastUpdated = quizAnalytics ? quizAnalytics.lastUpdated : new Date(0);

      // 修改：获取所有提交记录，而不仅仅是新提交的
      const submissions = await QuizSubmission.find({
        quizId,
        status: 'SUBMITTED'
      })
        .select('score attemptNumber answers.questionId answers.selectedOption answers.isCorrect answers.scaleValue answers.matrixAnswers')
        .populate({ path: 'answers.questionId', select: 'type' })
        .lean();
      
      // 不删除旧数据，后续使用upsert写回，避免瞬时查询不到

      logger.info('获取到提交记录', { 
        quizId, 
        submissionCount: submissions.length 
      });

      if (submissions.length === 0) {
        logger.info('没有提交记录，返回现有分析', { quizId });
        return quizAnalytics; // 如果没有提交，直接返回现有分析
      }

      // 初始化分析数据
      const analytics = {
        quizId,
        totalSubmissions: submissions.length,
        averageScore: 0,
        scoreDistribution: new Map(),
        completionRate: 0,
        questionAnalytics: [], // 修改：使用数组而不是 Map
        scaleAnalytics: {
          dimensionAverages: new Map(),
          dimensionDistribution: new Map()
        }
      };

      // 创建问题ID到索引的映射（使用纯对象以便V8优化）
      const questionMap = Object.create(null);
      
      // 初始化问题分析
      for (const submission of submissions) {
        for (const answer of submission.answers) {
          // 确保 questionId 是字符串形式的 ObjectId
          const questionId = answer.questionId && answer.questionId._id 
            ? answer.questionId._id.toString() 
            : (answer.questionId ? answer.questionId.toString() : null);
          
          if (!questionId) {
            logger.warn('跳过无效的问题ID', { 
              quizId, 
              answerId: answer._id 
            });
            continue;
          }
          
          if (questionMap[questionId] === undefined) {
            // 添加新的问题分析对象到数组
            const questionAnalytic = {
              questionId,
              totalAttempts: 0,
              correctAttempts: 0,
              optionDistribution: new Map(),
              averageResponseTime: 0,
              attemptWiseAccuracy: new Map() // 存储每次尝试的正确率
            };
            
            analytics.questionAnalytics.push(questionAnalytic);
            questionMap[questionId] = analytics.questionAnalytics.length - 1;
            
            logger.info('初始化问题分析', { 
              quizId, 
              questionId, 
              index: questionMap[questionId]
            });
          }
        }
      }

      // 分析每个提交
      let totalScore = 0;
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        // 更新分数分布
        const scoreKey = Math.floor(submission.score / 10) * 10;
        analytics.scoreDistribution.set(
          scoreKey.toString(),
          (analytics.scoreDistribution.get(scoreKey.toString()) || 0) + 1
        );
        totalScore += submission.score;

        // 更新每个问题的分析
        for (let j = 0; j < submission.answers.length; j++) {
          const answer = submission.answers[j];
          // 确保 questionId 是字符串形式的 ObjectId
          const questionId = answer.questionId && answer.questionId._id 
            ? answer.questionId._id.toString() 
            : (answer.questionId ? answer.questionId.toString() : null);
          
          if (!questionId) {
            logger.warn('跳过无效的问题ID', { 
              quizId, 
              answerId: answer._id 
            });
            continue;
          }
          
          const questionIndex = questionMap[questionId];
          
          if (questionIndex === undefined) {
            logger.warn('未找到问题索引', { quizId, questionId });
            continue;
          }
          
          const questionAnalytics = analytics.questionAnalytics[questionIndex];
          questionAnalytics.totalAttempts++;
          
          if (answer.isCorrect) {
            questionAnalytics.correctAttempts++;
          }

          // 获取问题类型 - 从populate的数据中获取
          const questionType = answer.questionId && answer.questionId.type 
            ? answer.questionId.type 
            : null;
            
          // 调试信息：检查questionId的结构
          logger.info('检查题目类型获取', {
            quizId,
            questionId,
            hasQuestionIdObject: !!answer.questionId,
            questionIdType: typeof answer.questionId,
            questionIdKeys: answer.questionId ? Object.keys(answer.questionId) : null,
            extractedType: questionType,
            answerStructure: {
              hasMatrixAnswers: !!answer.matrixAnswers,
              matrixAnswersSize: (answer.matrixAnswers instanceof Map)
                ? answer.matrixAnswers.size
                : (answer.matrixAnswers ? Object.keys(answer.matrixAnswers).length : 0),
              hasScaleValue: !!answer.scaleValue,
              scaleValue: answer.scaleValue,
              hasSelectedOption: !!answer.selectedOption
            }
          });
          
          // 更新选项分布 - 根据题目类型处理不同的数据结构
          if (questionType === 'PSYCHOLOGICAL_SCALE') {
            // 量表题目处理
            logger.info('处理量表题目', {
              quizId,
              questionId,
              questionType,
              hasMatrixAnswers: (answer.matrixAnswers instanceof Map)
                ? answer.matrixAnswers.size
                : (answer.matrixAnswers ? Object.keys(answer.matrixAnswers).length : 0),
              scaleValue: answer.scaleValue,
              selectedOption: answer.selectedOption
            });
            
            // 统一获取矩阵条目
            const matrixEntries = (answer.matrixAnswers instanceof Map)
              ? Array.from(answer.matrixAnswers.entries())
              : (answer.matrixAnswers ? Object.entries(answer.matrixAnswers) : []);

            if (matrixEntries.length > 0) {
              // 矩阵量表 - 处理每行的答案
              for (const [rowId, scaleValue] of matrixEntries) {
                // 后端统一转换为 1..N（前端按1基显示）
                const numericValue = Number(scaleValue);
                const oneBased = Number.isFinite(numericValue) ? (numericValue + 1) : scaleValue;
                const matrixKey = `matrix_${rowId}_${oneBased}`;
                questionAnalytics.optionDistribution.set(
                  matrixKey,
                  (questionAnalytics.optionDistribution.get(matrixKey) || 0) + 1
                );
              }
            } else if (answer.scaleValue) {
              // 单个量表
              const scaleKey = `scale_${answer.scaleValue}`;
              questionAnalytics.optionDistribution.set(
                scaleKey,
                (questionAnalytics.optionDistribution.get(scaleKey) || 0) + 1
              );
            } else {
              // 如果量表题目既没有matrixAnswers也没有scaleValue，记录警告
              logger.warn('量表题目缺少答案数据', {
                quizId,
                questionId,
                answer: {
                  selectedOption: answer.selectedOption,
                  scaleValue: answer.scaleValue,
                  hasMatrixAnswers: answer.matrixAnswers ? answer.matrixAnswers.size : 0
                }
              });
              // 临时使用none作为键，避免数据丢失
              const optionKey = 'scale_missing';
              questionAnalytics.optionDistribution.set(
                optionKey,
                (questionAnalytics.optionDistribution.get(optionKey) || 0) + 1
              );
            }
          } else {
            // 普通题目处理
            const optionKey = answer.selectedOption ? answer.selectedOption.toString() : 'none';
            questionAnalytics.optionDistribution.set(
              optionKey,
              (questionAnalytics.optionDistribution.get(optionKey) || 0) + 1
            );
          }
          
          // 记录更新的分布数据（用于调试）
          const distributionKeys = Array.from(questionAnalytics.optionDistribution.keys());
          logger.info('更新选项分布', { 
            quizId,
            questionId,
            questionType,
            distributionKeys,
            totalDistributions: questionAnalytics.optionDistribution.size,
            answerData: {
              questionId: answer.questionId?._id?.toString() || answer.questionId?.toString() || 'unknown',
              selectedOption: answer.selectedOption?.toString() || 'none',
              scaleValue: answer.scaleValue || null,
              hasMatrixAnswers: answer.matrixAnswers ? answer.matrixAnswers.size : 0,
              isCorrect: answer.isCorrect || false
            }
          });

          // 更新按尝试次数的正确率
          const attemptKey = submission.attemptNumber.toString();
          
          // 获取当前尝试次数的统计数据
          if (!questionAnalytics.attemptWiseAccuracy.has(attemptKey)) {
            // 如果是第一次记录该尝试次数，初始化为 0
            questionAnalytics.attemptWiseAccuracy.set(attemptKey, 0);
          }
          
          // 更新正确率 - 使用加权平均
          const currentAccuracy = questionAnalytics.attemptWiseAccuracy.get(attemptKey);
          const currentTotal = questionAnalytics.totalAttempts - 1; // 减去当前新增的一次
          const newAccuracy = answer.isCorrect ? 1 : 0; // 当前回答的正确率
          
          // 计算新的加权平均正确率
          const updatedAccuracy = (currentAccuracy * currentTotal + newAccuracy) / questionAnalytics.totalAttempts;
          questionAnalytics.attemptWiseAccuracy.set(attemptKey, updatedAccuracy);
        }

        // 如果是心理量表，更新维度分析
        if (submission.scaleResults && Object.keys(submission.scaleResults).length > 0) {
          for (const [dimension, score] of Object.entries(submission.scaleResults)) {
            // 更新维度平均分
            const currentAvg = analytics.scaleAnalytics.dimensionAverages.get(dimension) || 0;
            const newAvg = (currentAvg * (submissions.length - 1) + score) / submissions.length;
            analytics.scaleAnalytics.dimensionAverages.set(dimension, newAvg);

            // 更新维度分布
            if (!analytics.scaleAnalytics.dimensionDistribution.has(dimension)) {
              analytics.scaleAnalytics.dimensionDistribution.set(dimension, new Map());
            }
            const distribution = analytics.scaleAnalytics.dimensionDistribution.get(dimension);
            const scoreKey = Math.floor(score);
            distribution.set(
              scoreKey.toString(),
              (distribution.get(scoreKey.toString()) || 0) + 1
            );
          }
        }
      }

      // 计算平均分
      analytics.averageScore = totalScore / submissions.length;

      // 保存分析数据
      const saveAnalytics = async () => {
        try {
          // 将 Map 转换为普通对象
          const analyticsObj = {
            quizId: analytics.quizId,
            totalSubmissions: analytics.totalSubmissions,
            averageScore: analytics.averageScore,
            completionRate: analytics.completionRate,
            lastUpdated: new Date(),
            scoreDistribution: Object.fromEntries(
              Array.from(analytics.scoreDistribution.entries())
                .filter(([key]) => !key.startsWith('$'))
            ),
            questionAnalytics: analytics.questionAnalytics.map(qa => ({
              questionId: qa.questionId,
              totalAttempts: qa.totalAttempts,
              correctAttempts: qa.correctAttempts,
              averageResponseTime: qa.averageResponseTime,
              optionDistribution: Object.fromEntries(
                Array.from(qa.optionDistribution.entries())
                  .filter(([key]) => !key.startsWith('$'))
              ),
              attemptWiseAccuracy: Object.fromEntries(
                Array.from(qa.attemptWiseAccuracy.entries())
                  .filter(([key]) => !key.startsWith('$'))
              )
            })),
            scaleAnalytics: {
              dimensionAverages: Object.fromEntries(
                Array.from(analytics.scaleAnalytics.dimensionAverages.entries())
                  .filter(([key]) => !key.startsWith('$'))
              ),
              dimensionDistribution: Object.fromEntries(
                Array.from(analytics.scaleAnalytics.dimensionDistribution.entries())
                  .filter(([key]) => !key.startsWith('$'))
                  .map(([key, value]) => [
                    key,
                    Object.fromEntries(
                      Array.from(value.entries())
                        .filter(([subKey]) => !subKey.startsWith('$'))
                    )
                  ])
              )
            }
          };

          logger.info('准备保存分析数据', { 
            quizId: analytics.quizId,
            questionAnalyticsCount: analyticsObj.questionAnalytics.length
          });

          // 使用upsert原子写回，避免删除后读不到
          await QuizAnalytics.updateOne(
            { quizId: analytics.quizId },
            { $set: analyticsObj },
            { upsert: true }
          );
          logger.info('保存测验分析数据成功（upsert）', { quizId: analytics.quizId });
          
          return await QuizAnalytics.findOne({ quizId: analytics.quizId });
        } catch (error) {
          logger.error('保存分析数据失败', { 
            error: error.message, 
            stack: error.stack,
            quizId: analytics.quizId 
          });
          throw error;
        }
      };

      return await saveAnalytics();
    } catch (error) {
      logger.error('更新测验分析数据失败', { 
        quizId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * 获取单个测验中某个题目的分析数据
   * @param {string} questionId - 问题ID
   */
  static async getSingleQuizQuestionAnalytics(questionId) {
    const analytics = await QuizAnalytics.findOne({
      'questionAnalytics.questionId': questionId
    }, {
      'questionAnalytics.$': 1
    });

    return analytics?.questionAnalytics[0];
  }

  /**
   * 获取测验的整体分析数据
   * @param {string} quizId - 测验ID
   */
  static async getQuizAnalytics(quizId) {
    return await QuizAnalytics.findOne({ quizId });
  }

  /**
   * 获取所有测验中某个题目的完整分析数据
   * @param {string} questionId - 题目ID
   */
  static async getAllQuizQuestionAnalytics(questionId) {
    try {
      logger.info('获取题目分析数据', { questionId });
      
      const quizAnalytics = await QuizAnalytics.find({
        'questionAnalytics.questionId': questionId
      });

      if (!quizAnalytics || quizAnalytics.length === 0) {
        logger.warn('未找到题目分析数据', { questionId });
        return null; // 如果没有找到相关分析，返回 null
      }

      // 提取相关的题目分析数据
      const questionAnalytics = quizAnalytics.map(quiz => {
        try {
          // 使用 toString() 进行比较，避免类型不匹配问题
          const questionData = quiz.questionAnalytics.find(q => {
            const qId = q.questionId && q.questionId.toString ? q.questionId.toString() : q.questionId;
            return qId === questionId;
          });
          
          if (!questionData) {
            logger.warn('在测验中未找到题目数据', { 
              quizId: quiz.quizId, 
              questionId 
            });
            return null;
          }
          
          // 转换为普通对象
          const questionObj = questionData.toObject ? questionData.toObject() : JSON.parse(JSON.stringify(questionData));
          
          // 确保 Map 类型数据被正确转换
          if (questionObj.optionDistribution) {
            questionObj.optionDistribution = Object.fromEntries(
              Array.from(questionData.optionDistribution instanceof Map 
                ? questionData.optionDistribution.entries() 
                : Object.entries(questionObj.optionDistribution)
              ).filter(([key]) => !key.startsWith('$'))
            );
          }
          
          if (questionObj.attemptWiseAccuracy) {
            questionObj.attemptWiseAccuracy = Object.fromEntries(
              Array.from(questionData.attemptWiseAccuracy instanceof Map 
                ? questionData.attemptWiseAccuracy.entries() 
                : Object.entries(questionObj.attemptWiseAccuracy)
              ).filter(([key]) => !key.startsWith('$'))
            );
          }
          
          return questionObj;
        } catch (error) {
          logger.error('处理题目数据失败', { 
            error: error.message, 
            quizId: quiz.quizId, 
            questionId 
          });
          return null;
        }
      }).filter(Boolean); // 过滤掉 null 值
      
      logger.info('获取到题目分析数据', { 
        questionId, 
        count: questionAnalytics.length 
      });
      
      return questionAnalytics;
    } catch (error) {
      logger.error('获取题目分析数据失败', { 
        error: error.message, 
        stack: error.stack, 
        questionId 
      });
      throw error;
    }
  }
}

module.exports = QuizAnalyticsService; 