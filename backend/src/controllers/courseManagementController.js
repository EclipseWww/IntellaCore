const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const User = require('../models/User');

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

    console.log('Current user:', req.user);  // 添加日志

    // 处理课程访问控制
    const { isPublic, accessibleClasses, ...otherData } = req.body;
    
    const courseData = {
      ...otherData,
      isPublic: isPublic || false,
      accessibleClasses: accessibleClasses || [],
      instructor: req.user.id  // 使用 id 而不是 _id
    };

    console.log('Course data:', courseData);  // 添加日志

    const course = await Course.create(courseData);
    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error in createCourse:', error);  // 添加错误日志
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

    // 检查是否为课程的教师或管理员
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此课程'
      });
    }

    // 处理课程访问控制
    const { isPublic, accessibleClasses, ...otherData } = req.body;
    
    // 更新课程信息
    const updateData = {
      ...otherData,
      isPublic: isPublic || false,
      accessibleClasses: accessibleClasses || []
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
    console.error('Error in updateCourse:', error);  // 添加错误日志
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

    console.log('Current user:', req.user);

    // 管理员可以看到所有课程，教师只能看到自己的课程
    const query = req.user.role === 'admin' ? {} : { instructor: req.user.id };
    const courses = await Course.find(query)
      .populate('instructor', 'name username')
      .populate({
        path: 'accessibleClasses',
        match: { status: { $ne: 'archived' } }
      })
      .sort('-createdAt');

    const processedCourses = courses.map(course => {
      const courseObj = course.toObject();
      if (courseObj.accessibleClasses) {
        courseObj.accessibleClasses = courseObj.accessibleClasses
          .filter(c => c != null)
          .map(c => c._id || c);
      }
      return courseObj;
    });

    console.log('Query result:', processedCourses);

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

    console.log('Current user:', req.user);  // 添加日志
    
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    console.log('Course instructor:', course.instructor);  // 添加日志
    console.log('Current user id:', req.user.id);  // 添加日志

    // 检查是否为课程的教师或管理员
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
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
    console.error('Error in getCourseDetails:', error);  // 添加错误日志
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

    // 检查是否为课程的教师或管理员
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: '没有权限删除此课程' });
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
    console.error('删除课程失败:', error);
    res.status(500).json({ message: '删除课程失败', error: error.message });
  }
};
