-- =============================================
-- Inventory Management API - DB 초기화 스크립트
-- v5.0 : 공유 재고(Shared Inventory) 시스템 추가
-- =============================================

CREATE DATABASE IF NOT EXISTS inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory;

-- ─────────────────────────────────────────────
-- 1. 기본 사용자 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  username  VARCHAR(255) UNIQUE NOT NULL,
  email     VARCHAR(255) UNIQUE NOT NULL,
  password  VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 2. RBAC 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  UNIQUE NOT NULL COMMENT '역할명 (ADMIN, SUB_ADMIN, USER)',
  description VARCHAR(255),
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL COMMENT '권한명',
  description VARCHAR(255),
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  UNIQUE KEY uq_role_perm (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  role_id     INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role (user_id, role_id),
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)     REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sub_admin_teams (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sub_admin_id   INT NOT NULL,
  team_member_id INT NOT NULL,
  assigned_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team (sub_admin_id, team_member_id),
  FOREIGN KEY (sub_admin_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_member_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- 3. 팀 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) UNIQUE NOT NULL   COMMENT '팀 이름',
  description    VARCHAR(255)                   COMMENT '팀 설명',
  leader_id      INT                            COMMENT '팀장 user_id (FK)',
  parent_team_id INT          DEFAULT NULL      COMMENT '상위 팀 (자기참조 FK)',
  createdAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 4. 사용자-팀-역할-권한 매핑
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_team_roles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT     NOT NULL,
  team_id       INT     NOT NULL,
  role_id       INT                COMMENT '해당 팀에서의 역할',
  permission_id INT                COMMENT '해당 팀에서의 단일 권한',
  is_primary    BOOLEAN DEFAULT FALSE COMMENT '본팀 여부',
  assigned_by   INT                COMMENT '배정한 관리자 user_id',
  assigned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_team_perm (user_id, team_id, permission_id),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (team_id)       REFERENCES teams(id)       ON DELETE CASCADE,
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE SET NULL,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by)   REFERENCES users(id)       ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 5. 공유 재고 그룹 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_inventory_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL  COMMENT '공유 그룹명',
  description VARCHAR(255)            COMMENT '그룹 설명',
  created_by  INT                     COMMENT '생성자 (ADMIN)',
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 6. 공유 그룹-팀 매핑 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_group_teams (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT     NOT NULL,
  team_id  INT     NOT NULL,
  can_edit BOOLEAN DEFAULT FALSE COMMENT '해당 팀의 편집 권한 여부',
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_team (group_id, team_id),
  FOREIGN KEY (group_id) REFERENCES shared_inventory_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id)  REFERENCES teams(id)                   ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- 7. 재고 테이블 (team_id + shared_group_id 포함)
-- ─────────────────────────────────────────────
--  team_id          | shared_group_id | is_shared | 유형
--  NOT NULL         | NULL            | FALSE     | 팀 소유 재고
--  NULL             | NULL            | TRUE      | 전체 공용 재고
--  NULL             | NOT NULL        | TRUE      | 특정 그룹 공유 재고

CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT            NULL            COMMENT '생성자 (공용은 NULL 허용)',
  team_id          INT            NULL            COMMENT '소속 팀 (공용이면 NULL)',
  shared_group_id  INT            NULL            COMMENT '공유 그룹 (그룹 공유 재고)',
  is_shared        BOOLEAN        DEFAULT FALSE   COMMENT '공용/공유 여부',
  productName      VARCHAR(255)   NOT NULL,
  quantity         INT            NOT NULL DEFAULT 0,
  price            DECIMAL(15,2)  NOT NULL,
  category         VARCHAR(100),
  lastUpdated      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)         REFERENCES users(id)                    ON DELETE SET NULL,
  FOREIGN KEY (team_id)         REFERENCES teams(id)                    ON DELETE CASCADE,
  FOREIGN KEY (shared_group_id) REFERENCES shared_inventory_groups(id)  ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 8. 페이지/메뉴 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL COMMENT '페이지명',
  path        VARCHAR(255)        COMMENT 'URL 경로',
  description VARCHAR(255),
  is_menu     BOOLEAN   DEFAULT TRUE  COMMENT '메뉴 노출 여부',
  icon        VARCHAR(100)            COMMENT '메뉴 아이콘 클래스',
  order_num   INT       DEFAULT 0     COMMENT '메뉴 순서',
  parent_id   INT       DEFAULT NULL  COMMENT '서브메뉴 부모 ID',
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  page_id       INT     NOT NULL,
  permission_id INT     NOT NULL,
  required      BOOLEAN DEFAULT TRUE COMMENT '필수 권한 여부',
  UNIQUE KEY uq_page_perm (page_id, permission_id),
  FOREIGN KEY (page_id)       REFERENCES pages(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- 9. 기본 데이터 삽입
-- ─────────────────────────────────────────────

-- 역할
INSERT IGNORE INTO roles (name, description) VALUES
('ADMIN',     '시스템 관리자 — 모든 권한'),
('SUB_ADMIN', '부서장/팀장  — 팀 범위 관리'),
('USER',      '일반 사용자  — 기본 조회');

-- 권한
INSERT IGNORE INTO permissions (name, description) VALUES
('LIST_READ',    '재고 목록 조회'),
('WRITE_MODIFY', '재고 추가 및 수정'),
('DELETE',       '재고 삭제'),
('DOWNLOAD',     '데이터 다운로드'),
('MANAGE_USERS', '사용자/역할 관리');

-- 역할별 권한 매핑
-- ADMIN : 모든 권한
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'ADMIN';

-- SUB_ADMIN : MANAGE_USERS 포함 전체
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'SUB_ADMIN'
  AND p.name IN ('LIST_READ', 'WRITE_MODIFY', 'DELETE', 'DOWNLOAD', 'MANAGE_USERS');

-- USER : LIST_READ 기본
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'USER' AND p.name = 'LIST_READ';

-- 페이지
INSERT IGNORE INTO pages (name, path, description, is_menu, icon, order_num) VALUES
('대시보드',   '/dashboard', '시스템 대시보드',     TRUE, 'fas fa-chart-pie',  1),
('재고관리',   '/inventory', '재고 관리',           TRUE, 'fas fa-boxes',      2),
('사용자관리', '/users',     '사용자 및 권한 관리',  TRUE, 'fas fa-users',      3),
('팀관리',     '/teams',     '팀 관리',             TRUE, 'fas fa-users-cog',  4),
('보고서',     '/reports',   '재고 보고서',         TRUE, 'fas fa-file-alt',   5),
('설정',       '/settings',  '시스템 설정',         TRUE, 'fas fa-cog',        6);

-- 페이지별 필요 권한
INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '대시보드'   AND pm.name = 'LIST_READ';

INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '재고관리'   AND pm.name = 'LIST_READ';

INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '사용자관리' AND pm.name = 'MANAGE_USERS';

INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '팀관리'     AND pm.name = 'MANAGE_USERS';

INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '보고서'     AND pm.name = 'DOWNLOAD';

INSERT IGNORE INTO page_permissions (page_id, permission_id, required)
SELECT pg.id, pm.id, TRUE FROM pages pg, permissions pm
WHERE pg.name = '설정'       AND pm.name = 'MANAGE_USERS';

-- ─────────────────────────────────────────────
-- 10. 샘플 팀 데이터
-- ─────────────────────────────────────────────

-- ※ 팀장은 최초 가입 유저(id=1)를 가정, 없으면 NULL
INSERT IGNORE INTO teams (id, name, description, leader_id) VALUES
(1, '개발팀',     '소프트웨어 개발 팀',       NULL),
(2, '영업팀',     '영업 및 고객관리 팀',       NULL),
(3, '물류팀',     '재고 및 물류 담당 팀',      NULL);

-- 하위팀 예시
INSERT IGNORE INTO teams (id, name, description, leader_id, parent_team_id) VALUES
(4, '프론트엔드팀', '웹 프론트엔드 개발',     NULL, 1),
(5, '백엔드팀',     '백엔드 API 개발',        NULL, 1);

-- ─────────────────────────────────────────────
-- 11. 샘플 user_team_roles
-- ─────────────────────────────────────────────
-- user 5번이 있다고 가정:
--   - 개발팀(1) 소속, WRITE_MODIFY 권한, 본팀
--   - 영업팀(2) 소속, LIST_READ 권한

INSERT IGNORE INTO user_team_roles (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
SELECT 5, 1,
       (SELECT id FROM roles WHERE name = 'USER'),
       (SELECT id FROM permissions WHERE name = 'WRITE_MODIFY'),
       TRUE, NULL
FROM DUAL
WHERE EXISTS (SELECT 1 FROM users WHERE id = 5);

INSERT IGNORE INTO user_team_roles (user_id, team_id, role_id, permission_id, is_primary, assigned_by)
SELECT 5, 2,
       (SELECT id FROM roles WHERE name = 'USER'),
       (SELECT id FROM permissions WHERE name = 'LIST_READ'),
       FALSE, NULL
FROM DUAL
WHERE EXISTS (SELECT 1 FROM users WHERE id = 5);

-- ─────────────────────────────────────────────
-- 12. 샘플 공유 그룹 데이터
--     (관리자 계정 생성 후 id=1 이 존재하면 삽입)
-- ─────────────────────────────────────────────

INSERT IGNORE INTO shared_inventory_groups (id, name, description, created_by)
SELECT 1, '공용 창고',       '모든 팀이 사용하는 공용 물품',      1
FROM DUAL WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT IGNORE INTO shared_inventory_groups (id, name, description, created_by)
SELECT 2, '개발-물류 공유',  '개발팀과 물류팀이 공유하는 테스트 장비', 1
FROM DUAL WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

-- 공용 창고(1) — 개발팀/영업팀/물류팀 (읽기 전용)
INSERT IGNORE INTO shared_group_teams (group_id, team_id, can_edit)
SELECT 1, t.id, FALSE FROM teams t WHERE t.id IN (1, 2, 3)
  AND EXISTS (SELECT 1 FROM shared_inventory_groups WHERE id = 1);

-- 개발-물류 공유(2) — 개발팀/물류팀 (편집 가능)
INSERT IGNORE INTO shared_group_teams (group_id, team_id, can_edit)
SELECT 2, t.id, TRUE FROM teams t WHERE t.id IN (1, 3)
  AND EXISTS (SELECT 1 FROM shared_inventory_groups WHERE id = 2);

-- ─────────────────────────────────────────────
-- 13. 확인 쿼리
-- ─────────────────────────────────────────────

SELECT '=== 테이블 목록 ===' AS info;
SHOW TABLES;

SELECT '=== 역할-권한 매핑 ===' AS info;
SELECT r.name AS role, p.name AS permission
FROM role_permissions rp
JOIN roles r       ON rp.role_id       = r.id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.name;

SELECT '=== 팀 목록 ===' AS info;
SELECT t.id, t.name, t.description, t.parent_team_id FROM teams t ORDER BY t.id;

SELECT '=== 공유 그룹 ===' AS info;
SELECT g.id, g.name, g.description, t.name AS team_name, sgt.can_edit
FROM shared_inventory_groups g
LEFT JOIN shared_group_teams sgt ON g.id = sgt.group_id
LEFT JOIN teams t ON sgt.team_id = t.id
ORDER BY g.id, t.id;

SELECT '=== 행 수 ===' AS info;
SELECT 'users'                  AS tbl, COUNT(*) AS cnt FROM users
UNION ALL SELECT 'teams',                COUNT(*) FROM teams
UNION ALL SELECT 'shared_groups',        COUNT(*) FROM shared_inventory_groups
UNION ALL SELECT 'shared_group_teams',   COUNT(*) FROM shared_group_teams
UNION ALL SELECT 'products',             COUNT(*) FROM products;
