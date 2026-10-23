const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只允许Excel文件
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel文件格式'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 管理员权限检查中间件
const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      message: '需要管理员权限'
    });
  }
  next();
};

// 应用认证和管理员权限检查到所有路由
router.use(auth);
router.use(adminAuth);

/**
 * @swagger
 * /api/admin/overview:
 *   get:
 *     summary: 获取系统概览统计
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 系统概览统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                 totalStudents:
 *                   type: number
 *                 totalTeachers:
 *                   type: number
 *                 totalClasses:
 *                   type: number
 *                 totalCourses:
 *                   type: number
 *                 activeStudents:
 *                   type: number
 *                 systemHealth:
 *                   type: string
 */
router.get('/overview', adminController.getSystemOverview);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: 获取所有用户列表
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [all, student, teacher, admin]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 用户列表
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: 创建用户
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - name
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, teacher]
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               classId:
 *                 type: string
 *     responses:
 *       201:
 *         description: 用户创建成功
 */
router.post('/users', adminController.createUser);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   put:
 *     summary: 更新用户信息
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, teacher]
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               classId:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 用户更新成功
 */
router.put('/users/:userId', adminController.updateUser);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: 删除用户
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 用户删除成功
 */
router.delete('/users/:userId', adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/{userId}/reset-password:
 *   post:
 *     summary: 重置用户密码
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: 密码重置成功
 */
router.post('/users/:userId/reset-password', adminController.resetUserPassword);

/**
 * @swagger
 * /api/admin/classes:
 *   get:
 *     summary: 获取所有班级
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 班级列表
 */
router.get('/classes', adminController.getAllClasses);

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     summary: 获取所有课程
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 课程列表
 */
router.get('/courses', adminController.getAllCourses);

/**
 * @swagger
 * /api/admin/teachers:
 *   get:
 *     summary: 获取教师列表用于分配
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 教师列表（包含班级数量）
 */
router.get('/teachers', adminController.getTeachersForAssignment);

/**
 * @swagger
 * /api/admin/assign-teacher:
 *   post:
 *     summary: 分配教师到班级
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *               - teacherId
 *             properties:
 *               classId:
 *                 type: string
 *                 description: 班级ID
 *               teacherId:
 *                 type: string
 *                 description: 教师ID
 *     responses:
 *       200:
 *         description: 分配成功
 */
router.post('/assign-teacher', adminController.assignTeacherToClass);

/**
 * @swagger
 * /api/admin/teacher/{teacherId}/classes:
 *   get:
 *     summary: 获取教师负责的班级列表
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: string
 *         description: 教师ID
 *     responses:
 *       200:
 *         description: 教师负责的班级列表
 */
router.get('/teacher/:teacherId/classes', adminController.getTeacherClasses);

/**
 * @swagger
 * /api/admin/class:
 *   post:
 *     summary: 创建新班级
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grade
 *               - name
 *             properties:
 *               grade:
 *                 type: number
 *                 description: 年级（四位数年份）
 *               name:
 *                 type: number
 *                 description: 班级编号
 *               teacherId:
 *                 type: string
 *                 description: 教师ID（可选）
 *     responses:
 *       201:
 *         description: 班级创建成功
 */
router.post('/class', adminController.createClass);

/**
 * @swagger
 * /api/admin/batch-assign-teacher:
 *   post:
 *     summary: 批量分配教师
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teacherId
 *             properties:
 *               teacherId:
 *                 type: string
 *                 description: 教师ID
 *               assignClassIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 要分配的班级ID列表
 *               unassignClassIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 要取消分配的班级ID列表
 *     responses:
 *       200:
 *         description: 批量分配操作完成
 */
router.post('/batch-assign-teacher', adminController.batchAssignTeacher);

/**
 * @swagger
 * /api/admin/template/students/download:
 *   get:
 *     summary: 下载学生导入模板
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 模板文件下载成功
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/template/students/download', adminController.downloadStudentTemplate);

/**
 * @swagger
 * /api/admin/students/import:
 *   post:
 *     summary: 批量导入学生
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel文件
 *     responses:
 *       200:
 *         description: 学生导入成功
 *       400:
 *         description: 请求参数错误或文件格式错误
 */
router.post('/students/import', upload.single('file'), adminController.importStudents);

// 脚本运行相关路由
const scriptController = require('../controllers/scriptController');

/**
 * @swagger
 * /api/admin/scripts:
 *   get:
 *     summary: 获取可运行的脚本列表
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 脚本列表
 */
router.get('/scripts', scriptController.listScripts);

/**
 * @swagger
 * /api/admin/scripts/run:
 *   post:
 *     summary: 运行指定脚本
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scriptId
 *             properties:
 *               scriptId:
 *                 type: string
 *                 description: 脚本ID
 *               confirmed:
 *                 type: boolean
 *                 description: 是否已确认运行（危险脚本需要）
 *     responses:
 *       200:
 *         description: 脚本运行结果
 */
router.post('/scripts/run', scriptController.runScript);

module.exports = router;

