const mongoose = require('mongoose');
const Course = require('../models/Course');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

async function checkCourses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 获取所有课程
    const courses = await Course.find();
    console.log('Total courses:', courses.length);
    console.log('Courses:');
    courses.forEach(course => {
      console.log({
        id: course._id,
        title: course.title,
        instructor: course.instructor,
        status: course.status,
        createdAt: course.createdAt
      });
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCourses();
