/**
 * 数据库导出脚本
 * 用法: node src/scripts/export-db.js [collection] [outputPath]
 * 
 * 示例:
 * - 导出所有集合: node src/scripts/export-db.js
 * - 导出特定集合: node src/scripts/export-db.js Lesson ./exports
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// 加载所有模型
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const TypingText = require('../models/TypingText');
const User = require('../models/User');
const Class = require('../models/Class');
const Progress = require('../models/Progress');

// 可导出的集合映射
const COLLECTIONS = {
  'Lesson': Lesson,
  'Course': Course,
  'CourseUnit': CourseUnit,
  'Quiz': Quiz,
  'Question': Question,
  'TypingText': TypingText,
  'User': User,
  'Class': Class,
  'Progress': Progress
};

// 创建导出目录
async function createExportDir(outputPath) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const exportDir = path.resolve(outputPath || `./exports_${timestamp}`);
  
  try {
    await fs.mkdir(exportDir, { recursive: true });
    console.log(`创建导出目录: ${exportDir}`);
    return exportDir;
  } catch (error) {
    console.error('创建导出目录失败:', error);
    throw error;
  }
}

// 导出单个集合
async function exportCollection(model, exportDir) {
  const collectionName = model.collection.collectionName;
  console.log(`开始导出集合: ${collectionName}`);
  
  try {
    const data = await model.find({}).lean();
    const outputPath = path.join(exportDir, `${collectionName}.json`);
    
    await fs.writeFile(
      outputPath, 
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`成功导出 ${data.length} 条记录到 ${outputPath}`);
    return data.length;
  } catch (error) {
    console.error(`导出集合 ${collectionName} 失败:`, error);
    return 0;
  }
}

// 主函数
async function main() {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const collectionName = args[0];
    const outputPath = args[1];
    
    // 连接数据库
    console.log(`连接到数据库: ${config.mongoUri}`);
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');
    
    // 创建导出目录
    const exportDir = await createExportDir(outputPath);
    
    // 导出数据
    let totalExported = 0;
    
    if (collectionName && COLLECTIONS[collectionName]) {
      // 导出指定集合
      totalExported = await exportCollection(COLLECTIONS[collectionName], exportDir);
    } else if (collectionName) {
      console.error(`错误: 未知集合 "${collectionName}"`);
      console.log(`可用集合: ${Object.keys(COLLECTIONS).join(', ')}`);
      process.exit(1);
    } else {
      // 导出所有集合
      console.log('导出所有集合...');
      
      for (const [name, model] of Object.entries(COLLECTIONS)) {
        const count = await exportCollection(model, exportDir);
        totalExported += count;
      }
    }
    
    console.log(`导出完成! 总共导出 ${totalExported} 条记录到 ${exportDir}`);
    
    // 创建导出信息文件
    const infoPath = path.join(exportDir, 'export-info.json');
    await fs.writeFile(
      infoPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        collections: collectionName ? [collectionName] : Object.keys(COLLECTIONS),
        totalRecords: totalExported,
        dbUri: config.mongoUri.replace(/\/\/.*?@/, '//[credentials]@') // 隐藏凭据
      }, null, 2),
      'utf8'
    );
    
    // 断开数据库连接
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
    
  } catch (error) {
    console.error('导出过程中发生错误:', error);
    process.exit(1);
  }
}

// 执行主函数
main();