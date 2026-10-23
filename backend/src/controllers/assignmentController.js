// const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const QuizSubmission = require('../models/QuizSubmission');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const PythonSubmission = require('../models/PythonSubmission');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const jwt = require('jsonwebtoken');
const Class = require('../models/Class');
const User = require('../models/User');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const PointsManager = require('../utils/pointsManager');
const { runOfficeAutoGrade } = require('../services/officeSubmissionGrading');
const { isAutomaticGrade, isManualGrade } = require('../services/submissionGradePolicy');
const { withSubmissionLock } = require('../services/submissionLock');
const { safeDownloadPath } = require('../utils/safeDownloadPath');
const { checkAssignmentDownload } = require('../services/downloadAccess');

// 配置上传目录
const UPLOAD_DIR = path.join(__dirname, '../../uploads/assignments');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // 为每个课程/单元/课时/活动创建独特的目录
    const { courseId, unitId, lessonId, activityId } = req.params;
    const dir = path.join(UPLOAD_DIR, courseId, unitId, lessonId, activityId);

    try {
      await mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // 确保文件名是UTF-8编码
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 保留原始文件扩展名
    const ext = path.extname(originalName);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: (process.env.MAX_ASSIGNMENT_FILE_SIZE || 20) * 1024 * 1024, // 从环境变量读取，默认20MB
    files: 1 // 限制一次只能上传一个文件
  }
});

// 导出upload中间件
exports.upload = upload;



// 提交作业
exports.submitAssignment = async (req, res) => withSubmissionLock(
  [req.user._id, req.params.lessonId, req.params.activityId].join(':'), async () => {
  const file = req.file;
  let saved = false;
  const discardUpload = async () => { if (file?.path && !saved) await fs.promises.unlink(file.path).catch(() => {}); };
  try {
    const { courseId, unitId, lessonId, activityId } = req.params;
    if (!file) return res.status(400).json({success:false,message:'请选择要上传的文件'});
    const lesson = await Lesson.findById(lessonId);
    const activity = lesson?.activities.id(activityId);
    if (!activity || String(lesson.course) !== String(courseId) || String(lesson.unit) !== String(unitId)) {
      await discardUpload();
      return res.status(404).json({success:false,message:'未找到对应活动'});
    }
    const existing = await AssignmentSubmission.findOne({course:courseId,unit:unitId,lesson:lessonId,activity:activityId,student:req.user._id});
    if (isManualGrade(existing)) {
      await discardUpload();
      return res.status(403).json({success:false,message:'作业已由教师人工评分，不能重新提交覆盖'});
    }
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const storedFile = {filename:file.filename,originalName,path:path.relative(path.join(__dirname,'../..'),file.path).split(path.sep).join('/'),size:file.size,mimeType:file.mimetype,uploadedAt:new Date()};
    if (req.user.role !== 'student') {
      await discardUpload();
      return res.json({success:true,message:'模拟提交成功',submission:{content:{file:storedFile}}});
    }
    let submission;
    const oldFile = existing?.content?.file?.path;
    if (existing) {
      const previousPoints = Number(((existing.grade?.score ?? existing.aiGrade?.score ?? 0) * 10).toFixed(2));
      await PointsManager.reconcileAssignmentPoints(existing.student, previousPoints, existing._id, '迁移作业积分', previousPoints, true);
      submission = await AssignmentSubmission.findOneAndUpdate(
        {_id:existing._id,'content.file.filename':existing.content?.file?.filename,'grade.gradedAt':existing.grade?.gradedAt ?? null},
        {$set:{'content.file':storedFile,submittedAt:new Date(),status:'submitted'},$unset:{grade:1,aiGrade:1,pptAutoGrade:1,excelAutoGrade:1}},
        {new:true,runValidators:true}
      );
      if (!submission) { await discardUpload(); return res.status(409).json({success:false,message:'作业或评分已更新，请刷新后重试'}); }
    } else {
      submission = await AssignmentSubmission.create({student:req.user._id,course:courseId,unit:unitId,lesson:lessonId,activity:activityId,content:{file:storedFile},status:'submitted'});
    }
    saved = true;
    let autoGradeError;
    try {
      // Remove the superseded submission's award even if grading the new file fails.
      await PointsManager.syncAssignmentPoints(submission._id, '重新提交作业');
      const extension = path.extname(originalName).toLowerCase();
      const kind = extension === '.pptx' ? 'ppt' : extension === '.xlsx' ? 'excel' : null;
      if (kind && activity[kind + 'GradingSettings']?.enabled) {
        const graded = await runOfficeAutoGrade(submission, activity, kind);
        submission = graded.submission;
      } else if ((activity.pptGradingSettings?.enabled || activity.excelGradingSettings?.enabled) && !kind) {
        autoGradeError = '自动评阅需要PPTX或XLSX文件，请转换格式后重新提交';
      }
    } catch (error) {
      logger.error('上传后自动评阅失败', {submissionId:submission._id,error:error.message});
      autoGradeError = '文件已保存，自动评阅未完成，请联系教师重试';
      submission = await AssignmentSubmission.findById(submission._id);
    }
    // Delete the superseded file only after the replacement is safely stored.
    if (oldFile && oldFile !== storedFile.path) {
      const oldPath = resolveStoredPath(oldFile);
      if (oldPath && oldPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) await fs.promises.unlink(oldPath).catch(() => {});
    }
    res.json({success:true,message:autoGradeError || (submission.grade?.score != null ? '提交成功，自动评阅完成' : '作业提交成功'),autoGradeError,submission});
  } catch (error) {
    await discardUpload();
    logger.error('提交作业失败',{error:error.message});
    res.status(500).json({success:false,message:'提交作业失败',error:error.message});
  }
});

// 获取作业提交历史
exports.getSubmissionHistory = async (req, res) => {
  try {
    const { courseId, unitId, lessonId, activityId } = req.params;
    const studentId = req.user.id;

    logger.info('获取作业提交历史', {
      studentId,
      courseId,
      unitId,
      lessonId,
      activityId
    });

    const submissions = await AssignmentSubmission
      .find({
        course: courseId,
        unit: unitId,
        lesson: lessonId,
        activity: activityId,
        student: studentId
      })
      .sort('-submittedAt');

    logger.debug('查询到的提交记录', {
      count: submissions.length,
      studentId
    });

    res.json(submissions);
  } catch (error) {
    logger.error('获取提交历史失败', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });
    res.status(500).json({ message: error.message });
  }
};

// 获取作业提交详情
exports.getSubmissionDetail = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const studentId = req.user.id;  // 使用 id 字段

    const submission = await AssignmentSubmission
      .findOne({
        _id: submissionId,
        student: studentId
      });

    if (!submission) {
      return res.status(404).json({ message: '未找到提交记录' });
    }

    res.json(submission);
  } catch (error) {
    console.error('获取提交详情失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 下载作业文件
exports.downloadAssignmentFile = async (req, res) => {
  try {
    const absolutePath = await safeDownloadPath(UPLOAD_DIR, req.params[0]);
    await checkAssignmentDownload(req.user, absolutePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: '文件不存在' });
    }

    const fileName = path.basename(absolutePath);
    const ext = path.extname(fileName).toLowerCase();

    // MIME类型映射
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.py': 'text/plain',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    res.sendFile(absolutePath);
  } catch (error) {
    console.error('下载文件失败:', error);
    res.status(error.status || (error.code === 'ENOENT' ? 404 : 500)).json({ message: '文件不存在或无权访问' });
  }
};

// 通过提交ID下载作业文件
exports.downloadSubmissionFile = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const token = req.query.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: '请先登录' });
    }

    // 验证token
    let userId;
    let userRole;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      userRole = decoded.role;
    } catch (error) {
      return res.status(401).json({ message: '无效的token' });
    }

    const submission = await AssignmentSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: '未找到提交记录' });
    }

    // 权限检查：只有提交者本人或教师可以下载
    if (submission.student.toString() !== userId && userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ message: '无权限下载此文件' });
    }

    if (!submission.content?.file?.path) {
      return res.status(404).json({ message: '提交记录中没有文件' });
    }

    const absolutePath = path.join(__dirname, '../..', submission.content.file.path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: '文件不存在' });
    }

    const fileName = submission.content.file.originalName || path.basename(absolutePath);
    const mimeType = submission.content.file.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    res.sendFile(absolutePath);
  } catch (error) {
    console.error('下载提交文件失败:', error);
    res.status(500).json({ message: '下载文件失败', error: error.message });
  }
};

// 教师获取作业提交列表
exports.getSubmissionsByTeacher = async (req, res) => {
  try {
    const { courseId, unitId, lessonId, activityId } = req.params;

    logger.info('教师获取作业提交列表', {
      teacherId: req.user._id,
      courseId,
      unitId,
      lessonId,
      activityId
    });

    // 验证用户是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试访问作业提交列表', {
        userId: req.user._id,
        role: req.user.role
      });
      return res.status(403).json({ message: '无权限访问' });
    }

    // 获取提交记录并填充学生基本信息
    const submissions = await AssignmentSubmission
      .find({
        course: courseId,
        unit: unitId,
        lesson: lessonId,
        activity: activityId
      })
      .select('-pptAutoGrade.results -excelAutoGrade.results -previousVersions')
      .populate('student', 'name email avatar studentId username gender classId')
      .sort('-submittedAt');

    logger.debug('查询到的提交记录', {
      count: submissions.length,
      teacherId: req.user._id
    });

    // Student class IDs are already populated; avoid fetching the same users again.
    const classIds = [...new Set(submissions.filter(sub=>sub.student?.classId).map(sub=>sub.student.classId.toString()))];

    const classes = await Class.find({
      _id: { $in: classIds },
      status: { $ne: 'archived' }
    }).select('grade name _id');

    // 创建学生ID到班级的映射
    const studentClassMap = {};
    classes.forEach(cls => {
      studentClassMap[cls._id.toString()] = {
        grade: cls.grade,
        className: cls.name
      };
    });

    // 将班级信息添加到提交记录中，并过滤掉已归档班级的提交
    const submissionsWithClass = [];

    for (const submission of submissions) {
      const submissionObj = submission.toObject();
      for (const key of ['pptAutoGrade','excelAutoGrade']) {
        if(submissionObj[key]?.score != null) submissionObj[key]={...submissionObj[key],results:[],detailsLoaded:false};
      }

      // 检查student是否存在
      if (!submission.student) {
        logger.warn('提交记录关联的学生不存在', {
          submissionId: submission._id,
          courseId: submission.course,
          lessonId: submission.lesson
        });
        // 为不存在的学生添加占位信息
        submissionObj.student = {
          name: '已删除的用户',
          email: '',
          avatar: '',
          studentId: '',
          username: '',
          gender: '',
          classId: null,
          grade: '',
          className: ''
        };
        submissionsWithClass.push(submissionObj);
        continue;
      }

      // 添加班级信息
      const studentClassId = submission.student.classId?.toString();
      if (studentClassId) {
        if (studentClassMap[studentClassId]) {
          submissionObj.student.grade = studentClassMap[studentClassId].grade;
          submissionObj.student.className = studentClassMap[studentClassId].className;
          submissionsWithClass.push(submissionObj);
        }
        // 如果有班级ID但不在映射中（已被归档的班级），则直接丢弃该记录，不放入结果中
      } else {
        // 如果没有找到班级信息（未分配班级），设置为空值并保留
        submissionObj.student.grade = '';
        submissionObj.student.className = '';
        submissionsWithClass.push(submissionObj);
      }
    }

    res.json(submissionsWithClass);
  } catch (error) {
    logger.error('获取提交列表失败', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });
    res.status(500).json({ message: error.message });
  }
};

// 教师批阅作业
exports.gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { grade, aiGrade, status } = req.body;

    logger.info('开始批阅作业', {
      teacherId: req.user._id,
      submissionId,
      hasGrade: !!grade,
      hasAiGrade: !!aiGrade,
      status
    });

    // 验证用户是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试批阅作业', {
        userId: req.user._id,
        role: req.user.role
      });
      return res.status(403).json({ message: '无权限访问' });
    }

    const submission = await AssignmentSubmission.findById(submissionId);

    // 如果在AssignmentSubmission中未找到，尝试查找SpreadsheetSubmission
    if (!submission) {
      const spreadsheetSubmission = await SpreadsheetSubmission.findById(submissionId);

      if (!spreadsheetSubmission) {
        logger.warn('未找到提交记录', { submissionId });
        return res.status(404).json({ message: '未找到提交记录' });
      }

      // 处理SpreadsheetSubmission的评分
      const oldScore = spreadsheetSubmission.grade?.score;
      const studentId = spreadsheetSubmission.userId;

      // 如果score为null，则清除评分
      if (grade?.score === null) {
        spreadsheetSubmission.grade = null;
        spreadsheetSubmission.status = 'submitted';  // 恢复为已提交状态

        // 如果原先有评分，则需要扣除相应积分
        if (oldScore !== undefined && oldScore !== null) {
          try {
            const normalizedOldScore = Math.min(10, Math.max(0, Math.round(oldScore / 10)));
            await PointsManager.deductPoints(
              studentId,
              normalizedOldScore * 10,
              'task_completion_revoked',
              '作业评分已清除',
              submissionId
            );
            logger.info('清除评分时已扣除相应积分', { studentId, oldScore });
          } catch (pointsError) {
            logger.error('清除评分时扣除积分失败', { error: pointsError.message });
          }
        }
      } else {
        spreadsheetSubmission.grade = {
          score: grade?.score,
          feedback: grade?.feedback || '',
          gradedAt: new Date(),
          gradedBy: req.user._id
        };
        spreadsheetSubmission.status = 'graded';

        // 更新积分 (分数范围0-10，积分 = 分数 * 10)
        if (grade?.score !== undefined && grade?.score !== null) {
          try {
            // SpreadsheetSubmission的grade.score范围是0-100，需要转换为0-10
            const normalizedNewScore = Math.min(10, Math.max(0, Math.round(grade.score / 10)));
            const normalizedOldScore = oldScore !== undefined && oldScore !== null
              ? Math.min(10, Math.max(0, Math.round(oldScore / 10)))
              : null;

            await PointsManager.updatePoints(
              studentId,
              normalizedNewScore * 10,  // 新积分
              normalizedOldScore !== null ? normalizedOldScore * 10 : null, // 旧积分
              submissionId,
              'task_completion',
              `表格作业评分: ${normalizedNewScore}分`
            );
            logger.info('表格作业评分积分更新成功', {
              studentId,
              submissionId,
              score: grade.score,
              normalizedScore: normalizedNewScore
            });
          } catch (pointsError) {
            logger.error('表格作业评分积分更新失败', { error: pointsError.message });
          }
        }
      }

      await spreadsheetSubmission.save();

      logger.info(grade?.score === null ? '表格作业评分已清除' : '表格作业批阅完成', {
        submissionId,
        status: spreadsheetSubmission.status
      });

      return res.json({
        success: true,
        message: grade?.score === null ? '评分已清除' : '批阅成功',
        data: spreadsheetSubmission
      });
    }

    // 保存评分前的状态和分数，用于计算积分变化
    const oldStatus = submission.status;
    const oldScore = submission.grade?.score;
    const oldAiScore = submission.aiGrade?.score;
    const oldGradedAt = submission.grade?.gradedAt ?? null;
    const persistGrade = async () => {
      const updated = await AssignmentSubmission.findOneAndUpdate(
        {_id:submission._id,'content.file.filename':submission.content?.file?.filename,'grade.gradedAt':oldGradedAt},
        {$set:{grade:submission.grade || null,aiGrade:submission.aiGrade || null,status:submission.status,pptAutoGrade:submission.pptAutoGrade || null,excelAutoGrade:submission.excelAutoGrade || null}},
        {new:true,runValidators:true}
      );
      if (!updated) throw new Error('作业或评分已更新，请刷新后重试');
    };

    // 记录学生ID，用于后续积分处理
    const studentId = submission.student;
    const previousPoints = Number(((oldScore ?? oldAiScore ?? 0) * 10).toFixed(2));
    await PointsManager.reconcileAssignmentPoints(studentId, previousPoints, submissionId, '迁移作业积分', previousPoints, true);

    // 如果是清除评分的情况
    if (grade?.score === null && (!aiGrade || aiGrade.score === null)) {
      logger.info('清除作业评分', { submissionId });
      submission.grade = undefined;
      submission.aiGrade = undefined;
      submission.status = 'submitted';
      submission.pptAutoGrade = undefined;
      submission.excelAutoGrade = undefined;
      await persistGrade();

      // 如果原先有评分，则需要扣除相应积分
      if (oldScore != null || oldAiScore != null) {
        try {
          await PointsManager.syncAssignmentPoints(submissionId, '清除作业评分');
          logger.info('清除评分时已扣除相应积分', {
            studentId,
            oldScore,
            points: oldScore * 10
          });
        } catch (error) {
          logger.error('清除评分时扣除积分失败', {
            error: error.message,
            studentId,
            submissionId
          });
          // 继续处理，不因积分失败而中断主流程
        }
      }
    } else {
      // 正常评分的情况
      let newScore = null;

      if (grade) {
        logger.info('更新教师评分', {
          submissionId,
          score: grade.score,
          teacherId: req.user.id
        });
        submission.grade = {
          ...grade,
          source: 'manual',
          gradedBy: req.user.id,
          gradedAt: new Date()
        };
        newScore = grade.score;
      }

      if (aiGrade) {
        logger.info('更新AI评分', {
          submissionId,
          score: aiGrade.score
        });
        submission.aiGrade = aiGrade;

        // 如果没有教师评分，则使用AI评分作为最终分数
        if (!grade && aiGrade.score !== null && aiGrade.score !== undefined) {
          newScore = aiGrade.score;
        }
      }

      if (status) {
        submission.status = status;
      } else if (grade?.score !== undefined) {
        submission.status = 'graded';
      }

      await persistGrade();

      // 计算最终展示给学生的分数
      // 教师评分优先，其次是AI评分
      const finalScore = submission.grade?.score !== undefined ?
        submission.grade.score :
        submission.aiGrade?.score;

      // 处理积分变化
      if (finalScore !== undefined) {
        try {
          // 更新积分，参数为：学生ID、新分数、旧分数、提交ID、积分类型、描述
          await PointsManager.syncAssignmentPoints(submissionId, '作业评分');
          logger.info('已更新作业评分相关积分', {
            studentId,
            oldScore,
            oldAiScore,
            finalScore,
            points: finalScore * 10
          });
        } catch (error) {
          logger.error('更新作业评分积分失败', {
            error: error.message,
            studentId,
            submissionId
          });
          // 继续处理，不因积分失败而中断主流程
        }
      }
    }


    logger.info('作业批阅完成', {
      submissionId,
      status: submission.status
    });

    res.json({
      success: true,
      message: grade?.score === null ? '清除评分成功' : '批阅成功',
      data: submission
    });
  } catch (error) {
    logger.error('批阅作业失败', {
      error: error.message,
      stack: error.stack,
      submissionId: req.params.submissionId
    });
    res.status(500).json({ message: error.message });
  }
};

function resolveStoredPath(storedPath) {
  if (!storedPath) return null;
  if (path.isAbsolute(storedPath)) return storedPath;
  return path.join(__dirname, '../..', storedPath);
}

// 教师触发 PPT 自动批阅
exports.autoGradePptSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const submission = await AssignmentSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: '未找到提交记录' });
    }

    const studentFile = submission.content?.file;
    if (!studentFile?.path || !/\.pptx$/i.test(studentFile.originalName || studentFile.filename || '')) {
      return res.status(400).json({ success: false, message: '该提交不是PPTX文件，暂不支持自动批阅' });
    }

    const lesson = await Lesson.findById(submission.lesson);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '未找到课时' });
    }

    const activity = lesson.activities.id(submission.activity) ||
      lesson.activities.find(item => item._id?.toString() === submission.activity?.toString());
    if (!activity) {
      return res.status(404).json({ success: false, message: '未找到对应活动' });
    }

    const pptSettings = activity.pptGradingSettings || {};
    if (!pptSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: '该活动尚未开启PPT自动批阅。请先在活动编辑页上传原始PPT和参考答案PPT并保存得分点。'
      });
    }

    const studentPath = resolveStoredPath(studentFile.path);
    const referencePath = resolveStoredPath(pptSettings.referenceFile?.path);
    const originalPath = pptSettings.originalFile?.path ? resolveStoredPath(pptSettings.originalFile.path) : null;

    for (const [label, filePath] of [['学生PPT', studentPath], ['参考答案PPT', referencePath]]) {
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: `${label}文件不存在` });
      }
    }
    if (originalPath && !fs.existsSync(originalPath)) {
      return res.status(404).json({ success: false, message: '原始PPT文件不存在' });
    }

    const graded = await runOfficeAutoGrade(submission, activity, 'ppt', req.user._id);
    const result = graded.result;

    res.json({
      success: true,
      message: 'PPT自动批阅完成',
      data: {
        score: result.score,
        feedback: result.feedback,
        passedCount: result.passedCount,
        totalRules: result.totalRules,
        results: result.results,
        submission: graded.submission
      }
    });
  } catch (error) {
    logger.error('PPT自动批阅失败', {
      error: error.message,
      stack: error.stack,
      submissionId: req.params.submissionId
    });
    res.status(500).json({
      success: false,
      message: 'PPT自动批阅失败',
      error: error.message
    });
  }
};

// 获取PDF预览
exports.getPdfPreview = async (req, res) => {
  try {
    const { submissionId } = req.params;
    logger.info('请求预览提交ID:', { submissionId });

    const token = req.query.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      logger.error('未提供token');
      return res.status(401).json({ message: '请先登录', error: 'No token provided' });
    }

    // 验证token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.debug('token验证成功，用户ID:', { userId: decoded.id });
    } catch (error) {
      logger.error('token验证失败:', { error: error.message });
      return res.status(401).json({ message: '无效的token', error: error.message });
    }

    const submission = await AssignmentSubmission.findById(submissionId);
    if (!submission) {
      logger.warn('未找到提交记录:', { submissionId });
      return res.status(404).json({ message: '提交记录不存在' });
    }

    if (!submission.content.file) {
      logger.warn('提交记录中没有文件:', { submissionId });
      return res.status(404).json({ message: '提交记录中没有文件' });
    }

    const file = submission.content.file;
    logger.debug('文件信息:', {
      originalName: file.originalName,
      path: file.path,
      pdfPreviewPath: file.pdfPreviewPath,
      mimeType: file.mimeType
    });

    // 检查是否是Python或文本文件
    const fileExt = path.extname(file.originalName).toLowerCase();
    const isPythonOrText = fileExt === '.py' || file.mimeType === 'text/plain';

    if (isPythonOrText) {
      // 处理Python和文本文件
      const filePath = path.join(__dirname, '../..', file.path);

      if (!fs.existsSync(filePath)) {
        logger.warn('Python或文本文件不存在:', { filePath });
        return res.status(404).json({ message: '文件不存在' });
      }

      try {
        // 读取文件内容
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        // 即使文件为空，也返回一个空字符串，而不是报错
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(fileContent || ''); // 确保返回空字符串而不是null或undefined
      } catch (error) {
        logger.error('读取Python或文本文件失败:', { error: error.message, filePath });
        return res.status(500).json({ message: '读取文件失败', error: error.message });
      }
    }

    // 如果不是Python或文本文件，处理PDF预览
    // 如果有PDF预览路径，优先使用PDF预览路径，否则使用原始文件路径
    const previewPath = file.pdfPreviewPath || file.path;

    logger.debug('预览路径:', { previewPath });
    const absolutePath = path.join(__dirname, '../..', previewPath);
    logger.debug('绝对路径:', { absolutePath });

    if (!fs.existsSync(absolutePath)) {
      logger.warn('预览文件不存在:', { absolutePath });
      // 尝试直接使用原始文件
      const originalPath = path.join(__dirname, '../..', file.path);
      logger.debug('尝试使用原始文件:', { originalPath });

      if (!fs.existsSync(originalPath)) {
        logger.error('原始文件也不存在:', { originalPath });
        return res.status(404).json({ message: '预览文件不存在' });
      }

      // 检查文件大小
      const stats = fs.statSync(originalPath);
      logger.debug('原始文件大小:', { size: stats.size });

      // 设置响应头
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(file.originalName) + '"');

      // 使用流发送文件
      const fileStream = fs.createReadStream(originalPath);
      fileStream.on('error', (error) => {
        logger.error('文件流错误:', { error: error.message });
        if (!res.headersSent) {
          res.status(500).json({ message: '读取文件失败', error: error.message });
        }
      });

      return fileStream.pipe(res);
    }

    // 检查预览文件大小
    const stats = fs.statSync(absolutePath);
    logger.debug('预览文件大小:', { size: stats.size });

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(path.basename(file.originalName)) + '"');

    // 使用流发送文件
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (error) => {
      logger.error('文件流错误:', { error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ message: '读取文件失败', error: error.message });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    logger.error('获取预览失败:', { error: error.message, stack: error.stack });
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '无效的token', error: error.message });
    }
    res.status(500).json({ message: '获取预览失败', error: error.message });
  }
};

// 下载PDF预览文件
exports.downloadPdfPreview = async (req, res) => {
  try {
    const filePath = await safeDownloadPath(PDF_DIR, req.params[0]);
    await checkAssignmentDownload(req.user, filePath, true);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: '预览文件不存在' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');

    res.sendFile(filePath);
  } catch (error) {
    console.error('下载PDF预览失败:', error);
    res.status(error.status || (error.code === 'ENOENT' ? 404 : 500)).json({ message: '预览文件不存在或无权访问' });
  }
};

// 获取Excel数据 - 用于SpreadsheetEditor显示
exports.getExcelData = async (req, res) => {
  try {
    const { submissionId } = req.params;
    logger.info('请求Excel数据，提交ID:', { submissionId });

    // 定义限制常量，防止大文件导致服务器卡死
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_ROWS = 500;
    const MAX_COLS = 50;
    const MAX_CELLS_PER_SHEET = 10000;

    const token = req.query.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      logger.error('未提供token');
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // 验证token
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.error('token验证失败:', { error: error.message });
      return res.status(401).json({ success: false, message: '无效的token' });
    }

    const submission = await AssignmentSubmission.findById(submissionId);
    if (!submission) {
      logger.warn('未找到提交记录:', { submissionId });
      return res.status(404).json({ success: false, message: '提交记录不存在' });
    }

    if (!submission.content.file) {
      logger.warn('提交记录中没有文件:', { submissionId });
      return res.status(404).json({ success: false, message: '提交记录中没有文件' });
    }

    const file = submission.content.file;
    const fileExt = path.extname(file.originalName).toLowerCase();

    // 检查是否是Excel文件
    if (fileExt !== '.xlsx' && fileExt !== '.xls') {
      logger.warn('不是Excel文件:', { fileExt, originalName: file.originalName });
      return res.status(400).json({ success: false, message: '文件不是Excel格式' });
    }

    const filePath = path.join(__dirname, '../..', file.path);

    if (!fs.existsSync(filePath)) {
      logger.warn('Excel文件不存在:', { filePath });
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 检查文件大小
    const fileStats = fs.statSync(filePath);
    if (fileStats.size > MAX_FILE_SIZE) {
      logger.warn('Excel文件过大:', { filePath, size: fileStats.size, maxSize: MAX_FILE_SIZE });
      return res.status(400).json({
        success: false,
        message: `Excel文件过大 (${(fileStats.size / 1024 / 1024).toFixed(2)}MB)，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB。请下载原文件查看。`,
        canDownload: true
      });
    }

    // 使用xlsx库读取Excel文件
    const XLSX = require('xlsx');
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, {
        sheetRows: MAX_ROWS + 1,  // 限制读取的行数
        cellFormula: true,
        cellText: true
      });
    } catch (xlsxError) {
      logger.error('Excel文件读取失败:', { error: xlsxError.message, filePath });
      return res.status(400).json({
        success: false,
        message: 'Excel文件读取失败，文件可能已损坏。请下载原文件查看。',
        canDownload: true
      });
    }

    let isTruncated = false;
    let truncationMessage = '';

    // 转换为SpreadsheetEditor格式
    const sheets = workbook.SheetNames.map((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // 计算实际范围并应用限制
      const actualRows = range.e.r - range.s.r + 1;
      const actualCols = range.e.c - range.s.c + 1;
      const maxRow = Math.min(range.e.r, range.s.r + MAX_ROWS - 1);
      const maxCol = Math.min(range.e.c, range.s.c + MAX_COLS - 1);

      if (actualRows > MAX_ROWS || actualCols > MAX_COLS) {
        isTruncated = true;
        truncationMessage = `表格数据已截断：原始 ${actualRows} 行 × ${actualCols} 列，仅显示前 ${Math.min(actualRows, MAX_ROWS)} 行 × ${Math.min(actualCols, MAX_COLS)} 列`;
        logger.warn('Excel数据被截断:', { sheetName, actualRows, actualCols, maxRow, maxCol });
      }

      // 创建celldata数组
      const celldata = [];
      let cellCount = 0;

      for (let row = range.s.r; row <= maxRow && cellCount < MAX_CELLS_PER_SHEET; row++) {
        for (let col = range.s.c; col <= maxCol && cellCount < MAX_CELLS_PER_SHEET; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];

          if (cell) {
            const cellValue = {
              v: cell.v, // 值
              m: cell.w || String(cell.v || ''), // 显示文本
              ct: { fa: 'General', t: cell.t === 'n' ? 'n' : 'g' } // 格式
            };

            // 如果有公式，添加公式字段
            if (cell.f) {
              cellValue.f = '=' + cell.f; // FortuneSheet需要以=开头的公式
            }

            celldata.push({
              r: row,
              c: col,
              v: cellValue
            });
            cellCount++;
          }
        }
      }

      if (cellCount >= MAX_CELLS_PER_SHEET) {
        isTruncated = true;
        truncationMessage = `表格单元格数量过多，仅显示前 ${MAX_CELLS_PER_SHEET} 个单元格`;
      }

      return {
        name: sheetName,
        index: index,
        status: index === 0 ? 1 : 0,
        order: index,
        row: Math.min(Math.max(maxRow + 1, 50), MAX_ROWS),
        column: Math.min(Math.max(maxCol + 1, 26), MAX_COLS),
        config: {},
        celldata: celldata
      };
    });

    logger.info('Excel数据解析完成', {
      submissionId,
      sheetCount: sheets.length,
      fileName: file.originalName,
      isTruncated
    });

    res.json({
      success: true,
      data: sheets,
      fileName: file.originalName,
      isTruncated,
      truncationMessage
    });

  } catch (error) {
    logger.error('获取Excel数据失败:', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取Excel数据失败', error: error.message });
  }
};

// 获取学生的所有作业提交记录（聚合所有活动类型，不含打字）
exports.getStudentSubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;
    logger.info('获取学生活动提交记录', { studentId });

    // 并行获取所有类型的提交记录
    const [
      assignmentSubmissions,
      quizSubmissions,
      flowchartSubmissions,
      spreadsheetSubmissions,
      fillBlankSubmissions,
      pythonSubmissions
    ] = await Promise.all([
      // 1. AssignmentSubmission (文件作业 + HTML)
      AssignmentSubmission.find({ student: studentId })
        .populate({ path: 'course', select: 'title' })
        .populate({ path: 'lesson', select: 'title activities' })
        .sort('-submittedAt')
        .limit(20)
        .lean(),

      // 2. QuizSubmission (测验)
      QuizSubmission.find({ studentId: studentId, status: 'SUBMITTED' })
        .populate({ path: 'lessonId', select: 'title activities course unit' })
        .sort('-submitTime')
        .limit(20)
        .lean(),

      // 3. FlowchartSubmission (流程图)
      FlowchartSubmission.find({ userId: studentId, status: { $ne: 'draft' } })
        .populate({ path: 'lessonId', select: 'title activities course unit' })
        .sort('-submittedAt')
        .limit(20)
        .lean(),

      // 4. SpreadsheetSubmission (表格)
      SpreadsheetSubmission.find({ userId: studentId })
        .populate({ path: 'lessonId', select: 'title activities course unit' })
        .sort('-submittedAt')
        .limit(20)
        .lean(),

      // 5. FillBlankSubmission (填空)
      FillBlankSubmission.find({ studentId: studentId, status: 'submitted' })
        .populate({ path: 'lessonId', select: 'title activities course unit' })
        .sort('-submittedAt')
        .limit(20)
        .lean(),

      // 6. PythonSubmission (Python)
      PythonSubmission.find({ studentId: studentId, status: 'submitted' })
        .populate({ path: 'lessonId', select: 'title activities course unit' })
        .sort('-submittedAt')
        .limit(20)
        .lean()
    ]);

    // 辅助函数：从lesson.activities中查找活动信息（标题、类型）
    const findActivityInfo = (lesson, activityId) => {
      if (!lesson?.activities || !activityId) return null;
      const activity = lesson.activities.find(
        act => act._id && act._id.toString() === activityId.toString()
      );
      return activity ? {
        title: activity.title || null,
        type: activity.activityType || null,
        lessonName: lesson.title || null
      } : null;
    };

    // 格式化 AssignmentSubmission
    const formattedAssignments = assignmentSubmissions.map(sub => {
      const info = findActivityInfo(sub.lesson, sub.activity);
      return {
        id: sub._id,
        type: info?.type || 'assignment',
        title: info?.title || '文件作业',
        lessonName: info?.lessonName || sub.lesson?.title || null,
        courseName: sub.course?.title || '未知课程',
        status: sub.status || 'submitted',
        score: sub.grade?.score,
        gradeSource: sub.grade?.source || (isAutomaticGrade(sub) ? 'automatic' : sub.grade?.score != null ? 'manual' : null),
        canResubmit: !isManualGrade(sub),
        allowedFormats: sub.lesson?.activities?.find(item => String(item._id) === String(sub.activity))?.allowedFormats || [],
        pptAutoGrade: sub.pptAutoGrade,
        excelAutoGrade: sub.excelAutoGrade,
        submitTime: sub.submittedAt,
        feedback: sub.grade?.feedback,
        aiGrade: sub.aiGrade,
        content: sub.content ? {
          file: {
            originalName: sub.content.file?.originalName,
            path: sub.content.file?.path,
            size: sub.content.file?.size,
            mimeType: sub.content.file?.mimeType
          }
        } : null,
        // 导航相关字段
        lessonId: sub.lesson?._id,
        courseId: sub.course?._id,
        unitId: sub.unit,
        activityId: sub.activity
      };
    });

    // 格式化 QuizSubmission
    const formattedQuizzes = quizSubmissions.map(sub => {
      const info = findActivityInfo(sub.lessonId, sub.activityId);
      return {
        id: sub._id,
        type: info?.type || 'quiz',
        title: info?.title || '测验',
        lessonName: info?.lessonName || sub.lessonId?.title || null,
        courseName: info?.lessonName || sub.lessonId?.title || '课程测验',
        status: 'submitted',
        score: sub.score,
        submitTime: sub.submitTime,
        feedback: null,
        content: null,
        lessonId: sub.lessonId?._id,
        courseId: sub.lessonId?.course,
        unitId: sub.lessonId?.unit,
        activityId: sub.activityId
      };
    });

    // 格式化 FlowchartSubmission
    const formattedFlowcharts = flowchartSubmissions.map(sub => {
      const info = findActivityInfo(sub.lessonId, sub.activityId);
      return {
        id: sub._id,
        type: info?.type || 'flowchart',
        title: info?.title || '流程图',
        lessonName: info?.lessonName || sub.lessonId?.title || null,
        courseName: info?.lessonName || sub.lessonId?.title || '流程图活动',
        status: sub.status,
        score: sub.grade?.score,
        submitTime: sub.submittedAt,
        feedback: sub.grade?.feedback,
        content: null,
        lessonId: sub.lessonId?._id,
        courseId: sub.lessonId?.course,
        unitId: sub.lessonId?.unit,
        activityId: sub.activityId
      };
    });

    // 格式化 SpreadsheetSubmission
    const formattedSpreadsheets = spreadsheetSubmissions.map(sub => {
      const info = findActivityInfo(sub.lessonId, sub.activityId);
      return {
        id: sub._id,
        type: info?.type || 'spreadsheet',
        title: info?.title || '表格',
        lessonName: info?.lessonName || sub.lessonId?.title || null,
        courseName: info?.lessonName || sub.lessonId?.title || '表格活动',
        status: sub.status,
        score: sub.grade?.score,
        submitTime: sub.submittedAt,
        feedback: sub.grade?.feedback,
        content: null,
        lessonId: sub.lessonId?._id,
        courseId: sub.lessonId?.course,
        unitId: sub.lessonId?.unit,
        activityId: sub.activityId
      };
    });

    // 格式化 FillBlankSubmission
    const formattedFillBlanks = fillBlankSubmissions.map(sub => {
      const info = findActivityInfo(sub.lessonId, sub.activityId);
      return {
        id: sub._id,
        type: info?.type || 'fillBlank',
        title: info?.title || '填空',
        lessonName: info?.lessonName || sub.lessonId?.title || null,
        courseName: info?.lessonName || sub.lessonId?.title || '填空活动',
        status: sub.status,
        score: sub.autoScore ?? sub.grade?.bonusScore,
        submitTime: sub.submittedAt,
        feedback: sub.grade?.feedback,
        content: null,
        lessonId: sub.lessonId?._id,
        courseId: sub.lessonId?.course,
        unitId: sub.lessonId?.unit,
        activityId: sub.activityId
      };
    });

    // 格式化 PythonSubmission
    const formattedPythons = pythonSubmissions.map(sub => {
      const info = findActivityInfo(sub.lessonId, sub.activityId);
      return {
        id: sub._id,
        type: info?.type || 'python',
        title: info?.title || 'Python编程',
        lessonName: info?.lessonName || sub.lessonId?.title || null,
        courseName: info?.lessonName || sub.lessonId?.title || 'Python活动',
        status: sub.status,
        score: sub.score,
        submitTime: sub.submittedAt,
        feedback: sub.feedback,
        content: null,
        lessonId: sub.lessonId?._id,
        courseId: sub.lessonId?.course,
        unitId: sub.lessonId?.unit,
        activityId: sub.activityId
      };
    });

    // 合并所有提交记录
    const allSubmissions = [
      ...formattedAssignments,
      ...formattedQuizzes,
      ...formattedFlowcharts,
      ...formattedSpreadsheets,
      ...formattedFillBlanks,
      ...formattedPythons
    ];

    // 按提交时间排序（最新在前）
    allSubmissions.sort((a, b) => {
      const timeA = a.submitTime ? new Date(a.submitTime).getTime() : 0;
      const timeB = b.submitTime ? new Date(b.submitTime).getTime() : 0;
      return timeB - timeA;
    });
    // 限制返回数量
    const limitedSubmissions = allSubmissions.slice(0, 20);

    logger.debug('查询到的提交记录', {
      total: allSubmissions.length,
      returned: limitedSubmissions.length,
      studentId
    });

    res.json({
      success: true,
      data: limitedSubmissions
    });
  } catch (error) {
    logger.error('获取学生活动提交记录失败', {
      error: error.message,
      stack: error.stack,
      studentId: req.user._id
    });
    res.status(500).json({
      success: false,
      message: '获取活动提交记录失败',
      error: error.message
    });
  }
};

// 以下是文件清理相关的函数

/**
 * 获取作业文件统计信息
 */
exports.getAssignmentFilesStats = async (req, res) => {
  try {
    logger.info('获取作业文件统计信息');

    // 统计文件夹大小和文件数量
    const assignmentsDir = path.join(__dirname, '../../uploads/assignments');
    const pdfPreviewsDir = path.join(__dirname, '../../uploads/pdf_previews');

    let assignmentsStats = { size: 0, count: 0, sizeFormatted: '0 Bytes' };
    let pdfPreviewsStats = { size: 0, count: 0, sizeFormatted: '0 Bytes' };

    // 检查目录是否存在
    if (fs.existsSync(assignmentsDir)) {
      assignmentsStats.size = await getDirSize(assignmentsDir);
      assignmentsStats.count = await getFileCount(assignmentsDir);
      assignmentsStats.sizeFormatted = formatBytes(assignmentsStats.size);
    }

    if (fs.existsSync(pdfPreviewsDir)) {
      pdfPreviewsStats.size = await getDirSize(pdfPreviewsDir);
      pdfPreviewsStats.count = await getFileCount(pdfPreviewsDir);
      pdfPreviewsStats.sizeFormatted = formatBytes(pdfPreviewsStats.size);
    }

    // 获取课程和班级统计
    const courseStats = await getCourseStats();
    const classStats = await getClassStats();

    res.json({
      success: true,
      data: {
        assignments: assignmentsStats,
        pdfPreviews: pdfPreviewsStats,
        totalSize: assignmentsStats.size + pdfPreviewsStats.size,
        totalSizeFormatted: formatBytes(assignmentsStats.size + pdfPreviewsStats.size),
        totalCount: assignmentsStats.count + pdfPreviewsStats.count,
        courseStats,
        classStats
      }
    });
  } catch (error) {
    logger.error('获取作业文件统计信息失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取作业文件统计信息失败',
      error: error.message
    });
  }
};

/**
 * 构建过滤查询条件
 */
function buildFilterQuery(filters) {
  console.log('构建查询条件，原始过滤器:', JSON.stringify(filters, null, 2));

  const query = {};

  // 课程ID过滤 - 使用course字段，因为AssignmentSubmission模型中是course
  if (filters.courseIds && filters.courseIds.length > 0) {
    try {
      const courseObjectIds = filters.courseIds.map(id =>
        typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
      );
      query.course = { $in: courseObjectIds };
      console.log('添加课程过滤条件:', JSON.stringify(query.course));
    } catch (error) {
      console.error('转换课程ID失败:', error);
      query.course = { $in: filters.courseIds };
    }
  }

  // 日期范围过滤 - 使用提交时间字段 submittedAt
  if (filters.dateRange && filters.dateRange.length === 2) {
    const startDate = new Date(filters.dateRange[0]);
    const endDate = new Date(filters.dateRange[1]);

    // 确保endDate是当天的结束时间 23:59:59.999
    endDate.setHours(23, 59, 59, 999);

    query.submittedAt = {
      $gte: startDate,
      $lte: endDate
    };
    console.log('添加日期过滤条件:', JSON.stringify(query.submittedAt));
  }

  console.log('构建的基础查询条件:', JSON.stringify(query, null, 2));
  return query;
}

/**
 * 预览将被删除的文件
 */
exports.previewCleanup = async (req, res) => {
  try {
    logger.info('预览文件清理', { filters: req.body.filters, options: req.body.options });

    const { filters, options } = req.body;

    // 构建基本查询条件
    const baseQuery = buildFilterQuery(filters);

    // 构建完整的查询条件
    let fullQuery = { ...baseQuery };

    // 如果有班级ID，则需要先查找该班级的所有学生，然后查找这些学生的作业提交
    if (filters.classIds && filters.classIds.length > 0) {
      try {
        // 将班级ID转换为ObjectId
        const classObjectIds = filters.classIds.map(id =>
          typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
        );

        // 查找属于这些班级的所有学生ID
        const studentsInClasses = await User.find(
          { classId: { $in: classObjectIds } },
          { _id: 1 }
        );

        // 提取学生ID列表
        const studentIds = studentsInClasses.map(student => student._id);

        if (studentIds.length === 0) {
          logger.warn('没有找到属于指定班级的学生', { classIds: filters.classIds });
          // 返回空结果，因为没有学生
          return res.json({
            success: true,
            data: {
              totalCount: 0,
              totalSize: 0,
              totalSizeFormatted: '0 Bytes',
              files: [],
              hasMore: false,
              remainingCount: 0
            }
          });
        }

        // 将学生ID添加到查询条件中
        fullQuery.student = { $in: studentIds };

      } catch (error) {
        logger.error('处理班级ID失败', { error: error.message });
        return res.status(400).json({
          success: false,
          message: '班级ID格式无效',
          error: error.message
        });
      }
    }


    // 查询符合条件的作业提交，使用setOptions设置strictPopulate为false
    const submissions = await AssignmentSubmission.find(fullQuery)
      .populate('student', 'name')
      .populate({
        path: 'course',
        select: 'title'
      })
      .select('student course activity content.file submittedAt createdAt').lean()
      .setOptions({ strictPopulate: false });


    // 分析出哪些文件将被删除
    const filesToDelete = await analyzeFilesToDelete(submissions, options);


    // 计算总大小和数量
    const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, 0);

    // 计算按课程和班级的详细统计
    const statistics = {
      byCourse: {},
      byClass: {}
    };

    // 按课程统计
    filesToDelete.forEach(file => {
      const courseTitle = file.courseTitle || '未知课程';
      if (!statistics.byCourse[courseTitle]) {
        statistics.byCourse[courseTitle] = { count: 0, size: 0, sizeFormatted: '0 Bytes' };
      }
      statistics.byCourse[courseTitle].count++;
      statistics.byCourse[courseTitle].size += file.size;
      statistics.byCourse[courseTitle].sizeFormatted = formatBytes(statistics.byCourse[courseTitle].size);
    });

    // 按班级统计（需要查询学生的班级信息）
    if (filters.classIds && filters.classIds.length > 0) {
      try {
        const classObjectIds = filters.classIds.map(id =>
          typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
        );
        const classes = await Class.find({ _id: { $in: classObjectIds } });
        const classMap = {};
        classes.forEach(cls => {
          classMap[cls._id.toString()] = `${cls.grade}级${cls.name}班`;
        });

        // 为选中的每个班级初始化统计
        Object.values(classMap).forEach(className => {
          statistics.byClass[className] = { count: 0, size: 0, sizeFormatted: '0 Bytes' };
        });

        // 获取所有相关学生的班级信息
        const allStudentIds = submissions.map(sub => sub.student._id);
        const studentsWithClass = await User.find({
          _id: { $in: allStudentIds },
          classId: { $in: classObjectIds }
        }).populate('classId');

        const studentClassMap = {};
        studentsWithClass.forEach(student => {
          if (student.classId) {
            studentClassMap[student._id.toString()] = `${student.classId.grade}级${student.classId.name}班`;
          }
        });

        // Index submissions once for the per-class aggregation.
        const submissionMap = new Map(submissions.map(sub => [String(sub._id), sub]));
        filesToDelete.forEach(file => {
          // 需要找到这个文件对应的学生ID
          const submission = submissionMap.get(String(file.submissionId));
          if (submission && submission.student) {
            const studentId = submission.student._id.toString();
            const className = studentClassMap[studentId] || '未知班级';
            if (statistics.byClass[className]) {
              statistics.byClass[className].count++;
              statistics.byClass[className].size += file.size;
              statistics.byClass[className].sizeFormatted = formatBytes(statistics.byClass[className].size);
            }
          }
        });
      } catch (error) {
        logger.warn('计算班级统计失败', { error: error.message });
      }
    }

    // 限制返回的文件数量，避免响应过大
    const limitedFiles = filesToDelete.slice(0, 50);

    res.json({
      success: true,
      data: {
        totalCount: filesToDelete.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        files: limitedFiles,
        hasMore: filesToDelete.length > limitedFiles.length,
        remainingCount: filesToDelete.length - limitedFiles.length,
        statistics
      }
    });
  } catch (error) {
    logger.error('预览文件清理失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '预览文件清理失败',
      error: error.message
    });
  }
};

/**
 * 执行文件清理
 */
exports.cleanupFiles = async (req, res) => {
  try {
    logger.info('执行文件清理', { filters: req.body.filters, options: req.body.options });

    const { filters, options } = req.body;

    // 构建基本查询条件
    const baseQuery = buildFilterQuery(filters);

    // 构建完整的查询条件
    let fullQuery = { ...baseQuery };

    // 如果有班级ID，则需要先查找该班级的所有学生，然后查找这些学生的作业提交
    if (filters.classIds && filters.classIds.length > 0) {
      try {
        // 将班级ID转换为ObjectId
        const classObjectIds = filters.classIds.map(id =>
          typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
        );

        // 查找属于这些班级的所有学生ID
        const studentsInClasses = await User.find(
          { classId: { $in: classObjectIds } },
          { _id: 1 }
        );

        // 提取学生ID列表
        const studentIds = studentsInClasses.map(student => student._id);

        if (studentIds.length === 0) {
          logger.warn('没有找到属于指定班级的学生', { classIds: filters.classIds });
          // 返回空结果，因为没有学生
          return res.json({
            success: true,
            data: {
              deletedCount: 0,
              deletedSize: 0,
              deletedSizeFormatted: '0 Bytes',
              failedCount: 0
            }
          });
        }

        // 将学生ID添加到查询条件中
        fullQuery.student = { $in: studentIds };
      } catch (error) {
        logger.error('处理班级ID失败', { error: error.message });
        return res.status(400).json({
          success: false,
          message: '班级ID格式无效',
          error: error.message
        });
      }
    }


    // 查询符合条件的作业提交，使用setOptions设置strictPopulate为false
    const submissions = await AssignmentSubmission.find(fullQuery)
      .populate('student', 'name')
      .populate({
        path: 'course',
        select: 'title'
      })
      .select('student course activity content.file submittedAt createdAt').lean()
      .setOptions({ strictPopulate: false });


    if (submissions.length === 0) {
      logger.info('未找到符合条件的提交记录，无文件可清理');
      return res.json({
        success: true,
        data: {
          deletedCount: 0,
          deletedSize: 0,
          deletedSizeFormatted: '0 Bytes',
          failedCount: 0
        }
      });
    }

    // 分析出哪些文件将被删除
    const filesToDelete = await analyzeFilesToDelete(submissions, options);


    if (filesToDelete.length === 0) {
      logger.info('未找到符合条件的文件可删除');
      return res.json({
        success: true,
        data: {
          deletedCount: 0,
          deletedSize: 0,
          deletedSizeFormatted: '0 Bytes',
          failedCount: 0
        }
      });
    }

    // 执行文件删除
    const deleteResults = await deleteFiles(filesToDelete, submissions);

    // 计算总大小和数量
    const totalSize = deleteResults.reduce((sum, file) => sum + file.size, 0);

    const responseData = {
      deletedCount: deleteResults.length,
      deletedSize: totalSize,
      deletedSizeFormatted: formatBytes(totalSize),
      failedCount: filesToDelete.length - deleteResults.length
    };

    logger.info('文件清理完成', responseData);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('执行文件清理失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '执行文件清理失败',
      error: error.message
    });
  }
};

// 辅助函数

/**
 * 获取目录大小
 */
async function getDirSize(dirPath) {
  try {
    let totalSize = 0;
    const items = await fs.promises.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.promises.stat(itemPath);

      if (stats.isDirectory()) {
        totalSize += await getDirSize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch (error) {
    logger.error('获取目录大小失败', { dirPath, error: error.message });
    return 0;
  }
}

/**
 * 获取文件数量
 */
async function getFileCount(dirPath) {
  try {
    let count = 0;
    const items = await fs.promises.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.promises.stat(itemPath);

      if (stats.isDirectory()) {
        count += await getFileCount(itemPath);
      } else {
        count++;
      }
    }

    return count;
  } catch (error) {
    logger.error('获取文件数量失败', { dirPath, error: error.message });
    return 0;
  }
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 获取课程统计信息
 */
async function getCourseStats() {
  try {
    // 聚合查询，按课程分组统计提交数量
    const stats = await AssignmentSubmission.aggregate([
      {
        $lookup: {
          from: 'assignments',
          localField: 'assignmentId',
          foreignField: '_id',
          as: 'assignment'
        }
      },
      { $unwind: '$assignment' },
      {
        $lookup: {
          from: 'courses',
          localField: 'assignment.courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $group: {
          _id: '$course._id',
          courseTitle: { $first: '$course.title' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  } catch (error) {
    logger.error('获取课程统计信息失败', { error: error.message });
    return [];
  }
}

/**
 * 获取班级统计信息
 */
async function getClassStats() {
  try {
    // 聚合查询，按班级分组统计提交数量
    const stats = await AssignmentSubmission.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classes',
          localField: 'student.classId',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: '$class' },
      {
        $group: {
          _id: '$class._id',
          className: { $first: '$class.name' },
          grade: { $first: '$class.grade' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  } catch (error) {
    logger.error('获取班级统计信息失败', { error: error.message });
    return [];
  }
}

/**
 * 分析要删除的文件
 */
async function analyzeFilesToDelete(submissions, options) {
  const filesToDelete = [];


  // 遍历所有提交，确定要删除的文件
  for (const submission of submissions) {
    // 确保提交有ID，避免处理损坏的记录
    if (!submission._id) {

      continue;
    }



    // 检查提交内容是否存在
    if (!submission.content) {

      continue;
    }

    // 检查文件是否存在
    if (!submission.content.file) {

      continue;
    }

    // 输出文件详细信息，帮助诊断




    // 处理原始文件
    if (options.deleteOriginals &&
      submission.content.file.path &&
      !submission.content.file.fileDeleted) { // 检查文件是否已被标记为删除

      // 尝试构建正确的文件路径
      let filePath = submission.content.file.path;

      // 如果路径不是绝对路径，且不是以uploads开头，尝试修复
      if (!path.isAbsolute(filePath) && !filePath.startsWith('uploads/')) {
        if (!filePath.includes('/')) {
          // 可能只有文件名，尝试在uploads/assignments目录下查找
          const possiblePath = path.join('uploads/assignments', filePath);

          filePath = possiblePath;
        }
      }

      // 构建完整的文件系统路径
      const fullFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, '../../', filePath);


      // 尝试其他可能的位置
      const possibleLocations = [
        fullFilePath,
        path.join(__dirname, '../../uploads/assignments', path.basename(filePath))
      ];

      let fileExists = false;
      let existingFilePath = '';
      let fileStats = null;

      // 检查所有可能的位置
      for (const location of possibleLocations) {
        try {
          fileStats = await fs.promises.stat(location);
          if (fileStats.isFile()) {
            fileExists = true;
            existingFilePath = location;

            break;
          }
        } catch (error) {

        }
      }

      if (!fileExists) {

        continue;
      }

      try {
        const fileSize = fileStats.size || 0;

        filesToDelete.push({
          path: existingFilePath,
          type: 'original',
          size: fileSize,
          fileName: submission.content.file.originalName || submission.content.file.filename || path.basename(existingFilePath) || '未知文件',
          submissionId: submission._id,
          activityTitle: submission.activity || '未知活动',
          courseTitle: submission.course?.title || '未知课程',
          studentName: submission.student?.name || '未知学生',
          submissionDate: submission.submittedAt || submission.createdAt,
          sizeFormatted: formatBytes(fileSize),
          fieldPath: 'content.file.path' // 记录字段路径，用于后续更新
        });

      } catch (error) {
        // 文件不存在或无法访问，记录错误但继续处理
        logger.warn('处理原始文件时出错', {
          filePath: existingFilePath,
          submissionId: submission._id,
          error: error.message
        });
      }
    } else {
      if (!options.deleteOriginals) {

      } else if (!submission.content.file.path) {

      } else if (submission.content.file.fileDeleted) {

      }
    }

    // 处理PDF预览文件，类似处理原始文件的方式
    if (options.deletePreviews &&
      submission.content.file.pdfPreviewPath &&
      !submission.content.file.pdfPreviewDeleted) {

      // 尝试构建正确的文件路径
      let filePath = submission.content.file.pdfPreviewPath;

      // 如果路径不是绝对路径，且不是以uploads开头，尝试修复
      if (!path.isAbsolute(filePath) && !filePath.startsWith('uploads/')) {
        if (!filePath.includes('/')) {
          // 可能只有文件名，尝试在uploads/pdf_previews目录下查找
          const possiblePath = path.join('uploads/pdf_previews', filePath);

          filePath = possiblePath;
        }
      }

      // 构建完整的文件系统路径
      const fullFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, '../../', filePath);


      // 尝试其他可能的位置
      const possibleLocations = [
        fullFilePath,
        path.join(__dirname, '../../uploads/pdf_previews', path.basename(filePath))
      ];

      let fileExists = false;
      let existingFilePath = '';
      let fileStats = null;

      // 检查所有可能的位置
      for (const location of possibleLocations) {
        try {
          fileStats = await fs.promises.stat(location);
          if (fileStats.isFile()) {
            fileExists = true;
            existingFilePath = location;

            break;
          }
        } catch (error) {

        }
      }

      if (!fileExists) {

        continue;
      }

      try {
        const fileSize = fileStats.size || 0;

        filesToDelete.push({
          path: existingFilePath,
          type: 'preview',
          size: fileSize,
          fileName: submission.content.file.originalName || submission.content.file.filename || path.basename(existingFilePath) || '未知文件',
          submissionId: submission._id,
          activityTitle: submission.activity || '未知活动',
          courseTitle: submission.course?.title || '未知课程',
          studentName: submission.student?.name || '未知学生',
          submissionDate: submission.submittedAt || submission.createdAt,
          sizeFormatted: formatBytes(fileSize),
          fieldPath: 'content.file.pdfPreviewPath' // 记录字段路径，用于后续更新
        });

      } catch (error) {
        // 文件不存在或无法访问，记录错误但继续处理
        logger.warn('处理PDF预览文件时出错', {
          filePath: existingFilePath,
          submissionId: submission._id,
          error: error.message
        });
      }
    } else {
      if (!options.deletePreviews) {

      } else if (!submission.content.file.pdfPreviewPath) {

      } else if (submission.content.file.pdfPreviewDeleted) {

      }
    }
  }

  return filesToDelete;
}

/**
 * 删除文件并更新数据库记录
 */
async function deleteFiles(filesToDelete, submissions) {
  const deletedFiles = [];

  for (const file of filesToDelete) {
    try {


      // 检查文件是否存在
      try {
        await fs.promises.access(file.path, fs.constants.F_OK);
      } catch (error) {
        logger.warn(`文件不存在，跳过删除: ${file.path}`, { error: error.message });
        continue;
      }

      // 删除文件
      try {
        await fs.promises.unlink(file.path);

      } catch (error) {
        logger.error(`删除文件失败: ${file.path}`, { error: error.message });
        continue; // 如果文件删除失败，跳过数据库更新
      }

      // 更新数据库记录 - 只标记文件已删除，但保留记录本身
      const submissionId = file.submissionId;

      // 构建更新条件和更新内容
      const updateCondition = { _id: submissionId };
      let updateOperation;

      if (file.type === 'original') {
        // 使用$set和嵌套路径设置字段为null和标记删除状态
        updateOperation = {
          $set: {
            'content.file.path': null,
            'content.file.fileDeleted': true
          }
        };
      } else if (file.type === 'preview') {
        // 使用$set和嵌套路径设置字段为null和标记删除状态
        updateOperation = {
          $set: {
            'content.file.pdfPreviewPath': null,
            'content.file.pdfPreviewDeleted': true
          }
        };
      }

      // 执行数据库更新
      try {
        const updateResult = await AssignmentSubmission.updateOne(
          updateCondition,
          updateOperation
        );

        if (updateResult.matchedCount > 0) {

        } else {
          logger.warn(`未找到提交记录: ${submissionId}`);
        }
      } catch (error) {
        logger.error(`更新提交记录失败: ${submissionId}`, { error: error.message });
        // 即使数据库更新失败，我们仍然计算这个文件为已删除，因为文件已经被物理删除
      }

      // 记录成功删除
      deletedFiles.push(file);
      logger.info('文件删除成功', {
        filePath: file.path,
        submissionId,
        fileType: file.type,
        fieldPath: file.fieldPath
      });
    } catch (error) {
      // 捕获其他可能的错误
      logger.error('文件处理过程中出现意外错误', {
        filePath: file.path,
        submissionId: file.submissionId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  // 打印汇总信息
  const totalSize = deletedFiles.reduce((sum, file) => sum + file.size, 0);


  return deletedFiles;
}

exports.autoGradeExcelSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const submission = await AssignmentSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: '未找到提交记录' });
    }

    const studentFile = submission.content?.file;
    if (!studentFile?.path || !/\.xlsx$/i.test(studentFile.originalName || studentFile.filename || '')) {
      return res.status(400).json({ success: false, message: '该提交不是XLSX文件，暂不支持自动批阅' });
    }

    const lesson = await Lesson.findById(submission.lesson);
    if (!lesson) {
      return res.status(404).json({ success: false, message: '未找到课时' });
    }

    const activity = lesson.activities.id(submission.activity) ||
      lesson.activities.find(item => item._id?.toString() === submission.activity?.toString());
    if (!activity) {
      return res.status(404).json({ success: false, message: '未找到对应活动' });
    }

    const excelSettings = activity.excelGradingSettings || {};
    if (!excelSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: '该活动尚未开启Excel自动批阅。请先在活动编辑页上传原始Excel和参考答案Excel并保存得分点。'
      });
    }

    const studentPath = resolveStoredPath(studentFile.path);
    const referencePath = resolveStoredPath(excelSettings.referenceFile?.path);
    const originalPath = excelSettings.originalFile?.path ? resolveStoredPath(excelSettings.originalFile.path) : null;

    for (const [label, filePath] of [['学生Excel', studentPath], ['参考答案Excel', referencePath]]) {
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: `${label}文件不存在` });
      }
    }
    if (originalPath && !fs.existsSync(originalPath)) {
      return res.status(404).json({ success: false, message: '原始Excel文件不存在' });
    }

    const graded = await runOfficeAutoGrade(submission, activity, 'excel', req.user._id);
    const result = graded.result;

    res.json({
      success: true,
      message: 'Excel自动批阅完成',
      data: {
        score: result.score,
        feedback: result.feedback,
        passedCount: result.passedCount,
        totalRules: result.totalRules,
        results: result.results,
        submission: graded.submission
      }
    });
  } catch (error) {
    logger.error('Excel自动批阅失败', {
      error: error.message,
      stack: error.stack,
      submissionId: req.params.submissionId
    });
    res.status(500).json({
      success: false,
      message: 'Excel自动批阅失败',
      error: error.message
    });
  }
};

// Detailed reports are loaded only for the student selected in the review panel.
exports.getOfficeGradingReports = async (req,res) => {
 try {
  if(!['teacher','admin'].includes(req.user.role))return res.status(403).json({success:false,message:'无权限访问'});
  const submission=await AssignmentSubmission.findById(req.params.submissionId).select('pptAutoGrade excelAutoGrade');
  if(!submission)return res.status(404).json({success:false,message:'未找到提交记录'});
  res.json({success:true,data:submission});
 } catch(error){res.status(500).json({success:false,message:'加载评阅详情失败'});}
};
