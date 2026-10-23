const mongoose = require('mongoose');
const Question = require('./src/models/Question');
const fs = require('fs');
require('dotenv').config();

async function checkQuestions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const output = [];
        output.push('Connected to DB');

        // 1. Total Count
        const total = await Question.countDocuments({});
        output.push(`Total Questions in DB: ${total} `);

        // 2. Breakdown by Type
        const byType = await Question.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        output.push('By Type: ' + JSON.stringify(byType, null, 2));

        // 3. Breakdown by Status
        // Note: isArchived might not exist on all docs, treated as null
        const byStatus = await Question.aggregate([
            {
                $group: {
                    _id: {
                        isDeleted: { $ne: ['$deletedAt', null] },
                        isArchived: '$isArchived'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);
        output.push('By Status (Deleted/Archived): ' + JSON.stringify(byStatus, null, 2));

        // 4. Breakdown by Difficulty
        const byDifficulty = await Question.aggregate([
            { $group: { _id: '$difficulty', count: { $sum: 1 } } }
        ]);
        output.push('By Difficulty: ' + JSON.stringify(byDifficulty, null, 2));

        // 5. Check "Valid" candidates again with relaxed logic
        const matchCondition = {
            deletedAt: null,
            isArchived: { $ne: true },
        };
        const validActive = await Question.countDocuments(matchCondition);
        output.push(`Active & Not Deleted Questions(Any Type): ${validActive} `);

        fs.writeFileSync('debug_output.txt', output.join('\n'));
        console.log('Debug output written to debug_output.txt');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkQuestions();
