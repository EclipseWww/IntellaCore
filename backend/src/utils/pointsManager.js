const { roundPoints } = require('./pointPrecision');
const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const logger = require('./logger');

/**
 * 积分管理工具
 * 用于处理学生积分的添加和减少，封装常见的积分操作
 */
class PointsManager {
  /**
   * 添加积分
   * @param {string} studentId - 学生ID
   * @param {number} amount - 积分数量
   * @param {string} type - 积分类型
   * @param {string} description - 积分描述
   * @param {string|null} relatedId - 相关ID
   * @returns {Promise<object>} - 返回更新后的成就记录
   */
  static async addPoints(studentId, amount, type, description = '', relatedId = null) {
    try {
      logger.info('添加积分', {
        studentId,
        amount,
        type,
        description,
        relatedId
      });

      // 确保积分数量为正数
      if (amount <= 0) {
        logger.warn('添加积分时数量必须为正数', { studentId, amount });
        throw new Error('添加积分时数量必须为正数');
      }

      // 使用Achievement模型的静态方法添加积分交易记录
      const achievement = await Achievement.addPointTransaction(
        studentId,
        amount,
        type,
        description,
        relatedId
      );

      logger.info('积分添加成功', {
        studentId,
        amount,
        newTotal: achievement.totalPoints
      });

      return achievement;
    } catch (error) {
      logger.error('添加积分失败', {
        error: error.message,
        stack: error.stack,
        studentId
      });
      throw error;
    }
  }

  /**
   * 减少积分
   * @param {string} studentId - 学生ID
   * @param {number} amount - 积分数量
   * @param {string} type - 积分类型
   * @param {string} description - 积分描述
   * @param {string|null} relatedId - 相关ID
   * @returns {Promise<object>} - 返回更新后的成就记录
   */
  static async deductPoints(studentId, amount, type, description = '', relatedId = null) {
    try {
      logger.info('减少积分', {
        studentId,
        amount,
        type,
        description,
        relatedId
      });

      // 确保积分数量为正数，然后转为负数进行扣除
      if (amount <= 0) {
        logger.warn('减少积分时数量必须为正数', { studentId, amount });
        throw new Error('减少积分时数量必须为正数');
      }

      // 获取当前积分余额以检查是否足够
      const currentAchievement = await Achievement.findOne({ studentId });
      const currentPoints = currentAchievement ? currentAchievement.totalPoints : 0;

      if (currentPoints < amount) {
        logger.warn('积分余额不足', {
          studentId,
          currentPoints,
          requestedDeduction: amount
        });
        
        // 可以选择抛出错误或者只扣减到0
        // throw new Error('积分余额不足');
        
        // 这里选择只扣减现有的积分
        const actualDeduction = currentPoints;
        logger.info('调整扣减金额', {
          requested: amount,
          actual: actualDeduction
        });
        
        if (actualDeduction <= 0) {
          return currentAchievement || await Achievement.findOneAndUpdate(
            { studentId },
            { $setOnInsert: { totalPoints: 0 } },
            { upsert: true, new: true }
          );
        }
        
        // 使用负数表示扣除积分
        return await Achievement.addPointTransaction(
          studentId,
          -actualDeduction,
          type,
          description,
          relatedId
        );
      }

      // 使用负数表示扣除积分
      const achievement = await Achievement.addPointTransaction(
        studentId,
        -amount,
        type,
        description,
        relatedId
      );

      logger.info('积分扣除成功', {
        studentId,
        amount,
        newTotal: achievement.totalPoints
      });

      return achievement;
    } catch (error) {
      logger.error('扣除积分失败', {
        error: error.message,
        stack: error.stack,
        studentId
      });
      throw error;
    }
  }

  /**
   * 更新积分（通用方法）
   * @param {string} studentId - 学生ID 
   * @param {number|null} newScore - 新的分数
   * @param {number|null} oldScore - 旧的分数
   * @param {string} relatedId - 相关ID（如提交ID、测验ID等）
   * @param {string} type - 积分类型
   * @param {string} description - 积分描述
   * @returns {Promise<object|null>} - 返回更新后的成就记录或null
   */
  // Reconcile one assignment against its ledger, atomically updating balance and history.
  // Comparing the transaction count prevents duplicate awards during concurrent regrades.
  static async syncAssignmentPoints(submissionId, description = '') {
    const AssignmentSubmission = require('../models/AssignmentSubmission');
    const pointsFor = submission => Number(((submission.grade?.score ?? submission.aiGrade?.score ?? 0) * 10).toFixed(2));
    for (let attempt = 0; attempt < 10; attempt++) {
      const current = await AssignmentSubmission.findById(submissionId);
      if (!current) throw new Error('作业不存在');
      const target = pointsFor(current);
      const achievement = await this.reconcileAssignmentPoints(current.student, target, current._id, description);
      const latest = await AssignmentSubmission.findById(submissionId);
      if (latest && pointsFor(latest) === target) return achievement;
    }
    throw new Error('作业评分正在更新，请稍后重试');
  }

  static async reconcileAssignmentPoints(studentId, newPoints, relatedId, description = '', legacyPoints = null, initializeOnly = false) {
    const target = Number(Number(newPoints ?? 0).toFixed(2));
    if (!Number.isFinite(target) || target < 0) throw new Error('无效的作业积分');
    for (let attempt = 0; attempt < 10; attempt++) {
      let achievement;
      try {
        achievement = await Achievement.findOneAndUpdate(
          { studentId }, { $setOnInsert: { totalPoints: 0 } }, { upsert: true, new: true }
        );
      } catch (error) { if (error.code === 11000) continue; throw error; }
      const transactions = achievement.pointTransactions || [];
      const key = String(relatedId);
      const tracked = achievement.assignmentPoints?.get ? achievement.assignmentPoints.get(key) : achievement.assignmentPoints?.[key];
      if (initializeOnly && tracked != null) return achievement;
      const history = transactions.filter(item => String(item.relatedId) === key && ['task_completion', 'task_completion_revoked'].includes(item.type));
      const previous = tracked ?? (legacyPoints != null ? Number(legacyPoints) : history.reduce((sum, item) => sum + Number(item.amount), 0));
      const difference = Number((target - previous).toFixed(2));
      const roundedBalance=roundPoints(achievement.totalPoints);
      if (difference === 0 && tracked != null && Number(achievement.totalPoints)===roundedBalance && Number(tracked)===target) return achievement;
      const update = { $set: { ['assignmentPoints.' + key]: target, totalPoints:roundPoints(roundedBalance+difference) } };
      if (difference !== 0) {
        update.$set.totalPoints = Number((Number(achievement.totalPoints || 0) + difference).toFixed(2));
        update.$push = { pointTransactions: { $each: [{ amount: difference, type: 'task_completion', description, relatedId, timestamp: new Date() }], $position: 0, $slice: 100 } };
      }
      const updated = await Achievement.findOneAndUpdate(
        { _id: achievement._id, totalPoints: achievement.totalPoints, pointTransactions: { $size: transactions.length }, ['assignmentPoints.' + key]: tracked ?? { $exists: false } },
        update,
        { new: true }
      );
      if (updated) return updated;
    }
    throw new Error('积分正在更新，请稍后重试');
  }

  static async updatePoints(studentId, newScore, oldScore, relatedId, type = 'other', description = '') {
    try {
      logger.info('更新积分（通用方法）', {
        studentId,
        newScore,
        oldScore,
        relatedId,
        type,
        description
      });

      // 如果新旧分数相同，不需要更新积分
      if (newScore === oldScore) {
        logger.info('分数未变化，不更新积分', { studentId, score: newScore });
        return null;
      }

      // 如果原来有分数且大于0，需要先扣除原来的积分
      if (oldScore !== null && oldScore !== undefined && oldScore > 0) {
        const oldPoints = oldScore;
        await this.deductPoints(
          studentId,
          oldPoints,
          type,
          `取消${description}: ${oldScore}分`,
          relatedId
        );
        
        logger.info('已扣除旧的积分', {
          studentId,
          oldScore,
          oldPoints,
          type
        });
      } else if (oldScore !== null && oldScore !== undefined && oldScore === 0) {
        // 旧分数为0，记录日志但不调用deductPoints
        logger.info('旧分数为0，跳过扣分步骤', {
          studentId,
          oldScore,
          type
        });
      }

      // 如果有新分数且大于0，添加新的积分
      if (newScore !== null && newScore !== undefined && newScore > 0) {
        const newPoints = newScore;
        const achievement = await this.addPoints(
          studentId,
          newPoints,
          type,
          `${description}奖励: ${newScore}分`,
          relatedId
        );
        
        logger.info('已添加新的积分', {
          studentId,
          newScore,
          newPoints,
          type
        });
        
        return achievement;
      } else if (newScore !== null && newScore !== undefined && newScore === 0) {
        // 新分数为0，记录日志但不调用addPoints
        logger.info('新分数为0，跳过加分步骤', {
          studentId,
          newScore,
          type
        });
        
        // 返回当前成就状态
        return await Achievement.findOne({ studentId }) || 
               await Achievement.findOneAndUpdate(
                 { studentId },
                 { $setOnInsert: { totalPoints: 0 } },
                 { upsert: true, new: true }
               );
      }

      return null;
    } catch (error) {
      logger.error('更新积分失败', {
        error: error.message,
        stack: error.stack,
        studentId,
        relatedId,
        type
      });
      // 不抛出错误，避免影响主要业务逻辑
      return null;
    }
  }
}

module.exports = PointsManager; 