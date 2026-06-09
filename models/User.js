// models/User.js — 메타월드 계정
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // 평문 비밀번호는 절대 저장하지 않습니다. bcrypt 해시만 보관.
    passwordHash: {
      type: String,
      required: true,
    },
    // 포털 차원의 메타데이터 (게임별 세이브는 GameSave 컬렉션에 분리 저장)
    achievements: { type: mongoose.Schema.Types.Mixed, default: {} },
    progress: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true, // createdAt(가입일), updatedAt 자동
    // 초기 생성 후 추가되는 필드 허용 (Portfolio-System에서 배운 교훈)
    strict: false,
  }
);

// 비밀번호 설정 헬퍼
userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

// 비밀번호 검증
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// 클라이언트로 보낼 안전한 형태 (해시 제외)
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    joined: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
