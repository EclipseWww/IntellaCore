const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * /classes/available:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取可用的班级列表
 *     description: 获取所有可用的班级列表，无需认证
 *     responses:
 *       200:
 *         description: 成功返回班级列表
 */
router.get('/available', classController.getAvailableClasses);

/**
 * @swagger
 * /classes/{classId}/students:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取班级学生名单
 *     description: 获取特定班级的学生名单，无需认证
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功返回学生名单
 *       404:
 *         description: 班级不存在
 */
router.get('/:classId/students', classController.getClassStudents);

// 以下路由都需要认证
router.use(auth);

/**
 * @swagger
 * /classes:
 *   post:
 *     tags:
 *       - 班级
 *     summary: 创建新班级
 *     description: 创建新的班级，需要教师或管理员权限
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
 *                 description: 年级
 *               name:
 *                 type: number
 *                 description: 班级号
 *               allowIpChange:
 *                 type: boolean
 *                 description: 是否允许学生更换IP登录
 *               allowAiUsage:
 *                 type: boolean
 *                 description: 是否允许学生使用AI功能
 *     responses:
 *       201:
 *         description: 班级创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       409:
 *         description: 班级已存在
 */
router.post('/', classController.createClass);

/**
 * @swagger
 * /classes/teacher:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取教师的所有班级
 *     description: 获取当前登录教师的所有班级
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回班级列表
 *       401:
 *         description: 未授权访问
 */
router.get('/teacher', classController.getTeacherClasses);

// ============================================================
// 归档相关路由（具体路径必须在 /:classId 之前注册！）
// ============================================================

// 获取所有已归档班级列表
router.get('/archived', classController.getArchivedClasses);

// 按入学年级批量归档（管理员）
router.post('/archive/grade', classController.archiveGrade);

/**
 * @swagger
 * /classes/{classId}:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取班级详情
 *     description: 获取特定班级的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功返回班级详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级不存在
 */
router.get('/:classId', classController.getClassDetails);

/**
 * @swagger
 * /classes/{classId}/online-students:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取班级在线学生信息
 *     description: 获取特定班级的在线学生信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功返回在线学生信息
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级不存在
 */
router.get('/:classId/online-students', classController.getClassOnlineStudents);

/**
 * @swagger
 * /classes/{classId}/students/{studentId}/force-logout:
 *   post:
 *     tags:
 *       - 班级
 *     summary: 教师强制下线学生
 *     description: 清理学生会话，使其需要重新登录
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 强制下线成功
 *       403:
 *         description: 无权限
 *       404:
 *         description: 未找到班级或学生
 */
router.post('/:classId/students/:studentId/force-logout', classController.forceLogoutStudent);

// 清空班级所有学生的座位号（仅教师且限本班）
router.post('/:classId/clear-seats', classController.clearClassSeats);

// 强制下线班级所有学生（仅教师且限本班）
router.post('/:classId/force-logout-all', classController.forceLogoutAllStudents);

/**
 * @swagger
 * /classes/students/{studentId}/login-history:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 获取学生登录历史
 *     description: 获取特定学生的登录历史
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回登录历史
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 学生不存在
 */
router.get('/students/:studentId/login-history', classController.getStudentLoginHistory);

/**
 * @swagger
 * /classes/{classId}/students:
 *   post:
 *     tags:
 *       - 班级
 *     summary: 添加学生到班级
 *     description: 将学生添加到特定班级
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - name
 *             properties:
 *               username:
 *                 type: string
 *                 description: 学生用户名
 *               name:
 *                 type: string
 *                 description: 学生姓名
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: 学生性别
 *               seatNumber:
 *                 type: string
 *                 description: 座位号
 *     responses:
 *       201:
 *         description: 学生添加成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级不存在
 *       409:
 *         description: 学生用户名已存在
 */
router.post('/:classId/students', classController.addStudentToClass);

/**
 * @swagger
 * /classes/{classId}/students/batch:
 *   delete:
 *     tags:
 *       - 班级
 *     summary: 批量删除学生
 *     description: 批量删除班级中的多个学生及其相关数据，需要教师权限且只能操作自己班级的学生
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentIds
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 要删除的学生ID数组
 *     responses:
 *       200:
 *         description: 批量删除学生成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 无权操作此班级
 *       404:
 *         description: 班级不存在
 */
router.delete('/:classId/students/batch', auth, classController.batchDeleteStudents);

/**
 * @swagger
 * /classes/{classId}/students/{studentId}:
 *   delete:
 *     tags:
 *       - 班级
 *     summary: 从班级移除学生
 *     description: 从特定班级移除学生
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 学生移除成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级或学生不存在
 */
router.delete('/:classId/students/:studentId', classController.removeStudentFromClass);

/**
 * @swagger
 * /classes/students/{studentId}:
 *   put:
 *     tags:
 *       - 班级
 *     summary: 更新学生信息
 *     description: 更新特定学生的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 学生姓名
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: 学生性别
 *               seatNumber:
 *                 type: string
 *                 description: 座位号
 *               isActive:
 *                 type: boolean
 *                 description: 是否激活
 *     responses:
 *       200:
 *         description: 学生信息更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 学生不存在
 */
router.put('/students/:studentId', classController.updateStudent);

/**
 * @swagger
 * /classes/template/students/download:
 *   get:
 *     tags:
 *       - 班级
 *     summary: 下载学生导入模板
 *     description: 下载批量导入学生的Excel模板
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功下载模板
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: 未授权访问
 */
router.get('/template/students/download', classController.downloadStudentTemplate);

/**
 * @swagger
 * /classes/students/import:
 *   post:
 *     tags:
 *       - 班级
 *       - 学生
 *     summary: 批量导入学生
 *     description: 通过Excel文件批量导入学生
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
 *               - classId
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel文件
 *               classId:
 *                 type: string
 *                 description: 班级ID
 *     responses:
 *       200:
 *         description: 学生导入成功
 *       400:
 *         description: 请求参数错误或文件格式错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级不存在
 */
router.post('/students/import', auth, upload.single('file'), classController.importStudents);

/**
 * @swagger
 * /classes/{classId}/settings:
 *   patch:
 *     tags:
 *       - 班级
 *     summary: 更新班级设置
 *     description: 更新特定班级的设置
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allowIpChange:
 *                 type: boolean
 *                 description: 是否允许学生更换IP登录
 *               allowAiUsage:
 *                 type: boolean
 *                 description: 是否允许学生使用AI功能
 *               isInClass:
 *                 type: boolean
 *                 description: 班级是否在上课中
 *               scheduledEndTime:
 *                 type: string
 *                 format: date-time
 *                 description: 预定下课时间
 *               currentCourse:
 *                 type: string
 *                 description: 当前正在学习的课程ID
 *               currentUnit:
 *                 type: string
 *                 description: 当前正在学习的单元ID
 *               currentLesson:
 *                 type: string
 *                 description: 当前正在学习的课时ID
 *               autoRedirectToLesson:
 *                 type: boolean
 *                 description: 是否自动重定向到当前课时
 *     responses:
 *       200:
 *         description: 班级设置更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 班级不存在
 */
router.patch('/:classId/settings', classController.updateClassSettings);

/**
 * @swagger
 * /classes/{classId}:
 *   delete:
 *     tags:
 *       - 班级
 *     summary: 删除班级
 *     description: 删除指定班级及其所有学生和相关数据，需要教师权限且只能删除自己创建的班级
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 班级删除成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 无权删除此班级
 *       404:
 *         description: 班级不存在
 */
router.delete('/:classId', auth, classController.deleteClass);

// 恢复单个已归档班级（管理员，/:classId 通配符之后注册 /restore 子路径没有冲突）
router.post('/:classId/restore', classController.restoreClass);

// 删除归档班级的作业文件（节省存储）
router.delete('/:classId/files', classController.deleteArchivedClassFiles);

module.exports = router; 