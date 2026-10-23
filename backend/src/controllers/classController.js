const Class = require('../models/Class');
const User = require('../models/User');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const QuizSubmission = require('../models/QuizSubmission');
const TypingRecord = require('../models/TypingRecord');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const logger = require('../utils/logger');
const semesterUtils = require('../utils/semesterUtils');
const authController = require('./authController');

// 在文件顶部添加计时器映射
const classTimers = new Map();

// 创建新班级
exports.createClass = async (req, res) => {
  try {
    const { name, grade } = req.body;
    logger.info('尝试创建新班级', { name, grade, teacherId: req.user._id });

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试创建班级', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '只有教师可以创建班级'
      });
    }

    // 验证年级格式（确保是四位数年份）
    if (!grade || !/^20\d{2}$/.test(String(grade))) {
      logger.warn('年级格式无效', { grade });
      return res.status(400).json({
        success: false,
        message: '年级必须是四位数年份（如2023、2024），不能使用简写形式如"23级"'
      });
    }

    // 创建新班级
    const newClass = await Class.create({
      name,
      grade,
      teacher: req.user._id
    });

    logger.info('班级创建成功', { classId: newClass._id, name, grade });
    res.status(201).json({
      success: true,
      data: newClass
    });
  } catch (error) {
    logger.error('创建班级失败', { error: error.message, stack: error.stack });

    // 检查是否是重复键错误（重复的班级）
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '该年级已存在相同班号的班级'
      });
    }

    // 检查是否是验证错误
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || '创建班级失败'
    });
  }
};

// 获取教师的所有班级
exports.getTeacherClasses = async (req, res) => {
  try {
    // 默认只返回活跃班级，传 includeArchived=true 可获取所有
    const query = { teacher: req.user._id };
    if (req.query.includeArchived !== 'true') {
      query.status = { $ne: 'archived' }; // 排除已归档班级
    }
    const classes = await Class.find(query);

    // 获取每个班级的学生
    const classesWithStudents = await Promise.all(classes.map(async (classObj) => {
      const students = await User.find({
        classId: classObj._id,
        role: 'student'
      }).select('name username');

      return {
        ...classObj.toObject(),
        students
      };
    }));

    res.status(200).json({
      success: true,
      data: classesWithStudents
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 添加学生到班级
exports.addStudentToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const studentData = req.body;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以添加学生'
      });
    }

    // 检查学号是否已存在
    const existingStudent = await User.findOne({ username: studentData.username });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: '该学号已被使用'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 创建新学生用户，并设置班级ID
    const newStudent = await User.create({
      ...studentData,
      role: 'student',
      classId: classObj._id
    });

    res.status(200).json({
      success: true,
      message: '学生添加成功',
      data: newStudent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 从班级移除学生并删除用户
exports.removeStudentFromClass = async (req, res) => {
  try {
    const { classId, studentId } = req.params;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试删除学生', {
        userId: req.user._id,
        role: req.user.role,
        studentId
      });
      return res.status(403).json({
        success: false,
        message: '只有教师可以删除学生'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      logger.warn('未找到班级或无权操作', {
        classId,
        teacherId: req.user._id
      });
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 检查学生是否存在且属于该班级
    const student = await User.findOne({
      _id: studentId,
      classId: classId
    });

    if (!student) {
      logger.warn('未找到学生或学生不属于该班级', {
        studentId,
        classId
      });
      return res.status(404).json({
        success: false,
        message: '未找到该学生或学生不属于该班级'
      });
    }

    logger.info('开始删除学生及其相关数据', {
      studentId,
      classId,
      teacherId: req.user._id
    });

    // 查找并删除学生的所有作业提交记录
    const submissions = await AssignmentSubmission.find({ student: studentId });

    // 删除提交记录关联的文件
    for (const submission of submissions) {
      if (submission.content?.file?.path) {
        try {
          const filePath = path.join(__dirname, '../..', submission.content.file.path);
          await fsPromises.unlink(filePath).catch(err => {
            logger.warn('删除作业文件失败', {
              filePath,
              error: err.message
            });
          });

          // 如果存在PDF预览文件，也删除它
          if (submission.content.file.pdfPreviewPath) {
            const pdfPath = path.join(__dirname, '../..', submission.content.file.pdfPreviewPath);
            await fsPromises.unlink(pdfPath).catch(err => {
              logger.warn('删除PDF预览文件失败', {
                pdfPath,
                error: err.message
              });
            });
          }
        } catch (error) {
          logger.error('删除文件时出错', {
            submissionId: submission._id,
            error: error.message
          });
        }
      }
    }

    // 删除所有作业提交记录
    const deleteResult = await AssignmentSubmission.deleteMany({ student: studentId });
    logger.info('删除作业提交记录完成', {
      studentId,
      deletedCount: deleteResult.deletedCount
    });

    // 删除所有测验提交记录
    const quizDeleteResult = await QuizSubmission.deleteMany({ studentId: studentId });
    logger.info('删除测验提交记录完成', {
      studentId,
      deletedCount: quizDeleteResult.deletedCount
    });

    // 删除所有打字记录
    const typingDeleteResult = await TypingRecord.deleteMany({ userId: studentId });
    logger.info('删除打字记录完成', {
      studentId,
      deletedCount: typingDeleteResult.deletedCount
    });

    // 删除用户记录
    await User.findByIdAndDelete(studentId);
    logger.info('学生删除成功', {
      studentId,
      classId
    });

    res.status(200).json({
      success: true,
      message: '学生及其相关数据删除成功',
      deletedData: {
        submissions: deleteResult.deletedCount,
        quizSubmissions: quizDeleteResult.deletedCount,
        typingRecords: typingDeleteResult.deletedCount
      }
    });
  } catch (error) {
    logger.error('删除学生失败', {
      error: error.message,
      stack: error.stack,
      studentId: req.params.studentId
    });
    res.status(400).json({
      success: false,
      message: error.message || '删除学生失败'
    });
  }
};

// 获取班级详情
exports.getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;

    const classObj = await Class.findById(classId)
      .populate('teacher', 'name username')
      .populate('currentCourse', 'title')
      .populate('currentUnit', 'title')
      .populate('currentLesson', 'title')
      .populate('selectedClassroomLayout', 'name rows cols');

    if (!classObj) {
      return res.status(404).json({
        success: false,
        message: '未找到该班级'
      });
    }

    // 获取班级的学生
    const students = await User.find({
      classId: classObj._id,
      role: 'student'
    }).select('name username');

    // 检查权限（只有班级的教师和班级的学生可以查看）
    if (
      req.user.role !== 'admin' &&
      req.user._id.toString() !== classObj.teacher._id.toString() &&
      !students.some(student => student._id.toString() === req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: '无权查看该班级信息'
      });
    }

    const classData = {
      ...classObj.toObject(),
      students
    };

    res.status(200).json({
      success: true,
      data: classData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 更新学生信息
exports.updateStudent = async (req, res) => {
  try {
    logger.info('开始更新学生信息', {
      studentId: req.params.studentId,
      teacherId: req.user._id
    });

    const { studentId } = req.params;
    const { username, name, password, classId } = req.body;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试更新学生信息', {
        userId: req.user._id,
        role: req.user.role
      });
      return res.status(403).json({
        success: false,
        message: '只有教师可以更新学生信息'
      });
    }

    // 检查学生是否存在
    const student = await User.findById(studentId);
    if (!student) {
      logger.warn('未找到要更新的学生', { studentId });
      return res.status(404).json({
        success: false,
        message: '未找到该学生'
      });
    }

    // 检查该学生是否在教师的任何班级中
    const hasStudent = await Class.exists({
      teacher: req.user._id,
      _id: student.classId
    });

    if (!hasStudent) {
      logger.warn('教师无权更新该学生信息', {
        teacherId: req.user._id,
        studentId
      });
      return res.status(403).json({
        success: false,
        message: '无权更新该学生信息'
      });
    }

    // 如果要更新班级，检查新班级是否存在且属于当前教师
    if (classId && classId !== student.classId.toString()) {
      const newClass = await Class.findOne({
        _id: classId,
        teacher: req.user._id
      });

      if (!newClass) {
        logger.warn('教师无权将学生转入该班级', {
          teacherId: req.user._id,
          classId
        });
        return res.status(403).json({
          success: false,
          message: '无权将学生转入该班级'
        });
      }
    }

    // 如果要更新学号，检查新学号是否已存在
    if (username && username !== student.username) {
      const existingStudent = await User.findOne({ username });
      if (existingStudent) {
        logger.warn('学号已被使用', {
          username,
          existingStudentId: existingStudent._id
        });
        return res.status(400).json({
          success: false,
          message: '该学号已被使用'
        });
      }
    }

    // 更新学生信息
    const updateData = {
      ...(username && { username }),
      ...(name && { name }),
      ...(password && { password }),
      ...(classId && { classId })
    };

    const updatedStudent = await User.findByIdAndUpdate(
      studentId,
      updateData,
      { new: true }
    ).select('name username classId');

    logger.info('学生信息更新成功', {
      studentId,
      updatedFields: Object.keys(updateData)
    });

    res.status(200).json({
      success: true,
      message: '学生信息更新成功',
      data: updatedStudent
    });
  } catch (error) {
    logger.error('更新学生信息失败', {
      error: error.message,
      stack: error.stack,
      studentId: req.params.studentId
    });
    res.status(400).json({
      success: false,
      message: error.message || '更新学生信息失败'
    });
  }
};

// 获取可用的班级列表（用于学生注册）
exports.getAvailableClasses = async (req, res) => {
  try {
    logger.info('获取可用班级列表');

    // 获取当前有效的年级
    const validGrades = semesterUtils.getCurrentValidGrades();

    logger.info('当前有效年级', { validGrades });

    // 只查询有效年级的班级，且排除已归档班级
    const classes = await Class.find({ grade: { $in: validGrades }, status: { $ne: 'archived' } })
      .select('name grade teacher')
      .populate('teacher', 'name')
      .sort('grade name');

    logger.info('查询到的班级数量', { count: classes.length });

    res.status(200).json({
      success: true,
      data: classes
    });
  } catch (error) {
    logger.error('获取可用班级列表失败', { error: error.message, stack: error.stack });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取学生登录历史
exports.getStudentLoginHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以查看学生登录历史'
      });
    }

    // 检查学生是否存在
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '未找到该学生'
      });
    }

    // 检查该学生是否在教师的任何班级中
    const hasStudent = await Class.exists({
      teacher: req.user._id,
      _id: student.classId
    });

    if (!hasStudent) {
      return res.status(403).json({
        success: false,
        message: '无权查看该学生的登录历史'
      });
    }

    // 获取登录历史
    const loginHistory = student.loginHistory || [];

    res.status(200).json({
      success: true,
      data: loginHistory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取班级在线学生信息
exports.getClassOnlineStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    logger.info('获取班级在线学生信息', { classId });

    // 检查权限
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以查看学生在线状态'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      logger.warn('未找到班级或无权操作', { classId, teacherId: req.user._id });
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 获取今天的日期（当地时区的午夜时间）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取班级的所有学生（不论是否有登录历史）
    const allStudents = await User.find({
      classId: classObj._id,
      role: 'student'
    }).select('name username seatNumber loginHistory sessionId sessionExpiresAt');

    // 处理并返回学生信息，包括在线状态、座位状态等
    const now = new Date();
    const processedStudents = allStudents.map(student => {
      // 获取最新的登录记录（如果有）
      const latestLogin = student.loginHistory && student.loginHistory.length > 0
        ? student.loginHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
        : null;

      // 检查是否有今天的登录记录
      const hasLoginToday = latestLogin
        ? new Date(latestLogin.timestamp) >= today
        : false;
      // 根据会话字段判断当前是否在线（会话有效期内）
      const isOnlineNow = !!student.sessionId && student.sessionExpiresAt && new Date(student.sessionExpiresAt) > now;

      return {
        _id: student._id,
        name: student.name,
        username: student.username,
        seatNumber: student.seatNumber,
        hasSeat: !!student.seatNumber,  // 是否分配了座位
        ip: latestLogin ? latestLogin.ip : null,
        lastLoginTime: latestLogin ? latestLogin.timestamp : null,
        isOnlineToday: hasLoginToday,   // 今天是否上线
        isOnlineNow,
        status: isOnlineNow ? 'online' : 'absent',
      };
    });

    // 分类统计
    const stats = {
      total: processedStudents.length,
      online: processedStudents.filter(s => s.isOnlineToday).length,
      absent: processedStudents.filter(s => !s.isOnlineToday).length,
      withSeat: processedStudents.filter(s => s.hasSeat).length,
      withoutSeat: processedStudents.filter(s => !s.hasSeat).length,
    };

    logger.info('班级学生信息统计', {
      classId,
      stats,
      studentsCount: processedStudents.length
    });

    res.status(200).json({
      success: true,
      data: processedStudents,
      stats: stats
    });
  } catch (error) {
    logger.error('获取班级在线学生信息失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 教师强制下线学生
exports.forceLogoutStudent = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    logger.info('教师强制下线学生请求', { classId, studentId, teacherId: req.user._id });

    // 仅教师可操作
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: '只有教师可以进行该操作' });
    }

    // 班级归属校验
    const classObj = await Class.findOne({ _id: classId, teacher: req.user._id });
    if (!classObj) {
      logger.warn('未找到班级或无权操作', { classId, teacherId: req.user._id });
      return res.status(404).json({ success: false, message: '未找到该班级或无权操作' });
    }

    // 学生归属校验
    const student = await User.findOne({ _id: studentId, classId: classId, role: 'student' });
    if (!student) {
      logger.warn('未找到学生或不属于该班级', { studentId, classId });
      return res.status(404).json({ success: false, message: '未找到该学生或不属于该班级' });
    }

    // 清理会话
    await User.findByIdAndUpdate(studentId, { $unset: { sessionId: 1, sessionExpiresAt: 1 } });

    logger.info('学生已被强制下线', { studentId, classId });
    return res.status(200).json({ success: true, message: '已强制下线该学生' });
  } catch (error) {
    logger.error('强制下线学生失败', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: '强制下线失败' });
  }
};

// 教师强制下线班级所有学生
exports.forceLogoutAllStudents = async (req, res) => {
  try {
    const { classId } = req.params;
    logger.info('教师强制下线班级所有学生请求', { classId, teacherId: req.user._id });

    // 仅教师可操作
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: '只有教师可以进行该操作' });
    }

    // 班级归属校验
    const classObj = await Class.findOne({ _id: classId, teacher: req.user._id });
    if (!classObj) {
      logger.warn('未找到班级或无权操作', { classId, teacherId: req.user._id });
      return res.status(404).json({ success: false, message: '未找到该班级或无权操作' });
    }

    // 批量清理所有在线学生的会话（只清理会话未过期的学生）
    const now = new Date();
    const result = await User.updateMany(
      { classId: classId, role: 'student', sessionId: { $exists: true }, sessionExpiresAt: { $gt: now } },
      { $unset: { sessionId: 1, sessionExpiresAt: 1 } }
    );

    logger.info('班级所有学生已被强制下线', { classId, modifiedCount: result.modifiedCount });
    return res.status(200).json({
      success: true,
      message: `已强制下线${result.modifiedCount}名学生`,
      count: result.modifiedCount
    });
  } catch (error) {
    logger.error('强制下线班级所有学生失败', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: '强制下线失败' });
  }
};

// 下载学生导入模板
exports.downloadStudentTemplate = async (req, res) => {
  console.log('下载模板请求到达:', req.originalUrl); // 调试信息
  try {
    const templatePath = path.join(__dirname, '../templates/student_template.xlsx');
    res.download(templatePath, '学生导入模板.xlsx', (err) => {
      if (err) {
        console.error('下载模板失败:', err); // 记录错误信息
        res.status(500).json({
          success: false,
          message: '下载模板失败'
        });
      } else {
        console.log('模板下载成功'); // 记录成功信息
      }
    });
  } catch (error) {
    console.error('下载模板异常:', error); // 记录异常信息
    res.status(500).json({
      success: false,
      message: '下载模板失败'
    });
  }
};

// 批量导入学生
exports.importStudents = async (req, res) => {
  try {
    logger.info('开始导入学生', { file: req.file?.originalname });

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以导入学生'
      });
    }

    // 读取Excel文件
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // 验证数据格式
    for (const row of data) {
      if (!row.username || !row.name || !row.password || !row.grade || !row.class) {
        return res.status(400).json({
          success: false,
          message: '文件格式错误，请确保包含学号、姓名、密码、年级和班级字段'
        });
      }

      if (row.password.length < 6) {
        return res.status(400).json({
          success: false,
          message: '密码长度至少6位'
        });
      }

      // 验证年级格式（确保是四位数年份）
      if (!/^20\d{2}$/.test(String(row.grade))) {
        logger.warn('年级格式无效', { grade: row.grade });
        return res.status(400).json({
          success: false,
          message: `年级必须是四位数年份（如2023、2024），不能使用简写形式。发现无效年级: ${row.grade}`
        });
      }

      if (!Number.isInteger(Number(row.grade)) || !Number.isInteger(Number(row.class))) {
        return res.status(400).json({
          success: false,
          message: '年级和班级必须是整数'
        });
      }
    }

    // 检查学号是否重复
    const usernames = data.map(row => row.username);
    const existingStudents = await User.find({ username: { $in: usernames } });
    if (existingStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: `以下学号已存在：${existingStudents.map(s => s.username).join(', ')}`
      });
    }

    // 按年级和班级分组
    const groupedData = data.reduce((acc, row) => {
      const key = `${row.grade}-${row.class}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {});

    const results = [];
    // 处理每个班级的学生
    for (const [key, students] of Object.entries(groupedData)) {
      const [grade, className] = key.split('-');

      // 查找或创建班级
      let classObj = await Class.findOne({
        grade: Number(grade),
        name: Number(className),
        teacher: req.user._id
      });

      if (!classObj) {
        logger.info('创建新班级', { grade, className, teacherId: req.user._id });
        classObj = await Class.create({
          grade: Number(grade),
          name: Number(className),
          teacher: req.user._id
        });
      }

      // 创建学生账号并设置班级ID
      const createdStudents = await Promise.all(students.map(async row => {
        const student = await User.create({
          username: row.username,
          name: row.name,
          password: row.password,
          role: 'student',
          gender: 'other', // 设置默认性别为 other
          classId: classObj._id
        });
        return student._id;
      }));

      results.push({
        grade: grade,
        class: className,
        count: createdStudents.length
      });
    }

    // 删除临时文件
    await fsPromises.unlink(file.path);

    logger.info('学生导入成功', { results });
    res.status(200).json({
      success: true,
      message: `成功导入学生：${results.map(r => `${r.grade}级${r.class}班 ${r.count}人`).join('，')}`,
      data: results
    });
  } catch (error) {
    logger.error('导入学生失败', { error: error.message, stack: error.stack });

    // 删除临时文件
    if (req.file) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('删除临时文件失败', { error: unlinkError.message });
      }
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取班级学生名单
exports.getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    logger.info('获取班级学生名单', { classId });

    // 查找班级并携带所选机房布局（用于未登录查看座位图）
    const classObj = await Class.findById(classId)
      .populate('selectedClassroomLayout', 'name rows cols');

    if (!classObj) {
      logger.warn('未找到班级', { classId });
      return res.status(404).json({
        success: false,
        message: '未找到该班级'
      });
    }

    // 获取该班级的所有学生
    const students = await User.find({
      classId: classObj._id,
      role: 'student'
    }).select('name username seatNumber'); // 添加 seatNumber 字段

    logger.info('查询到班级学生', { classId, count: students.length });

    res.status(200).json({
      success: true,
      data: {
        students,
        isInClass: classObj.isInClass, // 返回班级是否正在上课中
        selectedClassroomLayout: classObj.selectedClassroomLayout || null
      }
    });
  } catch (error) {
    logger.error('获取班级学生名单错误', { error: error.message, stack: error.stack });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 清空班级所有学生的座位号（仅限班主任）
exports.clearClassSeats = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user._id;

    logger.info('清空班级学生座位号请求', { classId, userId });

    // 必须是教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师尝试清空座位', { userId, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '只有教师可以清空班级座位号'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({ _id: classId, teacher: userId });
    if (!classObj) {
      logger.warn('未找到班级或教师无权操作', { classId, userId });
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 批量清空座位号
    const result = await User.updateMany(
      { classId: classObj._id, role: 'student', seatNumber: { $exists: true } },
      { $unset: { seatNumber: 1 } }
    );

    logger.info('清空班级学生座位号成功', { classId, modifiedCount: result.modifiedCount });
    return res.status(200).json({
      success: true,
      message: '已清空班级学生座位号',
      cleared: result.modifiedCount
    });
  } catch (error) {
    logger.error('清空班级学生座位号失败', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: '清空班级学生座位号失败'
    });
  }
};

// 更新班级设置
exports.updateClassSettings = async (req, res) => {
  try {
    const { classId } = req.params;
    const {
      allowIpChange,
      isInClass,
      allowAiUsage,
      currentCourse,
      currentUnit,
      currentLesson,
      autoRedirectToLesson,
      selectedClassroomLayout,
      allowGameCenter
    } = req.body;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以更新班级设置'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 设置预期下课时间（如果启用上课状态）
    let scheduledEndTime = classObj.scheduledEndTime;
    if (isInClass === true) {
      scheduledEndTime = new Date(Date.now() + 45 * 60 * 1000); // 45分钟后
      logger.info('设置班级预期下课时间', { classId, endTime: scheduledEndTime });
    } else if (isInClass === false) {
      scheduledEndTime = null; // 如果手动下课，清除预期时间
    }

    // 更新设置
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      {
        $set: {
          ...(allowIpChange !== undefined && { allowIpChange }),
          ...(isInClass !== undefined && { isInClass }),
          ...(allowAiUsage !== undefined && { allowAiUsage }),
          ...(currentCourse !== undefined && { currentCourse }),
          ...(currentUnit !== undefined && { currentUnit }),
          ...(currentLesson !== undefined && { currentLesson }),
          ...(autoRedirectToLesson !== undefined && { autoRedirectToLesson }),
          ...(selectedClassroomLayout !== undefined && { selectedClassroomLayout }),
          ...(allowGameCenter !== undefined && { allowGameCenter }),
          scheduledEndTime, // 更新预期下课时间
        }
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    logger.error('更新班级设置出错', { error: error.message });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 删除班级
exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;
    logger.info('尝试删除班级', { classId, teacherId: req.user._id });

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试删除班级', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '只有教师可以删除班级'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      logger.warn('未找到班级或无权操作', { classId, teacherId: req.user._id });
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 查找该班级的所有学生
    const students = await User.find({ classId, role: 'student' });
    const studentIds = students.map(student => student._id);

    logger.info('查找到班级内的学生', { classId, studentCount: students.length });

    // 删除所有学生的作业提交记录及相关文件
    let totalSubmissionsDeleted = 0;
    let totalQuizSubmissionsDeleted = 0;
    let totalTypingRecordsDeleted = 0;

    for (const studentId of studentIds) {
      const submissions = await AssignmentSubmission.find({ student: studentId });

      // 删除提交记录关联的文件
      for (const submission of submissions) {
        if (submission.content?.file?.path) {
          try {
            const filePath = path.join(__dirname, '../..', submission.content.file.path);
            await fsPromises.unlink(filePath).catch(err => {
              logger.warn('删除作业文件失败', {
                filePath,
                error: err.message
              });
            });

            // 如果存在PDF预览文件，也删除它
            if (submission.content.file.pdfPreviewPath) {
              const pdfPath = path.join(__dirname, '../..', submission.content.file.pdfPreviewPath);
              await fsPromises.unlink(pdfPath).catch(err => {
                logger.warn('删除PDF预览文件失败', {
                  pdfPath,
                  error: err.message
                });
              });
            }
          } catch (error) {
            logger.error('删除文件时出错', {
              submissionId: submission._id,
              error: error.message
            });
          }
        }
      }

      // 删除学生的所有作业提交记录
      const deleteResult = await AssignmentSubmission.deleteMany({ student: studentId });
      totalSubmissionsDeleted += deleteResult.deletedCount;

      // 删除学生的所有测验提交记录
      const quizDeleteResult = await QuizSubmission.deleteMany({ studentId: studentId });
      totalQuizSubmissionsDeleted += quizDeleteResult.deletedCount;

      // 删除学生的所有打字记录
      const typingDeleteResult = await TypingRecord.deleteMany({ userId: studentId });
      totalTypingRecordsDeleted += typingDeleteResult.deletedCount;
    }

    // 删除所有学生账号
    const deleteStudentsResult = await User.deleteMany({ classId, role: 'student' });

    // 最后删除班级
    await Class.findByIdAndDelete(classId);

    logger.info('班级删除成功', {
      classId,
      deletedStudentsCount: deleteStudentsResult.deletedCount,
      deletedSubmissionsCount: totalSubmissionsDeleted,
      deletedQuizSubmissionsCount: totalQuizSubmissionsDeleted,
      deletedTypingRecordsCount: totalTypingRecordsDeleted
    });

    res.status(200).json({
      success: true,
      message: '班级及其学生数据删除成功',
      data: {
        deletedStudentsCount: deleteStudentsResult.deletedCount,
        deletedSubmissionsCount: totalSubmissionsDeleted,
        deletedQuizSubmissionsCount: totalQuizSubmissionsDeleted,
        deletedTypingRecordsCount: totalTypingRecordsDeleted
      }
    });
  } catch (error) {
    logger.error('删除班级失败', { error: error.message, stack: error.stack });
    res.status(400).json({
      success: false,
      message: error.message || '删除班级失败'
    });
  }
};

// 批量删除学生
exports.batchDeleteStudents = async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentIds } = req.body;

    logger.info('批量删除学生请求', {
      classId,
      studentCount: studentIds.length,
      teacherId: req.user._id
    });

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试批量删除学生', {
        userId: req.user._id,
        role: req.user.role,
        classId
      });
      return res.status(403).json({
        success: false,
        message: '只有教师可以删除学生'
      });
    }

    // 检查班级是否存在且属于当前教师
    const classObj = await Class.findOne({
      _id: classId,
      teacher: req.user._id
    });

    if (!classObj) {
      logger.warn('未找到班级或无权操作', {
        classId,
        teacherId: req.user._id
      });
      return res.status(404).json({
        success: false,
        message: '未找到该班级或无权操作'
      });
    }

    // 验证所有学生是否属于该班级
    const students = await User.find({
      _id: { $in: studentIds },
      classId: classId,
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      logger.warn('部分学生不存在或不属于该班级', {
        requestedCount: studentIds.length,
        foundCount: students.length,
        classId
      });
      return res.status(400).json({
        success: false,
        message: '部分学生不存在或不属于该班级'
      });
    }

    let deletedSubmissions = 0;
    let deletedFiles = 0;
    let deletedQuizSubmissions = 0;
    let deletedTypingRecords = 0;

    // 处理每个学生
    for (const student of students) {
      logger.info('开始删除学生及其相关数据', {
        studentId: student._id,
        classId,
        teacherId: req.user._id
      });

      // 查找并删除学生的所有作业提交记录
      const submissions = await AssignmentSubmission.find({ student: student._id });

      // 删除提交记录关联的文件
      for (const submission of submissions) {
        if (submission.content?.file?.path) {
          try {
            const filePath = path.join(__dirname, '../..', submission.content.file.path);
            await fsPromises.unlink(filePath).catch(err => {
              logger.warn('删除作业文件失败', {
                filePath,
                error: err.message
              });
            });
            deletedFiles++;

            // 如果存在PDF预览文件，也删除它
            if (submission.content.file.pdfPreviewPath) {
              const pdfPath = path.join(__dirname, '../..', submission.content.file.pdfPreviewPath);
              await fsPromises.unlink(pdfPath).catch(err => {
                logger.warn('删除PDF预览文件失败', {
                  pdfPath,
                  error: err.message
                });
              });
              deletedFiles++;
            }
          } catch (error) {
            logger.error('删除文件时出错', {
              submissionId: submission._id,
              error: error.message
            });
          }
        }
      }

      // 删除所有作业提交记录
      const deleteResult = await AssignmentSubmission.deleteMany({ student: student._id });
      deletedSubmissions += deleteResult.deletedCount;

      // 删除学生的所有测验提交记录
      const quizDeleteResult = await QuizSubmission.deleteMany({ studentId: student._id });
      deletedQuizSubmissions += quizDeleteResult.deletedCount;

      // 删除学生的所有打字记录
      const typingDeleteResult = await TypingRecord.deleteMany({ userId: student._id });
      deletedTypingRecords += typingDeleteResult.deletedCount;

      logger.info('删除学生相关数据完成', {
        studentId: student._id,
        assignmentSubmissions: deleteResult.deletedCount,
        quizSubmissions: quizDeleteResult.deletedCount,
        typingRecords: typingDeleteResult.deletedCount
      });
    }

    // 批量删除所有用户记录
    await User.deleteMany({ _id: { $in: studentIds } });

    logger.info('批量删除学生成功', {
      classId,
      deletedStudents: studentIds.length,
      deletedSubmissions,
      deletedFiles,
      deletedQuizSubmissions,
      deletedTypingRecords
    });

    res.status(200).json({
      success: true,
      message: `成功删除 ${studentIds.length} 名学生及其相关数据`,
      data: {
        deletedStudents: studentIds.length,
        deletedSubmissions,
        deletedFiles,
        deletedQuizSubmissions,
        deletedTypingRecords
      }
    });
  } catch (error) {
    logger.error('批量删除学生失败', {
      error: error.message,
      stack: error.stack,
      classId: req.params.classId
    });
    res.status(400).json({
      success: false,
      message: error.message || '批量删除学生失败'
    });
  }
};

// ============================================================
// 归档相关接口（管理员操作）
// ============================================================

/**
 * 按入学年级批量归档班级（管理员专用）
 * 将指定入学年份（grade）的所有班级标记为 archived，并清空上课状态
 */
exports.archiveGrade = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只有管理员可以执行归档操作' });
    }

    const { grade, graduationYear } = req.body;
    if (!grade || !/^20\d{2}$/.test(String(grade))) {
      return res.status(400).json({ success: false, message: '请提供有效的入学年份（如 2023）' });
    }

    const now = new Date();
    const result = await Class.updateMany(
      { grade: Number(grade), status: { $ne: 'archived' } },
      {
        $set: {
          status: 'archived',
          archivedAt: now,
          graduationYear: graduationYear || null,
          // 清空上课状态，防止学生误登
          isInClass: false,
          scheduledEndTime: null,
          currentCourse: null,
          currentUnit: null,
          currentLesson: null,
          autoRedirectToLesson: false
        }
      }
    );

    logger.info('年级归档完成', { grade, affectedClasses: result.modifiedCount });
    res.status(200).json({
      success: true,
      message: `${grade} 年级共 ${result.modifiedCount} 个班级已归档`,
      data: { grade, modifiedCount: result.modifiedCount, archivedAt: now }
    });
  } catch (error) {
    logger.error('归档年级失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message || '归档操作失败' });
  }
};

/**
 * 恢复单个已归档班级（管理员专用）
 */
exports.restoreClass = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只有管理员可以执行恢复操作' });
    }

    const classObj = await Class.findByIdAndUpdate(
      req.params.classId,
      { $set: { status: 'active', archivedAt: null, graduationYear: null } },
      { new: true }
    );

    if (!classObj) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }

    res.status(200).json({ success: true, message: '班级已恢复为活跃状态', data: classObj });
  } catch (error) {
    logger.error('恢复班级失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '恢复操作失败' });
  }
};

/**
 * 获取所有已归档班级列表（管理员/教师查看历史）
 * 管理员获取全部，教师只获取自己的
 */
exports.getArchivedClasses = async (req, res) => {
  try {
    const query = { status: 'archived' };
    if (req.user.role !== 'admin') {
      query.teacher = req.user._id;
    }

    const classes = await Class.find(query)
      .populate('teacher', 'name username')
      .sort({ archivedAt: -1 });

    // 获取每个归档班级的学生数
    const classesWithCount = await Promise.all(classes.map(async (classObj) => {
      const studentCount = await User.countDocuments({ classId: classObj._id, role: 'student' });
      return { ...classObj.toObject(), studentCount };
    }));

    res.status(200).json({ success: true, data: classesWithCount });
  } catch (error) {
    logger.error('获取归档班级失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '获取归档班级失败' });
  }
};

/**
 * 删除归档班级下学生的作业文件（节省存储空间，管理员专用）
 * 只删除文件，保留数据库记录（成绩/评语等不删）
 */
exports.deleteArchivedClassFiles = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只有管理员可以执行文件清理操作' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }
    if (classObj.status !== 'archived') {
      return res.status(400).json({ success: false, message: '只能清理已归档班级的文件' });
    }

    // 获取该班级所有学生
    const students = await User.find({ classId: req.params.classId, role: 'student' }).select('_id');
    const studentIds = students.map(s => s._id);

    const AssignmentSubmission = require('../models/AssignmentSubmission');
    // 查找有文件的提交记录
    const submissions = await AssignmentSubmission.find({
      student: { $in: studentIds },
      'content.file.path': { $exists: true, $ne: null }
    }).select('content.file.path content.file.pdfPreviewPath');

    let deletedFiles = 0;
    const uploadDir = require('path').join(__dirname, '../../uploads');
    const fsP = require('fs').promises;

    for (const sub of submissions) {
      // 删除原始文件
      if (sub.content?.file?.path) {
        const filePath = require('path').join(uploadDir, sub.content.file.path.replace(/^uploads[\/\\]?/, ''));
        try {
          await fsP.unlink(filePath);
          deletedFiles++;
        } catch (e) { /* 文件不存在则忽略 */ }
      }
      // 删除 PDF 预览文件
      if (sub.content?.file?.pdfPreviewPath) {
        const pdfPath = require('path').join(uploadDir, sub.content.file.pdfPreviewPath.replace(/^uploads[\/\\]?/, ''));
        try { await fsP.unlink(pdfPath); } catch (e) { /* 忽略 */ }
      }
    }

    // 将提交记录中的文件路径标记为已删除
    await AssignmentSubmission.updateMany(
      { student: { $in: studentIds }, 'content.file.path': { $exists: true, $ne: null } },
      { $set: { 'content.file.fileDeleted': true, 'content.file.pdfPreviewDeleted': true } }
    );

    logger.info('归档班级文件清理完成', { classId: req.params.classId, deletedFiles });
    res.status(200).json({
      success: true,
      message: `已清理 ${deletedFiles} 个作业文件（数据库记录保留）`,
      data: { deletedFiles }
    });
  } catch (error) {
    logger.error('清理归档文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message || '文件清理失败' });
  }
};

module.exports = exports;