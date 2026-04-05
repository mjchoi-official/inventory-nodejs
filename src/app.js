const express               = require('express');
const authRoutes             = require('./routes/authRoutes');
const roleRoutes             = require('./routes/roleRoutes');
const pageRoutes             = require('./routes/pageRoutes');
const teamRoutes             = require('./routes/teamRoutes');
const inventoryRoutes        = require('./routes/inventoryRoutes');
const sharedInventoryRoutes  = require('./routes/sharedInventoryRoutes');
const { swaggerUi, specs }   = require('./swagger');
const performanceMiddleware  = require('./middleware/performanceMiddleware');

const app = express();

// ─────────────────────────────────────────────
// 미들웨어
// ─────────────────────────────────────────────
app.use(express.json());

// 성능 모니터링 (응답 시간 측정, X-Response-Time 헤더, 200ms 초과 경고)
app.use(performanceMiddleware.track);

// ─────────────────────────────────────────────
// Swagger UI  →  GET /api-docs
// ─────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true,   // Authorize 정보 새로고침 후에도 유지
    displayOperationId:   false,
    defaultModelsExpandDepth: 1,  // 스키마 기본 펼침 깊이
    docExpansion:         'list', // 태그별 접힌 상태로 시작
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { font-size: 2rem; }
  `,
  customSiteTitle: 'Inventory API Docs',
}));

// ─────────────────────────────────────────────
// 라우터
//   /api/auth             → 인증 불필요 (로그인/회원가입)
//   /api/roles            → JWT + MANAGE_USERS
//   /api/pages            → JWT 필수
//   /api/teams            → JWT 필수 (팀 CRUD & 팀원 관리)
//   /api/inventory        → JWT + 팀 권한 (팀 소유 재고)
//   /api/shared-inventory → JWT + 권한 (공유/공용 재고)
// ─────────────────────────────────────────────
app.use('/api/auth',             authRoutes);
app.use('/api/roles',            roleRoutes);
app.use('/api/pages',            pageRoutes);
app.use('/api/teams',            teamRoutes);
app.use('/api/inventory',        inventoryRoutes);
app.use('/api/shared-inventory', sharedInventoryRoutes);

// ─────────────────────────────────────────────
// 글로벌 에러 핸들러
// ─────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status  = err.status || 500;
  const message = err.message || '서버 오류';
  if (status === 500) console.error('[Server Error]', err.stack);
  res.status(status).json({ error: message });
});

module.exports = app;
