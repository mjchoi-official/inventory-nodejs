const { Router }            = require('express');
const ctrl                  = require('../controllers/pageController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Pages
 *   description: 페이지 접근 권한 조회 (프론트엔드 메뉴 렌더링용)
 */

router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pages/menu:
 *   get:
 *     summary: 접근 가능한 메뉴 목록 조회
 *     description: |
 *       로그인한 사용자가 접근할 수 있는 메뉴 페이지 목록을 반환합니다.
 *       - 권한에 따라 보이는 메뉴가 다릅니다.
 *       - 프론트엔드 사이드바/네비게이션 렌더링에 사용합니다.
 *     tags: [Pages]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 menu:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Page'
 *             example:
 *               menu:
 *                 - id: 1
 *                   name: inventory
 *                   path: /inventory
 *                   description: 재고 관리
 *                   isMenu: true
 *                   icon: box
 *                   orderNum: 1
 *                   canAccess: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/menu', ctrl.getAccessibleMenu.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pages/check/{pageName}:
 *   get:
 *     summary: 페이지 접근 가능 여부 확인
 *     description: |
 *       특정 페이지에 로그인한 사용자가 접근 가능한지 확인합니다.
 *       - 프론트엔드 라우트 가드(Route Guard)에 활용합니다.
 *     tags: [Pages]
 *     parameters:
 *       - in: path
 *         name: pageName
 *         required: true
 *         schema: { type: string }
 *         description: "페이지 이름 (예: inventory, admin)"
 *         example: inventory
 *     responses:
 *       200:
 *         description: 접근 가능
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAccess: { type: boolean, example: true }
 *                 pageName:  { type: string,  example: inventory }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: 접근 불가 (권한 부족)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAccess: { type: boolean, example: false }
 *                 pageName:  { type: string,  example: admin }
 */
router.get('/check/:pageName', ctrl.checkAccess.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pages/{pageName}:
 *   get:
 *     summary: 페이지 상세 정보 조회
 *     description: |
 *       특정 페이지의 상세 정보와 해당 페이지에 필요한 권한 목록을 반환합니다.
 *     tags: [Pages]
 *     parameters:
 *       - in: path
 *         name: pageName
 *         required: true
 *         schema: { type: string }
 *         description: 페이지 이름
 *         example: inventory
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Page'
 *                 - type: object
 *                   properties:
 *                     requiredPermissions:
 *                       type: array
 *                       items: { type: string }
 *                       example: [LIST_READ]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:pageName', ctrl.getPageDetail.bind(ctrl));

module.exports = router;
