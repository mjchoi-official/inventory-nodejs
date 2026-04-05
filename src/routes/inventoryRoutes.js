const { Router }            = require('express');
const ctrl                  = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: 팀 소유 재고 CRUD + 수량 조정 (팀 소속·권한은 서비스 레이어 처리)
 */

// JWT 인증 전체 적용; 세부 권한은 서비스 레이어에서 처리
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: 재고 목록 조회
 *     description: |
 *       내가 소속된 팀(들)의 재고를 모두 반환합니다.
 *       - `teamId` 쿼리 파라미터로 특정 팀만 필터링 가능
 *       - `category` 로 카테고리 필터링
 *       - `lowStock` 이하인 상품만 조회 (재고 부족 알림용)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: teamId
 *         schema: { type: integer }
 *         description: "특정 팀 ID (미입력 시 내 모든 팀)"
 *         example: 1
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: "카테고리 필터"
 *         example: electronics
 *       - in: query
 *         name: lowStock
 *         schema: { type: integer }
 *         description: "해당 수량 이하인 상품만 반환"
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
router.get('/', ctrl.getAll.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory/{id}:
 *   get:
 *     summary: 재고 단건 조회
 *     description: 내 팀 소속 상품 하나를 조회합니다. 타팀 상품은 404 반환.
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 상품 ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', ctrl.getById.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: 재고 생성
 *     description: |
 *       팀에 새 재고를 추가합니다.
 *       - **팀 소속 필수**: 지정 `teamId` 팀에 소속되어 있어야 합니다.
 *       - **WRITE_MODIFY 권한 필수**: `user_team_roles` 에 해당 권한이 있어야 합니다.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, productName, quantity, price, category]
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               productName:
 *                 type: string
 *                 example: 노트북
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 50
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 1500000
 *               category:
 *                 type: string
 *                 example: electronics
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
router.post('/', ctrl.create.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory/{id}:
 *   put:
 *     summary: 재고 수정
 *     description: |
 *       재고 정보를 수정합니다. (WRITE_MODIFY 권한 필요)
 *       - `teamId` 를 생략하면 기존 상품의 팀 ID를 그대로 사용합니다.
 *     tags: [Inventory]
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
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               productName:
 *                 type: string
 *                 example: 노트북 Pro
 *               quantity:
 *                 type: integer
 *                 example: 45
 *               price:
 *                 type: number
 *                 example: 1600000
 *               category:
 *                 type: string
 *                 example: electronics
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
router.put('/:id', ctrl.update.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory/{id}/adjust:
 *   patch:
 *     summary: 재고 수량 조정
 *     description: |
 *       재고 수량을 증감합니다. (WRITE_MODIFY 권한 필요)
 *       - 양수: 입고 / 음수: 출고
 *       - 조정 전후 수량과 사유가 응답에 포함됩니다.
 *     tags: [Inventory]
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
 *             required: [teamId, quantity]
 *             properties:
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 description: "증감 수량 (음수 = 출고)"
 *                 example: -5
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
router.patch('/:id/adjust', ctrl.adjust.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/inventory/{id}:
 *   delete:
 *     summary: 재고 삭제
 *     description: |
 *       재고를 삭제합니다. (DELETE 권한 필요)
 *       - `teamId` 쿼리 파라미터로 팀 지정 (미입력 시 해당 상품의 팀 사용)
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *       - in: query
 *         name: teamId
 *         schema: { type: integer }
 *         description: "팀 ID (선택)"
 *         example: 1
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 삭제 완료 }
 *                 item:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', ctrl.remove.bind(ctrl));

module.exports = router;
