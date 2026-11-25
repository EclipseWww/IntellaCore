const HtmlProject = require('../models/HtmlProject');
const { detectGameCopy, isGameCopyCached, COPY_MESSAGE } = require('../services/gameCopyGuard');
const logger = require('../utils/logger');

// Create a new HTML project
exports.createProject = async (req, res) => {
    try {
        const { name, code, description } = req.body;

        const project = new HtmlProject({
            name: name || '未命名网页',
            code: code || undefined, // Use default if not provided
            description: description || '',
            creator: req.user.id
        });

        await project.save();

        res.status(201).json({
            success: true,
            data: project
        });
    } catch (error) {
        logger.error('Create HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '创建项目失败',
            error: error.message
        });
    }
};

// Get all projects for current user
exports.getProjects = async (req, res) => {
    try {
        const projects = await HtmlProject.find({ creator: req.user.id })
            .sort({ updatedAt: -1 })
            .select('name description thumbnail isPublished publishedAt viewCount linkedAssignment createdAt updatedAt');

        res.json({
            success: true,
            data: projects
        });
    } catch (error) {
        logger.error('Get HTML projects error:', error);
        res.status(500).json({
            success: false,
            message: '获取项目列表失败',
            error: error.message
        });
    }
};

// Get a single project
exports.getProject = async (req, res) => {
    try {
        const project = await HtmlProject.findOne({
            _id: req.params.id,
            creator: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在'
            });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        logger.error('Get HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '获取项目失败',
            error: error.message
        });
    }
};

// Update a project
exports.updateProject = async (req, res) => {
    try {
        const { name, code, description } = req.body;

        const project = await HtmlProject.findOneAndUpdate(
            { _id: req.params.id, creator: req.user.id },
            {
                ...(name && { name }),
                ...(code !== undefined && { code }),
                ...(description !== undefined && { description })
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在'
            });
        }

        // 已发布的作品改成了游戏中心的游戏代码：照常保存，但取消发布
        if (project.isPublished && code !== undefined && detectGameCopy(project.code)) {
            project.isPublished = false;
            await project.save();
            return res.json({ success: true, data: project, unpublished: true, message: COPY_MESSAGE + '已自动取消发布。' });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        logger.error('Update HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '更新项目失败',
            error: error.message
        });
    }
};

// Delete a project
exports.deleteProject = async (req, res) => {
    try {
        // Build query: User is creator OR User is teacher/admin
        const query = { _id: req.params.id };

        // If not admin or teacher, enforce creator check
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            query.creator = req.user.id;
        }

        const project = await HtmlProject.findOneAndDelete(query);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在或无权删除'
            });
        }

        res.json({
            success: true,
            message: '项目已删除'
        });
    } catch (error) {
        logger.error('Delete HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '删除项目失败',
            error: error.message
        });
    }
};

// Publish a project
exports.publishProject = async (req, res) => {
    try {
        // 1. Check publishing limit (Max 2)
        const publishedCount = await HtmlProject.countDocuments({
            creator: req.user.id,
            isPublished: true,
            _id: { $ne: req.params.id } // Exclude current project if it's already published
        });

        if (publishedCount >= 2) {
            return res.status(400).json({
                success: false,
                message: '每人最多只能发布2个网页作品，请先取消发布其他作品'
            });
        }

        // 2. 不允许发布从游戏中心复制的游戏（在扣积分之前检查）
        const target = await HtmlProject.findOne({ _id: req.params.id, creator: req.user.id }).select('code');
        if (!target) {
            return res.status(404).json({ success: false, message: '项目不存在' });
        }
        if (detectGameCopy(target.code)) {
            return res.status(400).json({ success: false, message: COPY_MESSAGE, code: 'GAME_COPY' });
        }

        // 3. Check and deduct points (500 pts)
        const Achievement = require('../models/Achievement');
        const POINT_COST = 500;

        const currentPoints = await Achievement.getStudentPoints(req.user.id);
        if (currentPoints < POINT_COST) {
            return res.status(400).json({
                success: false,
                message: `发布需要 ${POINT_COST} 积分，你当前只有 ${currentPoints} 积分`
            });
        }

        // 3. Deduct points
        await Achievement.addPointTransaction(
            req.user.id,
            -POINT_COST,
            'other',
            '发布HTML网页作品',
            req.params.id
        );

        // 4. Publish project
        const project = await HtmlProject.findOneAndUpdate(
            { _id: req.params.id, creator: req.user.id },
            {
                isPublished: true,
                publishedAt: new Date()
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在'
            });
        }

        res.json({
            success: true,
            data: project,
            message: `发布成功！已消耗 ${POINT_COST} 积分`
        });
    } catch (error) {
        logger.error('Publish HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '发布失败',
            error: error.message
        });
    }
};

// Unpublish a project
exports.unpublishProject = async (req, res) => {
    try {
        // Build query: User is creator OR User is teacher/admin
        const query = { _id: req.params.id };

        // If not admin or teacher, enforce creator check
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            query.creator = req.user.id;
        }

        const project = await HtmlProject.findOneAndUpdate(
            query,
            { isPublished: false },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在或无权操作'
            });
        }

        res.json({
            success: true,
            data: project,
            message: '已取消发布'
        });
    } catch (error) {
        logger.error('Unpublish HTML project error:', error);
        res.status(500).json({
            success: false,
            message: '取消发布失败',
            error: error.message
        });
    }
};

// Teacher publish a student's project (no points cost, no quota limit)
exports.teacherPublishProject = async (req, res) => {
    try {
        // Only allow teachers and admins
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有教师可以执行此操作'
            });
        }

        const target = await HtmlProject.findById(req.params.id).select('code');
        if (target && detectGameCopy(target.code)) {
            return res.status(400).json({ success: false, message: COPY_MESSAGE, code: 'GAME_COPY' });
        }

        const project = await HtmlProject.findByIdAndUpdate(
            req.params.id,
            {
                isPublished: true,
                publishedAt: new Date()
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在'
            });
        }

        res.json({
            success: true,
            data: project,
            message: '教师发布成功（无积分消耗）'
        });
    } catch (error) {
        logger.error('Teacher publish project error:', error);
        res.status(500).json({
            success: false,
            message: '发布失败',
            error: error.message
        });
    }
};

// Get projects for a specific lesson/activity (Teacher view)
exports.getProjectsByLesson = async (req, res) => {
    try {
        const { lessonId, activityId } = req.params;

        const projects = await HtmlProject.find({
            'linkedAssignment.lesson': lessonId,
            'linkedAssignment.activityId': activityId
        })
            .populate('creator', 'name avatar grade classId')
            .populate({
                path: 'creator',
                populate: { path: 'classId', select: 'name grade' }
            })
            .sort({ updatedAt: -1 });

        res.json({
            success: true,
            data: projects
        });
    } catch (error) {
        logger.error('Get lesson projects error:', error);
        res.status(500).json({
            success: false,
            message: '获取项目列表失败',
            error: error.message
        });
    }
};

// Get all published projects (public)
exports.getPublishedProjects = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const projects = await HtmlProject.find({ isPublished: true })
            .populate({
                path: 'creator',
                select: 'name avatar grade classId',
                populate: { path: 'classId', select: 'name grade' }
            })
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('name description thumbnail viewCount creator publishedAt isPublished code updatedAt');

        const total = await HtmlProject.countDocuments({ isPublished: true });

        res.json({
            success: true,
            // 屏蔽从游戏中心复制的游戏（作品本身不删除，作者仍可在自己的列表里看到）
            data: projects.filter(p => !isGameCopyCached(p)),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        logger.error('Get published projects error:', error);
        res.status(500).json({
            success: false,
            message: '获取作品列表失败',
            error: error.message
        });
    }
};

// View a published project (public or creator)
exports.viewPublishedProject = async (req, res) => {
    try {
        // Build query: Published OR Created by requester
        const query = {
            _id: req.params.id,
            $or: [
                { isPublished: true },
                { creator: req.user ? req.user.id : null }
            ]
        };

        const project = await HtmlProject.findOneAndUpdate(
            query,
            { $inc: { viewCount: 1 } },
            { new: true }
        ).populate('creator', 'name avatar');

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '作品不存在或未发布'
            });
        }

        const isCreator = req.user && project.creator && String(project.creator._id) === String(req.user.id);
        if (!isCreator && isGameCopyCached(project)) {
            return res.status(403).json({ success: false, message: '这个作品包含游戏中心的游戏代码，已被屏蔽' });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        logger.error('View published project error:', error);
        res.status(500).json({
            success: false,
            message: '查看作品失败',
            error: error.message
        });
    }
};

// Link project to assignment
exports.linkAssignment = async (req, res) => {
    try {
        const { courseId, unitId, lessonId, activityId } = req.body;
        const projectUrl = `/student/html-gallery/${req.params.id}`;

        // 1. Update HtmlProject
        const project = await HtmlProject.findOneAndUpdate(
            { _id: req.params.id, creator: req.user.id },
            {
                linkedAssignment: {
                    course: courseId,
                    unit: unitId,
                    lesson: lessonId,
                    activityId,
                    submittedAt: new Date()
                }
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '项目不存在'
            });
        }

        // 2. Create or Update AssignmentSubmission
        // Import AssignmentSubmission model (assuming it's needed here, require it at top normally, but here inside function or ensure top import)
        const AssignmentSubmission = require('../models/AssignmentSubmission');

        // Check if submission exists
        let submission = await AssignmentSubmission.findOne({
            student: req.user.id,
            course: courseId,
            unit: unitId,
            lesson: lessonId,
            activity: activityId
        });

        if (submission) {
            // Update existing submission
            submission.content.links = [projectUrl];
            submission.status = 'submitted';
            submission.submittedAt = new Date();
            // Add new version
            submission.version = (submission.version || 0) + 1;
            submission.previousVersions.push({
                content: { links: [projectUrl] },
                submittedAt: new Date(),
                version: submission.version
            });
            await submission.save();
        } else {
            // Create new submission
            submission = new AssignmentSubmission({
                student: req.user.id,
                course: courseId,
                unit: unitId,
                lesson: lessonId,
                activity: activityId,
                content: {
                    links: [projectUrl]
                },
                status: 'submitted',
                submittedAt: new Date()
            });
            await submission.save();
        }

        res.json({
            success: true,
            data: project,
            message: '作业提交成功'
        });
    } catch (error) {
        logger.error('Link assignment error:', error);
        res.status(500).json({
            success: false,
            message: '提交作业失败',
            error: error.message
        });
    }
};

