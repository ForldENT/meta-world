// config/db.js — MongoDB 연결
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다. .env 파일 또는 Render 환경변수를 확인하세요.');
  }

  // strictQuery: 스키마에 없는 필드로 쿼리 시 경고 동작 제어
  mongoose.set('strictQuery', false);

  await mongoose.connect(uri, {
    // Mongoose 8 기본값이 합리적이라 옵션은 최소로 둡니다.
    serverSelectionTimeoutMS: 10000,
  });

  console.log('✅ MongoDB 연결 성공');

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB 연결 에러:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB 연결 끊김');
  });
}

module.exports = connectDB;
