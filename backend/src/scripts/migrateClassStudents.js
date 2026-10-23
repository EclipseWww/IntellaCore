require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Class = require('../models/Class');
const User = require('../models/User');

async function migrateClassStudents() {
  try {
    logger.info('开始迁移班级学生数据');

    if (!process.env.MONGODB_URI) {
      throw new Error('未设置 MONGODB_URI 环境变量');
    }

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('数据库连接成功');

    // 获取所有班级数据
    const classes = await Class.find({}).lean();
    logger.info(`找到 ${classes.length} 个班级需要迁移`);

    let totalUpdated = 0;

    // 遍历每个班级
    for (const classDoc of classes) {
      if (classDoc.students && classDoc.students.length > 0) {
        logger.info(`开始处理班级 ${classDoc.grade}-${classDoc.name}，学生数量: ${classDoc.students.length}`);

        // 更新该班级所有学生的 classId
        const updateResult = await User.updateMany(
          { _id: { $in: classDoc.students } },
          { $set: { classId: classDoc._id } }
        );

        totalUpdated += updateResult.modifiedCount;
        logger.info(`班级 ${classDoc.grade}-${classDoc.name} 更新了 ${updateResult.modifiedCount} 个学生`);
      }
    }

    logger.info(`迁移完成，总共更新了 ${totalUpdated} 个学生的班级信息`);

    // 从 Class 模型中删除 students 字段
    const updateClassSchema = await Class.updateMany(
      {},
      { $unset: { students: 1 } }
    );
    logger.info(`已从 ${updateClassSchema.modifiedCount} 个班级中移除 students 字段`);

  } catch (error) {
    logger.error('迁移过程中发生错误', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('数据库连接已关闭');
  }
}

// 执行迁移
if (require.main === module) {
  migrateClassStudents()
    .then(() => {
      logger.info('迁移脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('迁移脚本执行失败', { error: error.message });
      process.exit(1);
    });
}

module.exports = migrateClassStudents; 