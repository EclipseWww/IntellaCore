const mongoose = require('mongoose');

/** 游戏存档：每个用户、每个游戏一份，内容由游戏自己决定（JSON） */
const gameSaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

gameSaveSchema.index({ user: 1, gameId: 1 }, { unique: true });

module.exports = mongoose.model('GameSave', gameSaveSchema);
