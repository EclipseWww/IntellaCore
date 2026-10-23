const mongoose = require('mongoose');
const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const Assignment = require('../models/Assignment');
require('dotenv').config();

async function createPythonCourse() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功');

    // 清理现有数据
    await Course.deleteMany({});
    await CourseUnit.deleteMany({});
    await Lesson.deleteMany({});
    await Assignment.deleteMany({});

    // 创建 Python 课程
    const course = await Course.create({
      title: 'Python 编程基础',
      description: '从零开始学习 Python 编程，掌握编程基础知识和技能。',
      type: 'programming',
      category: 'python',
      instructor: '64e5f35d72e71d001f24e43c', // 请替换为实际的讲师ID
      level: '入门',
      duration: '40小时',
      status: 'published',
      structure: {
        type: 'chapter'
      },
      settings: {
        hasDeadlines: true,
        hasAssessment: true,
        hasCertification: true,
        isSequential: true,
        allowReview: true
      },
      tags: ['Python', '编程基础', '入门课程']
    });

    // 创建单元
    const units = [
      {
        title: '第一单元：Python 入门',
        description: '了解 Python 编程语言的基础概念和开发环境。',
        order: 1,
        type: 'chapter'
      },
      {
        title: '第二单元：基础语法',
        description: '学习 Python 的基本语法规则和编程结构。',
        order: 2,
        type: 'chapter'
      }
    ];

    for (const unitData of units) {
      const unit = await CourseUnit.create({
        ...unitData,
        course: course._id
      });

      // 为每个单元创建课时
      if (unit.order === 1) {
        await createUnit1Lessons(course._id, unit._id);
      } else if (unit.order === 2) {
        await createUnit2Lessons(course._id, unit._id);
      }
    }

    console.log('Python 课程创建成功！');
  } catch (error) {
    console.error('创建课程失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('已断开数据库连接');
  }
}

async function createUnit1Lessons(courseId, unitId) {
  const lessons = [
    {
      title: '1.1 认识 Python',
      description: '了解 Python 的历史、特点和应用领域',
      order: 1,
      objectives: [
        '了解 Python 语言的起源和发展',
        '理解 Python 的主要特点和优势',
        '认识 Python 的常见应用场景'
      ],
      activities: [
        {
          title: 'Python 简介',
          type: 'reading',
          description: '阅读 Python 语言的基本介绍',
          content: '# Python 简介\n\nPython 是一种广泛使用的解释型、高级编程语言。Python 的设计具有很强的可读性...',
          duration: 15,
          hasAssignment: false
        },
        {
          title: '安装 Python',
          type: 'practice',
          description: '在本地计算机上安装 Python 环境',
          content: '# 安装步骤\n\n1. 访问 Python 官网\n2. 下载适合你操作系统的版本\n3. 运行安装程序...',
          duration: 30,
          hasAssignment: true,
          resources: ['https://www.python.org']
        },
        {
          title: '第一个程序',
          type: 'practice',
          description: '编写并运行你的第一个 Python 程序',
          content: '让我们来编写第一个 Python 程序！\n\n```python\nprint("Hello, World!")\n```',
          duration: 20,
          hasAssignment: true
        }
      ]
    },
    {
      title: '1.2 开发环境配置',
      description: '配置 Python 开发环境，安装必要的工具',
      order: 2,
      objectives: [
        '掌握 Python 环境变量的配置',
        '学会使用集成开发环境（IDE）',
        '了解常用的 Python 包管理工具'
      ],
      activities: [
        {
          title: '认识 VS Code',
          type: 'video',
          description: '了解 VS Code 编辑器的基本使用',
          content: '# VS Code 简介\n\nVS Code 是一个轻量级但功能强大的代码编辑器...',
          duration: 20,
          hasAssignment: false,
          resources: ['https://code.visualstudio.com']
        },
        {
          title: '配置开发环境',
          type: 'practice',
          description: '配置 Python 开发环境',
          content: '# 环境配置步骤\n\n1. 安装 Python 插件\n2. 配置解释器\n3. 安装常用工具',
          duration: 45,
          hasAssignment: true
        }
      ]
    }
  ];

  for (const lessonData of lessons) {
    // 为需要提交作业的活动创建作业
    const activitiesWithAssignments = await Promise.all(
      lessonData.activities.map(async (activity) => {
        if (activity.hasAssignment) {
          const assignment = await Assignment.create({
            title: `作业：${activity.title}`,
            description: `完成 ${activity.title} 的相关练习`,
            course: courseId,
            unit: unitId,
            type: 'practice',
            format: 'code',
            content: {
              instructions: activity.content,
              requirements: ['按时提交', '代码要有注释']
            },
            submission: {
              type: 'code',
              codeLanguage: 'python'
            },
            grading: {
              totalPoints: 100,
              passingScore: 60,
              autoGrade: false
            },
            scheduling: {
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后截止
              lateSubmission: {
                allowed: true,
                penalty: 10,
                maxDelay: 7
              }
            },
            settings: {
              allowMultipleAttempts: true,
              maxAttempts: 3,
              showAnswerAfter: 'dueDate'
            },
            status: 'published'
          });
          return { ...activity, assignment: assignment._id };
        }
        return activity;
      })
    );

    await Lesson.create({
      ...lessonData,
      activities: activitiesWithAssignments,
      course: courseId,
      unit: unitId,
      status: 'published'
    });
  }
}

async function createUnit2Lessons(courseId, unitId) {
  const lessons = [
    {
      title: '2.1 Python 基础语法',
      description: '学习 Python 的基本语法规则',
      order: 1,
      objectives: [
        '理解 Python 的缩进规则',
        '掌握 Python 的注释写法',
        '学习 Python 的基本数据类型'
      ],
      activities: [
        {
          title: '语法规则介绍',
          type: 'reading',
          description: '了解 Python 的基本语法规则',
          content: '# Python 语法规则\n\nPython 使用缩进来表示代码块，而不是使用花括号...',
          duration: 25,
          hasAssignment: false
        },
        {
          title: '变量和数据类型',
          type: 'practice',
          description: '学习 Python 的变量定义和基本数据类型',
          content: '# 变量和数据类型\n\n```python\n# 数字类型\nx = 42\ny = 3.14\n\n# 字符串\nname = "Python"\n```',
          duration: 40,
          hasAssignment: true
        },
        {
          title: '编程练习',
          type: 'quiz',
          description: '完成相关的编程练习，巩固所学知识',
          content: '请完成以下练习：\n\n1. 创建不同类型的变量\n2. 进行基本的数学运算\n3. 使用字符串方法',
          duration: 30,
          hasAssignment: true
        }
      ]
    },
    {
      title: '2.2 运算符和表达式',
      description: '学习 Python 中的各种运算符和表达式',
      order: 2,
      objectives: [
        '掌握算术运算符的使用',
        '理解比较运算符和逻辑运算符',
        '学会运算符优先级'
      ],
      activities: [
        {
          title: '运算符概述',
          type: 'video',
          description: '介绍 Python 中的各种运算符',
          content: '# Python 运算符\n\nPython 支持以下类型的运算符：\n- 算术运算符\n- 比较运算符\n- 逻辑运算符...',
          duration: 30,
          hasAssignment: false
        },
        {
          title: '表达式练习',
          type: 'practice',
          description: '练习编写各种 Python 表达式',
          content: '# 练习题\n\n```python\n# 1. 计算以下表达式\nx = 10\ny = 3\nprint(x + y)\nprint(x * y)\n```',
          duration: 35,
          hasAssignment: true
        }
      ]
    }
  ];

  for (const lessonData of lessons) {
    // 为需要提交作业的活动创建作业
    const activitiesWithAssignments = await Promise.all(
      lessonData.activities.map(async (activity) => {
        if (activity.hasAssignment) {
          const assignment = await Assignment.create({
            title: `作业：${activity.title}`,
            description: `完成 ${activity.title} 的相关练习`,
            course: courseId,
            unit: unitId,
            type: 'practice',
            format: 'code',
            content: {
              instructions: activity.content,
              requirements: ['按时提交', '代码要有注释']
            },
            submission: {
              type: 'code',
              codeLanguage: 'python'
            },
            grading: {
              totalPoints: 100,
              passingScore: 60,
              autoGrade: false
            },
            scheduling: {
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后截止
              lateSubmission: {
                allowed: true,
                penalty: 10,
                maxDelay: 7
              }
            },
            settings: {
              allowMultipleAttempts: true,
              maxAttempts: 3,
              showAnswerAfter: 'dueDate'
            },
            status: 'published'
          });
          return { ...activity, assignment: assignment._id };
        }
        return activity;
      })
    );

    await Lesson.create({
      ...lessonData,
      activities: activitiesWithAssignments,
      course: courseId,
      unit: unitId,
      status: 'published'
    });
  }
}

// 运行脚本
createPythonCourse().catch(console.error);
