const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
require('dotenv').config();

async function migrateLessons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const lessons = await Lesson.find({});
    console.log(`Found ${lessons.length} lessons to migrate`);

    for (const lesson of lessons) {
      // 提取旧的数据结构中的信息
      const oldData = lesson.toObject();
      
      // 构建新的数据结构
      const newData = {
        title: oldData.title,
        description: oldData.description,
        objectives: oldData.teachingPlan?.objectives || [],
        activities: (oldData.teachingPlan?.steps || []).map((step, index) => ({
          title: step.title,
          type: convertStepTypeToActivityType(step.type),
          description: step.content,
          duration: step.duration,
          order: index + 1
        })),
        resources: (oldData.resources?.supplementary || []).map(resource => ({
          title: resource.title,
          type: resource.type,
          url: resource.url,
          description: resource.purpose
        })),
        exercises: (oldData.interaction?.exercises || []).map(exercise => ({
          title: exercise.title,
          description: exercise.content,
          type: exercise.type || 'practice',
          duration: exercise.duration
        })),
        course: oldData.course,
        unit: oldData.unit,
        order: oldData.order,
        status: 'published'
      };

      // 更新课时
      await Lesson.findByIdAndUpdate(lesson._id, newData, { new: true });
      console.log(`Migrated lesson: ${lesson.title}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// 将旧的步骤类型转换为新的活动类型
function convertStepTypeToActivityType(stepType) {
  const typeMap = {
    'introduction': 'reading',
    'lecture': 'video',
    'practice': 'practice',
    'discussion': 'discussion',
    'assessment': 'quiz',
    'summary': 'reading'
  };
  return typeMap[stepType] || 'reading';
}

// 运行迁移
migrateLessons().catch(console.error);
