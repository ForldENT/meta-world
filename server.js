// server.js — Meta World 백엔드 엔트리
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Render 같은 프록시 뒤에서 동작 (Portfolio-System에서 배운 설정)
app.set('trust proxy', 1);

// ── 미들웨어 ──
app.use(cors()); // 같은 오리진에서 서빙하므로 기본 설정으로 충분
app.use(express.json({ limit: '2mb' })); // 게임 세이브가 클 수 있어 여유

// ── API 라우트 ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/saves', require('./routes/saves'));

// 헬스체크 (Render 모니터링용)
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// ── 정적 사이트 (포털 + 게임들) ──
app.use(express.static(path.join(__dirname, 'public')));

// SPA가 아니므로 정적 파일이 없으면 index로 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// DB 연결 후 서버 시작
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🌐 Meta World 서버 실행 중 → http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('🚨 시작 실패:', err.message);
    process.exit(1);
  });
