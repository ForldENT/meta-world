# 🌐 Meta World (Express + MongoDB 서버 버전)

정적 HTML 포털을 **Node.js/Express + MongoDB Atlas** 백엔드로 전환한 버전입니다.
회원 계정·세션·게임 세이브가 이제 브라우저가 아닌 **서버에 저장**됩니다.

---

## 📁 폴더 구조

```
meta-world/
├── server.js              # Express 엔트리: /api 마운트 + public 정적 서빙
├── package.json
├── render.yaml            # Render Blueprint (선택)
├── .env.example           # 환경변수 템플릿 (.env 로 복사)
├── .gitignore
│
├── config/
│   └── db.js              # MongoDB 연결
├── models/
│   ├── User.js            # 계정 (bcrypt 해시)
│   └── GameSave.js        # 유저별/게임별 세이브 (유연 스키마)
├── middleware/
│   └── auth.js            # JWT 검증 + 토큰 발급
├── routes/
│   ├── auth.js            # POST /register /login, GET /me
│   └── saves.js           # GET/PUT/DELETE /api/saves/:game
├── test/
│   └── smoke.js           # DB 없이 라우트 검증 (node test/smoke.js)
│
└── public/                # 프론트엔드 (그대로 서빙)
    ├── index.html         # 포털 — 인증을 서버 API로 전환 완료
    ├── js/mw-api.js       # 공용 클라이언트 (포털·게임 공통)
    └── games/{kbo,soccer,lol,gacha}/
```

---

## 🔑 인증 방식

| 항목 | 이전 (정적) | 현재 (서버) |
|---|---|---|
| 계정 저장 | `localStorage.mw_users` | MongoDB `users` 컬렉션 |
| 비밀번호 | `btoa()` (base64, 사실상 평문) | **bcrypt 해시** |
| 세션 | `localStorage.mw_session` | **JWT 토큰** (`localStorage.mw_token`) |
| 게임 식별 | `mw_session.name` 읽음 | `mw_session`{name,email} **그대로 유지** (게임 호환) |

> `mw_session`에는 민감정보(비번)가 없고 이름/이메일만 들어갑니다. 실제 권한 검증은 항상 `mw_token`(JWT)으로 합니다.

### API 요약
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | `{name,email,password}` → `{token,user}` |
| POST | `/api/auth/login` | `{id(이메일/닉),password}` → `{token,user}` |
| GET | `/api/auth/me` | (인증) 내 정보 |
| GET | `/api/saves/:game` | (인증) 세이브 불러오기 (없으면 `null`) |
| PUT | `/api/saves/:game` | (인증) `{data}` 저장(덮어쓰기) |
| DELETE | `/api/saves/:game` | (인증) 세이브 삭제 |
| GET | `/api/saves` | (인증) 내 전체 세이브 |

`:game` 은 `kbo` `soccer` `lol` `gacha` 만 허용 (새 게임은 `models/GameSave.js` + `routes/saves.js`의 목록에 추가).

---

## 🖥️ 로컬 실행

```bash
npm install
cp .env.example .env        # 값 채우기 (아래 참고)
npm start                   # → http://localhost:3000
```

`.env` 채우기:
```env
MONGODB_URI=mongodb+srv://...   # Atlas 연결 문자열
JWT_SECRET=                     # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

라우트만 빠르게 검증 (DB 불필요):
```bash
node test/smoke.js
```

---

## 🍃 MongoDB Atlas 준비

1. https://cloud.mongodb.com → 무료 **M0** 클러스터 생성
2. **Database Access** → 사용자 생성 (username/password)
3. **Network Access** → `0.0.0.0/0` 허용 (Render는 IP 고정이 없으므로)
4. **Connect → Drivers** → 연결 문자열 복사 → `<password>` 와 DB 이름(`metaworld`) 채워 `MONGODB_URI` 에 사용

---

## 🚀 Git + Render 배포

### 1) Git 초기화 & 푸시
```bash
git init
git add .
git commit -m "Meta World: Express + MongoDB 서버 전환"
git branch -M main
git remote add origin https://github.com/<당신>/meta-world.git
git push -u origin main
```
> `.gitignore`가 `node_modules/` 와 `.env`를 제외합니다. **`.env`는 절대 커밋하지 마세요.**

### 2) Render 배포 (방법 A — 수동)
1. https://render.com → **New + → Web Service** → GitHub 레포 연결
2. 설정:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. **Environment** 탭에서 추가:
   - `MONGODB_URI` = Atlas 연결 문자열
   - `JWT_SECRET` = 랜덤 문자열
4. Deploy → 발급된 `https://meta-world-xxxx.onrender.com` 접속

### 2) Render 배포 (방법 B — Blueprint)
레포에 포함된 `render.yaml` 덕분에 **New + → Blueprint** 로 선택하면 빌드/스타트 설정이 자동입니다.
`MONGODB_URI`, `JWT_SECRET` 두 비밀값만 대시보드에서 입력하면 됩니다.

> 💡 **무료 플랜 주의**: 일정 시간 트래픽이 없으면 서버가 잠들어 첫 요청이 느립니다(콜드 스타트). `PORT`는 Render가 자동 주입하므로 직접 설정하지 마세요.

---

## 🎮 게임 세이브를 서버로 옮기기 (하나씩)

각 게임은 아직 `localStorage`에 세이브를 저장합니다. 아래 패턴으로 **한 게임씩** 서버 저장으로 전환하세요.
공통 도구는 이미 준비됨 → 게임 HTML에 `mw-api.js`만 로드하면 `MW.loadSave / MW.saveSave` 사용 가능.

### 공통 1줄 추가 (모든 게임 `<head>` 또는 스크립트 위)
```html
<script src="/js/mw-api.js"></script>
```

### 패턴: "불러오기 → 플레이 → 저장"
```js
// 게임 시작 시: 서버에서 세이브 로드 (없으면 새 게임)
let state = (await MW.loadSave('gacha')) || makeNewGame();

// 세이브할 때: 기존 localStorage.setItem 대신
await MW.saveSave('gacha', state);
```

### 게임별 전환 매핑
| 게임 | 기존 localStorage 키 | 옮길 위치 |
|---|---|---|
| **gacha** | `ym_<유저명>` | `MW.saveSave('gacha', ST)` / `MW.loadSave('gacha')` |
| **kbo** | `kbo24g3` | `MW.saveSave('kbo', GS)` / `MW.loadSave('kbo')` |
| **soccer** | `fm_save_<id>`, `fm_acc_*` | 세이브는 `MW.saveSave('soccer', ...)`. 별도 계정(`fm_acc_*`)은 제거하고 MW 로그인으로 통일 권장 |
| **lol** | `banpick_user`, `banpick_type` | 밴픽은 영구 세이브가 거의 불필요 → `MW.session()?.name` 으로 로그인명만 사용 |

### 예시 — Gacha 전환 (가장 깔끔)
기존:
```js
// 저장
localStorage.setItem('ym_' + ST.username, JSON.stringify(ST));
// 로드
const raw = localStorage.getItem('ym_' + u);
const ST = raw ? JSON.parse(raw) : newState();
```
전환 후:
```js
// 저장 (username 키 불필요 — 서버가 로그인 유저로 자동 구분)
await MW.saveSave('gacha', ST);
// 로드
const ST = (await MW.loadSave('gacha')) || newState();
```

> ⚠️ `MW.saveSave`/`loadSave`는 비동기(`async`)입니다. 호출하는 함수에 `async`를 붙이고 `await`을 쓰세요.
> ⚠️ 로그인 안 한 상태에서 호출하면 401 에러가 납니다. `if (MW.isLoggedIn())` 로 감싸거나, 비로그인 시 로컬 임시 저장으로 폴백하도록 처리하세요.

---

## ✅ 전환 체크리스트
- [x] 포털 회원가입/로그인 → 서버 API
- [x] 비밀번호 bcrypt 해시
- [x] JWT 토큰 인증
- [x] 게임 세이브 API (`/api/saves/:game`)
- [x] `mw-api.js` 공용 클라이언트
- [x] Render 배포 설정 (`render.yaml`, health check, trust proxy)
- [ ] gacha 세이브 서버 전환
- [ ] kbo 세이브 서버 전환
- [ ] soccer 세이브 서버 전환
- [ ] lol 로그인명 연동 정리

Made with ❤️ — Meta World
