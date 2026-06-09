// test/smoke.js — DB 없이 인증/세이브 라우트 통합 테스트
// mongoose 모델을 인메모리 스텁으로 교체하여 실제 라우트 로직을 검증한다.
process.env.JWT_SECRET = 'test-secret';
const assert = require('assert');
const path = require('path');
const Module = require('module');
const bcrypt = require('bcryptjs');

// ── 인메모리 "DB" ──
const usersDB = [];
const savesDB = [];
let oid = 0;
const newId = () => ({ _v: ++oid, toString() { return 'id' + this._v; } });

// ── User 모델 스텁 ──
class FakeUser {
  constructor(doc) { Object.assign(this, doc); this._id = newId(); this.createdAt = new Date(); }
  async setPassword(p) { this.passwordHash = await bcrypt.hash(p, 4); }
  verifyPassword(p) { return bcrypt.compare(p, this.passwordHash); }
  toPublic() { return { id: this._id, name: this.name, email: this.email, joined: this.createdAt }; }
  async save() {
    if (usersDB.some(u => u !== this && (u.email === this.email || u.name === this.name))) {
      const e = new Error('dup'); e.code = 11000; throw e;
    }
    if (!usersDB.includes(this)) usersDB.push(this);
    return this;
  }
}
FakeUser.findOne = async (q) => {
  const ors = q.$or || [q];
  return usersDB.find(u => ors.some(c =>
    (c.email !== undefined && u.email === c.email) || (c.name !== undefined && u.name === c.name)
  )) || null;
};
FakeUser.findById = async (id) => usersDB.find(u => u._id.toString() === String(id)) || null;

// ── GameSave 모델 스텁 ──
const FakeGameSave = {
  find: (q) => ({ lean: async () => savesDB.filter(s => s.userId.toString() === q.userId.toString()) }),
  findOne: async (q) => savesDB.find(s => s.userId.toString() === q.userId.toString() && s.game === q.game) || null,
  findOneAndUpdate: async (q, upd) => {
    let s = savesDB.find(x => x.userId.toString() === q.userId.toString() && x.game === q.game);
    if (!s) { s = { userId: q.userId, game: q.game, updatedAt: new Date() }; savesDB.push(s); }
    s.data = upd.$set.data; s.updatedAt = new Date();
    return s;
  },
  deleteOne: async (q) => {
    const i = savesDB.findIndex(s => s.userId.toString() === q.userId.toString() && s.game === q.game);
    if (i >= 0) savesDB.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  },
};

// ── require 가로채기: 모델만 스텁으로 ──
const origResolve = Module._resolveFilename;
const userPath = path.resolve(__dirname, '../models/User.js');
const savePath = path.resolve(__dirname, '../models/GameSave.js');
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: FakeUser };
require.cache[savePath] = { id: savePath, filename: savePath, loaded: true, exports: FakeGameSave };

// ── 실제 라우터로 앱 구성 ──
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));
app.use('/api/saves', require('../routes/saves'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function call(method, p, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  let r;

  // health
  r = await call('GET', '/api/health');
  assert.strictEqual(r.json.ok, true); console.log('✓ health');

  // 짧은 비번 거부
  r = await call('POST', '/api/auth/register', { body: { name: 'Forld', email: 'f@x.com', password: 'short' } });
  assert.strictEqual(r.status, 400); console.log('✓ 짧은 비밀번호 거부');

  // 회원가입
  r = await call('POST', '/api/auth/register', { body: { name: 'Forld', email: 'F@X.com', password: 'password123' } });
  assert.strictEqual(r.status, 201); assert.ok(r.json.token); assert.strictEqual(r.json.user.name, 'Forld');
  const token = r.json.token; console.log('✓ 회원가입 + 토큰 발급');

  // 이메일 소문자 정규화 확인 (중복 가입 차단)
  r = await call('POST', '/api/auth/register', { body: { name: 'Other', email: 'f@x.com', password: 'password123' } });
  assert.strictEqual(r.status, 409); console.log('✓ 중복 이메일(대소문자 무관) 차단');

  // 잘못된 비번 로그인
  r = await call('POST', '/api/auth/login', { body: { id: 'Forld', password: 'wrong' } });
  assert.strictEqual(r.status, 401); console.log('✓ 잘못된 비밀번호 거부');

  // 닉네임으로 로그인
  r = await call('POST', '/api/auth/login', { body: { id: 'Forld', password: 'password123' } });
  assert.strictEqual(r.status, 200); assert.ok(r.json.token); console.log('✓ 닉네임 로그인');

  // 토큰 없이 me → 401
  r = await call('GET', '/api/auth/me');
  assert.strictEqual(r.status, 401); console.log('✓ 무인증 /me 차단');

  // me
  r = await call('GET', '/api/auth/me', { token });
  assert.strictEqual(r.json.user.email, 'f@x.com'); console.log('✓ /me 조회');

  // 세이브 저장
  r = await call('PUT', '/api/saves/gacha', { token, body: { data: { coins: 500, cards: [1, 2] } } });
  assert.strictEqual(r.json.ok, true); console.log('✓ gacha 세이브 저장');

  // 세이브 불러오기
  r = await call('GET', '/api/saves/gacha', { token });
  assert.strictEqual(r.json.data.coins, 500); console.log('✓ gacha 세이브 로드');

  // 잘못된 게임 이름 거부
  r = await call('GET', '/api/saves/unknown', { token });
  assert.strictEqual(r.status, 400); console.log('✓ 알 수 없는 게임 거부');

  // 전체 세이브 목록
  r = await call('GET', '/api/saves', { token });
  assert.ok(r.json.saves.gacha); console.log('✓ 전체 세이브 목록');

  // 세이브 삭제
  r = await call('DELETE', '/api/saves/gacha', { token });
  assert.strictEqual(r.json.ok, true);
  r = await call('GET', '/api/saves/gacha', { token });
  assert.strictEqual(r.json.data, null); console.log('✓ 세이브 삭제');

  console.log('\n🎉 모든 테스트 통과');
  server.close();
})().catch((e) => { console.error('❌ 테스트 실패:', e); server.close(); process.exit(1); });
