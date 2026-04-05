const { Router }            = require('express');
const ctrl                  = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: 역할·권한 할당 및 조회
 */

router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/me:
 *   get:
 *     summary: 내 역할·권한 조회
 *     description: 로그인한 사용자의 역할(roles)과 권한(permissions) 목록을 반환합니다.
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items: { type: string }
 *                   example: [ADMIN]
 *                 permissions:
 *                   type: array
 *                   items: { type: string }
 *                   example: [LIST_READ, WRITE_MODIFY, DELETE, DOWNLOAD, MANAGE_USERS]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', ctrl.getMyPermissions.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/assign:
 *   post:
 *     summary: 역할 할당
 *     description: |
 *       사용자에게 역할을 할당합니다. **MANAGE_USERS 권한** 이 필요합니다.
 *       - 역할: `ADMIN`, `SUB_ADMIN`, `USER`
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, roleName]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 2
 *               roleName:
 *                 type: string
 *                 enum: [ADMIN, SUB_ADMIN, USER]
 *                 example: SUB_ADMIN
 *     responses:
 *       201:
 *         description: 역할 할당 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:  { type: string, example: 역할이 할당되었습니다 }
 *                 userId:   { type: integer, example: 2 }
 *                 roleName: { type: string,  example: SUB_ADMIN }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: 사용자 또는 역할 없음
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/assign', requirePermission('MANAGE_USERS'), ctrl.assignRole.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/remove:
 *   delete:
 *     summary: 역할 제거
 *     description: 사용자로부터 역할을 제거합니다. **MANAGE_USERS 권한** 이 필요합니다.
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, roleName]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 2
 *               roleName:
 *                 type: string
 *                 enum: [ADMIN, SUB_ADMIN, USER]
 *                 example: SUB_ADMIN
 *     responses:
 *       200:
 *         description: 역할 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/remove', requirePermission('MANAGE_USERS'), ctrl.removeRole.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/team:
 *   post:
 *     summary: SUB_ADMIN 팀원 등록
 *     description: |
 *       SUB_ADMIN이 관리할 팀원을 등록합니다. **SUB_ADMIN 역할** 이 필요합니다.
 *       - `sub_admin_teams` 테이블에 매핑됩니다.
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamMemberId]
 *             properties:
 *               teamMemberId:
 *                 type: integer
 *                 description: 등록할 팀원 사용자 ID
 *                 example: 3
 *     responses:
 *       201:
 *         description: 팀원 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/team', ctrl.addTeamMember.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/team/{memberId}:
 *   delete:
 *     summary: SUB_ADMIN 팀원 제거
 *     description: SUB_ADMIN이 관리하는 팀원을 제거합니다.
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: integer }
 *         description: 제거할 팀원 사용자 ID
 *         example: 3
 *     responses:
 *       200:
 *         description: 팀원 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/team/:memberId', ctrl.removeTeamMember.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/roles/team:
 *   get:
 *     summary: SUB_ADMIN 팀원 목록 조회
 *     description: SUB_ADMIN이 관리하는 팀원 목록을 반환합니다.
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/team', ctrl.getTeamMembers.bind(ctrl));

module.exports = router;
