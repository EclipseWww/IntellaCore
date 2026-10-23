const mongoose = require('mongoose');
const Course = require('../models/Course');
const User = require('../models/User');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/ai-chat-edu';

const courses = [
  {
    title: '计算机基础知识',
    description: '本课程将带领学生了解计算机的基本组成、工作原理，以及计算机在现代社会中的重要作用。通过学习，学生将掌握计算机硬件、软件的基本概念，为进一步学习打下坚实基础。',
    duration: '10课时',
    level: '入门',
    tags: ['计算机基础', '硬件', '软件'],
    lessons: [
      {
        title: '计算机发展历史',
        content: '了解计算机的发展历程和重要里程碑',
        duration: 45,
        order: 1
      },
      {
        title: '计算机硬件组成',
        content: '学习CPU、内存、硬盘等硬件组件的功能',
        duration: 45,
        order: 2
      },
      {
        title: '计算机软件系统',
        content: '认识操作系统和应用软件的概念',
        duration: 45,
        order: 3
      }
    ],
    status: 'published'
  },
  {
    title: '操作系统入门',
    description: '本课程将教授Windows操作系统的基本使用方法，包括文件管理、系统设置、软件安装等实用技能。通过实践操作，学生将能够熟练使用计算机完成日常任务。',
    duration: '12课时',
    level: '入门',
    tags: ['Windows', '操作系统', '文件管理'],
    lessons: [
      {
        title: 'Windows系统基础',
        content: '认识Windows界面和基本操作',
        duration: 45,
        order: 1
      },
      {
        title: '文件管理',
        content: '学习文件和文件夹的创建、移动、复制等操作',
        duration: 45,
        order: 2
      },
      {
        title: '系统设置与维护',
        content: '掌握系统设置和基本维护技能',
        duration: 45,
        order: 3
      }
    ],
    status: 'published'
  },
  {
    title: '网络基础',
    description: '本课程介绍互联网的基本概念、工作原理和网络安全知识。学生将学习如何安全地使用互联网，保护个人信息，预防网络风险。',
    duration: '8课时',
    level: '初级',
    tags: ['网络', '互联网', '网络安全'],
    lessons: [
      {
        title: '互联网基础概念',
        content: '了解互联网的工作原理和基本概念',
        duration: 45,
        order: 1
      },
      {
        title: '网络安全',
        content: '学习网络安全知识和防护措施',
        duration: 45,
        order: 2
      },
      {
        title: '网络应用',
        content: '掌握常用网络应用的使用方法',
        duration: 45,
        order: 3
      }
    ],
    status: 'published'
  },
  {
    title: '办公软件应用',
    description: '本课程将教授Microsoft Office套件的基本使用方法，包括Word文档处理、Excel表格制作和PowerPoint演示文稿制作。学生将能够使用这些工具完成学习和日常工作任务。',
    duration: '15课时',
    level: '初级',
    tags: ['Office', 'Word', 'Excel', 'PowerPoint'],
    lessons: [
      {
        title: 'Word基础操作',
        content: '学习文档格式化和编辑技巧',
        duration: 45,
        order: 1
      },
      {
        title: 'Excel数据处理',
        content: '掌握表格制作和基本计算功能',
        duration: 45,
        order: 2
      },
      {
        title: 'PowerPoint演示',
        content: '制作精美的演示文稿',
        duration: 45,
        order: 3
      }
    ],
    status: 'published'
  },
  {
    title: '编程入门（Scratch）',
    description: '通过图形化编程工具Scratch，学生将学习基本的编程概念和逻辑思维。课程通过有趣的项目和游戏制作，激发学生对编程的兴趣。',
    duration: '12课时',
    level: '初级',
    tags: ['Scratch', '编程', '游戏开发'],
    lessons: [
      {
        title: 'Scratch界面介绍',
        content: '认识Scratch编程环境和基本功能',
        duration: 45,
        order: 1
      },
      {
        title: '基础编程概念',
        content: '学习顺序、循环、判断等编程概念',
        duration: 45,
        order: 2
      },
      {
        title: '游戏项目开发',
        content: '制作简单的游戏项目',
        duration: 45,
        order: 3
      }
    ],
    status: 'published'
  }
];

async function seedCourses() {
  try {
    // 连接数据库
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');

    // 获取一个教师用户作为课程讲师
    const teacher = await User.findOne({ role: 'teacher' });
    if (!teacher) {
      console.log('未找到教师用户，请先创建一个教师账号');
      process.exit(1);
    }

    // 为所有课程添加讲师ID
    const coursesWithInstructor = courses.map(course => ({
      ...course,
      instructor: teacher._id
    }));

    // 清空现有课程
    await Course.deleteMany({});
    console.log('已清空现有课程');

    // 添加新课程
    await Course.insertMany(coursesWithInstructor);
    console.log('课程数据添加成功');

    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

seedCourses();
