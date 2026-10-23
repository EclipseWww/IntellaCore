const User = require('../models/User');
const Class = require('../models/Class');
const Course = require('../models/Course');
const logger = require('../utils/logger');

const adminController = {
  // 获取系统概览统计
  async getSystemOverview(req, res) {
    try {
      logger.info('管理员获取系统概览');

      // 统计各种数据
      const [
        totalUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        totalCourses,
        activeStudents
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'teacher' }),
        Class.countDocuments(),
        Course.countDocuments(),
        User.countDocuments({ 
          role: 'student',
          lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 最近7天登录的学生
        })
      ]);

      const overview = {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        totalCourses,
        activeStudents,
        systemHealth: 'normal'
      };

      logger.info('系统概览统计完成', overview);
      res.json(overview);
    } catch (error) {
      logger.error('获取系统概览失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取系统概览失败',
        error: error.message
      });
    }
  },

  // 获取所有用户列表
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, role, search } = req.query;

      logger.info('管理员获取用户列表', { page, limit, role, search });

      // 构建查询条件
      const query = {};
      if (role && role !== 'all') {
        query.role = role;
      }
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ];
      }

      // 分页查询
      const users = await User.find(query)
        .select('-password')
        .populate('classId', 'name grade')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(query);

      logger.info('用户列表获取成功', { count: users.length, total });
      res.json({
        users,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      logger.error('获取用户列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取用户列表失败',
        error: error.message
      });
    }
  },

  // 创建用户
  async createUser(req, res) {
    try {
      const { username, password, name, role, gender, classId } = req.body;

      logger.info('管理员创建用户', { username, role, name });

      // 验证输入
      if (!username || !password || !name || !role) {
        return res.status(400).json({
          message: '用户名、密码、姓名和角色不能为空'
        });
      }

      // 检查用户名是否已存在
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        logger.warn('用户名已存在', { username });
        return res.status(400).json({
          message: '用户名已存在'
        });
      }

      // 创建用户
      const user = new User({
        username,
        password,
        name,
        role,
        gender: gender || 'other',
        classId: classId || null
      });

      await user.save();

      logger.info('用户创建成功', { userId: user._id, username });
      res.status(201).json({
        message: '用户创建成功',
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          role: user.role,
          gender: user.gender,
          classId: user.classId
        }
      });
    } catch (error) {
      logger.error('创建用户失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '创建用户失败',
        error: error.message
      });
    }
  },

  // 更新用户信息
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { name, role, gender, classId, isActive } = req.body;

      logger.info('管理员更新用户', { userId, updateData: req.body });

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '用户不存在'
        });
      }

      // 更新用户信息
      if (name !== undefined) user.name = name;
      if (role !== undefined) user.role = role;
      if (gender !== undefined) user.gender = gender;
      if (classId !== undefined) user.classId = classId || null;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      logger.info('用户更新成功', { userId });
      res.json({
        message: '用户更新成功',
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          role: user.role,
          gender: user.gender,
          classId: user.classId,
          isActive: user.isActive
        }
      });
    } catch (error) {
      logger.error('更新用户失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '更新用户失败',
        error: error.message
      });
    }
  },

  // 删除用户
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      logger.info('管理员删除用户', { userId });

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '用户不存在'
        });
      }

      await User.findByIdAndDelete(userId);

      logger.info('用户删除成功', { userId, username: user.username });
      res.json({
        message: '用户删除成功'
      });
    } catch (error) {
      logger.error('删除用户失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '删除用户失败',
        error: error.message
      });
    }
  },

  // 重置用户密码
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      logger.info('管理员重置用户密码', { userId });

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          message: '新密码不能少于6个字符'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '用户不存在'
        });
      }

      user.password = newPassword;
      await user.save();

      logger.info('用户密码重置成功', { userId, username: user.username });
      res.json({
        message: '密码重置成功'
      });
    } catch (error) {
      logger.error('重置用户密码失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '重置用户密码失败',
        error: error.message
      });
    }
  },

  // 获取所有班级
  async getAllClasses(req, res) {
    try {
      logger.info('管理员获取班级列表');

      const classes = await Class.find()
        .populate('teacher', 'name username')
        .sort({ createdAt: -1 });

      // 为每个班级统计学生数量
      const classesWithStats = await Promise.all(
        classes.map(async (classItem) => {
          const studentCount = await User.countDocuments({
            classId: classItem._id,
            role: 'student'
          });

          return {
            ...classItem.toObject(),
            studentCount
          };
        })
      );

      logger.info('班级列表获取成功', { count: classesWithStats.length });
      res.json(classesWithStats);
    } catch (error) {
      logger.error('获取班级列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取班级列表失败',
        error: error.message
      });
    }
  },

  // 获取所有课程
  async getAllCourses(req, res) {
    try {
      logger.info('管理员获取课程列表');

      const courses = await Course.find()
        .populate('instructor', 'name username')
        .sort({ createdAt: -1 });

      logger.info('课程列表获取成功', { count: courses.length });
      res.json(courses);
    } catch (error) {
      logger.error('获取课程列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取课程列表失败',
        error: error.message
      });
    }
  },

  // 分配教师到班级
  async assignTeacherToClass(req, res) {
    try {
      const { classId, teacherId } = req.body;
      
      logger.info('分配教师到班级', { classId, teacherId });

      // 验证输入
      if (!classId || !teacherId) {
        return res.status(400).json({
          message: '班级ID和教师ID不能为空'
        });
      }

      // 检查班级是否存在
      const classExists = await Class.findById(classId);
      if (!classExists) {
        return res.status(404).json({
          message: '班级不存在'
        });
      }

      // 检查教师是否存在且角色正确
      const teacher = await User.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({
          message: '教师不存在'
        });
      }

      if (teacher.role !== 'teacher') {
        return res.status(400).json({
          message: '指定用户不是教师角色'
        });
      }

      // 更新班级的教师
      await Class.findByIdAndUpdate(classId, { teacher: teacherId });

      logger.info('教师分配成功', { classId, teacherId, teacherName: teacher.name });
      res.json({
        message: '教师分配成功',
        class: {
          id: classId,
          teacher: {
            id: teacherId,
            name: teacher.name,
            username: teacher.username
          }
        }
      });
    } catch (error) {
      logger.error('分配教师到班级失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '分配教师失败',
        error: error.message
      });
    }
  },

  // 获取教师列表（用于分配）
  async getTeachersForAssignment(req, res) {
    try {
      logger.info('获取教师列表用于分配');

      const teachers = await User.find({ role: 'teacher' })
        .select('_id name username')
        .sort({ name: 1 });

      // 获取每个教师负责的班级数量
      const teachersWithClassCount = await Promise.all(
        teachers.map(async (teacher) => {
          const classCount = await Class.countDocuments({ teacher: teacher._id });
          return {
            ...teacher.toObject(),
            classCount
          };
        })
      );

      logger.info('教师列表获取成功', { count: teachersWithClassCount.length });
      res.json(teachersWithClassCount);
    } catch (error) {
      logger.error('获取教师列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取教师列表失败',
        error: error.message
      });
    }
  },

  // 获取教师负责的班级列表
  async getTeacherClasses(req, res) {
    try {
      const { teacherId } = req.params;
      
      logger.info('获取教师负责的班级', { teacherId });

      // 检查教师是否存在
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({
          message: '教师不存在'
        });
      }

      // 获取教师负责的班级
      const classes = await Class.find({ teacher: teacherId })
        .sort({ grade: -1, name: 1 });

      // 为每个班级统计学生数量
      const classesWithStats = await Promise.all(
        classes.map(async (classItem) => {
          const studentCount = await User.countDocuments({
            classId: classItem._id,
            role: 'student'
          });

          return {
            ...classItem.toObject(),
            studentCount
          };
        })
      );

      logger.info('教师班级列表获取成功', { teacherId, count: classesWithStats.length });
      res.json({
        teacher: {
          id: teacher._id,
          name: teacher.name,
          username: teacher.username
        },
        classes: classesWithStats
      });
    } catch (error) {
      logger.error('获取教师班级列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '获取教师班级列表失败',
        error: error.message
      });
    }
  },

  // 创建新班级
  async createClass(req, res) {
    try {
      const { grade, name, teacherId } = req.body;
      
      logger.info('创建新班级', { grade, name, teacherId });

      // 验证输入
      if (!grade || !name) {
        return res.status(400).json({
          message: '年级和班级名称不能为空'
        });
      }

      // 验证年级格式（四位数年份）
      if (!/^\d{4}$/.test(grade.toString())) {
        return res.status(400).json({
          message: '年级必须是四位数年份，例如：2024'
        });
      }

      // 检查班级是否已存在
      const existingClass = await Class.findOne({ grade, name });
      if (existingClass) {
        return res.status(400).json({
          message: `${grade}级${name}班已存在`
        });
      }

      // 如果指定了教师，检查教师是否存在且角色正确
      let teacher = null;
      if (teacherId) {
        teacher = await User.findById(teacherId);
        if (!teacher) {
          return res.status(404).json({
            message: '指定的教师不存在'
          });
        }
        if (teacher.role !== 'teacher') {
          return res.status(400).json({
            message: '指定用户不是教师角色'
          });
        }
      }

      // 创建班级
      const newClass = new Class({
        grade: parseInt(grade),
        name: parseInt(name),
        teacher: teacherId || null
      });

      await newClass.save();
      await newClass.populate('teacher', 'name username');

      // 统计学生数量（新班级为0）
      const classWithStats = {
        ...newClass.toObject(),
        studentCount: 0
      };

      logger.info('班级创建成功', { 
        classId: newClass._id, 
        grade, 
        name, 
        teacherName: teacher?.name 
      });

      res.status(201).json({
        message: '班级创建成功',
        class: classWithStats
      });
    } catch (error) {
      logger.error('创建班级失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '创建班级失败',
        error: error.message
      });
    }
  },

  // 批量分配教师
  async batchAssignTeacher(req, res) {
    try {
      const { teacherId, assignClassIds, unassignClassIds } = req.body;
      
      logger.info('批量分配教师', { teacherId, assignClassIds, unassignClassIds });

      // 验证输入
      if (!teacherId) {
        return res.status(400).json({
          message: '教师ID不能为空'
        });
      }

      // 检查教师是否存在且角色正确
      const teacher = await User.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({
          message: '教师不存在'
        });
      }

      if (teacher.role !== 'teacher') {
        return res.status(400).json({
          message: '指定用户不是教师角色'
        });
      }

      const results = {
        assigned: [],
        unassigned: [],
        errors: []
      };

      // 处理分配班级
      if (assignClassIds && assignClassIds.length > 0) {
        for (const classId of assignClassIds) {
          try {
            const classItem = await Class.findById(classId);
            if (!classItem) {
              results.errors.push(`班级 ${classId} 不存在`);
              continue;
            }

            // 检查班级是否已有教师
            if (classItem.teacher && classItem.teacher.toString() !== teacherId) {
              results.errors.push(`${classItem.grade}级${classItem.name}班已有教师负责`);
              continue;
            }

            await Class.findByIdAndUpdate(classId, { teacher: teacherId });
            results.assigned.push(`${classItem.grade}级${classItem.name}班`);
          } catch (error) {
            results.errors.push(`分配班级 ${classId} 时出错: ${error.message}`);
          }
        }
      }

      // 处理取消分配班级
      if (unassignClassIds && unassignClassIds.length > 0) {
        for (const classId of unassignClassIds) {
          try {
            const classItem = await Class.findById(classId);
            if (!classItem) {
              results.errors.push(`班级 ${classId} 不存在`);
              continue;
            }

            // 检查班级是否由该教师负责
            if (!classItem.teacher || classItem.teacher.toString() !== teacherId) {
              results.errors.push(`${classItem.grade}级${classItem.name}班不是由该教师负责`);
              continue;
            }

            await Class.findByIdAndUpdate(classId, { teacher: null });
            results.unassigned.push(`${classItem.grade}级${classItem.name}班`);
          } catch (error) {
            results.errors.push(`取消分配班级 ${classId} 时出错: ${error.message}`);
          }
        }
      }

      logger.info('批量分配教师完成', { 
        teacherId, 
        teacherName: teacher.name,
        assignedCount: results.assigned.length,
        unassignedCount: results.unassigned.length,
        errorCount: results.errors.length
      });

      res.json({
        message: '批量分配操作完成',
        teacher: {
          id: teacher._id,
          name: teacher.name,
          username: teacher.username
        },
        results
      });
    } catch (error) {
      logger.error('批量分配教师失败', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: '批量分配教师失败',
        error: error.message
      });
    }
  },

  // 下载学生导入模板
  async downloadStudentTemplate(req, res) {
    try {
      logger.info('管理员下载学生导入模板');
      const path = require('path');
      const templatePath = path.join(__dirname, '../templates/student_template.xlsx');
      
      res.download(templatePath, '学生导入模板.xlsx', (err) => {
        if (err) {
          logger.error('下载模板失败', { error: err.message });
          res.status(500).json({
            success: false,
            message: '下载模板失败'
          });
        } else {
          logger.info('模板下载成功');
        }
      });
    } catch (error) {
      logger.error('下载模板异常', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: '下载模板失败'
      });
    }
  },

  // 批量导入学生
  async importStudents(req, res) {
    try {
      logger.info('管理员开始导入学生', { file: req.file?.originalname });
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请上传文件'
        });
      }

      const xlsx = require('xlsx');
      const fsPromises = require('fs').promises;

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

        // 查找或创建班级（管理员可以为任何班级导入学生）
        let classObj = await Class.findOne({
          grade: Number(grade),
          name: Number(className)
        });

        if (!classObj) {
          logger.info('管理员创建新班级', { grade, className });
          classObj = await Class.create({
            grade: Number(grade),
            name: Number(className),
            teacher: null // 管理员创建的班级初始没有教师
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
      
      logger.info('管理员学生导入成功', { results });
      res.status(200).json({
        success: true,
        message: `成功导入学生：${results.map(r => `${r.grade}级${r.class}班 ${r.count}人`).join('，')}`,
        data: results
      });
    } catch (error) {
      logger.error('管理员导入学生失败', { error: error.message, stack: error.stack });
      
      // 删除临时文件
      if (req.file) {
        try {
          const fsPromises = require('fs').promises;
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
  }
};

module.exports = adminController;
