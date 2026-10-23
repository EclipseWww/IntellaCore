const ExamConfig = require('../models/ExamConfig');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const QuizSubmission = require('../models/QuizSubmission');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const PythonSubmission = require('../models/PythonSubmission');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const analyticsController = require('./analyticsController');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const fetchAllSubmissions = async (studentIds, lessonIds) => {
    const submissionMap = {}; // Key: studentId_lessonId_activityId -> score (0-100)

    const addScore = (studentId, lessonId, activityId, score) => {
        const key = `${studentId}_${lessonId}_${activityId}`;
        // If multiple submissions exist (unlikely with our filters), keep higher or latest?
        // Using simple overwrite for now, assuming unique active submissions
        // Normalize 0-100 here to save checks later
        submissionMap[key] = Math.max(0, Math.min(100, score || 0));
    };

    try {
        // 1. AssignmentSubmissions (graded/returned/submitted - includes AI-graded submissions)
        const assignments = await AssignmentSubmission.find({
            student: { $in: studentIds },
            lesson: { $in: lessonIds },
            status: { $in: ['graded', 'returned', 'submitted'] }
        }).select('student lesson activity grade aiGrade');

        assignments.forEach(sub => {
            // 优先使用教师评分，如果没有则使用AI评分
            // Teacher grade takes priority over AI grade
            const rawScore = (sub.grade?.score !== undefined && sub.grade?.score !== null)
                ? sub.grade.score
                : (sub.aiGrade?.score || 0);
            // Assignment scores are 0-10, normalize to 0-100
            const score = rawScore * 10;
            addScore(sub.student, sub.lesson, sub.activity, score);
        });

        // 2. QuizSubmissions (SUBMITTED)
        const quizzes = await QuizSubmission.find({
            studentId: { $in: studentIds },
            lessonId: { $in: lessonIds },
            status: 'SUBMITTED'
        }).select('studentId lessonId activityId score answers');

        quizzes.forEach(sub => {
            let totalPoints = sub.answers ? sub.answers.length : 0;
            const score = totalPoints > 0 ? (sub.score / totalPoints) * 100 : 0;
            addScore(sub.studentId, sub.lessonId, sub.activityId, score);
        });

        // 3. TypingRecords (Iterate for max speed)
        const TypingRecord = require('../models/TypingRecord');
        const typingRecords = await TypingRecord.find({
            userId: { $in: studentIds },
            lessonId: { $in: lessonIds }
        }).select('userId lessonId activityId speed targetSpeed');

        typingRecords.forEach(r => {
            const s = Math.min(100, (r.speed / r.targetSpeed) * 100);
            const key = `${r.userId}_${r.lessonId}_${r.activityId}`;
            // Typing keeps HIGHEST score
            if (!submissionMap[key] || s > submissionMap[key]) {
                submissionMap[key] = s;
            }
        });

        // 4. SpreadsheetSubmissions (graded)
        const sheets = await SpreadsheetSubmission.find({
            userId: { $in: studentIds },
            lessonId: { $in: lessonIds },
            status: 'graded'
        }).select('userId lessonId activityId grade');

        sheets.forEach(sub => {
            addScore(sub.userId, sub.lessonId, sub.activityId, sub.grade?.score || 0);
        });

        // 5. PythonSubmissions (submitted)
        const pythons = await PythonSubmission.find({
            studentId: { $in: studentIds },
            lessonId: { $in: lessonIds },
            status: 'submitted'
        }).select('studentId lessonId activityId score');

        pythons.forEach(sub => {
            addScore(sub.studentId, sub.lessonId, sub.activityId, (sub.score || 0) * 10);
        });

        // 6. FillBlankSubmissions (submitted/graded)
        const fills = await FillBlankSubmission.find({
            studentId: { $in: studentIds },
            lessonId: { $in: lessonIds },
            status: { $in: ['submitted', 'graded'] }
        }).select('studentId lessonId activityId autoScore grade');

        fills.forEach(sub => {
            const autoScore = sub.autoScore || 0;
            const bonusScore = (sub.grade && sub.grade.bonusScore) || 0;
            // Native score is 0-10 usually, normalize to 100
            const score = Math.min(100, (autoScore + bonusScore) * 10);
            addScore(sub.studentId, sub.lessonId, sub.activityId, score);
        });

        // 7. FlowchartSubmissions (graded)
        const flows = await FlowchartSubmission.find({
            userId: { $in: studentIds },
            lessonId: { $in: lessonIds },
            status: 'graded'
        }).select('userId lessonId activityId grade');

        flows.forEach(sub => {
            addScore(sub.userId, sub.lessonId, sub.activityId, (sub.grade?.score || 0) * 10);
        });

    } catch (e) {
        console.error("Bulk fetch error", e);
    }

    return submissionMap;
};

// 获取教师的所有考试配置列表
exports.getTeacherExamConfigs = async (req, res) => {
    try {
        const configs = await ExamConfig.find({ createdBy: req.user._id })
            .populate('course', 'title')
            .populate('classes', 'name grade')
            .select('title course classes semester dailyPerformanceWeight createdAt updatedAt')
            .sort({ updatedAt: -1 });

        res.json({ success: true, data: configs });
    } catch (error) {
        logger.error('Get Teacher Exam Configs Error', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createExamConfig = async (req, res) => {
    try {
        const config = new ExamConfig({
            ...req.body,
            createdBy: req.user._id
        });
        await config.save();
        res.status(201).json({ success: true, data: config });
    } catch (error) {
        logger.error('Create Exam Config Error', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getExamConfig = async (req, res) => {
    try {
        const config = await ExamConfig.findById(req.params.id)
            .populate('lessons', 'title')
            .populate('classes', 'name grade')
            .populate('class', 'name grade') // Legacy support
            .populate('course', 'title');
        if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateExamConfig = async (req, res) => {
    try {
        const config = await ExamConfig.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper Logic for Grade Calculation (Reused by API and Export)
const calculateResultsInternal = async (configId) => {
    const config = await ExamConfig.findById(configId);
    if (!config) throw new Error('Config not found');

    // 1. Get all students in the class(es)
    let classIds = [];
    if (config.classes && config.classes.length > 0) {
        classIds = config.classes;
    }
    if (config.class) {
        const legId = config.class.toString();
        if (!classIds.some(c => c.toString() === legId)) {
            classIds.push(config.class);
        }
    }

    // Optimization: Fetch only necessary fields
    const students = await User.find({
        role: 'student',
        classId: { $in: classIds }
    }).select('_id name username studentId classId')
        .populate('classId', 'name');

    const studentIds = students.map(s => s._id);

    // Extract lesson IDs from config
    const lessonIds = config.lessonConfigs ? config.lessonConfigs.map(l => l.lessonId) : [];

    // BULK FETCH 1: EXAM SUBMISSIONS
    const submissionMap = await fetchAllSubmissions(studentIds, lessonIds);

    // BULK FETCH 2: DAILY SCORES (Analytics) - PER CLASS to maintain grade consistency
    let dailyScoreMap = {};
    if (config.dailyScoreSource === 'analytics') {
        try {
            // Group students by class
            const studentsByClass = {};
            students.forEach(s => {
                const classIdStr = s.classId?._id?.toString() || s.classId?.toString() || 'unknown';
                if (!studentsByClass[classIdStr]) studentsByClass[classIdStr] = [];
                studentsByClass[classIdStr].push(s._id);
            });

            // Calculate daily scores for EACH CLASS separately (preserves per-class grade curve)
            const classPromises = Object.entries(studentsByClass).map(async ([classId, classStudentIds]) => {
                const classScores = await analyticsController.calculateDailyScoresForStudents(classStudentIds, config.semester);
                return classScores;
            });

            const allClassResults = await Promise.all(classPromises);

            // Merge all class results into the map
            allClassResults.flat().forEach(s => {
                dailyScoreMap[s.studentId.toString()] = s;
            });
        } catch (e) {
            console.error("Error fetching bulk daily scores", e);
        }
    }

    // Grade Map (matches analyticsController's 8 grades exactly)
    const gradeMap = {
        'A+': 100,
        'A': 90,
        'B+': 85,
        'B': 80,
        'C+': 75,
        'C': 70,
        'D': 60,
        'F': 40
    };

    // 2. Iterate students (Sync processing)
    const results = students.map(student => {
        let examPartScore = 0;
        const activityScores = {};

        // 3. Calculate Exam Part Score
        if (config.lessonConfigs && config.lessonConfigs.length > 0) {
            config.lessonConfigs.forEach(lessonConfig => {
                let lessonScore = 0;

                // Iterate Activities
                if (lessonConfig.activityConfigs && lessonConfig.activityConfigs.length > 0) {
                    lessonConfig.activityConfigs.forEach(actConfig => {
                        // Sync Lookup from Map
                        const key = `${student._id}_${lessonConfig.lessonId}_${actConfig.activityId}`;
                        const score = submissionMap[key] || 0;

                        // Add weighted score to lesson
                        lessonScore += score * (actConfig.weight / 100);

                        activityScores[actConfig.activityId] = {
                            score: Math.round(score * 100) / 100,
                            weight: actConfig.weight,
                            lessonId: lessonConfig.lessonId
                        };
                    });
                }

                // Add weighted lesson score to Total Exam Score (Flat Weighting)
                examPartScore += lessonScore * (lessonConfig.weight / 100);
            });
        }

        // 4. Calculate Daily Score
        let dailyScore = 0;
        if (config.dailyScoreSource === 'analytics') {
            // Map Lookup
            const dailyData = dailyScoreMap[student._id.toString()];
            // Map Grade to Number
            if (dailyData && dailyData.grade) {
                dailyScore = gradeMap[dailyData.grade] || 60;
            }
        } else {
            // Manual
            const manualEntry = config.studentDailyScores && config.studentDailyScores.find(s => s.student.toString() === student._id.toString());
            dailyScore = manualEntry ? manualEntry.score : 0;
        }

        const dailyWeight = config.dailyPerformanceWeight || 0;
        const dailyContribution = dailyScore * (dailyWeight / 100);
        const finalScore = dailyContribution + examPartScore;

        return {
            student,
            className: student.classId?.name || '未分配',
            activityScores: activityScores,
            dailyScore: Math.round(dailyScore * 100) / 100,
            dailyWeight: dailyWeight,
            dailyContribution: Math.round(dailyContribution * 100) / 100,
            examPartScore: Math.round(examPartScore * 100) / 100,
            finalScore: Math.round(finalScore * 100) / 100
        };
    });

    return results;
};

exports.calculateGrades = async (req, res) => {
    try {
        const results = await calculateResultsInternal(req.params.id);
        res.json({ success: true, data: results });
    } catch (error) {
        logger.error('Calculate Grades Error', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Internal helper: Map Analytics Grade to 0-100 Score
const getStudentDailyScoreInternal = async (studentId, semester) => {
    try {
        const scoreData = await analyticsController.calculateStudentDailyScoreInternal(studentId, semester);

        // Map Letter Grade to Number
        const gradeMap = {
            'A+': 100, // Updated per user request
            'A': 90,
            'A-': 88,
            'B+': 85,
            'B': 80,
            'B-': 78,
            'C+': 75,
            'C': 70,
            'C-': 68,
            'D+': 65,
            'D': 60,
            'F': 40
        };

        if (scoreData && scoreData.grade) {
            // Check if user has specific passing requirement not met? 
            // Analytics controller handles isPassing but mapping grade is cleaner.
            return gradeMap[scoreData.grade] || 60;
        }

        return 0;
    } catch (err) {
        console.error("Internal Daily Score fetch error", err);
        return 0;
    }
};

const ExcelJS = require('exceljs');

exports.exportGrades = async (req, res) => {
    try {
        const { id } = req.params;
        const config = await ExamConfig.findById(id).populate('course', 'title');

        // Use shared logic
        const results = await calculateResultsInternal(id);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('成绩单');

        // Headers
        worksheet.columns = [
            { header: '班级', key: 'className', width: 15 },
            { header: '姓名', key: 'name', width: 15 },
            { header: '学号', key: 'studentId', width: 15 },
            { header: '平时成绩', key: 'dailyScore', width: 15 },
            { header: '考试部分成绩', key: 'examScore', width: 15 },
            { header: '总成绩', key: 'finalScore', width: 15 },
        ];

        // Add Data
        results.forEach(r => {
            worksheet.addRow({
                className: r.className,
                name: r.student.name,
                studentId: r.student.username, // Assuming username is studentID
                dailyScore: r.dailyScore,
                examScore: r.examPartScore,
                finalScore: r.finalScore
            });
        });

        // Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=exam_grades_${id}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        logger.error('Export Grades Error', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
