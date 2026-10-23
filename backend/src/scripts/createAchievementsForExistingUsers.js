/**
 * 为已存在的用户创建Achievement记录的脚本
 * 运行方法: node createAchievementsForExistingUsers.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Achievement = require('../models/Achievement');
require('dotenv').config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB 连接成功'))
.catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});

// 为现有用户创建 Achievement 记录
const createAchievements = async () => {
  try {
    // 获取所有学生用户
    const students = await User.find({ role: 'student' });
    console.log(`找到 ${students.length} 个学生用户`);

    let created = 0;
    let skipped = 0;

    // 为每个学生创建成就记录
    for (const student of students) {
      // 检查是否已有成就记录
      const existingAchievement = await Achievement.findOne({ studentId: student._id });
      
      if (existingAchievement) {
        console.log(`用户 ${student.name} (ID: ${student._id}) 已有成就记录，跳过`);
        skipped++;
        continue;
      }

      // 创建新的成就记录
      const newAchievement = new Achievement({
        studentId: student._id,
        totalPoints: 100, // 初始积分值
        level: 1,
        pointTransactions: [{
          amount: 100,
          type: 'system_reward',
          description: '初始欢迎奖励',
          timestamp: new Date()
        }]
      });

      await newAchievement.save();
      console.log(`为用户 ${student.name} (ID: ${student._id}) 创建了成就记录`);
      created++;
    }

    console.log('========== 执行结果 ==========');
    console.log(`成功创建: ${created} 条记录`);
    console.log(`已有记录 (跳过): ${skipped} 条记录`);
    console.log('==============================');

  } catch (error) {
    console.error('创建成就记录时出错:', error);
  } finally {
    // 关闭数据库连接
    mongoose.connection.close();
    console.log('数据库连接已关闭');
  }
};

// 执行脚本
createAchievements(); 