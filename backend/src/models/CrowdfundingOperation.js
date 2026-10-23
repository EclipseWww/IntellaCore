const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  crowdfundingId: { type: mongoose.Schema.Types.ObjectId, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  points: { type: Number, required: true },
  message: String,
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  reason: String
}, { timestamps: true });
schema.index({ status: 1, updatedAt: 1 });
module.exports = mongoose.model('CrowdfundingOperation', schema);
