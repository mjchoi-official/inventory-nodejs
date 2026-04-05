/**
 * globalSetup.js — Jest 전체 실행 전 1회 실행
 * 테스트 전용 DB(inventory_test) 생성 및 스키마 초기화
 */

const mysql = require('mysql2/promise');
const path  = require('path');
const fs    = require('fs');

module.exports = async () => {
  // 환경변수 설정
  process.env.NODE_ENV    = 'test';
  process.env.DB_HOST     = '127.0.0.1';
  process.env.DB_PORT     = '3306';
  process.env.DB_USER     = 'root';
  process.env.DB_PASSWORD = '';
  process.env.DB_NAME     = 'inventory_test';
  process.env.JWT_SECRET  = 'test-jwt-secret-key-for-jest';
  process.env.JWT_EXPIRES = '1h';
  process.env.PORT        = '3001';

  // root 권한 연결
  const rootConn = await mysql.createConnection({
    host:     '127.0.0.1',
    port:     3306,
    user:     'root',
    password: '',
  });

  // 테스트 DB 생성
  await rootConn.query(
    `CREATE DATABASE IF NOT EXISTS inventory_test
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await rootConn.query('USE inventory_test');

  // init-db.sql 에서 테이블 DDL만 추출해서 실행
  // (INSERT 샘플 데이터는 testData.js 에서 별도 관리)
  const ddlStatements = [
    // users
    `CREATE TABLE IF NOT EXISTS users (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      username  VARCHAR(255) UNIQUE NOT NULL,
      email     VARCHAR(255) UNIQUE NOT NULL,
      password  VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // roles
    `CREATE TABLE IF NOT EXISTS roles (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(50) UNIQUE NOT NULL,
      description VARCHAR(255),
      createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // permissions
    `CREATE TABLE IF NOT EXISTS permissions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100) UNIQUE NOT NULL,
      description VARCHAR(255),
      createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // role_permissions
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      role_id       INT NOT NULL,
      permission_id INT NOT NULL,
      UNIQUE KEY uq_role_perm (role_id, permission_id),
      FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )`,
    // user_roles
    `CREATE TABLE IF NOT EXISTS user_roles (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      role_id     INT NOT NULL,
      assigned_by INT,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_role (user_id, role_id),
      FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id)     REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    // sub_admin_teams
    `CREATE TABLE IF NOT EXISTS sub_admin_teams (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      sub_admin_id   INT NOT NULL,
      team_member_id INT NOT NULL,
      assigned_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_team (sub_admin_id, team_member_id),
      FOREIGN KEY (sub_admin_id)   REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    // teams
    `CREATE TABLE IF NOT EXISTS teams (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      name           VARCHAR(100) UNIQUE NOT NULL,
      description    VARCHAR(255),
      leader_id      INT,
      parent_team_id INT DEFAULT NULL,
      createdAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id)      REFERENCES users(id)  ON DELETE SET NULL,
      FOREIGN KEY (parent_team_id) REFERENCES teams(id)  ON DELETE SET NULL
    )`,
    // user_team_roles
    `CREATE TABLE IF NOT EXISTS user_team_roles (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      team_id       INT NOT NULL,
      role_id       INT,
      permission_id INT,
      is_primary    BOOLEAN DEFAULT FALSE,
      assigned_by   INT,
      assigned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_team_perm (user_id, team_id, permission_id),
      FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
      FOREIGN KEY (team_id)       REFERENCES teams(id)       ON DELETE CASCADE,
      FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE SET NULL,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by)   REFERENCES users(id)       ON DELETE SET NULL
    )`,
    // shared_inventory_groups
    `CREATE TABLE IF NOT EXISTS shared_inventory_groups (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      created_by  INT,
      createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    // shared_group_teams
    `CREATE TABLE IF NOT EXISTS shared_group_teams (
      id       INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      team_id  INT NOT NULL,
      can_edit BOOLEAN DEFAULT FALSE,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_group_team (group_id, team_id),
      FOREIGN KEY (group_id) REFERENCES shared_inventory_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id)  REFERENCES teams(id)                   ON DELETE CASCADE
    )`,
    // products
    `CREATE TABLE IF NOT EXISTS products (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      user_id         INT,
      team_id         INT,
      shared_group_id INT,
      is_shared       BOOLEAN DEFAULT FALSE,
      productName     VARCHAR(255) NOT NULL,
      quantity        INT NOT NULL DEFAULT 0,
      price           DECIMAL(15,2) NOT NULL,
      category        VARCHAR(100),
      lastUpdated     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)         REFERENCES users(id)                   ON DELETE SET NULL,
      FOREIGN KEY (team_id)         REFERENCES teams(id)                   ON DELETE CASCADE,
      FOREIGN KEY (shared_group_id) REFERENCES shared_inventory_groups(id) ON DELETE SET NULL
    )`,
    // pages
    `CREATE TABLE IF NOT EXISTS pages (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      name      VARCHAR(100) UNIQUE NOT NULL,
      path      VARCHAR(255),
      description VARCHAR(255),
      is_menu   BOOLEAN DEFAULT TRUE,
      icon      VARCHAR(100),
      order_num INT DEFAULT 0,
      parent_id INT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
    )`,
    // page_permissions
    `CREATE TABLE IF NOT EXISTS page_permissions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      page_id       INT NOT NULL,
      permission_id INT NOT NULL,
      required      BOOLEAN DEFAULT TRUE,
      UNIQUE KEY uq_page_perm (page_id, permission_id),
      FOREIGN KEY (page_id)       REFERENCES pages(id)       ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )`,
  ];

  for (const ddl of ddlStatements) {
    await rootConn.query(ddl);
  }

  await rootConn.end();
  console.log('\n✅ [globalSetup] inventory_test DB 초기화 완료\n');
};
