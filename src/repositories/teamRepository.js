const { getPool } = require('../config/database');

// ================================================================
// teams / user_team_roles 쿼리 전담
// ================================================================
class TeamRepository {

  // ──────────────────────────────
  // 팀 CRUD
  // ──────────────────────────────
  async create({ name, description, leaderId }) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO teams (name, description, leader_id) VALUES (?, ?, ?)',
      [name, description, leaderId]
    );
    return result.insertId;
  }

  async findById(teamId) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    return rows[0] ?? null;
  }

  async findByName(name) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM teams WHERE name = ?', [name]);
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 사용자의 팀 목록 (본팀 우선 정렬)
  // ──────────────────────────────
  async findByUserId(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT DISTINCT t.*, utr.is_primary
       FROM teams t
       INNER JOIN user_team_roles utr ON t.id = utr.team_id
       WHERE utr.user_id = ?
       ORDER BY utr.is_primary DESC, t.id ASC`,
      [userId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 사용자의 본팀 조회
  // ──────────────────────────────
  async findPrimaryTeamByUserId(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.* FROM teams t
       INNER JOIN user_team_roles utr ON t.id = utr.team_id
       WHERE utr.user_id = ? AND utr.is_primary = TRUE
       LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 팀원 목록
  // ──────────────────────────────
  async findMembersByTeamId(teamId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.createdAt
       FROM users u
       INNER JOIN user_team_roles utr ON u.id = utr.user_id
       WHERE utr.team_id = ?`,
      [teamId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 사용자의 특정 팀 권한 목록
  // ──────────────────────────────
  async findPermissionsByUserAndTeam(userId, teamId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT DISTINCT p.*
       FROM permissions p
       INNER JOIN user_team_roles utr ON p.id = utr.permission_id
       WHERE utr.user_id = ? AND utr.team_id = ?`,
      [userId, teamId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 팀 소속 여부
  // ──────────────────────────────
  async isUserInTeam(userId, teamId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM user_team_roles WHERE user_id = ? AND team_id = ?',
      [userId, teamId]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 특정 팀 내 특정 권한 보유 여부
  // ──────────────────────────────
  async hasPermissionInTeam(userId, teamId, permissionName) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM permissions p
       INNER JOIN user_team_roles utr ON p.id = utr.permission_id
       WHERE utr.user_id = ? AND utr.team_id = ? AND p.name = ?`,
      [userId, teamId, permissionName]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 팀장 여부
  // ──────────────────────────────
  async isTeamLeader(userId, teamId) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT leader_id FROM teams WHERE id = ?', [teamId]);
    return rows.length > 0 && rows[0].leader_id === userId;
  }

  // ──────────────────────────────
  // 팀 관리 권한 여부 (팀장 or SUB_ADMIN in team)
  // ──────────────────────────────
  async canManageTeam(userId, teamId) {
    const isLeader = await this.isTeamLeader(userId, teamId);
    if (isLeader) return true;

    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM user_team_roles utr
       INNER JOIN roles r ON utr.role_id = r.id
       WHERE utr.user_id = ? AND utr.team_id = ? AND r.name = 'SUB_ADMIN'`,
      [userId, teamId]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 팀에 사용자 추가 (중복 무시)
  // ──────────────────────────────
  async addUserToTeam({ userId, teamId, roleId, permissionId, isPrimary, assignedBy }) {
    const pool = getPool();
    await pool.query(
      `INSERT IGNORE INTO user_team_roles
         (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, teamId, roleId, permissionId, isPrimary, assignedBy]
    );
  }

  // ──────────────────────────────
  // 팀에서 사용자 제거
  // ──────────────────────────────
  async removeUserFromTeam(userId, teamId) {
    const pool = getPool();
    await pool.query(
      'DELETE FROM user_team_roles WHERE user_id = ? AND team_id = ?',
      [userId, teamId]
    );
  }
}

module.exports = new TeamRepository();
