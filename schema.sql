-- ============================================================
-- Inventory Management API — 최적화 스키마 v6.0
-- 변경 사항:
--   • 모든 FK 컬럼에 인덱스 추가 (JOIN 성능)
--   • products 테이블 복합 인덱스 (team+category, user+id)
--   • 자주 사용되는 조회 경로에 커버링 인덱스 적용
--   • 전체 테이블 스캔 제거를 위한 WHERE 절 인덱스
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory;

-- ─────────────────────────────────────────────
-- 1. users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  username  VARCHAR(255) NOT NULL,
  email     VARCHAR(255) NOT NULL,
  password  VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username),
  -- 로그인 조회용 커버링 인덱스 (email, id, password)
  INDEX      idx_users_email_id (email, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 2. roles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL COMMENT '역할명 (ADMIN, SUB_ADMIN, USER)',
  description VARCHAR(255),
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 3. permissions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL COMMENT '권한명',
  description VARCHAR(255),
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 4. role_permissions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,

  UNIQUE KEY uq_role_perm (role_id, permission_id),
  -- 권한 → 역할 역방향 조회
  INDEX idx_rp_permission_id (permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 5. user_roles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  role_id     INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_user_role (user_id, role_id),
  -- role_id FK 인덱스 (JOIN 성능)
  INDEX idx_ur_role_id      (role_id),
  INDEX idx_ur_assigned_by  (assigned_by),
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)     REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 6. teams
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  description    VARCHAR(500),
  leader_id      INT,
  parent_team_id INT,
  createdAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_teams_name    (name),
  INDEX      idx_teams_leader (leader_id),
  INDEX      idx_teams_parent (parent_team_id),
  FOREIGN KEY (leader_id)      REFERENCES users(id)  ON DELETE SET NULL,
  FOREIGN KEY (parent_team_id) REFERENCES teams(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 7. user_team_roles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_team_roles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  team_id       INT NOT NULL,
  role_id       INT,
  permission_id INT,
  is_primary    TINYINT(1)   DEFAULT 0,
  assigned_by   INT,
  assigned_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  -- 복합 고유 키: 사용자-팀-권한 조합 중복 방지
  UNIQUE KEY uq_utr_user_team_perm (user_id, team_id, permission_id),
  -- 팀별 사용자 전체 조회 (팀원 목록)
  INDEX idx_utr_team_id       (team_id),
  -- 권한/역할 FK 인덱스
  INDEX idx_utr_role_id       (role_id),
  INDEX idx_utr_permission_id (permission_id),
  INDEX idx_utr_assigned_by   (assigned_by),
  -- 권한 존재 여부 확인 커버링 인덱스 (user, team, perm → cnt)
  INDEX idx_utr_user_team     (user_id, team_id),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (team_id)       REFERENCES teams(id)       ON DELETE CASCADE,
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE SET NULL,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by)   REFERENCES users(id)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 8. products  ← 핵심 성능 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL COMMENT '등록자',
  team_id     INT          NOT NULL COMMENT '소유 팀',
  productName VARCHAR(255) NOT NULL,
  quantity    INT          NOT NULL DEFAULT 0,
  price       DECIMAL(15,2)         DEFAULT 0.00,
  category    VARCHAR(100),
  lastUpdated TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdAt   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  -- FK 인덱스
  INDEX idx_products_user_id  (user_id),
  INDEX idx_products_team_id  (team_id),
  -- 팀별 목록 조회 + 정렬 (가장 빈번한 쿼리)
  INDEX idx_products_team_id_id      (team_id, id),
  -- 팀+카테고리 필터 (category 검색)
  INDEX idx_products_team_category   (team_id, category),
  -- 저재고 알림 조회 (team_id + quantity 범위 스캔)
  INDEX idx_products_team_qty        (team_id, quantity),
  -- 다중 팀 IN 절 최적화 (team_id 단일 인덱스로 커버)
  -- 상품명 검색 지원
  INDEX idx_products_name            (productName(50)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 9. shared_inventory_groups
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_inventory_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description VARCHAR(500),
  created_by  INT,
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_sig_name       (name),
  INDEX      idx_sig_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 10. shared_group_teams
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_group_teams (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  team_id    INT NOT NULL,
  added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_sgt_group_team (group_id, team_id),
  INDEX      idx_sgt_team_id  (team_id),
  FOREIGN KEY (group_id) REFERENCES shared_inventory_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id)  REFERENCES teams(id)                   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 11. pages
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL COMMENT '페이지 식별자',
  title       VARCHAR(255),
  description VARCHAR(500),
  path        VARCHAR(255),
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_pages_name (name),
  INDEX      idx_pages_path (path(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 12. page_permissions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  page_id       INT NOT NULL,
  permission_id INT NOT NULL,

  UNIQUE KEY uq_pp_page_perm    (page_id, permission_id),
  INDEX      idx_pp_permission  (permission_id),
  FOREIGN KEY (page_id)       REFERENCES pages(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- 기본 데이터 삽입
-- ─────────────────────────────────────────────

-- 역할
INSERT IGNORE INTO roles (name, description) VALUES
  ('ADMIN',     '시스템 전체 관리자'),
  ('SUB_ADMIN', '팀 내 부관리자'),
  ('USER',      '일반 사용자');

-- 권한
INSERT IGNORE INTO permissions (name, description) VALUES
  ('LIST_READ',    '목록 조회 및 읽기'),
  ('WRITE_MODIFY', '생성 및 수정'),
  ('DELETE',       '삭제'),
  ('DOWNLOAD',     '다운로드'),
  ('MANAGE_USERS', '사용자 관리');

-- ADMIN 역할에 모든 권한 부여
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN';

-- USER 역할에 LIST_READ 권한
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'USER' AND p.name = 'LIST_READ';
