const { getPool } = require('../config/database');

// ================================================================
// shared_inventory_groups / shared_group_teams / products(공유)
// 쿼리 전담 Repository
// ================================================================
class SharedInventoryRepository {

  // ──────────────────────────────
  // 공유 그룹 CRUD
  // ──────────────────────────────

  async createGroup({ name, description, createdBy }) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO shared_inventory_groups (name, description, created_by) VALUES (?, ?, ?)',
      [name, description ?? null, createdBy]
    );
    return result.insertId;
  }

  async findGroupById(groupId) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM shared_inventory_groups WHERE id = ?',
      [groupId]
    );
    return rows[0] ?? null;
  }

  async findAllGroups() {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM shared_inventory_groups ORDER BY id ASC'
    );
    return rows;
  }

  // ──────────────────────────────
  // 공유 그룹에 팀 추가/제거
  // ──────────────────────────────

  async addTeamToGroup({ groupId, teamId, canEdit = false }) {
    const pool = getPool();
    await pool.query(
      `INSERT IGNORE INTO shared_group_teams (group_id, team_id, can_edit)
       VALUES (?, ?, ?)`,
      [groupId, teamId, canEdit]
    );
  }

  async removeTeamFromGroup(groupId, teamId) {
    const pool = getPool();
    await pool.query(
      'DELETE FROM shared_group_teams WHERE group_id = ? AND team_id = ?',
      [groupId, teamId]
    );
  }

  async findTeamsByGroupId(groupId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.*, sgt.can_edit
       FROM teams t
       INNER JOIN shared_group_teams sgt ON t.id = sgt.team_id
       WHERE sgt.group_id = ?`,
      [groupId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 권한 확인
  // ──────────────────────────────

  /** 사용자가 그룹에 소속된 팀원인지 */
  async canAccessGroup(userId, groupId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM shared_group_teams sgt
       INNER JOIN user_team_roles utr ON sgt.team_id = utr.team_id
       WHERE sgt.group_id = ? AND utr.user_id = ?`,
      [groupId, userId]
    );
    return cnt > 0;
  }

  /** 사용자가 그룹에서 편집 권한을 갖는지 (can_edit = TRUE인 팀에 소속) */
  async canEditGroup(userId, groupId) {
    const pool = getPool();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM shared_group_teams sgt
       INNER JOIN user_team_roles utr ON sgt.team_id = utr.team_id
       WHERE sgt.group_id = ? AND utr.user_id = ? AND sgt.can_edit = TRUE`,
      [groupId, userId]
    );
    return cnt > 0;
  }

  // ──────────────────────────────
  // 공유 재고 (products) 조회
  // ──────────────────────────────

  /** 특정 그룹의 재고 전체 */
  async findByGroupId(groupId, { category, lowStock } = {}) {
    const pool = getPool();
    let   query  = 'SELECT * FROM products WHERE shared_group_id = ?';
    const params = [groupId];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (lowStock)  { query += ' AND quantity < ?'; params.push(parseInt(lowStock)); }
    query += ' ORDER BY id ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /** 전체 공용 재고 (team_id IS NULL, is_shared = TRUE) */
  async findPublic({ category, lowStock } = {}) {
    const pool = getPool();
    let   query  = 'SELECT * FROM products WHERE team_id IS NULL AND is_shared = TRUE AND shared_group_id IS NULL';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (lowStock)  { query += ' AND quantity < ?'; params.push(parseInt(lowStock)); }
    query += ' ORDER BY id ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /** 사용자가 접근 가능한 전체 재고
   *  = 팀 소유 재고 + 전체 공용 재고 + 사용자 그룹 공유 재고
   */
  async findAllAccessible(userId, { category, lowStock, teamId, groupId } = {}) {
    const pool = getPool();

    // -- 동적 필터 절 생성
    const filterClauses = [];
    const filterParams  = [];
    if (category) { filterClauses.push('category = ?'); filterParams.push(category); }
    if (lowStock)  { filterClauses.push('quantity < ?'); filterParams.push(parseInt(lowStock)); }
    const filterSQL = filterClauses.length ? ' AND ' + filterClauses.join(' AND ') : '';

    // ① 팀 소유 재고: 사용자 소속 팀 기반 (teamId 필터 지원)
    const teamFilter = teamId ? ' AND p.team_id = ?' : '';
    const teamSQL = `
      SELECT p.* FROM products p
      INNER JOIN user_team_roles utr ON p.team_id = utr.team_id
      WHERE utr.user_id = ? AND p.team_id IS NOT NULL
      ${teamFilter}
      ${filterSQL}
    `;
    const teamParams = [userId, ...(teamId ? [parseInt(teamId)] : []), ...filterParams];

    // ② 전체 공용 재고 (그룹 소속 여부 무관)
    const publicSQL = `
      SELECT p.* FROM products p
      WHERE p.team_id IS NULL AND p.is_shared = TRUE AND p.shared_group_id IS NULL
      ${filterSQL}
    `;
    const publicParams = [...filterParams];

    // ③ 그룹 공유 재고: 사용자 팀이 속한 그룹
    const groupFilter = groupId ? ' AND p.shared_group_id = ?' : '';
    const sharedSQL = `
      SELECT p.* FROM products p
      INNER JOIN shared_group_teams sgt ON p.shared_group_id = sgt.group_id
      INNER JOIN user_team_roles   utr ON sgt.team_id = utr.team_id
      WHERE utr.user_id = ? AND p.shared_group_id IS NOT NULL
      ${groupFilter}
      ${filterSQL}
    `;
    const sharedParams = [userId, ...(groupId ? [parseInt(groupId)] : []), ...filterParams];

    const unionSQL = `(${teamSQL}) UNION (${publicSQL}) UNION (${sharedSQL}) ORDER BY id ASC`;
    const allParams = [...teamParams, ...publicParams, ...sharedParams];

    const [rows] = await pool.query(unionSQL, allParams);
    return rows;
  }

  /** ID로 단건 조회 (공유 재고 한정) */
  async findSharedById(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ? AND is_shared = TRUE',
      [id]
    );
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 공유 재고 쓰기 (CUD)
  // ──────────────────────────────

  /** 그룹 공유 재고 생성 */
  async createGroupItem({ userId, sharedGroupId, productName, quantity, price, category }) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO products
         (user_id, shared_group_id, is_shared, productName, quantity, price, category, lastUpdated)
       VALUES (?, ?, TRUE, ?, ?, ?, ?, NOW())`,
      [userId ?? null, sharedGroupId, productName, quantity, price, category ?? null]
    );
    return result.insertId;
  }

  /** 전체 공용 재고 생성 (ADMIN 전용) */
  async createPublicItem({ userId, productName, quantity, price, category }) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO products
         (user_id, is_shared, productName, quantity, price, category, lastUpdated)
       VALUES (?, TRUE, ?, ?, ?, ?, NOW())`,
      [userId ?? null, productName, quantity, price, category ?? null]
    );
    return result.insertId;
  }

  /** 공유 재고 수정 (변경 필드만 동적 SET) */
  async update(id, { productName, quantity, price, category }) {
    const pool       = getPool();
    const setClauses = ['lastUpdated = NOW()'];
    const params     = [];

    if (productName !== undefined) { setClauses.push('productName = ?'); params.push(productName); }
    if (quantity    !== undefined) { setClauses.push('quantity = ?');    params.push(quantity); }
    if (price       !== undefined) { setClauses.push('price = ?');       params.push(price); }
    if (category    !== undefined) { setClauses.push('category = ?');    params.push(category); }

    params.push(id);
    const [result] = await pool.query(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND is_shared = TRUE`,
      params
    );
    return result.affectedRows > 0;
  }

  /** 공유 재고 삭제 */
  async delete(id) {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ? AND is_shared = TRUE',
      [id]
    );
    return result.affectedRows > 0;
  }

  /** 수량 원자적 증감 */
  async adjustQuantity(id, adjustment) {
    const pool = getPool();
    const [result] = await pool.query(
      'UPDATE products SET quantity = quantity + ?, lastUpdated = NOW() WHERE id = ? AND is_shared = TRUE',
      [adjustment, id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new SharedInventoryRepository();
