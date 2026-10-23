const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const questionController = require('../controllers/questionController');
const quizController = require('../controllers/quizController');
const quizSubmissionController = require('../controllers/quizSubmissionController');

/**
 * @swagger
 * /quiz/questions:
 *   post:
 *     tags:
 *       - 测验
 *     summary: 创建题目
 *     description: 创建新的题目，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - type
 *             properties:
 *               content:
 *                 type: string
 *                 description: 题目内容
 *               type:
 *                 type: string
 *                 enum: [single, multiple, blank, essay]
 *                 description: 题目类型（单选、多选、填空、问答）
 *               options:
 *                 type: array
 *                 description: 选项（单选/多选题必填）
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                       description: 选项文本
 *                     isCorrect:
 *                       type: boolean
 *                       description: 是否为正确选项
 *               answer:
 *                 type: string
 *                 description: 正确答案（填空题必填）
 *               score:
 *                 type: number
 *                 description: 题目分值
 *     responses:
 *       201:
 *         description: 题目创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取题目列表
 *     description: 获取所有题目列表，支持分页和筛选
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 题目类型筛选
 *     responses:
 *       200:
 *         description: 成功返回题目列表
 *       401:
 *         description: 未授权访问
 */
router
  .route('/questions')
  .post(auth, roleCheck(['teacher']), questionController.createQuestion)
  .get(auth, roleCheck(['teacher', 'admin']), questionController.getQuestions);

/**
 * @swagger
 * /quiz/questions/ai/parse:
 *   post:
 *     tags:
 *       - 测验
 *       - AI
 *     summary: AI解析题目
 *     description: 使用AI解析题目文本，生成结构化题目，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: 题目文本
 *     responses:
 *       200:
 *         description: 成功解析题目
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router
  .route('/questions/ai/parse')
  .post(auth, roleCheck(['teacher']), questionController.parseQuestionWithAI);

/**
 * @swagger
 * /quiz/questions/deleted:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取已删除的题目列表（回收站）
 *     description: 获取软删除的题目列表，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 题目类型过滤
 *     responses:
 *       200:
 *         description: 成功返回已删除题目列表
 *       401:
 *         description: 未授权访问
 */
router
  .route('/questions/deleted')
  .get(auth, roleCheck(['teacher']), questionController.getDeletedQuestions);

/**
 * @swagger
 * /quiz/questions/{id}:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取题目详情
 *     description: 获取特定题目的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 成功返回题目详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 题目不存在
 *   put:
 *     tags:
 *       - 测验
 *     summary: 更新题目
 *     description: 更新特定题目的信息，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: 题目内容
 *               options:
 *                 type: array
 *                 description: 选项（单选/多选题）
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     isCorrect:
 *                       type: boolean
 *               answer:
 *                 type: string
 *                 description: 正确答案（填空题）
 *               score:
 *                 type: number
 *                 description: 题目分值
 *     responses:
 *       200:
 *         description: 题目更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 题目不存在
 *   delete:
 *     tags:
 *       - 测验
 *     summary: 删除题目
 *     description: 删除特定题目，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 题目删除成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 题目不存在
 */
router
  .route('/questions/:id')
  .get(auth, roleCheck(['teacher', 'admin']), questionController.getQuestion)
  .put(auth, roleCheck(['teacher']), questionController.updateQuestion)
  .delete(auth, roleCheck(['teacher']), questionController.deleteQuestion);

/**
 * @swagger
 * /quiz/questions/{id}/references:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取题目引用信息
 *     description: 获取题目被多少测验使用的信息，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 成功返回引用信息
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 题目不存在
 */
router
  .route('/questions/:id/references')
  .get(auth, roleCheck(['teacher']), questionController.getQuestionReferences);

/**
 * @swagger
 * /quiz/questions/{id}/versions:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取题目版本历史
 *     description: 获取题目的版本历史记录，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 成功返回版本历史
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 题目不存在
 */
router
  .route('/questions/:id/versions')
  .get(auth, roleCheck(['teacher']), questionController.getQuestionVersionHistory);

/**
 * @swagger
 * /quiz/questions/{id}/restore:
 *   put:
 *     tags:
 *       - 测验
 *     summary: 还原已删除的题目
 *     description: 将软删除的题目还原到题库，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 题目还原成功
 *       400:
 *         description: 题目未被删除
 *       404:
 *         description: 题目不存在
 */
router
  .route('/questions/:id/restore')
  .put(auth, roleCheck(['teacher']), questionController.restoreQuestion);

/**
 * @swagger
 * /quiz/questions/{id}/permanent:
 *   delete:
 *     tags:
 *       - 测验
 *     summary: 永久删除题目
 *     description: 从回收站彻底删除题目，仅教师可用，且题目不能有引用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 题目永久删除成功
 *       400:
 *         description: 题目仍有引用，无法删除
 *       404:
 *         description: 题目不存在
 */
router
  .route('/questions/:id/permanent')
  .delete(auth, roleCheck(['teacher']), questionController.permanentDeleteQuestion);


/**
 * @swagger
 * /quiz/quizzes:
 *   post:
 *     tags:
 *       - 测验
 *     summary: 创建测验
 *     description: 创建新的测验，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - courseId
 *             properties:
 *               title:
 *                 type: string
 *                 description: 测验标题
 *               description:
 *                 type: string
 *                 description: 测验描述
 *               courseId:
 *                 type: string
 *                 description: 所属课程ID
 *               lessonId:
 *                 type: string
 *                 description: 所属课时ID
 *               unitId:
 *                 type: string
 *                 description: 所属单元ID
 *               timeLimit:
 *                 type: number
 *                 description: 时间限制（分钟）
 *               questions:
 *                 type: array
 *                 description: 题目ID列表
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 测验创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取测验列表
 *     description: 获取所有测验列表，支持分页和筛选
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: 按课程筛选
 *     responses:
 *       200:
 *         description: 成功返回测验列表
 *       401:
 *         description: 未授权访问
 */
router
  .route('/quizzes')
  .post(auth, roleCheck(['teacher']), quizController.createQuiz)
  .get(auth, quizController.getQuizzes);

/**
 * @swagger
 * /quiz/quizzes/{id}:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取测验详情
 *     description: 获取特定测验的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     responses:
 *       200:
 *         description: 成功返回测验详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 测验不存在
 *   put:
 *     tags:
 *       - 测验
 *     summary: 更新测验
 *     description: 更新特定测验的信息，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 测验标题
 *               description:
 *                 type: string
 *                 description: 测验描述
 *               timeLimit:
 *                 type: number
 *                 description: 时间限制（分钟）
 *     responses:
 *       200:
 *         description: 测验更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验不存在
 *   delete:
 *     tags:
 *       - 测验
 *     summary: 删除测验
 *     description: 删除特定测验，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     responses:
 *       200:
 *         description: 测验删除成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验不存在
 */
router
  .route('/quizzes/:id')
  .get(auth, quizController.getQuiz)
  .put(auth, roleCheck(['teacher']), quizController.updateQuiz)
  .delete(auth, roleCheck(['teacher']), quizController.deleteQuiz);

// 复制测验
router.post('/quizzes/:id/duplicate', auth, roleCheck(['teacher', 'admin']), quizController.duplicateQuiz);

/**
 * @swagger
 * /quiz/quizzes/{id}/publish:
 *   put:
 *     tags:
 *       - 测验
 *     summary: 发布测验
 *     description: 发布测验，使学生可以参与，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPublished:
 *                 type: boolean
 *                 description: 是否发布
 *                 default: true
 *     responses:
 *       200:
 *         description: 测验发布状态更新成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验不存在
 */
router
  .route('/quizzes/:id/publish')
  .put(auth, roleCheck(['teacher']), quizController.publishQuiz);

/**
 * @swagger
 * /quiz/quizzes/{id}/questions:
 *   post:
 *     tags:
 *       - 测验
 *     summary: 添加题目到测验
 *     description: 向测验中添加题目，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questions
 *             properties:
 *               questions:
 *                 type: array
 *                 description: 题目ID列表
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 成功添加题目
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验不存在
 *   put:
 *     tags:
 *       - 测验
 *     summary: 更新题目顺序
 *     description: 更新测验中题目的顺序，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questions
 *             properties:
 *               questions:
 *                 type: array
 *                 description: 按顺序排列的题目ID列表
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 成功更新题目顺序
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验不存在
 */
router
  .route('/quizzes/:id/questions')
  .post(auth, roleCheck(['teacher']), quizController.addQuestions)
  .put(auth, roleCheck(['teacher']), quizController.updateQuestionsOrder);

/**
 * @swagger
 * /quiz/quizzes/{id}/questions/{questionId}:
 *   delete:
 *     tags:
 *       - 测验
 *     summary: 从测验中移除题目
 *     description: 从测验中移除特定题目，仅教师可用
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *     responses:
 *       200:
 *         description: 成功移除题目
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 测验或题目不存在
 */
router
  .route('/quizzes/:id/questions/:questionId')
  .delete(auth, roleCheck(['teacher']), quizController.removeQuestion);

/**
 * @swagger
 * /quiz/submissions/submit:
 *   post:
 *     tags:
 *       - 测验
 *     summary: 提交测验答案
 *     description: 学生提交测验的答案
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quizId
 *               - answers
 *             properties:
 *               quizId:
 *                 type: string
 *                 description: 测验ID
 *               answers:
 *                 type: array
 *                 description: 答案列表
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - answer
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       description: 题目ID
 *                     answer:
 *                       type: string
 *                       description: 答案（单选/填空/问答）或答案数组（多选）
 *               timeSpent:
 *                 type: number
 *                 description: 花费时间（秒）
 *     responses:
 *       201:
 *         description: 答案提交成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 测验不存在
 */

// 开始答题（创建或恢复进度）
router.post('/submissions/start', auth, quizSubmissionController.start);

// 保存答题进度
router.put('/submissions/:submissionId/progress', auth, quizSubmissionController.saveProgress);

// 获取进行中的答题记录
router.get('/quizzes/:quizId/in-progress', auth, quizSubmissionController.getInProgress);

// 提交测验（最终提交）
router.post('/submissions/submit', auth, quizSubmissionController.submit);

/**
 * @swagger
 * /quiz/submissions/{submissionId}:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取提交详情
 *     description: 获取特定测验提交的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
 *     responses:
 *       200:
 *         description: 成功返回提交详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在
 */
router
  .route('/submissions/:submissionId')
  .get(auth, quizSubmissionController.getSubmission)
  .delete(auth, roleCheck(['teacher']), quizSubmissionController.deleteSubmission);

/**
 * @swagger
 * /quiz/quizzes/{quizId}/submissions/export:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 导出测验提交记录到Excel
 *     description: 导出特定测验的所有提交记录和答题详情到Excel文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         description: 班级ID (可选，用于筛选特定班级的提交记录)
 *     responses:
 *       200:
 *         description: 成功导出Excel文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足，只有教师可以导出
 *       404:
 *         description: 测验不存在或没有提交记录
 */
router.get('/quizzes/:quizId/submissions/export', auth, roleCheck(['teacher']), quizSubmissionController.exportSubmissions);

/**
 * @swagger
 * /quiz/quizzes/{quizId}/submissions:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取测验的所有提交
 *     description: 获取特定测验的所有提交记录
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     responses:
 *       200:
 *         description: 成功返回提交列表
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 测验不存在
 */
router
  .route('/quizzes/:quizId/submissions')
  .get(auth, quizSubmissionController.getSubmissionsByQuiz);

/**
 * @swagger
 * /quiz/class/{classId}/submissions:
 *   get:
 *     tags:
 *       - 测验
 *       - 教师
 *     summary: 获取班级测验提交记录
 *     description: 获取指定班级学生的测验提交记录，仅教师可用
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
 *         description: 成功返回班级测验提交记录
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router
  .route('/class/:classId/submissions')
  .get(auth, roleCheck(['teacher']), quizSubmissionController.getClassQuizSubmissions);

/**
 * @swagger
 * /quiz/class/{classId}/quiz/{quizId}/submissions:
 *   get:
 *     tags:
 *       - 测验
 *       - 教师
 *     summary: 获取班级特定测验提交记录
 *     description: 获取指定班级学生针对特定测验的提交记录，仅教师可用
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
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     responses:
 *       200:
 *         description: 成功返回班级特定测验提交记录
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router
  .route('/class/:classId/quiz/:quizId/submissions')
  .get(auth, roleCheck(['teacher']), quizSubmissionController.getClassQuizSubmissions);

/**
 * @swagger
 * /quiz/pending:
 *   get:
 *     tags:
 *       - 测验
 *     summary: 获取学生未完成的测验
 *     description: 获取学生当前未提交/未完成的测验列表
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回未完成测验列表
 *       401:
 *         description: 未授权访问
 */
router.get('/pending', auth, quizController.getPendingQuizzes);

module.exports = router;