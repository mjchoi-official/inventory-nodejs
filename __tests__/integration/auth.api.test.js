/**
 * auth.api.test.js — 인증 API 통합 테스트
 * 실제 HTTP 요청 → Express 앱 → DB (inventory_test)
 */

// 통합 테스트 환경변수 (globalSetup은 별도 프로세스라 여기서 재설정)
process.env.NODE_ENV    = 'test';
process.env.DB_HOST     = '127.0.0.1';
process.env.DB_PORT     = '3306';
process.env.DB_USER     = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME     = 'inventory_test';
process.env.JWT_SECRET  = 'test-jwt-secret-key-for-jest';
process.env.JWT_EXPIRES = '1h';

const request      = require('supertest');
const { initializePool } = require('../../src/config/database');
const app          = require('../../src/app');
const TestDatabase = require('../setup/testDB');
const { seedTestData } = require('../setup/testData');

const db = new TestDatabase();

beforeAll(async () => {
  // DB pool 초기화 (NODE_ENV=test → 직접 MySQL 연결)
  await initializePool();
  await db.connect();
  await db.clearAllTables();
  await seedTestData(db.getPool());
});

afterAll(async () => {
  await db.disconnect();
});

// ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('201 — 정상 회원가입', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', email: 'newuser@test.com', password: 'pass1234' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('newuser@test.com');
    expect(res.body.user).not.toHaveProperty('password'); // 비밀번호 노출 없음
  });

  it('400 — 이메일 형식 오류', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test', email: 'not-email', password: 'pass1234' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 — 비밀번호 5자 (짧음)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test', email: 'test2@test.com', password: '12345' });

    expect(res.status).toBe(400);
  });

  it('400 — username 누락', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-name@test.com', password: 'pass1234' });

    expect(res.status).toBe(400);
  });

  it('409 — 중복 이메일', async () => {
    // admin@test.com 은 seedTestData 에서 삽입됨
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin2', email: 'admin@test.com', password: 'pass1234' });

    expect(res.status).toBe(409);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('200 — 올바른 자격증명으로 로그인', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123456' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('admin@test.com');
  });

  it('401 — 잘못된 비밀번호', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'WRONG_PASSWORD' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('401 — 존재하지 않는 이메일', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'pass1234' });

    expect(res.status).toBe(401);
  });

  it('400 — 이메일 누락', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'pass1234' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
  let token;

  beforeAll(async () => {
    // user1 로그인
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'user123456' });
    token = res.body.token;
  });

  it('200 — 올바른 기존 비밀번호로 변경 성공', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'user123456', newPassword: 'newPass@2026' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('비밀번호가 변경');

    // 변경된 비밀번호로 로그인 확인
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'newPass@2026' });
    expect(loginRes.status).toBe(200);
  });

  it('401 — 기존 비밀번호 불일치', async () => {
    // 새 비밀번호로 다시 로그인
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'newPass@2026' });
    const freshToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ oldPassword: 'WRONG', newPassword: 'another@Pass' });

    expect(res.status).toBe(401);
  });

  it('401 — 인증 토큰 없음', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ oldPassword: 'user123456', newPassword: 'newPass@2026' });

    expect(res.status).toBe(401);
  });

  it('400 — 새 비밀번호가 기존과 동일', async () => {
    // 현재 비밀번호: newPass@2026
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'newPass@2026' });
    const freshToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ oldPassword: 'newPass@2026', newPassword: 'newPass@2026' });

    expect(res.status).toBe(400);
  });
});
