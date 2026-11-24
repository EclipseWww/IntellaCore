require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');

// 将历史遗留的积分浮点尾数（如 7.000000000000001）统一修正为两位小数。
// 只处理 totalPoints 与 pointTransactions.amount；用单条管道更新原地修正，
// 与并发发放积分不会互相覆盖。可重复执行，已是两位小数的记录不会被改动。
const round2 = value => ({ $round: [{ $ifNull: [value, 0] }, 2] });
const dirtyFilter = {
  $expr: {
    $or: [
      { $ne: [{ $ifNull: ['$totalPoints', 0] }, round2('$totalPoints')] },
      { $anyElementTrue: [{ $map: {
        input: { $ifNull: ['$pointTransactions', []] },
        as: 't',
        in: { $ne: [{ $ifNull: ['$$t.amount', 0] }, round2('$$t.amount')] }
      } }] }
    ]
  }
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('已连接数据库');
  try {
    const samples = await Achievement.find(dirtyFilter).select('studentId totalPoints').limit(10).lean();
    const before = await Achievement.countDocuments(dirtyFilter);
    console.log(`发现 ${before} 条积分记录含有超过两位小数的数值`);
    for (const s of samples) console.log(`  示例 学生 ${s.studentId}: totalPoints=${s.totalPoints}`);
    if (!before) return;

    const result = await Achievement.updateMany(dirtyFilter, [{ $set: {
      totalPoints: round2('$totalPoints'),
      pointTransactions: { $map: {
        input: { $ifNull: ['$pointTransactions', []] },
        as: 't',
        in: { $mergeObjects: ['$$t', { amount: round2('$$t.amount') }] }
      } }
    } }]);
    const after = await Achievement.countDocuments(dirtyFilter);
    console.log(`已修正 ${result.modifiedCount} 条记录，剩余异常 ${after} 条`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('执行失败:', error);
  process.exitCode = 1;
});
