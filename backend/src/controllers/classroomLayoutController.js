const ClassroomLayout = require('../models/ClassroomLayout');
const User = require('../models/User');
const Class = require('../models/Class');
const logger = require('../utils/logger');

/**
 * 创建新的机房布局
 */
exports.createLayout = async (req, res) => {
  try {
    logger.info('创建机房布局请求', { 
      userId: req.user._id,
      layoutData: req.body 
    });

    const { name, description, rows, cols, seats, classId } = req.body;

    // 检查是否已存在同名机房布局
    const existingLayout = await ClassroomLayout.findOne({
      name,
      createdBy: req.user._id
    });

    if (existingLayout) {
      logger.warn('机房布局名称已存在', { name, userId: req.user._id });
      return res.status(400).json({ message: '该机房布局名称已存在' });
    }

    const layout = new ClassroomLayout({
      name,
      description,
      rows,
      cols,
      seats,
      createdBy: req.user._id,
      class: classId
    });

    await layout.save();

    logger.info('机房布局创建成功', { layoutId: layout._id });
    res.status(201).json(layout);
  } catch (error) {
    logger.error('创建机房布局失败', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ message: '创建机房布局失败' });
  }
};

/**
 * 获取机房布局列表
 */
exports.getLayouts = async (req, res) => {
  try {
    logger.info('获取机房布局列表请求', { userId: req.user._id, role: req.user.role });
    
    let layouts = [];
    
    // 根据用户角色获取对应的机房布局
    if (req.user.role === 'teacher') {
      // 如果是老师，直接查询他创建的机房布局
      layouts = await ClassroomLayout.find({ createdBy: req.user._id })
        .populate('class', 'name')
        .select('-seats');
        
      logger.info('教师获取机房布局列表成功', { count: layouts.length });
    } else if (req.user.role === 'student') {
      // 如果是学生，先查找所在班级
      const student = await User.findById(req.user._id).select('classId');
      
      if (!student || !student.classId) {
        logger.warn('学生没有所属班级', { userId: req.user._id });
        return res.json([]);
      }
      
      // 查找班级的老师
      const classInfo = await Class.findById(student.classId).select('teacher');
      
      if (!classInfo || !classInfo.teacher) {
        logger.warn('学生所属班级没有关联教师', { userId: req.user._id, classId: student.classId });
        return res.json([]);
      }
      
      // 获取该老师创建的机房布局
      layouts = await ClassroomLayout.find({ 
        $or: [
          { createdBy: classInfo.teacher }, // 教师创建的所有布局
          { class: student.classId }        // 或者特定关联到该班级的布局
        ]
      })
      .populate('class', 'name')
      .select('-seats');
      
      logger.info('学生获取班级老师的机房布局列表成功', { 
        count: layouts.length, 
        teacherId: classInfo.teacher,
        classId: student.classId 
      });
    } else {
      // 管理员角色可以查看所有布局
      if (req.user.role === 'admin') {
        layouts = await ClassroomLayout.find({})
          .populate('class', 'name')
          .populate('createdBy', 'name')
          .select('-seats');
          
        logger.info('管理员获取所有机房布局列表成功', { count: layouts.length });
      } else {
        logger.warn('未知角色请求机房布局', { role: req.user.role });
        return res.status(403).json({ message: '无权访问机房布局' });
      }
    }

    res.json(layouts);
  } catch (error) {
    logger.error('获取机房布局列表失败', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      role: req.user.role
    });
    res.status(500).json({ message: '获取机房布局列表失败' });
  }
};

/**
 * 获取单个机房布局详情
 */
exports.getLayout = async (req, res) => {
  try {
    logger.info('获取机房布局详情请求', { 
      layoutId: req.params.id,
      userId: req.user._id 
    });

    const layout = await ClassroomLayout.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    }).populate('class', 'name');

    if (!layout) {
      logger.warn('机房布局不存在', { layoutId: req.params.id });
      return res.status(404).json({ message: '机房布局不存在' });
    }

    logger.info('获取机房布局详情成功', { layoutId: layout._id });
    res.json(layout);
  } catch (error) {
    logger.error('获取机房布局详情失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: '获取机房布局详情失败' });
  }
};

/**
 * 更新机房布局
 */
exports.updateLayout = async (req, res) => {
  try {
    logger.info('更新机房布局请求', {
      layoutId: req.params.id,
      userId: req.user._id,
      updateData: req.body
    });

    const { name, description, rows, cols, seats, classId } = req.body;

    // 检查是否存在同名布局（排除当前布局）
    const existingLayout = await ClassroomLayout.findOne({
      name,
      createdBy: req.user._id,
      _id: { $ne: req.params.id }
    });

    if (existingLayout) {
      logger.warn('机房布局名称已存在', { name, userId: req.user._id });
      return res.status(400).json({ message: '该机房布局名称已存在' });
    }

    const layout = await ClassroomLayout.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      {
        name,
        description,
        rows,
        cols,
        seats,
        class: classId
      },
      { new: true }
    );

    if (!layout) {
      logger.warn('机房布局不存在', { layoutId: req.params.id });
      return res.status(404).json({ message: '机房布局不存在' });
    }

    logger.info('更新机房布局成功', { layoutId: layout._id });
    res.json(layout);
  } catch (error) {
    logger.error('更新机房布局失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: '更新机房布局失败' });
  }
};

/**
 * 删除机房布局
 */
exports.deleteLayout = async (req, res) => {
  try {
    logger.info('删除机房布局请求', {
      layoutId: req.params.id,
      userId: req.user._id
    });

    const layout = await ClassroomLayout.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!layout) {
      logger.warn('机房布局不存在', { layoutId: req.params.id });
      return res.status(404).json({ message: '机房布局不存在' });
    }

    logger.info('删除机房布局成功', { layoutId: req.params.id });
    res.json({ message: '机房布局已删除' });
  } catch (error) {
    logger.error('删除机房布局失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: '删除机房布局失败' });
  }
}; 