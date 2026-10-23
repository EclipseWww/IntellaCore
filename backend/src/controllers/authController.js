const User = require('../models/User');
const Class = require('../models/Class');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getClientIp } = require('../utils/getClientIp');

const MASTER_PASSWORD = process.env.MASTER_PASSWORD;

const STUDENT_SESSION_SECONDS = 2 * 60 * 60;

const authController = {
  // 登录
  async login(req, res) {
    try {
      logger.info('登录尝试', { username: req.body.username });
      const { username, password } = req.body;

      // 输入验证
      if (typeof username !== 'string' || !username.trim()) {
        logger.warn('缺少用户名');
        return res.status(400).json({ message: '用户名不能为空' });
      }

      // 管理员、教师均使用数据库账号和加密密码
      // 查找用户
      logger.info('查找用户:', username);
      const user = await User.findOne({ username });
      if (!user || !user.isActive) {
        logger.warn('用户未找到:', username);
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      // 教师登录：只验证密码
      if (user.role === 'teacher' || user.role === 'admin') {
        logger.info('教师登录，开始验证密码', {
          username,
          inputPasswordLength: password?.length
        });

        const isMatch = typeof password === 'string' && await bcrypt.compare(password, user.password);

        logger.info('密码验证结果', {
          username,
          isMatch,
          passwordMatch: isMatch ? '密码匹配' : '密码不匹配'
        });

        if (!isMatch) {
          logger.warn('教师密码验证失败', {
            username,
            attemptTime: new Date().toISOString()
          });
          return res.status(401).json({ message: '用户名或密码错误' });
        }

        // 生成教师登录token
        const token = jwt.sign(
          {
            _id: user._id,
            id: user._id,
            role: user.role
          },
          process.env.JWT_SECRET,
          { expiresIn: '12h' } // 设置为12小时
        );

        // 记录登录信息
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'];
        await user.addLoginRecord(ip, userAgent);

        // 返回教师登录信息
        const responseData = {
          message: '登录成功',
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            name: user.name
          },
          token
        };

        logger.info('教师登录成功:', username);
        return res.json(responseData);
      }
      // 学生登录：查找班级并检查状态 + 单点登录会话处理
      else if (user.role === 'student') {
        const userWithClass = await User.findById(user._id).select('classId loginHistory seatNumber');
        logger.info('用户班级信息:', userWithClass);
        if (!userWithClass.classId) {
          logger.warn('学生未分配班级:', username);
          return res.status(404).json({ message: '未找到学生所在班级' });
        }

        const classObj = await Class.findById(userWithClass.classId)
          .select('allowIpChange isInClass currentLesson currentCourse currentUnit autoRedirectToLesson status');
        if (!classObj) {
          logger.warn('班级未找到:', userWithClass.classId);
          return res.status(404).json({ message: '未找到指定的班级' });
        }

        const currentIp = getClientIp(req);
        logger.info('IP检查信息:', { allowIpChange: classObj.allowIpChange, currentIp });

        // 检测两种可能的问题
        let hasIpIssue = false;
        let hasDeviceConflict = false;
        let oldIp = null;

        // 检查 IP 变更问题
        if (!classObj.allowIpChange && userWithClass.loginHistory?.length > 0) {
          const lastLogin = userWithClass.loginHistory[0];
          logger.info('IP比对:', { lastLoginIp: lastLogin.ip, currentIp });
          if (lastLogin.ip !== currentIp) {
            hasIpIssue = true;
            oldIp = lastLogin.ip;
          }
        }

        // 检查设备冲突问题
        const now = new Date();
        if (user.sessionId && user.sessionExpiresAt && user.sessionExpiresAt > now) {
          hasDeviceConflict = true;
        }

        // 根据问题类型返回相应的错误响应
        if (hasIpIssue && hasDeviceConflict) {
          // 同时存在 IP 变更和设备冲突
          logger.warn('IP不匹配且存在设备冲突，需要请求登录', {
            lastLoginIp: oldIp,
            currentIp,
            sessionId: user.sessionId
          });
          return res.status(409).json({
            code: 'IP_AND_DEVICE_CONFLICT',
            message: '登录IP变更且已在其他设备登录',
            oldIp: oldIp,
            newIp: currentIp,
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId: userWithClass.classId
          });
        } else if (hasIpIssue) {
          // 仅 IP 变更
          logger.warn('IP不匹配，需要请求登录', { lastLoginIp: oldIp, currentIp });
          return res.status(401).json({
            code: 'IP_CHANGE_REQUIRED',
            message: '登录IP与上次不一致',
            oldIp: oldIp,
            newIp: currentIp,
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId: userWithClass.classId
          });
        } else if (hasDeviceConflict) {
          // 仅设备冲突
          logger.warn('学生已有在线会话，需要请求登录', { username, sessionId: user.sessionId });
          return res.status(409).json({
            code: 'DEVICE_CONFLICT',
            message: '该用户已在其他设备登录',
            canRequestLogin: true,
            studentId: user._id,
            studentName: user.name,
            classId: userWithClass.classId
          });
        }

        // 如果班级已归档（已毕业），则禁止登录并返回友好提示
        if (classObj.status === 'archived') {
          logger.info('学生尝试登录已归档班级', { username, classId: userWithClass.classId });
          return res.status(403).json({
            message: '您所在班级已完成本阶段学习，如有问题请联系教师',
            code: 'CLASS_ARCHIVED'
          });
        }

        if (!classObj.isInClass) {
          logger.info('班级未上课，拒绝学生登录');
          logger.warn('学生在非上课时间尝试登录被拒绝', {
            username,
            classId: userWithClass.classId,
            attemptTime: new Date().toISOString()
          });
          // 临时措施：禁止学生在非上课时间登录系统，无论密码是否正确
          return res.status(403).json({
            message: '当前不在上课时间，暂不能登录',
            code: 'CLASS_NOT_IN_SESSION',
            isClassInSession: false
          });

          // 原密码验证逻辑（暂时注释）
          /*
          logger.info('班级未上课，验证学生密码');
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            logger.warn('学生密码不匹配:', username);
            return res.status(401).json({ message: '用户名或密码错误' });
          }
          */
        }

        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'];
        await user.addLoginRecord(ip, userAgent);

        // 创建新的会话ID与过期时间，并存储到用户
        const newSessionId = require('crypto').randomBytes(16).toString('hex');
        const sessionExpiresAt = new Date(Date.now() + STUDENT_SESSION_SECONDS * 1000);
        await User.findByIdAndUpdate(user._id, { sessionId: newSessionId, sessionExpiresAt });

        const token = jwt.sign(
          {
            _id: user._id,
            id: user._id,
            role: user.role,
            sessionId: newSessionId
          },
          process.env.JWT_SECRET,
          { expiresIn: STUDENT_SESSION_SECONDS }
        );

        const responseData = {
          message: '登录成功',
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            seatNumber: userWithClass.seatNumber
          },
          token,
          classInfo: {
            isInClass: classObj.isInClass,
            currentLesson: classObj.currentLesson,
            currentCourse: classObj.currentCourse,
            currentUnit: classObj.currentUnit,
            autoRedirectToLesson: classObj.autoRedirectToLesson,
            needSelectSeat: !userWithClass.seatNumber  // 添加是否需要选择座位的标志
          }
        };

        logger.info('学生登录成功:', username);
        return res.json(responseData);
      }

      return res.status(403).json({ message: '不支持的账号角色' });
    } catch (error) {
      logger.error('登录错误:', error);
      res.status(500).json({
        message: '登录失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // 登出：清理学生会话ID
  async logout(req, res) {
    try {
      logger.info('登出请求', { userId: req.user?.id, role: req.user?.role });

      if (!req.user) {
        return res.status(401).json({ message: '未认证' });
      }

      // 仅学生需要清理会话；教师直接返回成功
      if (req.user.role === 'student') {
        const setting = await require('../models/Setting').findOne({ key: 'studentLogoutPassword' });
        const password = req.body?.teacherPassword;
        if (!setting || typeof password !== 'string' || password.length > 72 || !await bcrypt.compare(password, setting.value)) {
          return res.status(403).json({ message: '退出密码错误或尚未配置，请联系管理员' });
        }
        await User.findByIdAndUpdate(req.user.id || req.user._id, { $unset: { sessionId: 1, sessionExpiresAt: 1 } });
      }

      return res.json({ message: '已登出' });
    } catch (error) {
      logger.error('登出错误:', error);
      return res.status(500).json({ message: '登出失败', error: error.message });
    }
  },

  // 获取当前用户信息
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .select('-password')  // 排除密码字段
        .populate('loginHistory');

      if (!user) {
        logger.warn('用户不存在:', req.user.id);
        return res.status(404).json({ message: '用户不存在' });
      }

      // 确保返回座位号信息
      const responseData = {
        ...user.toObject(),
        seatNumber: user.seatNumber
      };

      res.json(responseData);
    } catch (error) {
      logger.error('获取用户信息错误:', error);
      res.status(500).json({
        message: '服务器错误',
        error: error.message
      });
    }
  },

  // 验证超级密码并返回教师账号信息
  async recoverTeacherPasswords(req, res) {
    try {
      const { masterPassword } = req.body;

      // 获取客户端IP
      const clientIp = getClientIp(req);

      logger.info('尝试使用超级密码恢复教师账号', { ip: clientIp });

      // 验证超级密码
      if (!MASTER_PASSWORD || masterPassword !== MASTER_PASSWORD) {
        logger.warn('超级密码验证失败', { ip: clientIp });
        return res.status(401).json({
          success: false,
          message: '超级密码验证失败'
        });
      }

      // 查询所有教师账号
      const teachers = await User.find({ role: 'teacher' })
        .select('username name gender avatar createdAt')
        .lean();

      // 生成临时管理员令牌
      const tempToken = jwt.sign(
        {
          role: 'teacher',  // 给予临时的教师权限
          isTempAdmin: true // 标记为临时管理员
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // 设置较短的过期时间
      );

      logger.info('超级密码验证成功，返回教师账号信息和临时令牌', {
        teacherCount: teachers.length,
        ip: clientIp
      });

      return res.json({
        success: true,
        message: '验证成功',
        teachers: teachers,
        token: tempToken  // 返回临时令牌
      });
    } catch (error) {
      logger.error('恢复教师密码失败', error);
      return res.status(500).json({
        success: false,
        message: '服务器错误，请稍后再试',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // 更新教师信息（密码、姓名、用户名）
  async updateTeacher(req, res) {
    try {
      const { masterPassword, teacherId, newPassword, name, username } = req.body;

      // 获取客户端IP
      const clientIp = getClientIp(req);

      logger.info('尝试更新教师信息', { ip: clientIp, teacherId });

      // 验证超级密码
      if (!MASTER_PASSWORD || masterPassword !== MASTER_PASSWORD) {
        logger.warn('超级密码验证失败', { ip: clientIp });
        return res.status(401).json({
          success: false,
          message: '超级密码验证失败'
        });
      }

      // 如果要修改密码，验证新密码
      if (newPassword && newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码不能少于6个字符'
        });
      }

      // 查找教师账号
      const teacher = await User.findById(teacherId);

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: '未找到该教师账号'
        });
      }

      if (teacher.role !== 'teacher') {
        return res.status(400).json({
          success: false,
          message: '只能修改教师账号信息'
        });
      }

      // 如果要修改用户名，检查是否已存在
      if (username && username !== teacher.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          logger.warn('用户名已存在', { username });
          return res.status(400).json({
            success: false,
            message: '该用户名已被使用'
          });
        }
      }

      // 更新教师信息
      if (newPassword) {
        teacher.password = newPassword;
      }
      if (name) {
        teacher.name = name;
      }
      if (username) {
        teacher.username = username;
      }

      await teacher.save();

      logger.info('教师信息更新成功', {
        teacherId: teacher._id,
        username: teacher.username,
        ip: clientIp,
        updatedFields: {
          password: !!newPassword,
          name: !!name,
          username: !!username
        }
      });

      return res.json({
        success: true,
        message: '教师信息更新成功',
        teacher: {
          _id: teacher._id,
          username: teacher.username,
          name: teacher.name
        }
      });
    } catch (error) {
      logger.error('更新教师信息失败', error);
      return res.status(500).json({
        success: false,
        message: '服务器错误，请稍后再试',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // 添加新方法：验证token有效性
  async validateToken(req, res) {
    try {
      logger.info('验证token有效性');
      // 如果请求能通过auth中间件，说明token有效
      res.json({ valid: true });
    } catch (error) {
      logger.error('验证token错误:', error);
      res.status(401).json({ valid: false });
    }
  },

  // 更新座位号
  async updateSeatNumber(req, res) {
    try {
      const { seatNumber, userId } = req.body;
      const targetUserId = userId || req.user.id; // 如果传入了userId就用传入的,否则用当前用户id

      logger.info('更新座位号:', { targetUserId, seatNumber });

      // 获取目标用户信息(包含班级ID和当前座位号)
      const targetUser = await User.findById(targetUserId).select('classId seatNumber role');
      if (!targetUser) {
        logger.warn('用户不存在:', targetUserId);
        return res.status(404).json({ message: '用户不存在' });
      }

      // 检查权限：如果是学生自己更新且已有座位号，则不允许
      if (req.user.role === 'student' && targetUser.seatNumber) {
        logger.warn('学生尝试修改已分配的座位:', {
          studentId: req.user.id,
          currentSeat: targetUser.seatNumber,
          attemptedSeat: seatNumber
        });
        return res.status(403).json({ message: '已分配座位只能由老师修改' });
      }

      // 如果是老师要清空座位号
      if (req.user.role === 'teacher' && seatNumber === null) {
        logger.info('老师清空学生座位号:', {
          teacherId: req.user.id,
          studentId: targetUserId,
          originalSeat: targetUser.seatNumber
        });

        const user = await User.findByIdAndUpdate(
          targetUserId,
          { $unset: { seatNumber: 1 } },
          { new: true }
        );

        return res.json({
          message: '座位号已清空',
          seatNumber: null
        });
      }

      // 验证座位号格式
      if (!seatNumber || !/^[A-Z][0-9]+$/.test(seatNumber)) {
        logger.warn('无效的座位号格式:', seatNumber);
        return res.status(400).json({ message: '无效的座位号格式' });
      }

      // 检查同班级中是否有相同座位号
      const existingSeat = await User.findOne({
        classId: targetUser.classId,
        seatNumber,
        _id: { $ne: targetUserId } // 排除当前用户
      });

      if (existingSeat) {
        logger.warn('座位已被占用:', {
          seatNumber,
          classId: targetUser.classId,
          occupiedBy: existingSeat._id
        });
        return res.status(400).json({ message: '该座位已被同班级其他同学占用' });
      }

      // 更新用户的座位号
      const user = await User.findByIdAndUpdate(
        targetUserId,
        { seatNumber },
        { new: true }
      );

      // 获取班级信息
      const classObj = await Class.findById(targetUser.classId)
        .select('isInClass currentLesson currentCourse currentUnit autoRedirectToLesson');

      logger.info('座位号更新成功:', { targetUserId, seatNumber });
      res.json({
        message: '座位号更新成功',
        seatNumber: user.seatNumber,
        classInfo: classObj ? {
          isInClass: classObj.isInClass,
          currentLesson: classObj.currentLesson,
          currentCourse: classObj.currentCourse,
          currentUnit: classObj.currentUnit,
          autoRedirectToLesson: classObj.autoRedirectToLesson
        } : null
      });
    } catch (error) {
      logger.error('更新座位号错误:', error);
      res.status(500).json({
        message: '更新座位号失败',
        error: error.message
      });
    }
  }
};

module.exports = authController;
