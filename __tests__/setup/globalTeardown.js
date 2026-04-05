/**
 * globalTeardown.js — Jest 전체 종료 후 1회 실행
 * 테스트 전용 DB 정리 (선택적으로 DROP)
 */

const mysql = require('mysql2/promise');

module.exports = async () => {
  try {
    const conn = await mysql.createConnection({
      host:     '127.0.0.1',
      port:     3306,
      user:     'root',
      password: '',
    });
    // 테스트 DB는 남겨두고 연결만 정리 (재사용 목적)
    // 완전 삭제 원할 시: await conn.query('DROP DATABASE IF EXISTS inventory_test');
    await conn.end();
    console.log('\n✅ [globalTeardown] 테스트 완료\n');
  } catch (err) {
    // teardown 실패는 무시
  }
};
