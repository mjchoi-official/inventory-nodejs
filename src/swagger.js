/**
 * swagger.js — OpenAPI 3.0 스펙 설정
 * 글로벌 스키마, 보안 스킴, 서버 정보 정의
 * 각 라우트 파일의 JSDoc 주석을 수집하여 최종 스펙 생성
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi   = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory Management API',
      version: '3.0.0',
      description: `
## 팀별 재고관리 시스템 API

JWT 인증 기반의 멀티팀 재고관리 시스템입니다.

### 인증 방법
1. \`POST /api/auth/register\` 또는 \`POST /api/auth/login\` 으로 JWT 토큰 발급
2. 우측 상단 **Authorize** 버튼 클릭 → Bearer 토큰 입력
3. 이후 모든 요청에 자동으로 \`Authorization: Bearer <token>\` 헤더 포함

### 권한 체계
| 권한 | 설명 |
|------|------|
| LIST_READ | 재고 목록 조회 |
| WRITE_MODIFY | 재고 추가·수정, 수량 조정 |
| DELETE | 재고 삭제 |
| DOWNLOAD | 데이터 다운로드 |
| MANAGE_USERS | 사용자·역할·공유그룹 관리 (ADMIN 전용) |
      `,
      contact: {
        name:  'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url:  'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:         'http://localhost:3000',
        description: 'Development server',
      },
      {
        url:         'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      // ── 보안 스킴 ──────────────────────────────────────────────
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  '로그인 후 발급받은 JWT 토큰을 입력하세요 (Bearer 접두사 불필요)',
        },
      },
      // ── 공통 스키마 ────────────────────────────────────────────
      schemas: {
        // 사용자
        User: {
          type: 'object',
          properties: {
            id:        { type: 'integer',  example: 1 },
            username:  { type: 'string',   example: 'john_doe' },
            email:     { type: 'string',   example: 'john@example.com' },
            createdAt: { type: 'string',   format: 'date-time' },
          },
        },
        // 토큰 응답
        TokenResponse: {
          type: 'object',
          properties: {
            token: {
              type:    'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        // 재고 상품
        Product: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            teamId:      { type: 'integer', example: 1,     nullable: true },
            productName: { type: 'string',  example: '노트북' },
            quantity:    { type: 'integer', example: 50 },
            price:       { type: 'number',  example: 1500000 },
            category:    { type: 'string',  example: 'electronics' },
            isShared:    { type: 'boolean', example: false },
            lastUpdated: { type: 'string',  format: 'date-time' },
          },
        },
        // 재고 목록 응답
        ProductList: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 5 },
            items: {
              type:  'array',
              items: { $ref: '#/components/schemas/Product' },
            },
          },
        },
        // 수량 조정 응답
        AdjustResponse: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            productName: { type: 'string',  example: '노트북' },
            oldQuantity: { type: 'integer', example: 50 },
            adjustment:  { type: 'integer', example: -5 },
            newQuantity: { type: 'integer', example: 45 },
            reason:      { type: 'string',  example: 'sale' },
            timestamp:   { type: 'string',  format: 'date-time' },
          },
        },
        // 팀 (권한 포함)
        TeamWithPermissions: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            name:        { type: 'string',  example: '개발팀' },
            description: { type: 'string',  example: '백엔드 개발' },
            leaderId:    { type: 'integer', example: 2 },
            isPrimary:   { type: 'boolean', example: true },
            permissions: {
              type:    'array',
              items:   { type: 'string' },
              example: ['LIST_READ', 'WRITE_MODIFY', 'DELETE'],
            },
          },
        },
        // 공유 그룹
        SharedGroup: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            name:        { type: 'string',  example: '공용 창고' },
            description: { type: 'string',  example: '전사 공용 비품' },
            createdBy:   { type: 'integer', example: 1 },
            createdAt:   { type: 'string',  format: 'date-time' },
          },
        },
        // 페이지
        Page: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            name:        { type: 'string',  example: 'inventory' },
            path:        { type: 'string',  example: '/inventory' },
            description: { type: 'string',  example: '재고 관리 페이지' },
            isMenu:      { type: 'boolean', example: true },
            icon:        { type: 'string',  example: 'box' },
            orderNum:    { type: 'integer', example: 1 },
            canAccess:   { type: 'boolean', example: true },
          },
        },
        // 공통 에러
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: '에러 메시지' },
          },
        },
        // 성공 메시지
        MessageResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: '처리가 완료되었습니다' },
          },
        },
      },
      // ── 재사용 응답 ────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: '인증 필요 (토큰 없음 또는 만료)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: '인증 토큰이 필요합니다' },
            },
          },
        },
        Forbidden: {
          description: '권한 부족',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: '해당 권한이 없습니다' },
            },
          },
        },
        NotFound: {
          description: '리소스 없음',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: '찾을 수 없습니다' },
            },
          },
        },
        BadRequest: {
          description: '잘못된 요청 (유효성 검사 실패)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'teamId는 필수입니다 (숫자)' },
            },
          },
        },
      },
    },
    // 전역 JWT 보안 (기본 적용; 각 라우트에서 security: [] 로 해제 가능)
    security: [{ bearerAuth: [] }],
    // 태그 정의 (Swagger UI 표시 순서)
    tags: [
      { name: 'Authentication', description: '회원가입 / 로그인 / 비밀번호 변경' },
      { name: 'Teams',          description: '팀 생성·조회 및 팀원 관리' },
      { name: 'Inventory',      description: '팀 소유 재고 CRUD + 수량 조정' },
      { name: 'Shared Inventory', description: '공유 그룹 관리 및 공용·그룹 재고' },
      { name: 'Roles',          description: '역할·권한 할당 및 조회' },
      { name: 'Pages',          description: '페이지 접근 권한 조회' },
    ],
  },
  // JSDoc 주석을 수집할 파일 목록
  apis: [
    './src/routes/authRoutes.js',
    './src/routes/teamRoutes.js',
    './src/routes/inventoryRoutes.js',
    './src/routes/sharedInventoryRoutes.js',
    './src/routes/roleRoutes.js',
    './src/routes/pageRoutes.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
