const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');

/**
 * 获取教师的作业评阅树形结构
 * 一次性返回所有课程-单元-课时-活动的级联结构
 * 用于优化 AssignmentReview 页面的加载性能
 */
exports.getAssignmentTree = async (req, res) => {
    try {
        // 检查用户权限
        if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '只有教师或管理员可以访问此功能'
            });
        }

        // 1. 获取教师的所有课程（管理员可以看到所有课程）
        const courseQuery = req.user.role === 'admin' ? {} : { instructor: req.user.id };
        const courses = await Course.find(courseQuery)
            .select('_id title')
            .sort('-createdAt')
            .lean();

        if (courses.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const courseIds = courses.map(c => c._id);

        // 2. 批量获取所有相关单元
        const units = await CourseUnit.find({ course: { $in: courseIds } })
            .select('_id title course order')
            .sort('order')
            .lean();

        // 3. 批量获取所有相关课时（包含活动信息）
        const lessons = await Lesson.find({ course: { $in: courseIds } })
            .select('_id title unit activities.title activities._id activities.type activities.requireSubmission')
            .sort('order')
            .lean();

        // 4. 在内存中构建树形结构
        // 创建单元到课时的映射
        const lessonsByUnit = {};
        lessons.forEach(lesson => {
            const unitId = lesson.unit.toString();
            if (!lessonsByUnit[unitId]) {
                lessonsByUnit[unitId] = [];
            }
            lessonsByUnit[unitId].push(lesson);
        });

        // 创建课程到单元的映射
        const unitsByCourse = {};
        units.forEach(unit => {
            const courseId = unit.course.toString();
            if (!unitsByCourse[courseId]) {
                unitsByCourse[courseId] = [];
            }
            unitsByCourse[courseId].push(unit);
        });

        // 需要提交的活动类型
        const submittableTypes = ['flowchart', 'spreadsheet', 'fillblank', 'html', 'python', 'quiz'];

        // 构建级联选择器格式的数据
        const cascaderOptions = courses.map(course => {
            const courseUnits = unitsByCourse[course._id.toString()] || [];

            return {
                value: course._id.toString(),
                label: course.title,
                children: courseUnits.map(unit => {
                    const unitLessons = lessonsByUnit[unit._id.toString()] || [];

                    return {
                        value: unit._id.toString(),
                        label: unit.title,
                        children: unitLessons.map(lesson => {
                            // 过滤需要提交的活动
                            const activities = (lesson.activities || []).filter(activity =>
                                activity.requireSubmission || submittableTypes.includes(activity.type)
                            );

                            return {
                                value: lesson._id.toString(),
                                label: lesson.title,
                                children: activities.map(activity => ({
                                    value: activity._id.toString(),
                                    label: activity.title || '作业'
                                }))
                            };
                        }).filter(lesson => lesson.children.length > 0) // 只保留有活动的课时
                    };
                }).filter(unit => unit.children.length > 0) // 只保留有课时的单元
            };
        }).filter(course => course.children.length > 0); // 只保留有单元的课程

        res.status(200).json({
            success: true,
            data: cascaderOptions
        });

    } catch (error) {
        console.error('获取作业评阅树形结构失败:', error);
        res.status(500).json({
            success: false,
            message: '获取作业评阅树形结构失败',
            error: error.message
        });
    }
};
