const { Router }            = require('express');
const ctrl                  = require('../controllers/sharedInventoryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Shared Inventory
 *   description: 공유 그룹 관리 및 공용·그룹 재고 CRUD
 */

router.use(authenticateToken);

// ═══════════════════════════════════════════
// 공유 그룹 관리
// ═══════════════════════════════════════════

/**
 * @swagger
 * /api/shared-inventory/groups:
 *   post:
 *     summary: 공유 그룹 생성
 *     description: |
 *       팀들이 함께 사용할 공유 재고 그룹을 생성합니다. **MANAGE_USERS 권한** 필요.
 *       - 생성 후 `/api/shared-inventory/groups/{groupId}/teams` 로 팀을 추가합니다.
 *     tags: [Shared Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 공용 창고
 *               description:
 *                 type: string
 *                 example: 전사 공용 비품 보관소
 *     responses:
 *       201:
 *         description: 공유 그룹 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 공유 그룹이 생성되었습니다 }
 *                 group:
 *                   $ref: '#/components/schemas/SharedGroup'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/groups', requirePermission('MANAGE_USERS'), ctrl.createGroup.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/groups:
 *   get:
 *     summary: 공유 그룹 목록 조회
 *     description: 접근 가능한 모든 공유 그룹 목록을 반환합니다.
 *     tags: [Shared Inventory]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SharedGroup'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/groups', ctrl.getGroups.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/groups/{groupId}/teams:
 *   post:
 *     summary: 공유 그룹에 팀 추가
 *     description: |
 *       공유 그룹에 팀을 추가합니다. **MANAGE_USERS 권한** 필요.
 *       - `canEdit: true` 이면 해당 팀이 그룹 재고를 수정할 수 있습니다.
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId]
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 2
 *               canEdit:
 *                 type: boolean
 *                 default: false
 *                 description: "수정 권한 부여 여부"
 *                 example: true
 *     responses:
 *       201:
 *         description: 팀 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/groups/:groupId/teams',
  requirePermission('MANAGE_USERS'),
  ctrl.addTeamToGroup.bind(ctrl)
);

// ═══════════════════════════════════════════
// 재고 조회
// ═══════════════════════════════════════════

/**
 * @swagger
 * /api/shared-inventory/all:
 *   get:
 *     summary: 전체 접근 가능 재고 조회
 *     description: |
 *       팀 소유 + 공용 공개 + 그룹 공유 재고를 UNION으로 통합 조회합니다.
 *       - `teamId`: 특정 팀 재고만
 *       - `groupId`: 특정 공유 그룹만
 *       - `category`, `lowStock` 필터 지원
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: query
 *         name: teamId
 *         schema: { type: integer }
 *         example: 1
 *       - in: query
 *         name: groupId
 *         schema: { type: integer }
 *         example: 1
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         example: electronics
 *       - in: query
 *         name: lowStock
 *         schema: { type: integer }
 *         example: 10
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductList'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/all', requirePermission('LIST_READ'), ctrl.getAllAccessible.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/groups/{groupId}/items:
 *   get:
 *     summary: 특정 그룹 재고 조회
 *     description: 지정한 공유 그룹의 재고 목록을 반환합니다.
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductList'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/groups/:groupId/items',
  requirePermission('LIST_READ'),
  ctrl.getGroupItems.bind(ctrl)
);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/public:
 *   get:
 *     summary: 공용 공개 재고 조회
 *     description: 전사 공용(`is_shared=TRUE`, `team_id=NULL`, `shared_group_id=NULL`)인 재고를 반환합니다.
 *     tags: [Shared Inventory]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductList'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/public', requirePermission('LIST_READ'), ctrl.getPublicItems.bind(ctrl));

// ═══════════════════════════════════════════
// 재고 생성
// ═══════════════════════════════════════════

/**
 * @swagger
 * /api/shared-inventory/groups/{groupId}/items:
 *   post:
 *     summary: 그룹 공유 재고 생성
 *     description: |
 *       공유 그룹에 재고를 추가합니다.
 *       - 해당 그룹에 `canEdit=TRUE` 로 등록된 팀의 WRITE_MODIFY 권한자만 가능합니다.
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productName, quantity, price, category]
 *             properties:
 *               productName: { type: string,  example: 프로젝터 }
 *               quantity:    { type: integer, example: 5 }
 *               price:       { type: number,  example: 800000 }
 *               category:    { type: string,  example: equipment }
 *     responses:
 *       201:
 *         description: 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/groups/:groupId/items',
  requirePermission('WRITE_MODIFY'),
  ctrl.createGroupItem.bind(ctrl)
);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/public/items:
 *   post:
 *     summary: 공용 공개 재고 생성
 *     description: 전사 공용 재고를 추가합니다. **MANAGE_USERS 권한** (ADMIN 전용).
 *     tags: [Shared Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productName, quantity, price, category]
 *             properties:
 *               productName: { type: string,  example: 화이트보드 마커 }
 *               quantity:    { type: integer, example: 100 }
 *               price:       { type: number,  example: 500 }
 *               category:    { type: string,  example: supplies }
 *     responses:
 *       201:
 *         description: 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/public/items', requirePermission('MANAGE_USERS'), ctrl.createPublicItem.bind(ctrl));

// ═══════════════════════════════════════════
// 재고 수정 / 삭제 / 수량 조정
// ═══════════════════════════════════════════

/**
 * @swagger
 * /api/shared-inventory/{id}:
 *   put:
 *     summary: 공유 재고 수정
 *     description: 공유 재고 정보를 수정합니다. (WRITE_MODIFY 권한 + canEdit 팀 소속 필요)
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productName: { type: string,  example: 프로젝터 HD }
 *               quantity:    { type: integer, example: 4 }
 *               price:       { type: number,  example: 900000 }
 *               category:    { type: string,  example: equipment }
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', requirePermission('WRITE_MODIFY'), ctrl.updateItem.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/{id}:
 *   delete:
 *     summary: 공유 재고 삭제
 *     description: 공유 재고를 삭제합니다. (DELETE 권한 + canEdit 팀 소속 필요)
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', requirePermission('DELETE'), ctrl.deleteItem.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/shared-inventory/{id}/adjust:
 *   patch:
 *     summary: 공유 재고 수량 조정
 *     description: 공유 재고 수량을 증감합니다. (WRITE_MODIFY 권한 + canEdit 팀 소속 필요)
 *     tags: [Shared Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 description: "증감 수량 (음수 = 출고)"
 *                 example: -2
 *               reason:
 *                 type: string
 *                 enum: [sale, purchase, damaged, manual]
 *                 default: manual
 *                 example: sale
 *     responses:
 *       200:
 *         description: 조정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdjustResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/adjust', requirePermission('WRITE_MODIFY'), ctrl.adjustItem.bind(ctrl));

module.exports = router;
