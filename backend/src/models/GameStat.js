const mongoose = require('mongoose');

/** 游戏热度：按学生实际游玩时长累计（心跳计时，教师试玩不计入） */
const gameStatSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  totalSeconds: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 },
  players: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false }, // 去重玩家
  lastPlayedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('GameStat', gameStatSchema);
