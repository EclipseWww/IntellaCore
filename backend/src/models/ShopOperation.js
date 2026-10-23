const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'PointShopItem', required: true },
  itemName: { type: String, required: true },
  itemType: { type: String, required: true },
  pointCost: { type: Number, required: true },
  duration: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  reason: String
}, { timestamps: true });
schema.index({ status: 1, createdAt: 1 });
module.exports = mongoose.model('ShopOperation', schema);
