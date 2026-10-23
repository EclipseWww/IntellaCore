require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const QuizSubmission = require('../models/QuizSubmission');

async function fixQuizSubmissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');


    // Find submissions where startTime is after submitTime
    const submissions = await QuizSubmission.find({
      $expr: { $gt: ['$startTime', '$submitTime'] }
    });

    console.log(`Found ${submissions.length} dirty records.`);

    let fixedCount = 0;
    for (const sub of submissions) {
      if (sub.createdAt) {
        sub.startTime = sub.createdAt;
        await sub.save();
        fixedCount++;
        console.log(`Fixed record ${sub._id}: Set startTime to ${sub.createdAt.toISOString()}`);
      }
    }

    console.log(`Successfully fixed ${fixedCount} records.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
}

fixQuizSubmissions();
