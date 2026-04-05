/**
 * 관리자 계정 생성 스크립트
 * 사용법: npm run create-admin
 *
 * - 비밀번호는 bcrypt(saltRounds=10)로 해싱 후 저장
 * - ADMIN 역할 자동 부여
 * - 이미 동일 email이 존재하면 중단
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

// ─────────────────────────────────────────────
// 관리자 기본 정보 (필요 시 수정)
// ─────────────────────────────────────────────
const ADMIN = {
  username: 'admin',
  email:    'admin@example.com',
  password: 'admin123456',   // ⚠️  최초 실행 후 반드시 변경!
};

// ─────────────────────────────────────────────
// DB 직접 연결 (SSH 터널 없이 로컬 실행용)
// ─────────────────────────────────────────────
async function getDirectPool() {
  return mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'inventory',
    waitForConnections: true,
    connectionLimit:    5,
    queueLimit:         0,
  });
}

// ─────────────────────────────────────────────
// 메인 함수
// ─────────────────────────────────────────────
async function createAdminUser() {
  let pool;

  try {
    pool = await getDirectPool();
    console.log('✅ DB 연결 성공\n');

    // 1. 중복 이메일 확인
    const [[existing]] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [ADMIN.email]
    );
    if (existing) {
      console.log(`⚠️  이미 존재하는 계정입니다 (email: ${ADMIN.email})`);
      console.log('   다른 이메일을 사용하거나 기존 계정을 확인하세요.');
      return;
    }

    // 2. 비밀번호 bcrypt 해싱
    console.log('📝 관리자 계정 생성 중...');
    console.log(`   Username : ${ADMIN.username}`);
    console.log(`   Email    : ${ADMIN.email}`);

    const hashedPassword = await bcrypt.hash(ADMIN.password, 10);

    // 3. users 테이블에 INSERT
    const [userResult] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [ADMIN.username, ADMIN.email, hashedPassword]
    );
    const userId = userResult.insertId;
    console.log(`✅ 사용자 생성 완료 (ID: ${userId})`);

    // 4. ADMIN 역할 조회
    const [[roleRow]] = await pool.query(
      'SELECT id FROM roles WHERE name = ?',
      ['ADMIN']
    );
    if (!roleRow) {
      throw new Error('ADMIN 역할을 찾을 수 없습니다. init-db.sql을 먼저 실행하세요.');
    }

    // 5. user_roles 에 ADMIN 역할 부여
    await pool.query(
      'INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
      [userId, roleRow.id, userId]
    );
    console.log('✅ ADMIN 역할 할당 완료');

    // 6. 해당 역할의 권한 수 확인
    const [[{ permCount }]] = await pool.query(
      'SELECT COUNT(*) AS permCount FROM role_permissions WHERE role_id = ?',
      [roleRow.id]
    );
    console.log(`✅ 관리자가 보유한 권한: ${permCount}개`);

    // 7. 결과 출력
    console.log('\n🎉 관리자 계정이 성공적으로 생성되었습니다!');
    console.log('\n┌──────────────────────────────────┐');
    console.log('│         로그인 정보              │');
    console.log('├──────────────────────────────────┤');
    console.log(`│  Email    : ${ADMIN.email.padEnd(20)} │`);
    console.log(`│  Password : ${ADMIN.password.padEnd(20)} │`);
    console.log('└──────────────────────────────────┘');
    console.log('\n⚠️  보안을 위해 비밀번호를 반드시 변경하세요!');
    console.log('   POST /api/auth/change-password\n');

  } catch (err) {
    console.error('\n❌ 관리자 계정 생성 실패:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

createAdminUser();
