const { getPool } = require('../config/database');

// ================================================================
// roles / permissions / user_roles / sub_admin_teams 쿼리 전담
// ================================================================
class RoleRepository {

  // ──────────────────────────────
  // 역할 조회
  // ──────────────────────────────
  async findRoleByName(name) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM roles WHERE name = ?', [name]);
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 사용자의 역할 목록
  // ──────────────────────────────
  async getRolesByUserId(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT r.* FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 사용자의 권한 목록 (중복 제거)
  // ──────────────────────────────
  async getPermissionsByUserId(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT DISTINCT p.* FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur        ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 특정 권한 보유 여부
  // ──────────────────────────────
  async hasPermission(userId, permissionName) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur        ON rp.role_id = ur.role_id
       WHERE ur.user_id = ? AND p.name = ?`,
      [userId, permissionName]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 역할 할당 / 제거
  // ──────────────────────────────
  async assignRole(userId, roleId, assignedBy) {
    const pool = getPool();
    await pool.query(
      'INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
      [userId, roleId, assignedBy]
    );
  }

  async removeRole(userId, roleId) {
    const pool = getPool();
    await pool.query(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
  }

  // ──────────────────────────────
  // 역할 확인 헬퍼
  // ──────────────────────────────
  async isAdmin(userId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM user_roles ur
       INNER JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = 'ADMIN'`,
      [userId]
    );
    return cnt > 0;
  }

  async isSubAdmin(userId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM user_roles ur
       INNER JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = 'SUB_ADMIN'`,
      [userId]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 팀 관리
  // ──────────────────────────────
  async addTeamMember(subAdminId, teamMemberId) {
    const pool = getPool();
    await pool.query(
      'INSERT IGNORE INTO sub_admin_teams (sub_admin_id, team_member_id) VALUES (?, ?)',
      [subAdminId, teamMemberId]
    );
  }

  async removeTeamMember(subAdminId, teamMemberId) {
    const pool = getPool();
    await pool.query(
      'DELETE FROM sub_admin_teams WHERE sub_admin_id = ? AND team_member_id = ?',
      [subAdminId, teamMemberId]
    );
  }

  async getTeamMembers(subAdminId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.createdAt
       FROM users u
       INNER JOIN sub_admin_teams st ON u.id = st.team_member_id
       WHERE st.sub_admin_id = ?`,
      [subAdminId]
    );
    return rows;
  }

  async isTeamMember(subAdminId, teamMemberId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM sub_admin_teams WHERE sub_admin_id = ? AND team_member_id = ?',
      [subAdminId, teamMemberId]
    );
    return cnt > 0;
  }
}

module.exports = new RoleRepository();
