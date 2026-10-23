const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/ai-chat-edu';

async function createTeacher() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');

    const teacher = new User({
      username: 'teacher1',
      password: 'teacher123',
      role: 'teacher',
      name: '张老师'
    });

    await teacher.save();
    console.log('教师账号创建成功');
    await mongoose.connection.close();
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

createTeacher();
