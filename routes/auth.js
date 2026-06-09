// routes/auth.js — 회원가입 / 로그인 / 내 정보
const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

// 무차별 대입 방지: 인증 라우트에 속도 제한
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

// ─── 회원가입 ───
// body: { name, email, password }
router.post('/register', authLimiter, async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ error: '모든 항목을 입력하세요.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    }

    // 중복 검사
    const exists = await User.findOne({ $or: [{ email }, { name }] });
    if (exists) {
      const which = exists.email === email ? '이메일' : '닉네임';
      return res.status(409).json({ error: `이미 사용 중인 ${which}입니다.` });
    }

    const user = new User({ name, email });
    await user.setPassword(password);
    await user.save();

    const token = signToken(user);
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    // unique 인덱스 경합 등
    if (err.code === 11000) {
      return res.status(409).json({ error: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }
    console.error('register error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 로그인 ───
// body: { id (이메일 또는 닉네임), password }
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) {
      return res.status(400).json({ error: '모든 항목을 입력하세요.' });
    }

    const key = id.trim();
    const user = await User.findOne({
      $or: [{ email: key.toLowerCase() }, { name: key }],
    });

    // 유저 없음/비번 틀림을 동일 메시지로 처리 (계정 존재 노출 방지)
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: '계정 정보가 올바르지 않습니다.' });
    }

    const token = signToken(user);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 내 정보 ───
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
