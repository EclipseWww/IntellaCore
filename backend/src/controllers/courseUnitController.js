const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const mongoose = require('mongoose');
const LessonModel = require('../models/Lesson'); // 添加 Lesson 模型的引用

// 获取课程的所有单元
exports.getCourseUnits = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('获取课程单元，courseId:', courseId);
    
    // 获取所有顶级单元（章节）
    const units = await CourseUnit.find({
      course: courseId,
      parent: null
    }).sort('order');

    console.log('找到的顶级单元数量:', units.length);
    
    if (units.length === 0) {
      // 检查课程是否存在
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: '课程不存在' });
      }
      console.log('课程存在，但没有找到任何单元');
    }

    // 递归获取子单元
    const populatedUnits = await Promise.all(
      units.map(async unit => {
        const children = await getChildUnits(unit._id);
        return {
          ...unit.toObject(),
          children
        };
      })
    );

    console.log('返回单元数据，包含子单元');
    res.json(populatedUnits);
  } catch (error) {
    console.error('获取课程单元失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 递归获取子单元
const getChildUnits = async (parentId) => {
  const children = await CourseUnit.find({ parent: parentId }).sort('order');
  const populatedChildren = await Promise.all(
    children.map(async child => {
      const grandChildren = await getChildUnits(child._id);
      return {
        ...child.toObject(),
        children: grandChildren
      };
    })
  );
  return populatedChildren;
};

// 获取课程单元的所有课时
exports.getUnitLessons = async (req, res) => {
  try {
    const { unitId } = req.params;
    console.log('获取课时，unitId:', unitId);
    
    // 从 Lesson 表中获取所有课时
    const lessons = await Lesson.find({
      unit: unitId
    }).sort('order');

    console.log('找到的课时数量:', lessons.length);
    console.log('课时数据:', lessons);
    
    res.json({
      success: true,
      data: lessons
    });
  } catch (error) {
    console.error('获取课时失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 创建课程单元
exports.createCourseUnit = async (req, res) => {
  try {
    const { courseId } = req.params;
    const unitData = req.body;

    // 验证课程存在
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 如果是子单元，验证父单元存在
    if (unitData.parent) {
      const parentUnit = await CourseUnit.findById(unitData.parent);
      if (!parentUnit) {
        return res.status(404).json({ message: '父单元不存在' });
      }
    }

    // 创建单元
    const unit = new CourseUnit({
      ...unitData,
      course: courseId
    });

    await unit.save();
    res.status(201).json(unit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新课程单元
exports.updateCourseUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const updates = req.body;

    const unit = await CourseUnit.findByIdAndUpdate(
      unitId,
      updates,
      { new: true, runValidators: true }
    );

    if (!unit) {
      return res.status(404).json({ message: '单元不存在' });
    }

    res.json(unit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 删除课程单元
exports.deleteCourseUnit = async (req, res) => {
  try {
    const { unitId } = req.params;

    // 检查是否有子单元
    const hasChildren = await CourseUnit.exists({ parent: unitId });
    if (hasChildren) {
      return res.status(400).json({ message: '请先删除所有子单元' });
    }

    const unit = await CourseUnit.findByIdAndDelete(unitId);
    if (!unit) {
      return res.status(404).json({ message: '单元不存在' });
    }

    res.json({ message: '单元已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 调整单元顺序
exports.reorderUnits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { units } = req.body; // [{id, order}]

    // 批量更新单元顺序
    await Promise.all(
      units.map(({ id, order }) =>
        CourseUnit.findByIdAndUpdate(
          id,
          { order },
          { session }
        )
      )
    );

    await session.commitTransaction();
    res.json({ message: '顺序已更新' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// 获取单元详情
exports.getCourseUnitDetails = async (req, res) => {
  try {
    const { unitId } = req.params;
    console.log('获取单元详情，unitId:', unitId);
    
    const unit = await CourseUnit.findById(unitId);
    if (!unit) {
      return res.status(404).json({ message: '单元不存在' });
    }

    res.json(unit);
  } catch (error) {
    console.error('获取单元详情失败:', error);
    res.status(500).json({ message: error.message });
  }
};
