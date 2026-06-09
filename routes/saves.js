// routes/saves.js — 게임별 세이브 CRUD
const express = require('express');
const GameSave = require('../models/GameSave');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_GAMES = ['kbo', 'soccer', 'lol', 'gacha'];

function checkGame(req, res, next) {
  if (!VALID_GAMES.includes(req.params.game)) {
    return res.status(400).json({ error: '알 수 없는 게임입니다.' });
  }
  next();
}

// 이 라우터의 모든 엔드포인트는 로그인 필요
router.use(requireAuth);

// ─── 내 전체 세이브 목록 (프로필/대시보드용) ───
router.get('/', async (req, res) => {
  const saves = await GameSave.find({ userId: req.user._id }).lean();
  const map = {};
  for (const s of saves) map[s.game] = { data: s.data, updatedAt: s.updatedAt };
  res.json({ saves: map });
});

// ─── 특정 게임 세이브 불러오기 ───
router.get('/:game', checkGame, async (req, res) => {
  const save = await GameSave.findOne({ userId: req.user._id, game: req.params.game });
  res.json({ data: save ? save.data : null });
});

// ─── 특정 게임 세이브 저장(덮어쓰기) ───
// body: { data: {...} }
router.put('/:game', checkGame, async (req, res) => {
  const { data } = req.body || {};
  if (typeof data === 'undefined') {
    return res.status(400).json({ error: 'data 필드가 필요합니다.' });
  }
  const save = await GameSave.findOneAndUpdate(
    { userId: req.user._id, game: req.params.game },
    { $set: { data } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ ok: true, updatedAt: save.updatedAt });
});

// ─── 특정 게임 세이브 삭제 ───
router.delete('/:game', checkGame, async (req, res) => {
  await GameSave.deleteOne({ userId: req.user._id, game: req.params.game });
  res.json({ ok: true });
});

module.exports = router;
