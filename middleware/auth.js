// middleware/auth.js — JWT 검증 미들웨어
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authorization: Bearer <token> 헤더를 검증하고 req.user 에 유저를 붙입니다.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.uid);
    if (!user) {
      return res.status(401).json({ error: '유효하지 않은 계정입니다.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: '인증 토큰이 유효하지 않거나 만료되었습니다.' });
  }
}

// 토큰 발급 헬퍼
function signToken(user) {
  return jwt.sign({ uid: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

module.exports = { requireAuth, signToken };
