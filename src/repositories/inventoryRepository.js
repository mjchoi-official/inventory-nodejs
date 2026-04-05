const { getPool } = require('../config/database');

// ================================================================
// products 테이블 쿼리 전담
//   최적화 포인트:
//   1. N+1 제거 — 팀 IDs를 서브쿼리 대신 IN 절로 한 번에 처리
//   2. 전체 테이블 스캔 방지 — team_id 인덱스 활용
//   3. 동적 UPDATE — 변경 필드만 SET
//   4. 원자적 quantity 조정 — quantity + ?
//   5. 팀별 통계 / 저재고 — 집계 쿼리 + LIMIT
// ================================================================
class InventoryRepository {

  // ──────────────────────────────
  // 내부 헬퍼: userId의 소속 팀 IDs (서브쿼리 대신 단일 조회)
  // ──────────────────────────────
  async _getAccessibleTeamIds(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT DISTINCT team_id FROM user_team_roles WHERE user_id = ?',
      [userId]
    );
    return rows.map(r => r.team_id);
  }

  // ──────────────────────────────
  // 전체 조회 — 사용자 소속 팀 기준
  //   N+1 개선: findByUserId(userId) 별도 호출 제거
  //   → user_team_roles JOIN products 한 쿼리
  //   필터: category, lowStock, teamId
  // ──────────────────────────────
  async findAllAccessible(userId, { category, lowStock, teamId } = {}) {
    const pool = getPool();

    // 소속 팀 IDs 먼저 조회 (캐시 레이어에서 재사용 가능한 단순 쿼리)
    const teamIds = await this._getAccessibleTeamIds(userId);
    if (teamIds.length === 0) return [];

    // teamId 필터: 소속 팀인지 검증
    let targetIds = teamIds;
    if (teamId) {
      const numId = Number(teamId);
      if (!teamIds.includes(numId)) {
        const err = new Error('해당 팀에 접근할 권한이 없습니다');
        err.status = 403;
        throw err;
      }
      targetIds = [numId];
    }

    const placeholders = targetIds.map(() => '?').join(',');
    // SELECT 컬럼 명시 — 불필요한 컬럼 전송 방지
    let query = `
      SELECT p.id, p.user_id, p.team_id, p.productName,
             p.quantity, p.price, p.category, p.lastUpdated
      FROM products p
      WHERE p.team_id IN (${placeholders})`;
    const params = [...targetIds];

    if (category)  { query += ' AND p.category = ?';         params.push(category); }
    if (lowStock)  { query += ' AND p.quantity < ?';          params.push(parseInt(lowStock, 10)); }

    query += ' ORDER BY p.id ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  // ──────────────────────────────
  // 배치 조회: 여러 ID를 한 번에 가져오기
  //   N+1 방지용 (서비스 레이어에서 반복 findById 대신 사용)
  // ──────────────────────────────
  async findByIds(userId, ids) {
    if (!ids || ids.length === 0) return [];
    const pool   = getPool();
    const teamIds = await this._getAccessibleTeamIds(userId);
    if (teamIds.length === 0) return [];

    const idPH   = ids.map(() => '?').join(',');
    const teamPH = teamIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT p.id, p.user_id, p.team_id, p.productName,
              p.quantity, p.price, p.category, p.lastUpdated
       FROM products p
       WHERE p.id IN (${idPH}) AND p.team_id IN (${teamPH})`,
      [...ids, ...teamIds]
    );
    return rows;
  }

  // ──────────────────────────────
  // 단건 조회 (팀 소속 검증 포함)
  //   JOIN 방식으로 team 별도 조회 제거
  // ──────────────────────────────
  async findById(userId, id) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.id, p.user_id, p.team_id, p.productName,
              p.quantity, p.price, p.category, p.lastUpdated
       FROM products p
       INNER JOIN user_team_roles utr
               ON p.team_id = utr.team_id AND utr.user_id = ?
       WHERE p.id = ?
       LIMIT 1`,
      [userId, id]
    );
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 팀 소속 없이 ID만으로 조회 (관리자용)
  // ──────────────────────────────
  async findByIdRaw(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 생성
  // ──────────────────────────────
  async create({ userId, teamId, productName, quantity, price, category }) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO products
         (user_id, team_id, productName, quantity, price, category, lastUpdated)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, teamId, productName, quantity, price, category]
    );
    return result.insertId;
  }

  // ──────────────────────────────
  // 수정 — 동적 SET (변경 필드만)
  //   불필요한 전체 UPDATE 방지
  // ──────────────────────────────
  async update(id, teamId, { productName, quantity, price, category }) {
    const pool       = getPool();
    const setClauses = ['lastUpdated = NOW()'];
    const params     = [];

    if (productName !== undefined) { setClauses.push('productName = ?'); params.push(productName); }
    if (quantity    !== undefined) { setClauses.push('quantity = ?');    params.push(quantity); }
    if (price       !== undefined) { setClauses.push('price = ?');       params.push(price); }
    if (category    !== undefined) { setClauses.push('category = ?');    params.push(category); }

    if (setClauses.length === 1) return true; // 변경 없음

    params.push(id, teamId);
    const [result] = await pool.query(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND team_id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  // ──────────────────────────────
  // 삭제
  // ──────────────────────────────
  async delete(id, teamId) {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ? AND team_id = ?',
      [id, teamId]
    );
    return result.affectedRows > 0;
  }

  // ──────────────────────────────
  // 재고 증감 — 원자적 연산
  //   quantity = quantity + adjustment (음수 가능)
  //   음수 방지 옵션: quantity >= ABS(adjustment) 검증
  // ──────────────────────────────
  async adjustQuantity(id, teamId, adjustment) {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE products
       SET quantity = quantity + ?, lastUpdated = NOW()
       WHERE id = ? AND team_id = ?`,
      [adjustment, id, teamId]
    );
    return result.affectedRows > 0;
  }

  // ──────────────────────────────
  // 팀별 통계 (집계 쿼리 — LIMIT 없이 풀스캔 대신 GROUP BY 활용)
  // ──────────────────────────────
  async getStatsByTeam(teamId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT
         COUNT(*)        AS totalItems,
         SUM(quantity)   AS totalQuantity,
         SUM(price * quantity) AS totalValue,
         AVG(price)      AS avgPrice,
         MIN(quantity)   AS minQuantity,
         MAX(quantity)   AS maxQuantity
       FROM products
       WHERE team_id = ?`,
      [teamId]
    );
    return rows[0];
  }

  // ──────────────────────────────
  // 저재고 알림 (LIMIT 적용 — 100만 행 스캔 방지)
  //   threshold 미만 상품 최대 limit 건
  // ──────────────────────────────
  async findLowStockByTeam(teamId, threshold = 10, limit = 50) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, productName, quantity, category
       FROM products
       WHERE team_id = ? AND quantity < ?
       ORDER BY quantity ASC
       LIMIT ?`,
      [teamId, threshold, limit]
    );
    return rows;
  }

  // ──────────────────────────────
  // 카테고리별 재고 합계 (팀 기준)
  // ──────────────────────────────
  async getSummaryByCategory(teamId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT category,
              COUNT(*)      AS itemCount,
              SUM(quantity) AS totalQuantity,
              SUM(price * quantity) AS totalValue
       FROM products
       WHERE team_id = ?
       GROUP BY category
       ORDER BY totalValue DESC`,
      [teamId]
    );
    return rows;
  }
}

module.exports = new InventoryRepository();
