const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');

// 检查用户是否为教师
const checkTeacherRole = (req, res) => {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      message: '只有教师可以访问此功能'
    });
  }
  return null;
};

// 创建课程单元
exports.createUnit = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    console.log('Creating unit for course:', req.params.courseId);
    console.log('User:', req.user);

    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 检查是否为课程的教师
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此课程'
      });
    }

    // 获取当前最大的 order 值
    const maxOrderUnit = await CourseUnit.findOne({ course: course._id })
      .sort('-order');
    const nextOrder = maxOrderUnit ? maxOrderUnit.order + 1 : 1;

    // 创建单元
    const unit = await CourseUnit.create({
      ...req.body,
      course: course._id,
      order: nextOrder
    });

    res.status(201).json({
      success: true,
      data: unit
    });
  } catch (error) {
    console.error('Error in createUnit:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 更新课程单元
exports.updateUnit = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 检查是否为课程的教师
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此课程'
      });
    }

    const unit = await CourseUnit.findOneAndUpdate(
      { _id: req.params.id, course: course._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: '未找到课程单元'
      });
    }

    res.status(200).json({
      success: true,
      data: unit
    });
  } catch (error) {
    console.error('Error in updateUnit:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 删除课程单元
exports.deleteUnit = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 检查是否为课程的教师
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此课程'
      });
    }

    // 检查单元是否存在
    const unit = await CourseUnit.findOne({
      _id: req.params.id,
      course: course._id
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: '未找到课程单元'
      });
    }

    // 检查单元下是否有课时
    const lessonsCount = await Lesson.countDocuments({ unit: unit._id });
    if (lessonsCount > 0) {
      return res.status(400).json({
        success: false,
        message: '请先删除单元下的所有课时'
      });
    }

    // 删除单元
    await CourseUnit.findByIdAndDelete(unit._id);

    // 重新排序其他单元
    await CourseUnit.updateMany(
      { course: course._id, order: { $gt: unit.order } },
      { $inc: { order: -1 } }
    );

    res.status(200).json({
      success: true,
      message: '单元删除成功'
    });
  } catch (error) {
    console.error('Error in deleteUnit:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 获取课程单元列表
exports.getUnits = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    console.log('courseId:', req.params.courseId);
    console.log('user:', req.user);

    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 检查是否为课程的教师
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限查看此课程单元'
      });
    }

    const units = await CourseUnit.find({ course: course._id })
      .sort('order');

    res.status(200).json({
      success: true,
      count: units.length,
      data: units
    });
  } catch (error) {
    console.error('Error in getUnits:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 更新单元顺序
exports.updateUnitsOrder = async (req, res) => {
  try {
    // 检查教师权限
    const error = checkTeacherRole(req, res);
    if (error) return;

    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '未找到课程'
      });
    }

    // 检查是否为课程的教师
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此课程'
      });
    }

    const units = req.body.units || req.body.lessons || req.body;

    if (!Array.isArray(units)) {
      return res.status(400).json({
        success: false,
        message: 'units.map is not a function (units must be an array)'
      });
    }

    // 使用 Promise.all 并行处理所有更新
    await Promise.all(units.map(async (unit) => {
      await CourseUnit.findByIdAndUpdate(
        unit.unitId,
        { order: unit.order },
        { new: true }
      );
    }));

    // 获取更新后的单元列表
    const updatedUnits = await CourseUnit.find({ course: course._id })
      .sort('order');

    res.status(200).json({
      success: true,
      data: updatedUnits
    });
  } catch (error) {
    console.error('Error in updateUnitsOrder:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
