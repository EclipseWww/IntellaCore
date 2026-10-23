/**
 * 调试脚本：查找特定活动的待批改提交（检查所有提交类型）
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 先导入 User 模型（因为 populate 需要）
const User = require('./src/models/User');

// 导入所有提交模型
const AssignmentSubmission = require('./src/models/AssignmentSubmission');
const PythonSubmission = require('./src/models/PythonSubmission');
const FlowchartSubmission = require('./src/models/FlowchartSubmission');
const SpreadsheetSubmission = require('./src/models/SpreadsheetSubmission');
const FillBlankSubmission = require('./src/models/FillBlankSubmission');
const Lesson = require('./src/models/Lesson');

async function debugPendingSubmissions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chat-edu');
        console.log('数据库连接成功');

        // 查找课时
        const lessons = await Lesson.find({
            title: { $regex: '04-顺序结构练习1', $options: 'i' }
        }).select('_id title activities').lean();

        console.log(`\n找到 ${lessons.length} 个匹配的课时`);

        for (const lesson of lessons) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`课时: ${lesson.title} (ID: ${lesson._id})`);

            const activities = lesson.activities || [];

            // 找到 "任务1" 活动
            const task1 = activities.find(a => a.title === '任务1');
            if (!task1) {
                console.log('未找到 "任务1" 活动');
                continue;
            }

            console.log(`\n活动: ${task1.title} | 类型: ${task1.type} | ID: ${task1._id}`);
            console.log(`requireSubmission: ${task1.requireSubmission}`);

            const activityId = task1._id;
            const lessonId = lesson._id;

            // 检查 AssignmentSubmission
            console.log('\n--- AssignmentSubmission ---');
            const assignmentSubs = await AssignmentSubmission.find({
                lesson: lessonId,
                activity: activityId
            }).populate('student', 'name username role').lean();

            console.log(`总数: ${assignmentSubs.length}`);
            const pendingAssignment = assignmentSubs.filter(s =>
                s.status === 'submitted' &&
                (s.grade?.score === undefined || s.grade?.score === null)
            );
            console.log(`待批改 (status=submitted AND grade.score为空): ${pendingAssignment.length}`);

            if (pendingAssignment.length > 0) {
                console.log('\n待批改详情:');
                for (const p of pendingAssignment) {
                    console.log(`  学生: ${p.student?.name || '未知'} (${p.student?.username})`);
                    console.log(`    角色: ${p.student?.role}`);
                    console.log(`    状态: ${p.status}`);
                    console.log(`    grade.score: ${p.grade?.score}`);
                    console.log(`    aiGrade.score: ${p.aiGrade?.score}`);
                    console.log(`    提交ID: ${p._id}`);
                }
            }

            // 状态分布
            const statusDist = {};
            assignmentSubs.forEach(s => {
                const key = `status=${s.status}, grade.score=${s.grade?.score ?? 'undefined'}`;
                statusDist[key] = (statusDist[key] || 0) + 1;
            });
            console.log('\n状态分布:');
            for (const [k, v] of Object.entries(statusDist)) {
                console.log(`  ${k}: ${v}`);
            }

            // 检查 PythonSubmission
            console.log('\n--- PythonSubmission ---');
            const pythonSubs = await PythonSubmission.find({
                lessonId: lessonId,
                activityId: activityId.toString()
            }).populate('studentId', 'name username role').lean();
            console.log(`总数: ${pythonSubs.length}`);

            // 检查 FlowchartSubmission
            console.log('\n--- FlowchartSubmission ---');
            const flowchartSubs = await FlowchartSubmission.find({
                lessonId: lessonId,
                activityId: activityId
            }).populate('userId', 'name username role').lean();
            console.log(`总数: ${flowchartSubs.length}`);

            // 检查 SpreadsheetSubmission
            console.log('\n--- SpreadsheetSubmission ---');
            const spreadsheetSubs = await SpreadsheetSubmission.find({
                lessonId: lessonId,
                activityId: activityId
            }).populate('userId', 'name username role').lean();
            console.log(`总数: ${spreadsheetSubs.length}`);

            // 检查 FillBlankSubmission
            console.log('\n--- FillBlankSubmission ---');
            const fillblankSubs = await FillBlankSubmission.find({
                lessonId: lessonId,
                activityId: activityId
            }).populate('studentId', 'name username role').lean();
            console.log(`总数: ${fillblankSubs.length}`);
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
}

debugPendingSubmissions();
