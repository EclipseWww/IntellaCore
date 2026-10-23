const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const PythonSubmission = require('../models/PythonSubmission');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const Class = require('../models/Class');
const User = require('../models/User');

/**
 * 获取待批改作业汇总
 * 返回教师所有课程中待批改的作业数量，按课程/单元/课时/活动分组
 */
exports.getPendingSummary = async (req, res) => {
    try {
        // 检查用户权限
        if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '只有教师或管理员可以访问此功能'
            });
        }

        // 1. 获取教师的所有课程
        const courseQuery = req.user.role === 'admin' ? {} : { instructor: req.user.id };
        const courses = await Course.find(courseQuery)
            .select('_id title')
            .sort('-createdAt')
            .lean();

        if (courses.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                totalPending: 0
            });
        }

        const courseIds = courses.map(c => c._id);

        // 2. 批量获取所有相关单元
        const units = await CourseUnit.find({ course: { $in: courseIds } })
            .select('_id title course order')
            .sort('order')
            .lean();

        // 3. 批量获取所有相关课时
        const lessons = await Lesson.find({ course: { $in: courseIds } })
            .select('_id title unit activities.title activities._id activities.type activities.requireSubmission')
            .sort('order')
            .lean();

        const lessonIds = lessons.map(l => l._id);

        // 获取所有未归档班级的学生ID
        const activeClasses = await Class.find({ status: { $ne: 'archived' } }).select('_id').lean();
        const activeClassIds = activeClasses.map(c => c._id);
        const activeStudents = await User.find({ classId: { $in: activeClassIds }, role: 'student' }).select('_id').lean();
        const activeStudentIds = activeStudents.map(s => s._id);

        // 4. 并行查询各类型的待批改提交数量
        // 注意：只统计已提交且未被教师评分也未被AI评分的作业，并排除已归档班级的学生
        const [
            assignmentPending,
            flowchartPending,
            pythonPending,
            spreadsheetPending,
            fillblankPending
        ] = await Promise.all([
            // AssignmentSubmission: status === 'submitted' 且教师未评分且AI未评分

            AssignmentSubmission.aggregate([
                {
                    $match: {
                        lesson: { $in: lessonIds },
                        student: { $in: activeStudentIds },
                        status: 'submitted',  // 只统计已提交的，不包括 draft
                        $or: [
                            { 'grade.score': { $exists: false } },
                            { 'grade.score': null }
                        ],
                        // 同时排除有AI评分的记录
                        $and: [
                            {
                                $or: [
                                    { 'aiGrade.score': { $exists: false } },
                                    { 'aiGrade.score': null }
                                ]
                            }
                        ]
                    }
                },
                { $group: { _id: '$activity', count: { $sum: 1 } } }
            ]),
            // FlowchartSubmission: status === 'submitted' 且教师未评分
            FlowchartSubmission.aggregate([
                {
                    $match: {
                        lessonId: { $in: lessonIds },
                        userId: { $in: activeStudentIds },
                        status: 'submitted',  // 只统计已提交的
                        $or: [
                            { 'grade.score': { $exists: false } },
                            { 'grade.score': null }
                        ]
                    }
                },
                { $group: { _id: '$activityId', count: { $sum: 1 } } }
            ]),
            // PythonSubmission: status === 'submitted' 且教师未评分 (score 为 null)
            PythonSubmission.aggregate([
                { $match: { lessonId: { $in: lessonIds }, studentId: { $in: activeStudentIds }, status: 'submitted', score: null } },
                { $group: { _id: '$activityId', count: { $sum: 1 } } }
            ]),
            // SpreadsheetSubmission: status === 'submitted' 且教师未评分
            SpreadsheetSubmission.aggregate([
                {
                    $match: {
                        lessonId: { $in: lessonIds },
                        userId: { $in: activeStudentIds },
                        status: 'submitted',
                        $or: [
                            { 'grade.score': { $exists: false } },
                            { 'grade.score': null }
                        ]
                    }
                },
                { $group: { _id: '$activityId', count: { $sum: 1 } } }
            ]),
            // FillBlankSubmission: status === 'submitted' (填空题只看 status)
            FillBlankSubmission.aggregate([
                { $match: { lessonId: { $in: lessonIds }, studentId: { $in: activeStudentIds }, status: 'submitted' } },
                { $group: { _id: '$activityId', count: { $sum: 1 } } }
            ])
        ]);

        // 5. 合并待批改计数到一个Map
        const pendingCountMap = new Map();

        const addToMap = (results) => {
            results.forEach(r => {
                if (r._id) {
                    const key = r._id.toString();
                    pendingCountMap.set(key, (pendingCountMap.get(key) || 0) + r.count);
                }
            });
        };

        addToMap(assignmentPending);
        addToMap(flowchartPending);
        addToMap(pythonPending);
        addToMap(spreadsheetPending);
        addToMap(fillblankPending);

        // 6. 构建树形结构
        const lessonsByUnit = {};
        lessons.forEach(lesson => {
            const unitId = lesson.unit.toString();
            if (!lessonsByUnit[unitId]) {
                lessonsByUnit[unitId] = [];
            }
            lessonsByUnit[unitId].push(lesson);
        });

        const unitsByCourse = {};
        units.forEach(unit => {
            const courseId = unit.course.toString();
            if (!unitsByCourse[courseId]) {
                unitsByCourse[courseId] = [];
            }
            unitsByCourse[courseId].push(unit);
        });

        const submittableTypes = ['flowchart', 'spreadsheet', 'fillblank', 'html', 'python', 'quiz'];

        let totalPending = 0;
        const result = [];

        courses.forEach(course => {
            const courseUnits = unitsByCourse[course._id.toString()] || [];
            let coursePending = 0;
            const courseChildren = [];

            courseUnits.forEach(unit => {
                const unitLessons = lessonsByUnit[unit._id.toString()] || [];
                let unitPending = 0;
                const unitChildren = [];

                unitLessons.forEach(lesson => {
                    const activities = (lesson.activities || []).filter(activity =>
                        activity.requireSubmission || submittableTypes.includes(activity.type)
                    );

                    let lessonPending = 0;
                    const lessonChildren = [];

                    activities.forEach(activity => {
                        const activityId = activity._id.toString();
                        const pending = pendingCountMap.get(activityId) || 0;
                        if (pending > 0) {
                            lessonPending += pending;
                            lessonChildren.push({
                                value: activityId,
                                label: activity.title || '作业',
                                type: activity.type,
                                pendingCount: pending,
                                lessonId: lesson._id.toString(),
                                unitId: unit._id.toString(),
                                courseId: course._id.toString()
                            });
                        }
                    });

                    if (lessonChildren.length > 0) {
                        unitPending += lessonPending;
                        unitChildren.push({
                            value: lesson._id.toString(),
                            label: lesson.title,
                            pendingCount: lessonPending,
                            children: lessonChildren
                        });
                    }
                });

                if (unitChildren.length > 0) {
                    coursePending += unitPending;
                    courseChildren.push({
                        value: unit._id.toString(),
                        label: unit.title,
                        pendingCount: unitPending,
                        children: unitChildren
                    });
                }
            });

            if (courseChildren.length > 0) {
                totalPending += coursePending;
                result.push({
                    value: course._id.toString(),
                    label: course.title,
                    pendingCount: coursePending,
                    children: courseChildren
                });
            }
        });

        res.status(200).json({
            success: true,
            data: result,
            totalPending
        });

    } catch (error) {
        console.error('获取待批改作业汇总失败:', error);
        res.status(500).json({
            success: false,
            message: '获取待批改作业汇总失败',
            error: error.message
        });
    }
};
