const { getPool } = require('../config/database');

// ================================================================
// pages / page_permissions 쿼리 전담
// ================================================================
class PageRepository {

  // ──────────────────────────────
  // 전체 메뉴 페이지 조회 (is_menu = TRUE)
  // ──────────────────────────────
  async findAllMenuPages() {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM pages WHERE is_menu = TRUE ORDER BY parent_id ASC, order_num ASC'
    );
    return rows;
  }

  // ──────────────────────────────
  // 이름으로 페이지 조회
  // ──────────────────────────────
  async findByName(name) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM pages WHERE name = ?', [name]);
    return rows[0] ?? null;
  }

  // ──────────────────────────────
  // 페이지에 필요한 권한 목록
  // ──────────────────────────────
  async getPermissionsByPageId(pageId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.*, pp.required FROM permissions p
       INNER JOIN page_permissions pp ON p.id = pp.permission_id
       WHERE pp.page_id = ?`,
      [pageId]
    );
    return rows;
  }

  // ──────────────────────────────
  // 사용자가 해당 페이지에 접근 가능한지 확인
  //   - 페이지에 required 권한이 없으면 누구나 접근 가능
  //   - required = TRUE 인 권한을 모두 보유해야 접근 가능
  // ──────────────────────────────
  async canAccess(userId, pageId) {
    const pool = getPool();

    // 페이지의 required 권한 개수
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM page_permissions WHERE page_id = ? AND required = TRUE',
      [pageId]
    );
    if (total === 0) return true; // 필요 권한 없음 → 누구나 접근

    // 사용자가 보유한 required 권한 개수
    const [[{ matched }]] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) AS matched
       FROM permissions p
       INNER JOIN page_permissions pp ON p.id = pp.permission_id AND pp.page_id = ? AND pp.required = TRUE
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur        ON rp.role_id = ur.role_id AND ur.user_id = ?`,
      [pageId, userId]
    );
    return matched >= total; // 모든 required 권한 보유 시 접근 가능
  }

  // ──────────────────────────────
  // 사용자가 접근 가능한 페이지 목록
  // ──────────────────────────────
  async findAccessiblePages(userId) {
    const allPages = await this.findAllMenuPages();
    const results  = await Promise.all(
      allPages.map(async (page) => {
        const ok = await this.canAccess(userId, page.id);
        return ok ? page : null;
      })
    );
    return results.filter(Boolean);
  }
}

module.exports = new PageRepository();
