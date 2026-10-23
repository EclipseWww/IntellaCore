const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 获取所有用户
    const users = await User.find({ role: 'teacher' });
    console.log('Total teachers:', users.length);
    console.log('Teachers:');
    users.forEach(user => {
      console.log({
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      });
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
