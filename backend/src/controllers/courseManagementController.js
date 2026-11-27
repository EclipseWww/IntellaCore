const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const logger = require('../utils/logger');
const access = require('../services/teachingAccess');
const { formatClassName } = require('../utils/className');

// 检查用户是否为教师或管理员
const checkTeacherRole = (req, res) => {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: '只有教师或管理员可以访问此功能'
    });
  }
  return null;
};

// 创建新课程
exports.createCourse = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    logger.info('Current user:', req.user);  // 添加日志

    // 处理课程访问控制
    const { isPublic, accessibleClasses, instructor, coInstructors, ...otherData } = req.body;
    
    const courseData = {
      ...otherData,
      isPublic: isPublic || false,
      accessibleClasses: accessibleClasses || [],
      instructor: req.user.id  // 使用 id 而不是 _id
    };

    logger.info('Course data:', courseData);  // 添加日志

    const course = await Course.create(courseData);
    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('Error in createCourse:', error);  // 添加错误日志
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 更新课程信息
exports.updateCourse = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 课程创建者、协作教师或管理员可以修改
    if (!access.canMaintainCourse(req.user, course)) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此课程'
      });
    }

    // 处理课程访问控制；创建者和协作教师只能在这里修改，不能通过普通保存改掉
    const { isPublic, accessibleClasses, instructor, coInstructors, _id, createdAt, updatedAt, ...otherData } = req.body;
    
    // 更新课程信息。可访问班级只改动编辑者任教的班级，其他教师班级的访问权保持不变
    const updateData = {
      ...otherData,
      isPublic: isPublic || false,
      accessibleClasses: await access.mergeAccessibleClasses(req.user, course.accessibleClasses, accessibleClasses)
    };

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedCourse
    });
  } catch (error) {
    logger.error('Error in updateCourse:', error);  // 添加错误日志
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取教师的所有课程（管理员可以看到所有课程）
exports.getTeacherCourses = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    logger.info('Current user:', req.user);

    // 管理员可以看到所有课程，教师看到自己创建和协作的课程
    const query = req.user.role === 'admin' ? {} : access.courseTeacherFilter(req.user.id);
    const courses = await Course.find(query)
      .populate('instructor', 'name username')
      .populate('coInstructors', 'name username')
      .populate({
        path: 'accessibleClasses',
        match: { status: { $ne: 'archived' } }
      })
      .sort('-createdAt');

    const processedCourses = courses.map(course => {
      const courseObj = course.toObject();
      courseObj.isOwner = req.user.role === 'admin' || access.isCourseOwner(req.user, course);
      courseObj.coInstructors = (courseObj.coInstructors || []).filter(Boolean)
        .map(t => ({ _id: t._id, name: t.name, username: t.username }));
      if (courseObj.accessibleClasses) {
        const populated = courseObj.accessibleClasses.filter(c => c != null);
        // 班级名称：共同维护的课程里有其他老师任教的班级，前端不一定有这些班级的信息
        courseObj.accessibleClassInfo = populated
          .map(c => (c && c._id ? { _id: c._id, displayName: formatClassName(c) } : null))
          .filter(Boolean);
        courseObj.accessibleClasses = populated.map(c => c._id || c);
      }
      return courseObj;
    });

    logger.info('Query result:', processedCourses);

    res.status(200).json({
      success: true,
      count: processedCourses.length,
      data: processedCourses
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个课程详情
exports.getCourseDetails = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    logger.info('Current user:', req.user);  // 添加日志
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    logger.info('Course instructor:', course.instructor);  // 添加日志
    logger.info('Current user id:', req.user.id);  // 添加日志

    // 检查是否为课程的创建者、协作教师或管理员
    if (!access.canMaintainCourse(req.user, course)) {
      return res.status(403).json({
        success: false,
        message: '没有权限查看此课程详情'
      });
    }

    // 获取课程单元
    const units = await CourseUnit.find({ course: course._id })
      .sort('order');

    // 获取课程的所有课时
    const lessons = await Lesson.find({ course: course._id })
      .populate('unit')
      .sort('order');

    res.status(200).json({
      success: true,
      data: {
        course,
        units,
        lessons
      }
    });
  } catch (error) {
    logger.error('Error in getCourseDetails:', error);  // 添加错误日志
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 删除课程
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    // 检查课程是否存在
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 只有课程创建者或管理员可以删除（协作教师不能删除）
    if (req.user.role !== 'admin' && !access.isCourseOwner(req.user, course)) {
      return res.status(403).json({ message: '只有课程创建者可以删除此课程' });
    }

    // 检查课程是否有单元
    const unitsCount = await CourseUnit.countDocuments({ course: course._id });
    if (unitsCount > 0) {
      return res.status(400).json({ message: '请先删除课程下的所有单元' });
    }

    // 删除课程
    await Course.findByIdAndDelete(id);

    res.json({ message: '课程删除成功' });
  } catch (error) {
    logger.error('删除课程失败:', error);
    res.status(500).json({ message: '删除课程失败', error: error.message });
  }
};

// 设置课程的协作教师（课程创建者或管理员）
exports.setCourseCoInstructors = async (req, res) => {
  try {
    const error = checkTeacherRole(req, res);
    if (error) return;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: '未找到课程' });
    if (req.user.role !== 'admin' && !access.isCourseOwner(req.user, course)) {
      return res.status(403).json({ success: false, message: '只有课程创建者可以设置协作教师' });
    }
    const ids = access.cleanTeacherIds(req.body.teacherIds, course.instructor).slice(0, 20);
    const teachers = ids.length
      ? await User.find({ _id: { $in: ids }, role: 'teacher', isActive: { $ne: false } }).select('_id name username').lean()
      : [];
    if (teachers.length !== ids.length) {
      return res.status(400).json({ success: false, message: '只能选择在职的教师' });
    }
    course.coInstructors = teachers.map(t => t._id);
    await course.save();
    logger.info('设置课程协作教师', { courseId: String(course._id), coInstructors: ids, operator: req.user._id || req.user.id });
    res.json({
      success: true,
      message: teachers.length ? `协作教师：${teachers.map(t => t.name).join('、')}` : '已取消全部协作教师',
      data: { coInstructors: teachers.map(t => ({ _id: t._id, name: t.name, username: t.username })) }
    });
  } catch (error) {
    logger.error('设置课程协作教师失败', { error: error.message, courseId: req.params.id });
    res.status(500).json({ success: false, message: '设置协作教师失败' });
  }
};
