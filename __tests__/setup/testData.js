/**
 * testData.js — 통합 테스트용 공통 시드 데이터
 */

const bcrypt = require('bcryptjs');

/**
 * 역할/권한/사용자/팀 기본 데이터 삽입
 * @returns {{ adminId, userId1, userId2, teamId1, teamId2 }}
 */
async function seedTestData(pool) {
  // ── 역할 ──────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO roles (name, description) VALUES
    ('ADMIN',     '시스템 관리자'),
    ('SUB_ADMIN', '팀 관리자'),
    ('USER',      '일반 사용자')
  `);

  // ── 권한 ──────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO permissions (name, description) VALUES
    ('LIST_READ',    '목록 조회'),
    ('WRITE_MODIFY', '추가 및 수정'),
    ('DELETE',       '삭제'),
    ('DOWNLOAD',     '다운로드'),
    ('MANAGE_USERS', '사용자 관리')
  `);

  // ── 역할-권한 매핑 ─────────────────────────────────
  // ADMIN → 전체 권한
  await pool.query(`
    INSERT IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'ADMIN'
  `);
  // USER → LIST_READ
  await pool.query(`
    INSERT IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'USER' AND p.name = 'LIST_READ'
  `);

  // ── 사용자 ─────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123456', 10);
  const userHash  = await bcrypt.hash('user123456',  10);

  const [adminResult] = await pool.query(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    ['admin', 'admin@test.com', adminHash]
  );
  const adminId = adminResult.insertId;

  const [user1Result] = await pool.query(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    ['user1', 'user1@test.com', userHash]
  );
  const userId1 = user1Result.insertId;

  const [user2Result] = await pool.query(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    ['user2', 'user2@test.com', userHash]
  );
  const userId2 = user2Result.insertId;

  // ── ADMIN 역할 부여 ────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO user_roles (user_id, role_id)
    SELECT ?, id FROM roles WHERE name = 'ADMIN'
  `, [adminId]);

  // USER 역할 부여
  await pool.query(`
    INSERT IGNORE INTO user_roles (user_id, role_id)
    SELECT ?, id FROM roles WHERE name = 'USER'
  `, [userId1]);

  await pool.query(`
    INSERT IGNORE INTO user_roles (user_id, role_id)
    SELECT ?, id FROM roles WHERE name = 'USER'
  `, [userId2]);

  // ── 팀 생성 ───────────────────────────────────────
  const [team1Result] = await pool.query(
    'INSERT INTO teams (name, description, leader_id) VALUES (?, ?, ?)',
    ['개발팀', '소프트웨어 개발', userId1]
  );
  const teamId1 = team1Result.insertId;

  const [team2Result] = await pool.query(
    'INSERT INTO teams (name, description, leader_id) VALUES (?, ?, ?)',
    ['영업팀', '영업 및 고객 관리', userId2]
  );
  const teamId2 = team2Result.insertId;

  // ── user1 → 개발팀 (WRITE_MODIFY + DELETE, 본팀) ───
  const [[writePermRow]] = await pool.query(
    'SELECT id FROM permissions WHERE name = ?', ['WRITE_MODIFY']
  );
  const [[deletePermRow]] = await pool.query(
    'SELECT id FROM permissions WHERE name = ?', ['DELETE']
  );
  const [[userRoleRow]] = await pool.query(
    'SELECT id FROM roles WHERE name = ?', ['USER']
  );

  await pool.query(
    `INSERT IGNORE INTO user_team_roles
       (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
     VALUES (?, ?, ?, ?, TRUE, ?)`,
    [userId1, teamId1, userRoleRow.id, writePermRow.id, adminId]
  );
  await pool.query(
    `INSERT IGNORE INTO user_team_roles
       (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
     VALUES (?, ?, ?, ?, TRUE, ?)`,
    [userId1, teamId1, userRoleRow.id, deletePermRow.id, adminId]
  );

  // ── user2 → 영업팀 (LIST_READ, 본팀) ───────────────
  const [[readPermRow]] = await pool.query(
    'SELECT id FROM permissions WHERE name = ?', ['LIST_READ']
  );
  await pool.query(
    `INSERT IGNORE INTO user_team_roles
       (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
     VALUES (?, ?, ?, ?, TRUE, ?)`,
    [userId2, teamId2, userRoleRow.id, readPermRow.id, adminId]
  );

  return { adminId, userId1, userId2, teamId1, teamId2 };
}

module.exports = { seedTestData };
