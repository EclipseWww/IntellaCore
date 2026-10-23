const AssignmentSubmission = require('../models/AssignmentSubmission');
const { generateCodeReview } = require('../config/ai');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const PointsManager = require('../utils/pointsManager');

// AI 评阅控制器
const aiGradeController = {
  // 请求 AI 评阅
  requestGrade: async (req, res) => {
    try {
      const { submissionId } = req.params;

      logger.info('请求评阅的提交ID:', submissionId);

      // 获取作业提交
      const submission = await AssignmentSubmission.findById(submissionId)
        .populate('student', 'name grade className')
        .populate('course', 'title')
        .populate({
          path: 'lesson',
          select: 'objectives activities'
        });

      logger.info('后端收到的提交数据:', { submissionId, submission });

      if (!submission) {
        logger.warn('未找到作业提交', { submissionId });
        return res.status(404).json({
          success: false,
          message: '未找到作业提交'
        });
      }

      // 获取文件信息
      const file = submission.content.file;
      if (!file || !file.path) {
        logger.warn('未找到代码文件', { submissionId });
        return res.status(400).json({
          success: false,
          message: '未找到代码文件'
        });
      }

      // 检查文件类型
      const fileExt = path.extname(file.originalName).toLowerCase();
      if (fileExt !== '.py') {
        logger.warn('只支持评阅 Python 文件', { submissionId });
        return res.status(400).json({
          success: false,
          message: '只支持评阅 Python 文件'
        });
      }

      try {
        // 读取文件内容
        const filePath = path.join(process.cwd(), file.path);
        const codeContent = await fs.readFile(filePath, 'utf-8');

        // 准备课程和学生信息
        const activity = submission.lesson?.activities.find(a => a._id.toString() === submission.activity);
        const lessonInfo = {
          objectives: submission.lesson?.objectives || [],
          description: activity?.description || '',
          referenceAnswer: activity?.referenceAnswer || ''
        };

        logger.info('准备传递给 AI 的数据:', { lessonInfo, codeContent, activityId: submission.activity, activity });

        // 调用 AI 评审
        const aiGrade = await generateCodeReview(codeContent, lessonInfo);
        aiGrade.gradedAt = new Date();

        // 保存评分前的状态，用于计算积分变化
        const oldAiScore = submission.aiGrade?.score;
        const oldTeacherScore = submission.grade?.score;
        const studentId = submission.student._id;

        // 更新提交记录
        submission.aiGrade = aiGrade;
        
        // 如果没有教师评分，则将状态设置为已评分
        if (oldTeacherScore === undefined && submission.status !== 'graded') {
          logger.info('设置AI评阅作业状态为已评分', { submissionId });
          submission.status = 'graded';
        }
        
        await submission.save();

        // 如果没有教师评分，且 AI 评分有效，则更新学生积分
        if (oldTeacherScore === undefined && aiGrade.score !== undefined) {
          try {
            await PointsManager.updatePoints(
              studentId,
              aiGrade.score * 10,
              oldAiScore ? oldAiScore * 10 : oldAiScore,
              submissionId,
              'task_completion',
              'AI作业评分'
            );
            
            logger.info('AI评分后更新学生积分成功', {
              studentId,
              oldAiScore,
              newAiScore: aiGrade.score,
              points: aiGrade.score * 10
            });
          } catch (error) {
            logger.error('AI评分后更新学生积分失败', {
              error: error.message,
              stack: error.stack,
              studentId,
              submissionId
            });
            // 继续执行，不因积分失败而影响主业务
          }
        } else {
          logger.info('存在教师评分，不根据AI评分更新积分', {
            studentId,
            teacherScore: oldTeacherScore,
            aiScore: aiGrade.score
          });
        }

        logger.info('AI 评阅成功', { submissionId, aiGrade });
        return res.json({
          success: true,
          data: aiGrade
        });

      } catch (error) {
        if (error.code === 'ENOENT') {
          logger.warn('文件不存在', { submissionId });
          return res.status(404).json({
            success: false,
            message: '文件不存在'
          });
        }
        logger.error('读取文件失败', { error: error.message });
        throw error;
      }

    } catch (error) {
      logger.error('AI 评阅失败', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'AI 评阅失败',
        error: error.message
      });
    }
  }
};

module.exports = aiGradeController; 