const Class = require('../models/Class');
const logger = require('../utils/logger');

/**
 * 旧版本的班级唯一索引 grade_1_name_1 不区分班级类型，会让没有年级和班号的教学班互相冲突。
 * 启动时删除它，并建立只约束行政班的新索引。
 */
async function migrateClassIndexes() {
  try {
    const indexes = await Class.collection.indexes();
    const legacy = indexes.find(i => i.name === 'grade_1_name_1');
    if (legacy) {
      await Class.collection.dropIndex('grade_1_name_1');
      logger.info('已删除旧的班级唯一索引 grade_1_name_1');
    }
    await Class.createIndexes();
  } catch (error) {
    // 集合还不存在（全新数据库）时 indexes() 会报错，createIndexes 会在首次写入时自动建立
    if (error.codeName === 'NamespaceNotFound' || error.code === 26) return;
    logger.warn('班级索引迁移失败', { error: error.message });
  }
}

module.exports = { migrateClassIndexes };
