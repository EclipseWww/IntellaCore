const portableMedia = require('../services/portableMedia');
const { normalizeOfficeRuleScores } = require('../services/officeRuleScores');
const Lesson = require('../models/Lesson');
const CourseUnit = require('../models/CourseUnit');
const Course = require('../models/Course');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { generateExcelGradeRules } = require('../services/excelAutoGradeService');
const { generatePptGradeRules } = require('../services/pptAutoGradeService');

// 创建课时
exports.createLesson = async (req, res) => {
  try {
    const { unitId } = req.params;
    const lessonData = req.body;

    // 验证单元存在
    const unit = await CourseUnit.findById(unitId);
    if (!unit) {
      return res.status(404).json({ message: '课程单元不存在' });
    }

    // 获取当前单元的最大 order
    const maxOrderLesson = await Lesson.findOne({ unit: unitId })
      .sort({ order: -1 })
      .select('order');

    // 确保 order 是一个有效的数字
    const nextOrder = maxOrderLesson ? (maxOrderLesson.order || 0) + 1 : 1;

    // 创建课时，确保必要字段都存在且类型正确
    const lesson = new Lesson({
      ...lessonData,
      unit: unitId,
      course: unit.course,
      order: nextOrder,  // 使用计算得到的 order
      activities: lessonData.activities || [],
      resources: lessonData.resources || [],
      exercises: lessonData.exercises || []
    });

    await lesson.save();

    // 更新单元状态
    await CourseUnit.findByIdAndUpdate(unitId, {
      'interactive.hasLesson': true
    });

    res.status(201).json({
      success: true,
      data: lesson,
      message: '课时创建成功'
    });
  } catch (error) {
    console.error('创建课时失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '创建课时失败'
    });
  }
};

// 获取课时详情
exports.getLessonDetails = async (req, res) => {
  try {
    const { lessonId } = req.params;
    console.log('获取课时详情，lessonId:', lessonId);

    const lesson = await Lesson.findById(lessonId)
      .populate('unit')
      .populate('course')
      .populate('activities.quizSettings.quiz')
      .lean();

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: '课时不存在'
      });
    }

    // 检查用户角色
    const isTeacher = req.user.role === 'teacher';

    // 记录访问未发布课时的情况（仅用于日志记录）
    if (!isTeacher && lesson.status !== 'published') {
      console.log(`学生 ${req.user.id} 访问了未发布的课时 ${lessonId}`);
    }

    // 根据用户角色过滤数据
    const filteredActivities = lesson.activities.map(activity => {
      // 如果是学生，只显示已发布的活动
      if (!isTeacher) {
        // 如果活动未发布，则跳过
        if (!activity.isPublished) {
          return null;
        }

        // 深拷贝活动对象以避免修改原始数据
        const activityObj = activity.toObject ? activity.toObject() : { ...activity };
        if (activityObj.quizSettings?.quiz) {
          activityObj.quizSettings = { ...activityObj.quizSettings,
            quiz: require('../services/quizSecurity').withoutAnswers(activityObj.quizSettings.quiz) };
        }

        // 处理Python活动的隐藏测试用例
        if (activityObj.type === 'python' && activityObj.pythonSettings?.testCases) {
          activityObj.pythonSettings.testCases = activityObj.pythonSettings.testCases.map(testCase => {
            if (testCase.isHidden) {
              // 对隐藏测试用例的输入输出进行简单的Base64混淆
              // 添加 ENC: 前缀以便前端识别
              return {
                ...testCase,
                input: testCase.input ? `ENC:${Buffer.from(testCase.input).toString('base64')}` : '',
                expectedOutput: testCase.expectedOutput ? `ENC:${Buffer.from(testCase.expectedOutput).toString('base64')}` : '',
                // 确保isHidden标志保留
                isHidden: true
              };
            }
            return testCase;
          });
        }

        // 学生端过滤参考答案和教师专用批阅配置
        const { referenceAnswer, pptGradingSettings, excelGradingSettings, ...rest } = activityObj;
        return rest;
      }
      return activity;
    }).filter(activity => activity !== null); // 过滤掉未发布的活动

    // 确保返回的数据结构完整
    const response = {
      ...lesson,
      objectives: lesson.objectives || [],
      activities: filteredActivities,
      resources: lesson.resources || [],
      exercises: lesson.exercises || []
    };

    console.log('找到课时:', response.title);
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('获取课时详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

function decodeOriginalName(name = '') {
  return Buffer.from(name, 'latin1').toString('utf8');
}

function resolveStoredPath(storedPath) {
  if (!storedPath) return null;
  if (path.isAbsolute(storedPath)) return storedPath;
  return path.join(__dirname, '../..', storedPath);
}

function getActivityById(lesson, activityId) {
  return lesson.activities.id(activityId) ||
    lesson.activities.find(item => item._id?.toString() === activityId?.toString());
}

function normalizePptRules(rules = []) {
  return normalizeOfficeRuleScores(rules).map((rule, index) => ({
    ...rule,
    id: rule.id || `${rule.type || 'rule'}-${rule.slideNumber || 'all'}-${index}`,
    enabled: rule.enabled !== false,
    score: Number(rule.score ?? 1)
  }));
}

async function regeneratePptRules(activity) {
  const settings = activity.pptGradingSettings || {};
  const originalPath = settings.originalFile?.path ? resolveStoredPath(settings.originalFile.path) : null;
  const referencePath = settings.referenceFile?.path ? resolveStoredPath(settings.referenceFile.path) : null;

  if (!referencePath) return [];
  const rules = await generatePptGradeRules({ originalPath, referencePath });
  return normalizePptRules(rules);
}

exports.uploadPptGradingFile = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的PPTX文件' });
    }

    const { lessonId, activityId } = req.params;
    const { fileRole } = req.body;

    if (!['original', 'reference'].includes(fileRole)) {
      return res.status(400).json({ success: false, message: '文件用途无效' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const originalName = decodeOriginalName(req.file.originalname);
    if (!/\.pptx$/i.test(originalName)) {
      return res.status(400).json({ success: false, message: '目前仅支持PPTX文件' });
    }

    const relativePath = path.join('uploads/ppt-grading', lessonId, activityId, req.file.filename).split(path.sep).join('/');
    const fileInfo = {
      filename: req.file.filename,
      originalName,
      path: relativePath,
      size: req.file.size,
      uploadedAt: new Date()
    };

    activity.pptGradingSettings = activity.pptGradingSettings || {};
    if (fileRole === 'original') {
      activity.pptGradingSettings.originalFile = fileInfo;
    } else {
      activity.pptGradingSettings.referenceFile = fileInfo;
    }
    activity.pptGradingSettings.enabled = true;
    activity.pptGradingSettings.updatedAt = new Date();

    if (activity.pptGradingSettings.referenceFile?.path) {
      activity.pptGradingSettings.rules = await regeneratePptRules(activity);
    }

    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: fileRole === 'original' ? '原始PPT上传成功' : '参考答案PPT上传成功',
      data: activity.pptGradingSettings
    });
  } catch (error) {
    logger.error('上传PPT批阅文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '上传PPT批阅文件失败', error: error.message });
  }
};

exports.updatePptGradingSettings = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId } = req.params;
    const { enabled, rules } = req.body;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    activity.pptGradingSettings = activity.pptGradingSettings || {};
    if (enabled !== undefined) activity.pptGradingSettings.enabled = !!enabled;
    if (Array.isArray(rules)) activity.pptGradingSettings.rules = normalizePptRules(rules);
    activity.pptGradingSettings.updatedAt = new Date();
    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: 'PPT批阅配置已保存',
      data: activity.pptGradingSettings
    });
  } catch (error) {
    logger.error('保存PPT批阅配置失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '保存PPT批阅配置失败', error: error.message });
  }
};

exports.regeneratePptGradingRules = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    if (!activity.pptGradingSettings?.referenceFile?.path) {
      return res.status(400).json({ success: false, message: '请先上传参考答案PPT' });
    }

    activity.pptGradingSettings.rules = await regeneratePptRules(activity);
    activity.pptGradingSettings.enabled = true;
    activity.pptGradingSettings.updatedAt = new Date();
    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: '得分点已重新解析',
      data: activity.pptGradingSettings
    });
  } catch (error) {
    logger.error('重新解析PPT得分点失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '重新解析PPT得分点失败', error: error.message });
  }
};

exports.downloadPptGradingFile = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId, fileRole } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const fileInfo = fileRole === 'original'
      ? activity.pptGradingSettings?.originalFile
      : activity.pptGradingSettings?.referenceFile;

    if (!fileInfo?.path) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const absolutePath = resolveStoredPath(fileInfo.path);
    await fs.access(absolutePath);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileInfo.originalName || fileInfo.filename || 'ppt-grading.pptx')}`);
    res.sendFile(absolutePath);
  } catch (error) {
    logger.error('下载PPT批阅文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '下载PPT批阅文件失败', error: error.message });
  }
};

// 更新课时
exports.updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const updates = req.body;

    const lesson = await Lesson.findByIdAndUpdate(
      lessonId,
      updates,
      { new: true, runValidators: true }
    );

    if (!lesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 删除课时
exports.deleteLesson = async (req, res) => {
  try {
    const { lessonId, unitId } = req.params;

    logger.info('删除课时请求', { lessonId, unitId });

    // 检查课时是否存在
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      logger.warn('课时不存在', { lessonId });
      return res.status(404).json({
        success: false,
        message: '课时不存在'
      });
    }

    // 获取课程ID
    const courseId = lesson.course.toString();

    // 删除所有相关的资源文件
    const uploadDir = path.join(__dirname, '../../uploads');

    // 删除课时资源
    if (lesson.resources && lesson.resources.length > 0) {
      for (const resource of lesson.resources) {
        try {
          const filePath = path.join(uploadDir, resource.path);
          await fs.unlink(filePath);
          logger.info('已删除课时资源文件', { path: resource.path });
        } catch (error) {
          logger.error('删除课时资源文件失败', { path: resource.path, error: error.message });
          // 继续删除其他文件，不中断流程
        }
      }
    }

    // 删除活动中的资源
    if (lesson.activities && lesson.activities.length > 0) {
      for (const activity of lesson.activities) {
        if (activity.resources && activity.resources.length > 0) {
          for (const resource of activity.resources) {
            try {
              const filePath = path.join(uploadDir, resource.path);
              await fs.unlink(filePath);
              logger.info('已删除活动资源文件', { path: resource.path });
            } catch (error) {
              logger.error('删除活动资源文件失败', { path: resource.path, error: error.message });
              // 继续删除其他文件，不中断流程
            }
          }
        }
      }
    }

    // 删除课时相关的媒体文件夹
    try {
      const mediaDir = path.join(uploadDir, 'public/media', courseId, unitId, lessonId);
      logger.info('尝试删除课时媒体文件夹', { mediaDir });

      // 检查媒体目录是否存在
      const mediaDirExists = await fs.access(mediaDir).then(() => true).catch(() => false);

      if (mediaDirExists) {
        // 递归删除目录及其内容
        await fs.rm(mediaDir, { recursive: true, force: true });
        logger.info('课时媒体文件夹删除成功', { mediaDir });
      } else {
        logger.info('课时媒体文件夹不存在，无需删除', { mediaDir });
      }
    } catch (mediaError) {
      // 记录错误但不中断流程
      logger.error('删除课时媒体文件夹失败', {
        error: mediaError.message,
        stack: mediaError.stack,
        lessonId
      });
      // 继续删除课时，即使媒体文件删除失败
    }

    // 删除课时
    await Lesson.findByIdAndDelete(lessonId);

    // 检查单元是否还有其他课时
    const remainingLessons = await Lesson.countDocuments({ unit: unitId });

    // 如果没有其他课时，更新单元状态
    if (remainingLessons === 0) {
      await CourseUnit.findByIdAndUpdate(
        unitId,
        { 'interactive.hasLesson': false }
      );
    }

    logger.info('课时及其所有资源已删除', { lessonId });
    res.json({
      success: true,
      message: '课时及其所有资源已删除'
    });
  } catch (error) {
    logger.error('删除课时失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '删除课时失败',
      error: error.message
    });
  }
};

// 获取单元的所有课时
exports.getUnitLessons = async (req, res) => {
  try {
    const { unitId } = req.params;

    let query = { unit: unitId };

    // 如果用户已登录且是学生，只返回已发布的课时
    if (req.user && req.user.role === 'student') {
      query.status = 'published';
    }

    // 只选择必要的字段：id、标题、顺序、状态和活动列表
    const lessons = await Lesson.find(query)
      .select('_id title order status activities')
      .populate('activities.quizSettings.quiz', 'status')
      .sort('order');

    res.json({
      success: true,
      data: lessons
    });
  } catch (error) {
    console.error('获取单元课时失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新课时教学计划
exports.updateTeachingPlan = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { teachingPlan } = req.body;

    const lesson = await Lesson.findByIdAndUpdate(
      lessonId,
      { teachingPlan },
      { new: true, runValidators: true }
    );

    if (!lesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新课时资源
exports.updateResources = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { resources } = req.body;

    const lesson = await Lesson.findByIdAndUpdate(
      lessonId,
      { resources },
      { new: true, runValidators: true }
    );

    if (!lesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取课时统计数据
exports.getLessonAnalytics = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    // 这里可以添加更多统计数据的计算逻辑
    const analytics = {
      ...lesson.analytics,
      totalViews: await calculateTotalViews(lessonId),
      averageRating: await calculateAverageRating(lessonId),
      completionRate: await calculateCompletionRate(lessonId)
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 辅助函数：计算总观看次数
const calculateTotalViews = async (lessonId) => {
  // 实现观看次数统计逻辑
  return 0;
};

// 辅助函数：计算平均评分
const calculateAverageRating = async (lessonId) => {
  // 实现评分计算逻辑
  return 0;
};

// 辅助函数：计算完成率
const calculateCompletionRate = async (lessonId) => {
  // 实现完成率计算逻辑
  return 0;
};

// 更新课时顺序
exports.updateLessonsOrder = async (req, res) => {
  try {
    const { lessons } = req.body;

    if (!lessons || !Array.isArray(lessons)) {
      return res.status(400).json({ message: '请提供有效的课时顺序数据' });
    }

    // 使用 Promise.all 批量更新课时顺序
    await Promise.all(
      lessons.map(({ lessonId, order }) =>
        Lesson.findByIdAndUpdate(
          lessonId,
          { order },
          { new: true }
        )
      )
    );

    res.json({ message: '课时顺序更新成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新课时状态
exports.updateLessonStatus = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { status } = req.body;

    // 验证状态值是否有效
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的状态值' });
    }

    // 更新课时状态
    const updatedLesson = await Lesson.findByIdAndUpdate(
      lessonId,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedLesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    res.json(updatedLesson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取教师的所有课程小节
exports.getTeacherLessons = async (req, res) => {
  try {
    // 获取当前教师的ID
    const teacherId = req.user._id;

    // 1. 首先查找教师负责的所有课程
    const teacherCourses = await Course.find({ instructor: teacherId })
      .select('_id');

    if (!teacherCourses.length) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 2. 获取这些课程的ID数组
    const courseIds = teacherCourses.map(course => course._id);

    // 3. 查找这些课程下的所有小节
    const lessons = await Lesson.find({
      course: { $in: courseIds }
    })
      .select('title _id')
      .sort('title');

    res.json({
      success: true,
      data: lessons
    });

  } catch (error) {
    console.error('获取教师课程小节失败:', error);
    res.status(500).json({
      success: false,
      message: '获取教师课程小节失败',
      error: error.message
    });
  }
};

// 更新活动发布状态
exports.updateActivityPublishStatus = async (req, res) => {
  try {
    const { lessonId, activityId } = req.params;
    const { isPublished } = req.body;

    // 记录请求信息
    logger.info('更新活动发布状态', { lessonId, activityId, isPublished });

    // 查找课时
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: '课时不存在' });
    }

    // 查找活动并更新发布状态
    const activity = lesson.activities.id(activityId);
    if (!activity) {
      return res.status(404).json({ message: '活动不存在' });
    }

    activity.isPublished = isPublished;
    await lesson.save();

    res.json({
      success: true,
      message: '活动发布状态更新成功',
      data: activity
    });
  } catch (error) {
    logger.error('更新活动发布状态失败', { error: error.message, stack: error.stack }); // 记录错误信息
    res.status(500).json({
      success: false,
      message: error.message || '更新活动发布状态失败'
    });
  }
};

// 更新活动详情
exports.updateActivityDetails = async (req, res) => {
  try {
    const { lessonId, activityId } = req.params;
    const { description, referenceAnswer } = req.body;

    // 记录请求信息
    logger.info('更新活动详情', { lessonId, activityId, hasDescription: !!description, hasReferenceAnswer: !!referenceAnswer });

    // 查找课时
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      logger.warn('课时不存在', { lessonId });
      return res.status(404).json({
        success: false,
        message: '课时不存在'
      });
    }

    // 查找活动并更新详情
    const activity = lesson.activities.id(activityId);
    if (!activity) {
      logger.warn('活动不存在', { lessonId, activityId });
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }

    // 更新字段
    if (description !== undefined) {
      activity.description = description;
    }

    if (referenceAnswer !== undefined) {
      activity.referenceAnswer = referenceAnswer;
    }

    // 支持更新Python设置（如测试用例隐藏状态）
    if (req.body.pythonSettings) {
      // 如果提供了pythonSettings，合并或更新
      // 这里主要用于更新测试用例的隐藏状态
      if (!activity.pythonSettings) {
        activity.pythonSettings = {};
      }

      const { testCases, ...otherSettings } = req.body.pythonSettings;

      // 更新基本设置
      Object.assign(activity.pythonSettings, otherSettings);

      // 如果提供了testCases，则更新
      if (testCases && Array.isArray(testCases)) {
        activity.pythonSettings.testCases = testCases;
      }

      // 标记为已修改，因为混合类型可能不会自动检测到变化
      activity.markModified('pythonSettings');
    }

    // 保存更改
    await lesson.save();

    logger.info('活动详情更新成功', { lessonId, activityId });
    res.json({
      success: true,
      message: '活动详情更新成功',
      data: activity
    });
  } catch (error) {
    logger.error('更新活动详情失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message || '更新活动详情失败'
    });
  }
};

// 导出单个课时
exports.exportLesson = async (req, res) => {
  let exportTempDir;
  let exportZipPath;
  try {
    const { lessonId } = req.params;
    const mode = req.query.mode || 'full';
    if (!['full', 'content', 'media'].includes(mode)) return res.status(400).json({ message: '无效的导出方式' });

    // 1. 获取课时数据
    const Lesson = mongoose.model('Lesson');
    const lesson = await Lesson.findById(lessonId).populate({
      path: 'unit',
      populate: {
        path: 'course'
      }
    });

    if (!lesson) {
      logger.warn('导出课时失败：课时不存在', { lessonId });
      return res.status(404).json({ message: '课时不存在' });
    }

    const course = lesson.unit.course;

    // 检查权限（只有课程创建者或管理员可以导出）
    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      logger.warn('导出课时失败：权限不足', {
        userId: req.user._id,
        role: req.user.role,
        instructorId: course.instructor
      });
      return res.status(403).json({ message: '您没有权限导出此课时' });
    }

    // 2. 收集所有测验ID和打字文本ID
    const quizIds = [];
    const typingTextIds = [];
    const resourcePaths = [];
    const questionIds = []; // 收集所有题目ID

    lesson.activities.forEach(activity => {
      if (activity.type === 'quiz' && activity.quizSettings?.quiz) {
        quizIds.push(activity.quizSettings.quiz._id);
      }
      if (activity.type === 'typing' && activity.typingSettings?.text) {
        typingTextIds.push(activity.typingSettings.text._id);
      }
      if (activity.resources && activity.resources.length > 0) {
        console.log(`活动 "${activity.title}" 的资源:`, activity.resources);
        activity.resources.forEach(resource => {
          if (resource.path) {
            resourcePaths.push(resource.path);
            console.log(`添加资源路径: ${resource.path}`);
          }
        });
      }
    });

    console.log('收集的资源路径:', resourcePaths);

    // 3. 获取所有测验数据
    const Quiz = mongoose.model('Quiz');
    const quizzes = await Quiz.find({ _id: { $in: quizIds } });
    console.log('获取到测验数据:', quizzes.length, '个');

    // 收集所有测验中的题目ID
    quizzes.forEach(quiz => {
      if (quiz.questions && quiz.questions.length > 0) {
        quiz.questions.forEach(question => {
          if (question.questionId) {
            questionIds.push(question.questionId);
          }
        });
      }
    });
    console.log('收集的题目ID:', questionIds.length, '个');

    // 获取所有题目数据
    const Question = mongoose.model('Question');
    const questions = await Question.find({ _id: { $in: questionIds } });
    console.log('获取到题目数据:', questions.length, '个');

    // 4. 获取所有打字文本数据
    const TypingText = mongoose.model('TypingText');
    const typingTexts = await TypingText.find({ _id: { $in: typingTextIds } });
    console.log('获取到打字文本数据:', typingTexts.length, '个');

    // 5. 准备导出数据
    const exportData = {
      lesson: lesson.toObject(),
      quizzes: quizzes.map(quiz => quiz.toObject()),
      typingTexts: typingTexts.map(text => text.toObject()),
      questions: questions.map(question => question.toObject()), // 导出题目数据
      resourcePaths
    };

    // 6. 创建临时目录存放资源文件
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    const tempBaseDir = path.join(os.tmpdir(), 'ai-chat-edu-temp');
    const tempDir = path.join(tempBaseDir, `lesson_${lessonId}_${require("crypto").randomUUID()}`);
    exportTempDir = tempDir;
    console.log('创建临时目录:', tempDir);

    try {
      await fs.mkdir(tempBaseDir, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });
      console.log('临时目录创建成功');
    } catch (err) {
      console.error('创建临时目录失败:', err);
      throw err;
    }

    // 7. 复制资源文件到临时目录
    const resourceDir = path.join(tempDir, 'resources');
    try {
      await fs.mkdir(resourceDir, { recursive: true });
      console.log('资源目录创建成功:', resourceDir);
    } catch (err) {
      console.error('创建资源目录失败:', err);
      throw err;
    }

    // 创建媒体文件目录
    const mediaDir = path.join(tempDir, 'media');
    const lessonMediaDir = path.join(mediaDir, 'lesson');
    const questionsMediaDir = path.join(mediaDir, 'questions');
    try {
      await fs.mkdir(mediaDir, { recursive: true });
      await fs.mkdir(lessonMediaDir, { recursive: true });
      await fs.mkdir(questionsMediaDir, { recursive: true });
      logger.info('媒体目录创建成功', { mediaDir, lessonMediaDir, questionsMediaDir });
    } catch (err) {
      logger.error('创建媒体目录失败', { error: err.message });
      throw err;
    }

    // 记录导出的媒体文件信息，用于跟踪关系
    const mediaFileMap = {
      lesson: [],
      questions: {}
    };

    const manifest = await portableMedia.collect(exportData, tempDir, mode !== 'content');
    await fs.writeFile(path.join(tempDir, 'media_manifest.json'), JSON.stringify({ ...manifest, mediaOnly: mode === 'media' }));

    for (const resourcePath of (mode === 'media' ? [] : resourcePaths)) {
      try {
        // 修正资源文件路径
        let sourcePath;
        if (resourcePath.startsWith('resources/')) {
          // 如果路径以resources/开头，文件位于uploads目录下
          sourcePath = path.join(__dirname, '../../uploads', resourcePath);
        } else {
          // 其他情况，使用原始路径
          sourcePath = path.join(__dirname, '../../', resourcePath);
        }

        const fileName = path.basename(resourcePath);
        const destPath = path.join(resourceDir, fileName);
        console.log('复制资源文件:', { from: sourcePath, to: destPath });

        // 检查文件是否存在
        try {
          await fs.access(sourcePath);
        } catch (err) {
          console.error(`资源文件不存在: ${sourcePath}`, err);
          continue; // 跳过不存在的文件
        }

        await fs.copyFile(sourcePath, destPath);
        console.log(`资源文件复制成功: ${fileName}`);
      } catch (error) {
        console.error(`复制文件失败: ${resourcePath}`, error);
        logger.error(`复制文件失败: ${resourcePath}`, { error: error.message });
      }
    }

    // 将媒体文件映射信息写入文件，用于导入时参考
    const mediaMapPath = path.join(mediaDir, 'media_map.json');
    try {
      await fs.writeFile(mediaMapPath, JSON.stringify(mediaFileMap, null, 2));
      logger.info('媒体文件映射信息保存成功', { path: mediaMapPath });
    } catch (err) {
      logger.error('保存媒体文件映射信息失败', { error: err.message });
      // 继续流程，不中断导出
    }

    // 8. 将导出数据写入JSON文件
    const dataPath = path.join(tempDir, 'lesson_data.json');
    console.log('写入数据文件:', dataPath);
    try {
      if (mode !== 'media') await fs.writeFile(dataPath, JSON.stringify(exportData, null, 2));
      console.log('数据文件写入成功');
    } catch (err) {
      console.error('写入数据文件失败:', err);
      throw err;
    }

    // 9. 创建ZIP文件
    const zipPath = path.join(tempBaseDir, `lesson_${lessonId}_${Date.now()}.zip`);
    exportZipPath = zipPath;
    console.log('创建ZIP文件:', zipPath);

    // 使用archiver创建ZIP文件
    const archiver = require('archiver');
    const fs_stream = require('fs');
    const output = fs_stream.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.once('close', resolve);
      output.once('error', reject);
      archive.once('error', reject);
      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize().catch(reject);
    });
    res.download(zipPath, `lesson_${lesson.title}_${mode}.zip`, async error => {
      if (error && !res.headersSent) res.status(500).json({ message: '下载课时包失败' });
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await fs.unlink(zipPath).catch(() => {});
    });

    logger.info('课时导出成功', {
      lessonId,
      userId: req.user._id,
      quizCount: quizzes.length,
      typingTextCount: typingTexts.length,
      resourceCount: resourcePaths.length,
      mediaCount: new Set(manifest.assets.map(asset => asset.name)).size
    });

  } catch (error) {
    if (exportTempDir) await fs.rm(exportTempDir, { recursive: true, force: true }).catch(() => {});
    if (exportZipPath) await fs.unlink(exportZipPath).catch(() => {});
    logger.error('导出课时失败:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '导出课时失败', error: error.message });
  }
};

// 导入课时到指定单元
exports.importLesson = async (req, res) => {
  try {
    const { unitId } = req.params; // 目标单元ID

    // 1. 验证单元存在
    const unit = await CourseUnit.findById(unitId);
    if (!unit) {
      logger.warn('导入课时失败：单元不存在', { unitId });
      return res.status(404).json({ message: '课程单元不存在' });
    }

    // 检查权限（只有课程创建者或管理员可以导入）
    const course = await Course.findById(unit.course);
    if (!course) {
      logger.warn('导入课时失败：课程不存在', { courseId: unit.course });
      return res.status(404).json({ message: '课程不存在' });
    }

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      logger.warn('导入课时失败：权限不足', {
        userId: req.user._id,
        role: req.user.role,
        instructorId: course.instructor
      });
      return res.status(403).json({ message: '您没有权限导入课时到此单元' });
    }

    // 2. 接收上传的文件
    if (!req.file) {
      logger.warn('导入课时失败：未上传文件', { userId: req.user._id });
      return res.status(400).json({ message: '请上传课时数据包' });
    }

    const fs = require('fs').promises;
    const path = require('path');
    const zipPath = req.file.path;
    const extractDir = path.join(__dirname, '../../temp', `import_lesson_${require("crypto").randomUUID()}`);

    try {
      // 3. 解压ZIP文件
      await fs.mkdir(extractDir, { recursive: true });
      const extract = require('extract-zip');
      await extract(zipPath, { dir: extractDir });

      // 4. 读取课时数据
      const dataPath = path.join(extractDir, 'lesson_data.json');
      let manifest;
      try { manifest = JSON.parse(await fs.readFile(path.join(extractDir, 'media_manifest.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      let mediaResult;
      if (manifest) {
        mediaResult = await portableMedia.restore(manifest, extractDir);
        if (manifest.mediaOnly) {
          if (mediaResult.missing.length) throw new Error('媒体包不完整');
          return res.json({ success: true, mediaOnly: true, message: '媒体已导入，相关课时的引用已自动关联' });
        }
      }
      let lessonData = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      if (!manifest) {
        manifest = await portableMedia.legacyManifest(lessonData, extractDir);
        mediaResult = await portableMedia.restore(manifest, extractDir);
      }
      lessonData = mediaResult.rewrite(lessonData);

      // 记录导入数据的结构，帮助调试
      console.log('导入数据结构:', {
        hasLesson: !!lessonData.lesson,
        hasQuizzes: Array.isArray(lessonData.quizzes) ? lessonData.quizzes.length : 0,
        hasQuestions: Array.isArray(lessonData.questions) ? lessonData.questions.length : 0,
        hasTypingTexts: Array.isArray(lessonData.typingTexts) ? lessonData.typingTexts.length : 0,
        hasResourcePaths: Array.isArray(lessonData.resourcePaths) ? lessonData.resourcePaths.length : 0
      });

      // 5. 创建ID映射表
      const idMappings = {
        quizzes: {},
        questions: {},
        typingTexts: {},
        resources: {}
      };

      // 6. 导入题目
      const Question = mongoose.model('Question');
      if (lessonData.questions && Array.isArray(lessonData.questions) && lessonData.questions.length > 0) {
        console.log(`开始导入 ${lessonData.questions.length} 个题目`);

        // 记录第一个题目的结构，帮助调试
        if (lessonData.questions[0]) {
          console.log('题目数据示例:', {
            id: lessonData.questions[0]._id,
            content: lessonData.questions[0].content,
            type: lessonData.questions[0].type,
            hasOptions: Array.isArray(lessonData.questions[0].options) ? lessonData.questions[0].options.length : 0
          });
        }

        for (const question of lessonData.questions) {
          try {
            // 检查题目是否已存在（通过内容和类型匹配）
            const existingQuestion = await Question.findOne({
              content: question.content,
              type: question.type
            });

            if (existingQuestion) {
              // 如果题目已存在，使用已有题目
              idMappings.questions[question._id] = existingQuestion._id;
              console.log(`题目已存在，使用已有题目: ${existingQuestion._id}`);
            } else {
              // 如果题目不存在，创建新题目
              const questionInfo = { ...question };
              const oldId = questionInfo._id;
              delete questionInfo._id;
              // 同时删除id字段，防止重复键错误
              delete questionInfo.id;
              questionInfo.createdBy = req.user._id;

              const newQuestion = new Question(questionInfo);
              await newQuestion.save();

              idMappings.questions[oldId] = newQuestion._id;
              console.log(`创建新题目: ${newQuestion._id}`);
            }
          } catch (questionError) {
            console.error(`导入题目失败:`, questionError);
            logger.error(`导入题目失败`, { error: questionError.message, questionContent: question.content });
          }
        }
      } else {
        console.log('没有题目需要导入或题目数据格式不正确:', {
          questions: lessonData.questions,
          isArray: Array.isArray(lessonData.questions),
          length: lessonData.questions ? lessonData.questions.length : 0
        });
      }

      // 7. 导入测验
      const Quiz = mongoose.model('Quiz');
      if (lessonData.quizzes && Array.isArray(lessonData.quizzes) && lessonData.quizzes.length > 0) {
        console.log(`开始导入 ${lessonData.quizzes.length} 个测验`);

        // 记录第一个测验的结构，帮助调试
        if (lessonData.quizzes[0]) {
          console.log('测验数据示例:', {
            id: lessonData.quizzes[0]._id,
            title: lessonData.quizzes[0].title,
            hasQuestions: Array.isArray(lessonData.quizzes[0].questions) ? lessonData.quizzes[0].questions.length : 0
          });

          // 如果测验有问题，检查问题ID是否在映射表中
          if (lessonData.quizzes[0].questions && lessonData.quizzes[0].questions.length > 0) {
            const firstQuestionId = lessonData.quizzes[0].questions[0].questionId;
            console.log('第一个问题ID:', firstQuestionId);
            console.log('问题ID是否在映射表中:', !!idMappings.questions[firstQuestionId]);
            console.log('问题ID映射表部分内容:', Object.keys(idMappings.questions).slice(0, 5));
          }
        }

        for (const quiz of lessonData.quizzes) {
          try {
            const quizInfo = { ...quiz };
            const oldId = quizInfo._id;
            delete quizInfo._id;
            // 同时删除id字段，这是mongoose生成的虚拟字段，可能导致重复键错误
            delete quizInfo.id;

            // 检查是否存在当前用户创建的相同内容的测验
            // 主要比较标题、描述和包含的题目集合，设置可以不一致
            let existingQuiz = null;

            // 首先通过基本信息筛选可能的匹配
            const potentialQuizzes = await Quiz.find({
              title: quizInfo.title,
              createdBy: req.user._id // 只检查当前用户创建的测验
            }).populate('questions.questionId');

            if (potentialQuizzes.length > 0) {
              console.log(`找到 ${potentialQuizzes.length} 个可能匹配的测验`);

              // 准备导入测验的题目ID集合（使用映射后的ID）
              const importQuestionIds = new Set();
              if (quizInfo.questions && quizInfo.questions.length > 0) {
                quizInfo.questions.forEach(q => {
                  const oldQuestionId = q.questionId ? (typeof q.questionId === 'object' ? q.questionId.toString() : q.questionId) : null;
                  const newQuestionId = oldQuestionId && idMappings.questions[oldQuestionId]
                    ? idMappings.questions[oldQuestionId].toString()
                    : oldQuestionId;
                  if (newQuestionId) {
                    importQuestionIds.add(newQuestionId);
                  }
                });
              }

              // 检查每个潜在匹配的测验
              for (const quiz of potentialQuizzes) {
                console.log(`检查测验 "${quiz.title}"`);
                // 检查描述是否匹配
                if (quiz.description !== quizInfo.description) {
                  console.log(`描述不匹配: "${quiz.description}" vs "${quizInfo.description}"`);
                  continue;
                }

                // 检查题目集合是否匹配
                const quizQuestionIds = new Set();
                if (quiz.questions && quiz.questions.length > 0) {
                  quiz.questions.forEach(q => {
                    if (q.questionId) {
                      // 确保获取的是ID字符串，而不是整个对象
                      const qId = typeof q.questionId === 'object' ? q.questionId._id.toString() : q.questionId.toString();
                      quizQuestionIds.add(qId);
                      console.log(`现有测验题目ID: ${qId}`);
                    }
                  });
                }

                // 比较题目集合大小
                if (quizQuestionIds.size !== importQuestionIds.size) {
                  console.log(`题目数量不匹配: ${quizQuestionIds.size} vs ${importQuestionIds.size}`);
                  continue;
                }

                // 检查题目是否完全匹配
                let allQuestionsMatch = true;
                let mismatchedQuestions = [];

                // 打印所有导入题目ID和现有题目ID，帮助调试
                console.log('导入题目IDs:', Array.from(importQuestionIds));
                console.log('现有题目IDs:', Array.from(quizQuestionIds));


                for (const id of importQuestionIds) {
                  // 确保比较的是字符串形式的ID
                  const idStr = id.toString();
                  if (!quizQuestionIds.has(idStr)) {
                    allQuestionsMatch = false;
                    mismatchedQuestions.push(idStr);
                    console.log(`导入测验题目 ${idStr} 不在现有测验中`);
                  }
                }


                if (!allQuestionsMatch) {
                  console.log(`题目不完全匹配，不匹配的题目: ${mismatchedQuestions.join(', ')}`);
                  continue;
                }

                if (allQuestionsMatch) {
                  existingQuiz = quiz;
                  console.log(`找到题目集合完全匹配的测验: ${existingQuiz._id}`);
                  break;
                }
              }
            }

            let newQuizId;

            if (existingQuiz) {
              // 如果当前用户已有完全匹配的测验，使用现有测验
              newQuizId = existingQuiz._id;
              console.log(`用户已有相同测验，使用现有测验: ${newQuizId}`);

              // 更新映射表
              idMappings.quizzes[oldId] = newQuizId;
            } else {
              // 设置创建者为当前用户
              quizInfo.createdBy = req.user._id;

              // 更新测验中的题目引用
              if (quizInfo.questions && quizInfo.questions.length > 0) {
                console.log(`处理测验中的 ${quizInfo.questions.length} 个题目引用`);

                // 使用for...of循环代替map，允许我们使用await
                const updatedQuestions = [];
                for (const q of quizInfo.questions) {
                  const oldQuestionId = q.questionId ? (typeof q.questionId === 'object' ? q.questionId.toString() : q.questionId) : null;

                  // 删除题目中的_id字段，防止重复键错误
                  delete q._id;

                  let newQuestionId = null;

                  if (oldQuestionId && idMappings.questions[oldQuestionId]) {
                    // 如果映射表中已有此题目ID的映射，使用映射的ID
                    newQuestionId = idMappings.questions[oldQuestionId];
                    console.log(`使用映射表中的题目ID: ${oldQuestionId} -> ${newQuestionId}`);
                  } else if (oldQuestionId) {
                    // 如果映射表中没有此题目ID的映射，尝试查找题目
                    try {
                      console.log(`尝试查找题目: ${oldQuestionId}`);
                      const question = await Question.findById(oldQuestionId);
                      if (question) {
                        // 如果题目存在，直接使用原ID
                        idMappings.questions[oldQuestionId] = oldQuestionId;
                        newQuestionId = oldQuestionId;
                        console.log(`找到现有题目 ${oldQuestionId}，添加到映射表`);
                      } else {
                        console.warn(`题目 ${oldQuestionId} 不存在，跳过此题`);
                        continue; // 跳过此题
                      }
                    } catch (err) {
                      console.error(`查找题目失败: ${oldQuestionId}`, err);
                      continue; // 跳过此题
                    }
                  } else {
                    console.warn(`题目ID无效，跳过此题`);
                    continue; // 跳过此题
                  }

                  // 添加有效的题目到列表
                  updatedQuestions.push({
                    questionId: newQuestionId,
                    order: q.order
                  });
                }

                // 更新quizInfo中的questions
                quizInfo.questions = updatedQuestions;
                console.log(`更新后的题目列表长度: ${updatedQuestions.length}`);
              }

              // 创建新测验
              const newQuiz = new Quiz(quizInfo);
              await newQuiz.save();

              // 重新获取测验并填充题目关联，确保题目引用正确
              const savedQuiz = await Quiz.findById(newQuiz._id).populate('questions.questionId');

              newQuizId = newQuiz._id;
              idMappings.quizzes[oldId] = newQuizId;
              console.log(`创建新测验: ${newQuizId} (包含 ${newQuiz.questions ? newQuiz.questions.length : 0} 个题目)`);
            }
          } catch (quizError) {
            console.error(`导入测验失败:`, quizError);
            logger.error(`导入测验失败`, { error: quizError.message, quizTitle: quiz.title });
          }
        }
      } else {
        console.log('没有测验需要导入或测验数据格式不正确:', {
          quizzes: lessonData.quizzes,
          isArray: Array.isArray(lessonData.quizzes),
          length: lessonData.quizzes ? lessonData.quizzes.length : 0
        });
      }

      // 8. 导入打字文本
      const TypingText = mongoose.model('TypingText');
      for (const text of lessonData.typingTexts) {
        // 检查打字文本是否已存在（通过内容和分类匹配）
        const existingText = await TypingText.findOne({
          content: text.content,
          category: text.category || 'article'
        });

        if (existingText) {
          // 如果打字文本已存在，使用已有打字文本
          idMappings.typingTexts[text._id] = existingText._id;
          console.log(`打字文本已存在，使用已有打字文本: ${existingText._id}`);
        } else {
          // 如果打字文本不存在，创建新打字文本
          const textInfo = { ...text };
          const oldId = textInfo._id;
          delete textInfo._id;
          // 同时删除id字段，防止重复键错误
          delete textInfo.id;
          textInfo.createdBy = req.user._id;

          const newText = new TypingText(textInfo);
          await newText.save();

          idMappings.typingTexts[oldId] = newText._id;
          console.log(`创建新打字文本: ${newText._id}`);
        }
      }

      // 9. 导入资源文件
      const resourcesDir = path.join(extractDir, 'resources');
      // 创建课程和单元特定的资源目录
      const courseDir = path.join(__dirname, '../../uploads/resources', course._id.toString());
      const unitDir = path.join(courseDir, unitId);

      // 确保目录存在
      await fs.mkdir(courseDir, { recursive: true });
      await fs.mkdir(unitDir, { recursive: true });

      // 10. 获取当前单元的最大 order
      const maxOrderLesson = await Lesson.findOne({ unit: unitId })
        .sort({ order: -1 })
        .select('order');

      // 确保 order 是一个有效的数字
      const nextOrder = maxOrderLesson ? (maxOrderLesson.order || 0) + 1 : 1;

      // 11. 创建新课时
      const lessonInfo = { ...lessonData.lesson };
      lessonInfo.migrationMedia = [...new Map(manifest.assets.map(asset => [asset.name, { name: asset.name, size: asset.size }])).values()];
      delete lessonInfo._id;
      // 同时删除id字段，防止重复键错误
      delete lessonInfo.id;

      // 更新课程和单元引用
      lessonInfo.course = unit.course;
      lessonInfo.unit = unitId;
      lessonInfo.order = nextOrder;

      // 更新活动中的引用
      if (lessonInfo.activities && lessonInfo.activities.length > 0) {
        lessonInfo.activities = lessonInfo.activities.map(activity => {
          const newActivity = { ...activity };

          // 【重要】删除活动的 _id，让 Mongoose 自动生成新的 ID
          // 这样可以避免导入的课时中活动ID与原课时重复
          delete newActivity._id;
          delete newActivity.id;

          // 更新测验引用
          if (newActivity.type === 'quiz' && newActivity.quizSettings?.quiz) {
            const oldQuizId = typeof newActivity.quizSettings.quiz === 'object'
              ? newActivity.quizSettings.quiz._id
              : newActivity.quizSettings.quiz;

            if (oldQuizId && idMappings.quizzes[oldQuizId]) {
              newActivity.quizSettings.quiz = idMappings.quizzes[oldQuizId];
              console.log(`更新活动中的测验引用: ${oldQuizId} -> ${idMappings.quizzes[oldQuizId]}`);
            } else {
              console.warn(`未找到测验映射: ${oldQuizId}`);
            }
          }

          // 更新打字文本引用
          if (newActivity.type === 'typing' && newActivity.typingSettings?.text) {
            newActivity.typingSettings.text = idMappings.typingTexts[newActivity.typingSettings.text._id || newActivity.typingSettings.text];
          }

          // 更新资源文件路径
          if (newActivity.resources && newActivity.resources.length > 0) {
            newActivity.resources = newActivity.resources.map(resource => {
              const newResource = { ...resource };
              if (newResource.path && idMappings.resources[newResource.path]) {
                newResource.path = idMappings.resources[newResource.path];
              }
              return newResource;
            });
          }

          return newActivity;
        });
      }

      const newLesson = new Lesson(lessonInfo);
      await newLesson.save();

      // 创建新的资源目录路径
      const newResourceDir = path.join(unitDir, newLesson._id.toString());
      await fs.mkdir(newResourceDir, { recursive: true });

      for (const resourcePath of lessonData.resourcePaths) {
        const fileName = path.basename(resourcePath);
        const sourcePath = path.join(resourcesDir, fileName);

        // 新的资源路径
        const newRelativePath = `resources/${course._id}/${unitId}/${newLesson._id}/${fileName}`;
        const destPath = path.join(__dirname, '../../uploads', newRelativePath);

        try {
          console.log('复制导入的资源文件:', { from: sourcePath, to: destPath });
          await fs.copyFile(sourcePath, destPath);
          idMappings.resources[resourcePath] = newRelativePath;
          console.log(`资源文件导入成功: ${fileName} -> ${newRelativePath}`);
        } catch (error) {
          console.error(`复制资源文件失败: ${fileName}`, error);
          logger.error(`复制资源文件失败: ${fileName}`, { error: error.message });
        }
      }

      // 导入媒体文件
      const mediaDir = path.join(extractDir, 'media');
      try {
        // 检查媒体目录是否存在
        await fs.access(mediaDir);

        // 读取媒体文件映射信息，如果存在
        let mediaFileMap = null;
        try {
          const mediaMapPath = path.join(mediaDir, 'media_map.json');
          const mediaMapData = await fs.readFile(mediaMapPath, 'utf8');
          mediaFileMap = JSON.parse(mediaMapData);
          logger.info('读取到媒体文件映射信息', {
            lessonFilesCount: mediaFileMap.lesson.length,
            questionCount: Object.keys(mediaFileMap.questions).length
          });
        } catch (err) {
          logger.info('媒体文件映射信息不存在，将使用传统方式导入媒体文件');
        }

        // 1. 导入课时媒体文件
        const lessonMediaDir = path.join(mediaDir, 'lesson');
        try {
          await fs.access(lessonMediaDir);

          // 获取课时媒体文件目录下的所有文件
          let lessonMediaFiles;
          if (mediaFileMap && Array.isArray(mediaFileMap.lesson)) {
            // 使用映射信息
            lessonMediaFiles = mediaFileMap.lesson;
          } else {
            // 使用目录中的所有文件
            lessonMediaFiles = await fs.readdir(lessonMediaDir);
          }

          logger.info('找到课时媒体文件', { count: lessonMediaFiles.length });

          if (lessonMediaFiles.length > 0) {
            // 创建新课时媒体文件目录
            const courseId = course._id.toString();
            const lessonDestDir = path.join(__dirname, '../../uploads/public/media', courseId, unitId, newLesson._id.toString());
            await fs.mkdir(lessonDestDir, { recursive: true });
            logger.info('创建课时媒体目录', { lessonDestDir });

            // 复制每个课时媒体文件
            for (const file of lessonMediaFiles) {
              const srcPath = path.join(lessonMediaDir, file);
              const destPath = path.join(lessonDestDir, file);

              // 检查源文件存在性
              try {
                await fs.access(srcPath);
                const stat = await fs.stat(srcPath);
                if (!stat.isFile()) continue;

                // 检查目标文件是否已存在
                try {
                  await fs.access(destPath);
                  // 文件已存在，跳过
                  logger.info('课时媒体文件已存在，跳过导入', { file });
                } catch (accessErr) {
                  if (accessErr.code === 'ENOENT') {
                    // 文件不存在，复制
                    await fs.copyFile(srcPath, destPath);
                    logger.info('课时媒体文件导入成功', { file });
                  } else {
                    throw accessErr;
                  }
                }
              } catch (fileErr) {
                if (fileErr.code !== 'ENOENT') {
                  logger.error('处理课时媒体文件失败', { file, error: fileErr.message });
                }
              }
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') { // 忽略目录不存在的错误
            logger.error('导入课时媒体文件失败', { error: error.message });
          } else {
            logger.info('没有课时媒体文件需要导入');
          }
        }

        // 2. 导入题目媒体文件
        const questionsMediaDir = path.join(mediaDir, 'questions');
        try {
          await fs.access(questionsMediaDir);

          // 获取题目媒体目录下的所有题目目录
          const questionDirs = await fs.readdir(questionsMediaDir);
          logger.info('找到题目媒体目录', { count: questionDirs.length });

          // 处理每个题目目录
          for (const oldQuestionId of questionDirs) {
            const questionMediaDir = path.join(questionsMediaDir, oldQuestionId);

            // 检查是否为目录
            const stat = await fs.stat(questionMediaDir);
            if (!stat.isDirectory()) {
              continue;
            }

            // 检查这个题目ID是否在映射表中
            const newQuestionId = idMappings.questions[oldQuestionId];
            if (!newQuestionId) {
              logger.warn('找不到题目ID映射', { oldQuestionId });
              continue;
            }

            // 获取新题目的信息
            const question = await Question.findById(newQuestionId);
            if (!question) {
              logger.warn('新题目不存在', { oldQuestionId, newQuestionId });
              continue;
            }

            // 获取该题目的媒体文件列表
            let questionMediaFiles;
            if (mediaFileMap && mediaFileMap.questions && Array.isArray(mediaFileMap.questions[oldQuestionId])) {
              // 使用映射信息
              questionMediaFiles = mediaFileMap.questions[oldQuestionId];
            } else {
              // 使用目录中的所有文件
              questionMediaFiles = await fs.readdir(questionMediaDir);
            }

            if (questionMediaFiles.length === 0) {
              continue;
            }

            logger.info('找到题目媒体文件', {
              oldQuestionId,
              newQuestionId,
              count: questionMediaFiles.length
            });

            // 创建新题目的媒体目录
            const newQuestionMediaDir = path.join(__dirname, '../../uploads/public/media/question-bank', question.type, newQuestionId.toString());
            await fs.mkdir(newQuestionMediaDir, { recursive: true });

            // 复制每个媒体文件
            for (const file of questionMediaFiles) {
              const srcPath = path.join(questionMediaDir, file);

              // 检查源文件是否存在
              try {
                await fs.access(srcPath);
                const fileStat = await fs.stat(srcPath);
                if (!fileStat.isFile()) continue;

                const destPath = path.join(newQuestionMediaDir, file);

                // 检查目标文件是否已存在
                try {
                  await fs.access(destPath);
                  // 文件已存在，跳过复制
                  logger.info('题目媒体文件已存在，跳过导入', {
                    questionId: newQuestionId,
                    file
                  });
                } catch (err) {
                  if (err.code === 'ENOENT') {
                    // 文件不存在，直接复制
                    await fs.copyFile(srcPath, destPath);
                    logger.info('题目媒体文件导入成功', {
                      questionId: newQuestionId,
                      file
                    });
                  } else {
                    throw err;
                  }
                }
              } catch (fileErr) {
                if (fileErr.code !== 'ENOENT') {
                  logger.error('处理题目媒体文件失败', {
                    questionId: newQuestionId,
                    file,
                    error: fileErr.message
                  });
                }
              }
            }

            logger.info('题目媒体文件导入完成', {
              oldQuestionId,
              newQuestionId,
              fileCount: questionMediaFiles.length
            });
          }
        } catch (error) {
          if (error.code !== 'ENOENT') { // 忽略目录不存在的错误
            logger.error('导入题目媒体文件失败', { error: error.message });
          } else {
            logger.info('没有题目媒体文件需要导入');
          }
        }

      } catch (error) {
        if (error.code !== 'ENOENT') { // 忽略目录不存在的错误
          logger.error('导入媒体文件失败', { error: error.message });
        } else {
          logger.info('没有媒体文件需要导入');
        }
      }

      // 更新课时中的资源路径
      if (newLesson.activities && newLesson.activities.length > 0) {
        let updated = false;

        for (const activity of newLesson.activities) {
          if (activity.resources && activity.resources.length > 0) {
            for (const resource of activity.resources) {
              if (resource.path && idMappings.resources[resource.path]) {
                resource.path = idMappings.resources[resource.path];
                updated = true;
              }
            }
          }
        }

        if (updated) {
          await newLesson.save();
          console.log('更新了课时中的资源路径');
        }
      }

      logger.info('课时导入成功', {
        lessonId: newLesson._id,
        unitId,
        courseId: unit.course,
        userId: req.user._id
      });

      res.status(200).json({
        success: true,
        message: '课时导入成功',
        lessonId: newLesson._id,
        missingMedia: mediaResult.missing
      });
    } catch (error) {
      logger.error('课时导入失败:', { error: error.message, stack: error.stack });
      res.status(500).json({ message: '导入课时失败', error: error.message });
    } finally {
      // 确保无论成功或失败都清理临时文件
      try {
        const fsSync = require('fs');
        if (fsSync.existsSync(extractDir)) {
          await fs.rm(extractDir, { recursive: true, force: true });
          console.log(`清理临时目录: ${extractDir}`);
        }
        if (fsSync.existsSync(zipPath)) {
          await fs.unlink(zipPath);
          console.log(`清理临时ZIP文件: ${zipPath}`);
        }
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
        logger.error('清理临时文件失败', { error: cleanupError.message });
      }
    }
  } catch (error) {
    logger.error('课时导入处理失败', { error: error.message });
    res.status(500).json({ message: `课时导入处理失败: ${error.message}` });
  }
};

function normalizeExcelRules(rules = []) {
  return normalizeOfficeRuleScores(rules).map((rule, index) => ({
    ...rule,
    id: rule.id || `${rule.type || 'rule'}-${rule.slideNumber || 'all'}-${index}`,
    enabled: rule.enabled !== false,
    score: Number(rule.score ?? 1)
  }));
}

async function regenerateExcelRules(activity) {
  const settings = activity.excelGradingSettings || {};
  const originalPath = settings.originalFile?.path ? resolveStoredPath(settings.originalFile.path) : null;
  const referencePath = settings.referenceFile?.path ? resolveStoredPath(settings.referenceFile.path) : null;

  if (!referencePath) return [];
  const rules = await generateExcelGradeRules({ originalPath, referencePath });
  return normalizeExcelRules(rules);
}

exports.uploadExcelGradingFile = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的XLSX文件' });
    }

    const { lessonId, activityId } = req.params;
    const { fileRole } = req.body;

    if (!['original', 'reference'].includes(fileRole)) {
      return res.status(400).json({ success: false, message: '文件用途无效' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const originalName = decodeOriginalName(req.file.originalname);
    if (!/\.xlsx$/i.test(originalName)) {
      return res.status(400).json({ success: false, message: '目前仅支持XLSX文件' });
    }

    const relativePath = path.join('uploads/excel-grading', lessonId, activityId, req.file.filename).split(path.sep).join('/');
    const fileInfo = {
      filename: req.file.filename,
      originalName,
      path: relativePath,
      size: req.file.size,
      uploadedAt: new Date()
    };

    activity.excelGradingSettings = activity.excelGradingSettings || {};
    if (fileRole === 'original') {
      activity.excelGradingSettings.originalFile = fileInfo;
    } else {
      activity.excelGradingSettings.referenceFile = fileInfo;
    }
    activity.excelGradingSettings.enabled = true;
    activity.excelGradingSettings.updatedAt = new Date();

    if (activity.excelGradingSettings.referenceFile?.path && activity.excelGradingSettings.originalFile?.path) {
      activity.excelGradingSettings.rules = await regenerateExcelRules(activity);
    }

    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: fileRole === 'original' ? '原始Excel上传成功' : '参考答案Excel上传成功',
      data: activity.excelGradingSettings
    });
  } catch (error) {
    logger.error('上传Excel批阅文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '上传Excel批阅文件失败', error: error.message });
  }
};

exports.updateExcelGradingSettings = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId } = req.params;
    const { enabled, rules } = req.body;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    activity.excelGradingSettings = activity.excelGradingSettings || {};
    if (enabled !== undefined) activity.excelGradingSettings.enabled = !!enabled;
    if (Array.isArray(rules)) activity.excelGradingSettings.rules = normalizeExcelRules(rules);
    activity.excelGradingSettings.updatedAt = new Date();
    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: 'Excel批阅配置已保存',
      data: activity.excelGradingSettings
    });
  } catch (error) {
    logger.error('保存Excel批阅配置失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '保存Excel批阅配置失败', error: error.message });
  }
};

exports.regenerateExcelGradingRules = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    if (!activity.excelGradingSettings?.referenceFile?.path) {
      return res.status(400).json({ success: false, message: '请先上传参考答案Excel' });
    }

    activity.excelGradingSettings.rules = await regenerateExcelRules(activity);
    activity.excelGradingSettings.enabled = true;
    activity.excelGradingSettings.updatedAt = new Date();
    lesson.markModified('activities');
    await lesson.save();

    res.json({
      success: true,
      message: '得分点已重新解析',
      data: activity.excelGradingSettings
    });
  } catch (error) {
    logger.error('重新解析Excel得分点失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '重新解析Excel得分点失败', error: error.message });
  }
};

exports.downloadExcelGradingFile = async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const { lessonId, activityId, fileRole } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '课时不存在' });
    }

    const activity = getActivityById(lesson, activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const fileInfo = fileRole === 'original'
      ? activity.excelGradingSettings?.originalFile
      : activity.excelGradingSettings?.referenceFile;

    if (!fileInfo?.path) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const absolutePath = resolveStoredPath(fileInfo.path);
    await fs.access(absolutePath);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileInfo.originalName || fileInfo.filename || 'excel-grading.xlsx')}`);
    res.sendFile(absolutePath);
  } catch (error) {
    logger.error('下载Excel批阅文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '下载Excel批阅文件失败', error: error.message });
  }
};
