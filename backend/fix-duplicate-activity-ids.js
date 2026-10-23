/**
 * 数据迁移脚本：修复重复的活动ID问题（包含提交记录关联更新）
 * 
 * 问题说明：
 * 由于导入课时时未清除活动的 _id，导致多个课时共享相同的活动ID。
 * 这会导致待批改统计中将不同课时的提交混在一起计算。
 * 
 * 解决方案：
 * 1. 找出所有在多个课时中出现的重复活动ID
 * 2. 对于每个重复的活动，除了第一个出现的保留原ID外，其他的生成新ID
 * 3. 同时更新该课时中关联的所有提交记录的 activityId
 * 
 * 注意：运行前请备份数据库！
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Lesson = require('./src/models/Lesson');
const AssignmentSubmission = require('./src/models/AssignmentSubmission');
const PythonSubmission = require('./src/models/PythonSubmission');
const FlowchartSubmission = require('./src/models/FlowchartSubmission');
const SpreadsheetSubmission = require('./src/models/SpreadsheetSubmission');
const FillBlankSubmission = require('./src/models/FillBlankSubmission');

async function fixDuplicateActivityIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chat-edu');
        console.log('数据库连接成功');

        // 1. 获取所有课时和活动
        const lessons = await Lesson.find({}).select('_id title activities').lean();
        console.log(`找到 ${lessons.length} 个课时`);

        // 2. 统计每个活动ID出现的次数和位置
        const activityIdMap = new Map(); // activityId -> [{lessonId, lessonTitle, activityTitle, index}]

        for (const lesson of lessons) {
            if (lesson.activities && lesson.activities.length > 0) {
                lesson.activities.forEach((activity, index) => {
                    if (activity._id) {
                        const activityIdStr = activity._id.toString();
                        if (!activityIdMap.has(activityIdStr)) {
                            activityIdMap.set(activityIdStr, []);
                        }
                        activityIdMap.get(activityIdStr).push({
                            lessonId: lesson._id,
                            lessonTitle: lesson.title,
                            activityTitle: activity.title,
                            activityIndex: index
                        });
                    }
                });
            }
        }

        // 3. 找出重复的活动ID
        const duplicates = [];
        for (const [activityId, occurrences] of activityIdMap.entries()) {
            if (occurrences.length > 1) {
                duplicates.push({ activityId, occurrences });
            }
        }

        console.log(`\n找到 ${duplicates.length} 个重复的活动ID`);

        if (duplicates.length === 0) {
            console.log('没有需要修复的重复活动ID');
            return;
        }

        // 4. 显示重复情况
        console.log('\n重复活动详情:');
        for (const dup of duplicates) {
            console.log(`\n活动ID: ${dup.activityId}`);
            dup.occurrences.forEach((occ, i) => {
                console.log(`  ${i + 1}. 课时: "${occ.lessonTitle}" (${occ.lessonId})`);
                console.log(`     活动: "${occ.activityTitle}" (索引: ${occ.activityIndex})`);
            });
        }

        // 5. 修复重复（保留第一个，其他生成新ID，同时更新提交记录）
        console.log('\n开始修复重复活动ID...');
        let fixedCount = 0;
        let submissionUpdateCount = 0;

        for (const dup of duplicates) {
            const oldActivityId = dup.activityId;

            // 保留第一个，修复其余的
            for (let i = 1; i < dup.occurrences.length; i++) {
                const occ = dup.occurrences[i];
                const newActivityId = new mongoose.Types.ObjectId();
                const lessonId = occ.lessonId;

                console.log(`\n处理: 课时 "${occ.lessonTitle}" 中的活动 "${occ.activityTitle}"`);
                console.log(`  原活动ID: ${oldActivityId}`);
                console.log(`  新活动ID: ${newActivityId}`);
                console.log(`  课时ID: ${lessonId}`);

                // 5.1 更新课时中的活动ID
                const updateResult = await Lesson.updateOne(
                    { _id: lessonId },
                    { $set: { [`activities.${occ.activityIndex}._id`]: newActivityId } }
                );

                if (updateResult.modifiedCount > 0) {
                    console.log(`  ✓ 活动ID已更新`);
                    fixedCount++;
                } else {
                    console.log(`  ✗ 活动ID更新失败`);
                    continue; // 如果活动ID更新失败，跳过提交更新
                }

                // 5.2 更新该课时中关联的所有提交记录

                // AssignmentSubmission (使用 lesson + activity)
                const assignmentResult = await AssignmentSubmission.updateMany(
                    { lesson: lessonId, activity: new mongoose.Types.ObjectId(oldActivityId) },
                    { $set: { activity: newActivityId } }
                );
                if (assignmentResult.modifiedCount > 0) {
                    console.log(`  ✓ 更新了 ${assignmentResult.modifiedCount} 条 AssignmentSubmission`);
                    submissionUpdateCount += assignmentResult.modifiedCount;
                }

                // PythonSubmission (使用 lessonId + activityId, activityId 是字符串)
                const pythonResult = await PythonSubmission.updateMany(
                    { lessonId: lessonId, activityId: oldActivityId },
                    { $set: { activityId: newActivityId.toString() } }
                );
                if (pythonResult.modifiedCount > 0) {
                    console.log(`  ✓ 更新了 ${pythonResult.modifiedCount} 条 PythonSubmission`);
                    submissionUpdateCount += pythonResult.modifiedCount;
                }

                // FlowchartSubmission (使用 lessonId + activityId)
                const flowchartResult = await FlowchartSubmission.updateMany(
                    { lessonId: lessonId, activityId: new mongoose.Types.ObjectId(oldActivityId) },
                    { $set: { activityId: newActivityId } }
                );
                if (flowchartResult.modifiedCount > 0) {
                    console.log(`  ✓ 更新了 ${flowchartResult.modifiedCount} 条 FlowchartSubmission`);
                    submissionUpdateCount += flowchartResult.modifiedCount;
                }

                // SpreadsheetSubmission (使用 lessonId + activityId)
                const spreadsheetResult = await SpreadsheetSubmission.updateMany(
                    { lessonId: lessonId, activityId: new mongoose.Types.ObjectId(oldActivityId) },
                    { $set: { activityId: newActivityId } }
                );
                if (spreadsheetResult.modifiedCount > 0) {
                    console.log(`  ✓ 更新了 ${spreadsheetResult.modifiedCount} 条 SpreadsheetSubmission`);
                    submissionUpdateCount += spreadsheetResult.modifiedCount;
                }

                // FillBlankSubmission (使用 lessonId + activityId)
                const fillblankResult = await FillBlankSubmission.updateMany(
                    { lessonId: lessonId, activityId: new mongoose.Types.ObjectId(oldActivityId) },
                    { $set: { activityId: newActivityId } }
                );
                if (fillblankResult.modifiedCount > 0) {
                    console.log(`  ✓ 更新了 ${fillblankResult.modifiedCount} 条 FillBlankSubmission`);
                    submissionUpdateCount += fillblankResult.modifiedCount;
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`修复完成！`);
        console.log(`  - 修复了 ${fixedCount} 个重复活动ID`);
        console.log(`  - 更新了 ${submissionUpdateCount} 条提交记录`);

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
}

// 添加确认提示
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('='.repeat(60));
console.log('活动ID重复修复脚本（含提交记录关联更新）');
console.log('='.repeat(60));
console.log('\n此脚本将：');
console.log('1. 找出所有重复的活动ID');
console.log('2. 为重复的活动生成新ID（保留第一个出现的）');
console.log('3. 更新对应课时中的提交记录，确保关联不丢失');
console.log('\n⚠️  警告：此脚本将修改数据库');
console.log('⚠️  请确保在运行前已备份数据库！\n');

rl.question('是否继续？(y/n) ', async (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'y') {
        await fixDuplicateActivityIds();
    } else {
        console.log('已取消');
    }
    process.exit(0);
});
