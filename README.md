# Inventory Management API

> **Node.js + Express + MariaDB(SSH Tunnel) + JWT + RBAC + 멀티팀 + 공유 재고**  
> Clean Architecture (Controller / Service / Repository / DTO)

---

## 프로젝트 구조

```
inventory-api/
 ├─ scripts/
 │  └─ createAdmin.js          # 관리자 계정 생성 스크립트
 ├─ src/
 │  ├─ config/
 │  │  └─ database.js          # SSH 터널 + MySQL 커넥션 풀
 │  ├─ controllers/
 │  │  ├─ authController.js
 │  │  ├─ inventoryController.js
 │  │  ├─ pageController.js
 │  │  ├─ roleController.js
 │  │  ├─ sharedInventoryController.js
 │  │  └─ teamController.js
 │  ├─ services/
 │  │  ├─ authService.js
 │  │  ├─ inventoryService.js
 │  │  ├─ pageService.js
 │  │  ├─ roleService.js
 │  │  ├─ sharedInventoryService.js
 │  │  └─ teamService.js
 │  ├─ repositories/
 │  │  ├─ inventoryRepository.js
 │  │  ├─ pageRepository.js
 │  │  ├─ roleRepository.js
 │  │  ├─ sharedInventoryRepository.js
 │  │  ├─ teamRepository.js
 │  │  └─ userRepository.js
 │  ├─ dtos/
 │  │  ├─ authDTO.js
 │  │  ├─ inventoryDTO.js
 │  │  ├─ pageDTO.js
 │  │  ├─ roleDTO.js
 │  │  ├─ sharedInventoryDTO.js
 │  │  └─ teamDTO.js
 │  ├─ middleware/
 │  │  ├─ authMiddleware.js
 │  │  └─ permissionMiddleware.js
 │  ├─ routes/
 │  │  ├─ authRoutes.js
 │  │  ├─ inventoryRoutes.js
 │  │  ├─ pageRoutes.js
 │  │  ├─ roleRoutes.js
 │  │  ├─ sharedInventoryRoutes.js
 │  │  └─ teamRoutes.js
 │  └─ app.js
 ├─ server.js
 ├─ init-db.sql
 ├─ .env.example
 ├─ package.json
 └─ README.md
```

---

## 레이어 역할

| 레이어 | 역할 |
|--------|------|
| Controller | HTTP 요청/응답, DTO 인스턴스화 |
| Service    | 비즈니스 로직, 권한 검증, 에러 throw |
| Repository | SQL 쿼리 실행 (DB 접근 전담) |
| DTO        | 입력 유효성 검사, 응답 형식 정의 |
| Config     | 환경변수 로드, DB/SSH 연결 관리 |

---

## 재고 유형

| 유형 | team_id | shared_group_id | is_shared | 접근 가능자 |
|------|---------|-----------------|-----------|-------------|
| **팀 소유** | NOT NULL | NULL | FALSE | 해당 팀원 (user_team_roles) |
| **전체 공용** | NULL | NULL | TRUE | 권한 있는 모든 사용자 |
| **그룹 공유** | NULL | NOT NULL | TRUE | 그룹에 속한 팀의 팀원 |

---

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일에서 SSH/DB/JWT 설정 수정

# 3. SSH 개인키 복사 (Windows)
copy C:\Users\[username]\.ssh\id_rsa .\ssh-key.pem
# Linux/Mac
chmod 600 ssh-key.pem

# 4. DB 초기화 (init-db.sql 실행)

# 5. 관리자 계정 생성 (super admin)
npm run create-admin

# 6. 서버 시작
npm start
```

예상 출력:
```
✅ SSH 연결 성공
✅ MariaDB 연결 성공
✅ Inventory API running on port 3000
```

---

## API 엔드포인트

### 인증 (`/api/auth`)

| Method | URL | 설명 | 인증 |
|--------|-----|------|------|
| POST | `/api/auth/register` | 회원가입 | 불필요 |
| POST | `/api/auth/login` | 로그인 (JWT 발급) | 불필요 |
| POST | `/api/auth/change-password` | 비밀번호 변경 | JWT |

```json
// 로그인 예시
POST /api/auth/login
{ "email": "admin@example.com", "password": "admin123456" }
// 응답: { "token": "eyJhbGci..." }

// 비밀번호 변경
POST /api/auth/change-password
Authorization: Bearer <token>
{ "oldPassword": "admin123456", "newPassword": "newPass@2026" }
```

---

### 팀 관리 (`/api/teams`) — JWT 사용

| Method | URL | 설명 | 권한 |
|--------|-----|------|------|
| POST | `/api/teams` | 팀 생성 | ADMIN |
| GET | `/api/teams/my` | 내 팀 목록 + 권한 | 모든 인증 사용자 |
| POST | `/api/teams/:teamId/members` | 팀원 추가 | 팀장/SUB_ADMIN/ADMIN |
| DELETE | `/api/teams/:teamId/members/:userId` | 팀원 제거 | 팀장/SUB_ADMIN/ADMIN |
| GET | `/api/teams/:teamId/members` | 팀원 목록 | 팀 소속 or ADMIN |

```json
// 팀 생성
POST /api/teams
Authorization: Bearer <token>
{ "name": "개발팀", "description": "소프트웨어 개발", "leaderId": 1 }

// 팀원 추가 (permissionName: LIST_READ | WRITE_MODIFY | DELETE | DOWNLOAD)
POST /api/teams/1/members
Authorization: Bearer <token>
{ "userId": 3, "permissionName": "WRITE_MODIFY", "isPrimary": true }
```

---

### 팀 소유 재고 (`/api/inventory`) — JWT 사용

| Method | URL | 설명 | 필요 권한 |
|--------|-----|------|-----------|
| GET | `/api/inventory` | 목록 조회 | LIST_READ |
| GET | `/api/inventory/:id` | 단건 조회 | LIST_READ |
| POST | `/api/inventory` | 재고 추가 | WRITE_MODIFY |
| PUT | `/api/inventory/:id` | 재고 수정 | WRITE_MODIFY |
| DELETE | `/api/inventory/:id` | 재고 삭제 | DELETE |
| PATCH | `/api/inventory/:id/adjust` | 수량 증감 | WRITE_MODIFY |

**쿼리 파라미터:** `?teamId=1&category=electronics&lowStock=10`

```json
// 재고 추가 (teamId 필수)
POST /api/inventory
Authorization: Bearer <token>
{ "teamId": 1, "productName": "노트북", "quantity": 50, "price": 1500000, "category": "electronics" }

// 수량 조정 (teamId 필수)
PATCH /api/inventory/1/adjust
Authorization: Bearer <token>
{ "teamId": 1, "quantity": -5, "reason": "sale" }
```

---

### 공유/공용 재고 (`/api/shared-inventory`) — JWT 사용

#### 공유 그룹 관리

| Method | URL | 설명 | 권한 |
|--------|-----|------|------|
| POST | `/api/shared-inventory/groups` | 공유 그룹 생성 | MANAGE_USERS(ADMIN) |
| GET | `/api/shared-inventory/groups` | 그룹 목록 조회 | JWT만 |
| POST | `/api/shared-inventory/groups/:groupId/teams` | 그룹에 팀 추가 | MANAGE_USERS(ADMIN) |

```json
// 공유 그룹 생성
POST /api/shared-inventory/groups
Authorization: Bearer <admin_token>
{ "name": "공용 창고", "description": "모든 팀이 사용하는 공용 물품" }
// 응답: { "id": 1, "name": "공용 창고", ... }

// 그룹에 팀 추가
POST /api/shared-inventory/groups/1/teams
Authorization: Bearer <admin_token>
{ "teamId": 2, "canEdit": true }
```

#### 재고 조회

| Method | URL | 설명 | 권한 |
|--------|-----|------|------|
| GET | `/api/shared-inventory/all` | 접근 가능한 전체 재고 | LIST_READ |
| GET | `/api/shared-inventory/groups/:groupId/items` | 특정 그룹 재고 | LIST_READ |
| GET | `/api/shared-inventory/public` | 전체 공용 재고 | LIST_READ |

**쿼리 파라미터:** `?category=&lowStock=&teamId=&groupId=`

```json
// 전체 재고 조회 (팀 소유 + 공용 + 그룹 공유 한번에)
GET /api/shared-inventory/all
Authorization: Bearer <token>
// 응답: { "total": 15, "items": [...] }
```

#### 재고 생성

| Method | URL | 설명 | 권한 |
|--------|-----|------|------|
| POST | `/api/shared-inventory/groups/:groupId/items` | 그룹 공유 재고 생성 | WRITE_MODIFY (canEdit 팀원) |
| POST | `/api/shared-inventory/public/items` | 전체 공용 재고 생성 | MANAGE_USERS (ADMIN) |

```json
// 그룹 공유 재고 생성
POST /api/shared-inventory/groups/1/items
Authorization: Bearer <token>
{ "productName": "프로젝터", "quantity": 5, "price": 800000, "category": "equipment" }

// 응답: { "id": 12, "productName": "프로젝터", "isShared": true, "teamId": null, ... }
```

#### 재고 수정/삭제/수량 조정

| Method | URL | 설명 | 권한 |
|--------|-----|------|------|
| PUT | `/api/shared-inventory/:id` | 수정 | WRITE_MODIFY |
| DELETE | `/api/shared-inventory/:id` | 삭제 | DELETE |
| PATCH | `/api/shared-inventory/:id/adjust` | 수량 증감 | WRITE_MODIFY |

```json
// 공유 재고 수량 조정
PATCH /api/shared-inventory/12/adjust
Authorization: Bearer <token>
{ "quantity": -2, "reason": "사용" }
// 응답: { "id": 12, "oldQuantity": 5, "adjustment": -2, "newQuantity": 3, ... }
```

---

### 역할 관리 (`/api/roles`) — JWT + MANAGE_USERS

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/roles` | 역할 목록 |
| POST | `/api/roles/assign` | 사용자에게 역할 부여 |
| DELETE | `/api/roles/remove` | 역할 제거 |

---

### 페이지 권한 (`/api/pages`) — JWT 사용

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/pages/menu` | 접근 가능한 메뉴 목록 |
| GET | `/api/pages/check/:pageName` | 특정 페이지 접근 가능 여부 |
| GET | `/api/pages/:pageName` | 페이지 상세 정보 |

---

## Thunder Client 테스트 순서

```
1.  POST /api/auth/register             → 계정 생성
2.  POST /api/auth/login                → Bearer 토큰 발급
3.  (ADMIN) POST /api/teams             → 팀 생성
4.  (ADMIN) POST /api/teams/1/members   → 팀원 추가 (permissionName: "WRITE_MODIFY")
5.  GET  /api/teams/my                  → 내 팀 및 권한 확인
6.  POST /api/inventory                 → { teamId:1, ... } 팀 소유 재고 추가
7.  GET  /api/inventory?teamId=1        → 팀 재고 조회
8.  PATCH /api/inventory/1/adjust       → { teamId:1, quantity:-5 } 수량 조정
9.  (ADMIN) POST /api/shared-inventory/groups → 공유 그룹 생성
10. (ADMIN) POST /api/shared-inventory/groups/1/teams → { teamId:1, canEdit:true }
11. POST /api/shared-inventory/groups/1/items → 그룹 공유 재고 추가
12. GET  /api/shared-inventory/all      → 전체 접근 가능 재고 조회
13. PATCH /api/shared-inventory/:id/adjust → 공유 재고 수량 조정
14. POST /api/auth/change-password      → 비밀번호 변경
```

---

## 주요 특징

- **JWT 인증**: 7일 만료 토큰, Bearer 방식
- **bcrypt**: 패스워드 단방향 해싱 (saltRounds=10)
- **3종 재고 격리**: 팀 소유 / 전체 공용 / 그룹 공유
- **팀 권한 검증**: `user_team_roles` 기반 `WRITE_MODIFY` / `DELETE` 확인
- **그룹 편집 권한**: `shared_group_teams.can_edit` 플래그
- **원자적 재고 증감**: `SET quantity = quantity + ?`
- **SSH 터널링**: Node.js → localhost:13306 → SSH → MariaDB:3306
- **Clean Architecture**: Controller → Service → Repository 단방향 의존성

---

## DB 테이블 목록 (v5.0)

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 |
| `roles` | 역할 (ADMIN / SUB_ADMIN / USER) |
| `permissions` | 권한 (LIST_READ / WRITE_MODIFY / DELETE / DOWNLOAD / MANAGE_USERS) |
| `role_permissions` | 역할-권한 매핑 |
| `user_roles` | 사용자-역할 매핑 |
| `sub_admin_teams` | SUB_ADMIN 팀 관리 |
| `teams` | 팀 (계층 구조 지원) |
| `user_team_roles` | 사용자-팀-역할-권한 매핑 |
| `shared_inventory_groups` | 공유 재고 그룹 |
| `shared_group_teams` | 공유 그룹-팀 매핑 (can_edit 포함) |
| `products` | 재고 (팀 소유 / 공용 / 그룹 공유) |
| `pages` | 페이지/메뉴 |
| `page_permissions` | 페이지-권한 매핑 |

---
