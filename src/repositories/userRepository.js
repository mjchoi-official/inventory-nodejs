const { getPool } = require('../config/database');

// ================================================================
// users 테이블 쿼리 전담 — 비즈니스 로직 없음
// ================================================================
class UserRepository {

  // 이메일로 조회
  async findByEmail(email) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // ID로 조회
  async findById(id) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // 생성 → insertId 반환
  async create({ username, email, hashedPassword }) {
    const pool = getPool();
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    return result.insertId;
  }

  // 비밀번호 업데이트
  async updatePassword(userId, newHashedPassword) {
    const pool = getPool();
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [newHashedPassword, userId]
    );
  }
}

module.exports = new UserRepository();
