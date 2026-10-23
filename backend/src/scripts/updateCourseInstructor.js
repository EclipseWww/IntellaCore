const mongoose = require('mongoose');
const Course = require('../models/Course');
const dotenv = require('dotenv');

dotenv.config();

async function updateCourseInstructor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 更新课程的 instructor
    const result = await Course.updateOne(
      { _id: "67ac6880b6780f1a59113c5e" },
      { $set: { instructor: "67ab46bfdd35d101163afdeb" } }
    );

    console.log('Update result:', result);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateCourseInstructor();
