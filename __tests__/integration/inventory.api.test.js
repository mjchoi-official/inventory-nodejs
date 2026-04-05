/**
 * inventory.api.test.js — 재고 API 통합 테스트
 * 실제 HTTP 요청 → Express 앱 → DB (inventory_test)
 *
 * 전제:
 *   - adminId : ADMIN 역할 (LIST_READ, WRITE_MODIFY, DELETE 등 전체 권한)
 *   - userId1 : USER 역할 + 개발팀(teamId1) WRITE_MODIFY, DELETE 권한
 *   - userId2 : USER 역할 + 영업팀(teamId2) LIST_READ 권한만
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
let ids; // { adminId, userId1, userId2, teamId1, teamId2 }

// 토큰 캐시
let adminToken;
let user1Token;  // 개발팀 WRITE_MODIFY + DELETE
let user2Token;  // 영업팀 LIST_READ 전용

// ── DB 초기화 & 로그인 ────────────────────────────────────────────
beforeAll(async () => {
  // DB pool 초기화 (NODE_ENV=test → 직접 MySQL 연결)
  await initializePool();
  await db.connect();
  await db.clearAllTables();
  ids = await seedTestData(db.getPool());

  // 로그인 → 토큰 취득
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'admin123456' });
  adminToken = adminLogin.body.token;

  const user1Login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user1@test.com', password: 'user123456' });
  user1Token = user1Login.body.token;

  const user2Login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user2@test.com', password: 'user123456' });
  user2Token = user2Login.body.token;
});

afterAll(async () => {
  await db.disconnect();
});

// ──────────────────────────────────────────────────────────────────
describe('POST /api/inventory — 재고 생성', () => {
  it('201 — WRITE_MODIFY 권한 보유 시 생성 성공 (user1/개발팀)', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        teamId:      ids.teamId1,
        productName: '노트북',
        quantity:    50,
        price:       1500000,
        category:    'electronics',
      });

    expect(res.status).toBe(201);
    expect(res.body.productName).toBe('노트북');
    expect(res.body.teamId).toBe(ids.teamId1);
    expect(res.body).toHaveProperty('id');
  });

  it('201 — admin도 팀 소속이면 생성 가능', async () => {
    // admin을 개발팀에 추가 (직접 DB 삽입)
    const [permRow] = await db.query(
      "SELECT id FROM permissions WHERE name = 'WRITE_MODIFY'"
    );
    const [roleRow] = await db.query(
      "SELECT id FROM roles WHERE name = 'ADMIN'"
    );
    await db.query(
      `INSERT IGNORE INTO user_team_roles (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
       VALUES (?, ?, ?, ?, TRUE, ?)`,
      [ids.adminId, ids.teamId1, roleRow[0].id, permRow[0].id, ids.adminId]
    );

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        teamId:      ids.teamId1,
        productName: '마우스',
        quantity:    100,
        price:       30000,
        category:    'accessories',
      });

    expect(res.status).toBe(201);
    expect(res.body.productName).toBe('마우스');
  });

  it('401 — 인증 토큰 없음', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .send({ teamId: ids.teamId1, productName: 'X', quantity: 1, price: 100, category: 'X' });

    expect(res.status).toBe(401);
  });

  it('403 — user2는 개발팀에 소속되지 않음', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        teamId:      ids.teamId1,
        productName: '키보드',
        quantity:    30,
        price:       80000,
        category:    'accessories',
      });

    expect(res.status).toBe(403);
  });

  it('400 — teamId 누락', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productName: '모니터', quantity: 10, price: 400000, category: 'electronics' });

    expect(res.status).toBe(400);
  });

  it('400 — price 누락', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, productName: '모니터', quantity: 10, category: 'electronics' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('GET /api/inventory — 재고 목록 조회', () => {
  it('200 — 소속 팀 재고 반환 (user1)', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    // 노트북(개발팀) 포함 확인
    const names = res.body.items.map(i => i.productName);
    expect(names).toContain('노트북');
  });

  it('200 — teamId 필터링', async () => {
    const res = await request(app)
      .get(`/api/inventory?teamId=${ids.teamId1}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    res.body.items.forEach(item => {
      expect(item.teamId).toBe(ids.teamId1);
    });
  });

  it('200 — user2는 영업팀 재고만 조회 (개발팀 상품 없음)', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    // 영업팀에 상품이 없으므로 빈 배열
    expect(res.body.total).toBe(0);
  });

  it('401 — 토큰 없음', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('GET /api/inventory/:id — 단건 조회', () => {
  let createdId;

  beforeAll(async () => {
    // user1이 개발팀에 상품 하나 생성
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, productName: '태블릿', quantity: 20, price: 900000, category: 'electronics' });
    createdId = res.body.id;
  });

  it('200 — 소속 팀 상품 조회', async () => {
    const res = await request(app)
      .get(`/api/inventory/${createdId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.productName).toBe('태블릿');
  });

  it('404 — 접근 불가 상품 (타팀 소속 user2)', async () => {
    const res = await request(app)
      .get(`/api/inventory/${createdId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    // user2는 영업팀 → 개발팀 상품 접근 불가 → 404
    expect(res.status).toBe(404);
  });

  it('404 — 존재하지 않는 상품 ID', async () => {
    const res = await request(app)
      .get('/api/inventory/9999999')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('PUT /api/inventory/:id — 재고 수정', () => {
  let productId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, productName: '헤드셋', quantity: 15, price: 200000, category: 'accessories' });
    productId = res.body.id;
  });

  it('200 — WRITE_MODIFY 권한으로 수정 성공', async () => {
    const res = await request(app)
      .put(`/api/inventory/${productId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productName: '헤드셋 Pro', quantity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.productName).toBe('헤드셋 Pro');
    expect(res.body.quantity).toBe(20);
  });

  it('404 — 존재하지 않는 상품', async () => {
    const res = await request(app)
      .put('/api/inventory/9999999')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productName: '없는상품' });

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('PATCH /api/inventory/:id/adjust — 재고 수량 조정', () => {
  let productId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, productName: '충전기', quantity: 100, price: 50000, category: 'accessories' });
    productId = res.body.id;
  });

  it('200 — 재고 감소 성공', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${productId}/adjust`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, quantity: -10, reason: 'sale' });

    expect(res.status).toBe(200);
    expect(res.body.oldQuantity).toBe(100);
    expect(res.body.adjustment).toBe(-10);
    expect(res.body.newQuantity).toBe(90);
    expect(res.body.reason).toBe('sale');
  });

  it('200 — 재고 증가 성공', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${productId}/adjust`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, quantity: 20, reason: 'restock' });

    expect(res.status).toBe(200);
    expect(res.body.adjustment).toBe(20);
  });

  it('400 — teamId 누락', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${productId}/adjust`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ quantity: -5, reason: 'test' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────
describe('DELETE /api/inventory/:id — 재고 삭제', () => {
  let productId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ teamId: ids.teamId1, productName: '삭제될상품', quantity: 5, price: 10000, category: 'test' });
    productId = res.body.id;
  });

  it('200 — DELETE 권한으로 삭제 성공', async () => {
    const res = await request(app)
      .delete(`/api/inventory/${productId}?teamId=${ids.teamId1}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('삭제 완료');
  });

  it('404 — 이미 삭제된 상품', async () => {
    const res = await request(app)
      .delete(`/api/inventory/${productId}?teamId=${ids.teamId1}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
  });

  it('403 — LIST_READ 전용 user2는 DELETE 불가', async () => {
    // 영업팀에 상품 생성 (user2는 LIST_READ만, WRITE_MODIFY 없음 → 403 at create)
    // → admin으로 직접 DB 삽입
    const [[permRow]] = await db.query(
      "SELECT id FROM permissions WHERE name = 'LIST_READ'"
    );
    const [insertResult] = await db.query(
      'INSERT INTO products (user_id, team_id, productName, quantity, price, category) VALUES (?, ?, ?, ?, ?, ?)',
      [ids.adminId, ids.teamId2, '영업팀상품', 10, 5000, 'etc']
    );
    const newId = insertResult.insertId;

    const res = await request(app)
      .delete(`/api/inventory/${newId}?teamId=${ids.teamId2}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
  });
});
