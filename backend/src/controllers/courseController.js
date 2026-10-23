const mongoose = require('mongoose');
const Course = require('../models/Course');
const User = require('../models/User');
const Class = require('../models/Class');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const Achievement = require('../models/Achievement');
const logger = require('../utils/logger');

// 获取所有课程
exports.getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, level, tags, search } = req.query;

    const query = {};
    if (level) query.level = level;
    if (tags) query.tags = { $in: tags.split(',') };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('instructor', 'name avatar')
      .select('title description instructor duration level tags coverImage enrolledCount rating')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取单个课程详情
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name avatar bio')
      .populate({
        path: 'reviews',
        populate: {
          path: 'student',
          select: 'name avatar'
        }
      });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 获取当前用户的学习进度
    const progress = await Progress.findOne({
      studentId: req.user._id,
      courseId: req.params.id
    });

    // 获取课程统计信息
    const stats = {
      totalStudents: await Progress.countDocuments({ courseId: new mongoose.Types.ObjectId(req.params.id) }),
      averageProgress: await Progress.aggregate([
        { $match: { courseId: new mongoose.Types.ObjectId(req.params.id) } },
        { $group: { _id: null, avg: { $avg: '$progress' } } }
      ]).then(result => result[0]?.avg || 0)
    };

    res.json({
      ...course.toObject(),
      userProgress: progress,
      stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取课程学习进度
exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.query;
    const progress = await Progress.findOne({
      studentId: req.user._id,
      courseId
    }).populate('completedLessons.lessonId');

    if (!progress) {
      return res.json({
        progress: 0,
        completedLessons: [],
        lastLesson: null,
        startDate: null,
        status: 'not_started'
      });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新学习进度
exports.updateProgress = async (req, res) => {
  try {
    const { courseId, lessonId, timeSpent, completed } = req.body;

    let progress = await Progress.findOne({
      studentId: req.user._id,
      courseId
    });

    if (!progress) {
      progress = new Progress({
        studentId: req.user._id,
        courseId,
        startDate: new Date(),
        status: 'in_progress'
      });
    }

    if (completed) {
      // 添加到已完成课程列表
      if (!progress.completedLessons.some(lesson => lesson.lessonId.equals(lessonId))) {
        progress.completedLessons.push({
          lessonId,
          completedAt: new Date(),
          timeSpent
        });
      }
    }

    // 更新最后访问的课程
    progress.lastLesson = {
      lessonId,
      position: req.body.position || 0
    };
    progress.lastAccessDate = new Date();

    // 计算总进度
    const course = await Course.findById(courseId);
    const totalLessons = course.lessons.length;
    progress.progress = (progress.completedLessons.length / totalLessons) * 100;

    // 如果完成了所有课程
    if (progress.progress === 100 && progress.status !== 'completed') {
      progress.status = 'completed';

      // 更新成就
      await Achievement.findOneAndUpdate(
        { studentId: req.user._id },
        {
          $inc: {
            coursesCompleted: 1,
            totalPoints: 100 // 完成课程奖励100积分
          }
        },
        { upsert: true }
      );
    }

    await progress.save();

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取课程资源
exports.getCourseResources = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId)
      .select('resources')
      .populate('resources.uploadedBy', 'name');

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    res.json(course.resources);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取课程统计数据
exports.getCourseStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    const stats = await Progress.aggregate([
      { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averageProgress: { $avg: '$progress' },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          averageTimeSpent: {
            $avg: {
              $reduce: {
                input: '$completedLessons',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.timeSpent'] }
              }
            }
          }
        }
      }
    ]);

    res.json(stats[0] || {
      totalStudents: 0,
      averageProgress: 0,
      completedCount: 0,
      averageTimeSpent: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取推荐课程
exports.getRecommendedCourses = async (req, res) => {
  try {
    // 获取用户已完成的课程标签
    const userProgress = await Progress.find({
      studentId: req.user._id,
      status: 'completed'
    }).populate('courseId', 'tags');

    const userTags = new Set();
    userProgress.forEach(progress => {
      progress.courseId.tags.forEach(tag => userTags.add(tag));
    });

    // 基于用户标签推荐课程
    const recommendedCourses = await Course.find({
      tags: { $in: Array.from(userTags) },
      _id: { $nin: userProgress.map(p => p.courseId._id) }
    })
      .populate('instructor', 'name avatar')
      .select('title description instructor duration level tags coverImage rating')
      .limit(3)
      .sort({ rating: -1 });

    res.json(recommendedCourses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取所有课程
exports.getAllCoursesNew = async (req, res) => {
  try {
    let query = {};

    // 如果是学生用户，只显示其班级教师的课程
    if (req.user.role === 'student') {
      // 获取用户ID（兼容 _id 和 id）
      const userId = req.user._id || req.user.id;

      console.log('用户信息:', {
        id: userId,
        username: req.user.username,
        role: req.user.role
      });

      // 先检查用户ID是否有效
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('无效的用户ID格式:', userId);
        return res.status(400).json({
          success: false,
          message: '无效的用户ID格式'
        });
      }

      // 确保使用ObjectId类型进行查询
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // 先检查用户是否存在
      const user = await User.findById(userObjectId);
      console.log('数据库中的用户信息:', user);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 查找学生所在的班级
      const studentClass = await Class.findOne({
        _id: user.classId
      }).populate('teacher');

      if (!studentClass) {
        return res.status(404).json({
          success: false,
          message: '未找到学生所在班级',
          debug: {
            userId: userId,
            username: user.username
          }
        });
      }

      // 查询条件：课程是公开的，或者学生所在班级在可访问班级列表中
      query.$or = [
        { isPublic: true },
        {
          accessibleClasses: user.classId,
          $expr: { $gt: [{ $size: "$accessibleClasses" }, 0] } // 确保accessibleClasses不为空
        }
      ];
    }

    const courses = await Course.find(query)
      .populate('instructor', 'name')
      .select('-lessons.content')
      .lean();

    res.json({
      success: true,
      courses
    });
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({
      success: false,
      message: '获取课程列表失败',
      error: error.message
    });
  }
};

// 获取课程详情
exports.getCourseByIdNew = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('instructor', 'name')
      .lean();

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error getting course details:', error);
    res.status(500).json({ message: '获取课程详情失败' });
  }
};

// 获取课程进度
exports.getCourseProgressNew = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: '未授权的访问' });
    }

    const progress = await Progress.findOne({
      studentId: req.user.id,
      courseId: req.params.courseId
    }).lean();

    if (!progress) {
      // 如果没有进度记录，创建一个新的
      const newProgress = await Progress.create({
        studentId: req.user.id,
        courseId: req.params.courseId,
        completedLessons: [],
        totalTime: 0,
        lastAccessTime: new Date(),
        points: 0
      });
      return res.json(newProgress);
    }

    res.json(progress);
  } catch (error) {
    console.error('Error getting course progress:', error);
    res.status(500).json({ message: '获取课程进度失败' });
  }
};

// 更新课程进度
exports.updateProgressNew = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: '未授权的访问' });
    }

    const { lessonId, timeSpent } = req.body;
    const progress = await Progress.findOne({
      studentId: req.user.id,
      courseId: req.params.courseId
    });

    if (!progress) {
      return res.status(404).json({ message: '进度记录不存在' });
    }

    // 如果这是一个新完成的课程
    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
      progress.points += 10; // 完成课程奖励积分
    }

    progress.totalTime += timeSpent;
    progress.lastAccessTime = new Date();
    await progress.save();

    res.json(progress);
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ message: '更新进度失败' });
  }
};

// 创建示例课程数据
exports.createSampleCourses = async (req, res) => {
  try {
    // 首先创建一个示例教师用户
    let instructor = await User.findOne({ role: 'teacher' });
    if (!instructor) {
      instructor = await User.create({
        username: 'teacher1',
        email: 'teacher1@example.com',
        password: 'password123',
        role: 'teacher',
        name: '张教授'
      });
    }

    // 示例课程数据
    const sampleCourses = [
      {
        title: '高等数学基础',
        description: '本课程涵盖微积分、线性代数等重要数学概念，帮助学生建立扎实的数学基础。',
        instructor: instructor._id,
        duration: '48课时',
        level: '入门',
        tags: ['数学', '必修课'],
        lessons: [
          {
            title: '函数与极限',
            content: '本章节介绍函数的基本概念、极限的定义和性质等内容。',
            duration: 45,
            order: 1
          },
          {
            title: '导数与微分',
            content: '学习导数的概念、计算方法和应用。',
            duration: 45,
            order: 2
          }
        ]
      },
      {
        title: '计算机编程入门',
        description: '通过Python语言学习编程基础知识，培养编程思维和问题解决能力。',
        instructor: instructor._id,
        duration: '36课时',
        level: '入门',
        tags: ['编程', '选修课'],
        lessons: [
          {
            title: 'Python基础语法',
            content: '介绍Python的基本语法、数据类型和控制结构。',
            duration: 40,
            order: 1
          },
          {
            title: '函数和模块',
            content: '学习函数的定义、调用和模块的使用方法。',
            duration: 40,
            order: 2
          }
        ]
      },
      {
        title: '英语口语进阶',
        description: '提高英语口语表达能力，掌握地道的表达方式和交际技巧。',
        instructor: instructor._id,
        duration: '24课时',
        level: '中级',
        tags: ['英语', '选修课'],
        lessons: [
          {
            title: '日常对话实践',
            content: '通过情景对话练习提高口语交际能力。',
            duration: 30,
            order: 1
          },
          {
            title: '商务英语会话',
            content: '学习商务场合常用的英语表达。',
            duration: 30,
            order: 2
          }
        ]
      }
    ];

    // 删除现有的示例课程
    await Course.deleteMany({});

    // 创建新的示例课程
    await Course.insertMany(sampleCourses);

    res.json({ message: '示例课程数据创建成功' });
  } catch (error) {
    console.error('Error creating sample courses:', error);
    res.status(500).json({ message: '创建示例课程数据失败' });
  }
};

// 获取学生课程详情
exports.getStudentCourseDetails = async (req, res) => {
  try {
    logger.info('获取学生课程详情', {
      courseId: req.params.courseId,
      userId: req.user.id,
      role: req.user.role
    });

    // 检查是否为学生
    if (req.user.role !== 'student') {
      logger.warn('非学生用户尝试访问学生课程详情', { userId: req.user.id });
      return res.status(403).json({
        success: false,
        message: '只有学生可以访问此接口'
      });
    }

    // 获取课程基本信息
    const course = await Course.findById(req.params.courseId)
      .populate('instructor', 'name')
      .lean();

    if (!course) {
      logger.warn('课程不存在', { courseId: req.params.courseId });
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    // 获取课程单元
    const units = await CourseUnit.find({ course: course._id })
      .sort('order')
      .lean();

    // 获取课程的所有课时
    const lessons = await Lesson.find({ course: course._id })
      .select('title description objectives unit order')
      .populate('unit', 'title')
      .sort('order')
      .lean();

    // 获取学生所在班级信息
    const student = await User.findById(req.user.id);
    const classInfo = await Class.findById(student.classId)
      .select('currentLesson currentUnit')
      .lean();

    // 获取学生的课程进度
    const progress = await Progress.findOne({
      studentId: req.user.id,
      courseId: req.params.courseId
    }).lean() || { completedLessons: [] };

    // 处理课时数据，添加完成状态
    const processedLessons = lessons.map(lesson => {
      const isCompleted = progress.completedLessons.some(
        completed => completed.lessonId.toString() === lesson._id.toString()
      );

      const isCurrentLesson = classInfo &&
        classInfo.currentLesson &&
        classInfo.currentLesson.toString() === lesson._id.toString();

      return {
        ...lesson,
        isCompleted,
        isCurrentLesson
      };
    });

    // 处理单元数据，添加课时和完成状态
    const processedUnits = units.map(unit => {
      const unitLessons = processedLessons.filter(
        lesson => lesson.unit._id.toString() === unit._id.toString()
      );

      const isCurrentUnit = classInfo &&
        classInfo.currentUnit &&
        classInfo.currentUnit.toString() === unit._id.toString();

      const completedCount = unitLessons.filter(lesson => lesson.isCompleted).length;
      const totalCount = unitLessons.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        ...unit,
        lessons: unitLessons,
        isCurrentUnit,
        progress,
        completedCount,
        totalCount
      };
    });

    logger.info('学生课程详情获取成功', {
      courseId: req.params.courseId,
      unitsCount: processedUnits.length,
      lessonsCount: processedLessons.length
    });

    res.status(200).json({
      success: true,
      data: {
        course,
        units: processedUnits,
        currentLessonId: classInfo?.currentLesson || null,
        currentUnitId: classInfo?.currentUnit || null
      }
    });
  } catch (error) {
    logger.error('获取学生课程详情失败', {
      error: error.message,
      stack: error.stack,
      courseId: req.params.courseId
    });

    res.status(500).json({
      success: false,
      message: '获取课程详情失败',
      error: error.message
    });
  }
};

// 获取学生可访问的HTML活动列表
exports.getHtmlActivities = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // 获取学生信息
    const student = await User.findById(userId);
    if (!student) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取学生可访问的课程
    let query = {};
    if (req.user.role === 'student') {
      query.$or = [
        { isPublic: true },
        { accessibleClasses: student.classId }
      ];
    }

    const courses = await Course.find(query).select('_id title').lean();
    const courseIds = courses.map(c => c._id);

    // 获取这些课程中的所有课时
    const lessons = await Lesson.find({
      course: { $in: courseIds },
      status: 'published'
    })
      .populate('course', 'title')
      .populate('unit', 'title')
      .lean();

    // 提取所有 HTML 类型的活动
    const htmlActivities = [];

    for (const lesson of lessons) {
      if (lesson.activities && lesson.activities.length > 0) {
        for (const activity of lesson.activities) {
          if (activity.type === 'html' && activity.isPublished !== false) {
            htmlActivities.push({
              activityId: activity._id.toString(),
              title: activity.title || 'HTML活动',
              description: activity.description || '',
              courseId: lesson.course._id,
              courseName: lesson.course.title,
              unitId: lesson.unit?._id,
              unitName: lesson.unit?.title || '',
              lessonId: lesson._id,
              lessonName: lesson.title
            });
          }
        }
      }
    }

    res.json({
      success: true,
      data: htmlActivities
    });
  } catch (error) {
    console.error('Get HTML activities error:', error);
    res.status(500).json({
      success: false,
      message: '获取HTML活动失败',
      error: error.message
    });
  }
};

