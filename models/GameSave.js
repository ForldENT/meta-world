// models/GameSave.js — 유저별 / 게임별 세이브 (유연한 스키마)
const mongoose = require('mongoose');

// 게임마다 세이브 구조가 다르므로 data는 자유 형식(Mixed)으로 둡니다.
// (userId, game) 조합당 1개의 세이브 문서를 유지합니다.
const gameSaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    game: {
      type: String,
      required: true,
      enum: ['kbo', 'soccer', 'lol', 'gacha'], // 새 게임 추가 시 여기에 등록
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
    minimize: false, // 빈 객체 {}도 그대로 저장
  }
);

// 한 유저는 한 게임당 세이브 하나
gameSaveSchema.index({ userId: 1, game: 1 }, { unique: true });

module.exports = mongoose.model('GameSave', gameSaveSchema);
