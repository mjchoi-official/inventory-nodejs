/**
 * testDB.js — 통합 테스트용 DB 헬퍼
 * 각 테스트 suite의 beforeAll/afterAll 에서 사용
 */

const mysql = require('mysql2/promise');

class TestDatabase {
  constructor() {
    this.pool = null;
  }

  async connect() {
    this.pool = await mysql.createPool({
      host:               process.env.DB_HOST     || '127.0.0.1',
      port:               parseInt(process.env.DB_PORT || '3306'),
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASSWORD || '',
      database:           process.env.DB_NAME     || 'inventory_test',
      waitForConnections: true,
      connectionLimit:    5,
    });
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /** FK 체크 해제 후 전 테이블 TRUNCATE */
  async clearAllTables() {
    if (!this.pool) return;
    await this.pool.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'page_permissions', 'pages',
      'shared_group_teams', 'shared_inventory_groups',
      'products',
      'user_team_roles',
      'sub_admin_teams',
      'user_roles',
      'role_permissions',
      'permissions',
      'roles',
      'teams',
      'users',
    ];
    for (const t of tables) {
      await this.pool.query(`TRUNCATE TABLE \`${t}\``).catch(() => {});
    }
    await this.pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  async query(sql, values) {
    return this.pool.query(sql, values);
  }

  getPool() {
    return this.pool;
  }
}

// 통합 테스트마다 새 인스턴스 사용
module.exports = TestDatabase;
