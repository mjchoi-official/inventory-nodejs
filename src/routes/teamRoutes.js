const { Router }            = require('express');
const ctrl                  = require('../controllers/teamController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Teams
 *   description: 팀 생성·조회 및 팀원 관리
 */

router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: 팀 생성
 *     description: |
 *       새로운 팀을 생성합니다. **ADMIN 역할** 이 있어야 합니다.
 *       - `parentTeamId` 를 지정하면 하위 팀을 만들 수 있습니다.
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, leaderId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 개발팀
 *               description:
 *                 type: string
 *                 example: 백엔드 개발
 *               leaderId:
 *                 type: integer
 *                 description: 팀장 사용자 ID
 *                 example: 2
 *               parentTeamId:
 *                 type: integer
 *                 nullable: true
 *                 description: 상위 팀 ID (하위 팀 생성 시)
 *                 example: null
 *     responses:
 *       201:
 *         description: 팀 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 팀이 생성되었습니다 }
 *                 team:
 *                   type: object
 *                   properties:
 *                     id:          { type: integer, example: 1 }
 *                     name:        { type: string,  example: 개발팀 }
 *                     description: { type: string,  example: 백엔드 개발 }
 *                     leaderId:    { type: integer, example: 2 }
 *                     createdAt:   { type: string,  format: date-time }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: 팀 이름 중복
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 이미 사용 중인 팀 이름입니다
 */
router.post('/', ctrl.create.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/teams/my:
 *   get:
 *     summary: 내 팀 목록 조회
 *     description: 로그인한 사용자가 소속된 모든 팀과 각 팀의 권한을 반환합니다.
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TeamWithPermissions'
 *             example:
 *               teams:
 *                 - id: 1
 *                   name: 개발팀
 *                   description: 백엔드 개발
 *                   leaderId: 2
 *                   isPrimary: true
 *                   permissions: [LIST_READ, WRITE_MODIFY, DELETE]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/my', ctrl.getMyTeams.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/teams/{teamId}/members:
 *   post:
 *     summary: 팀원 추가
 *     description: |
 *       팀에 사용자를 추가합니다. **팀장 또는 ADMIN** 이어야 합니다.
 *       - `permissionName` 으로 해당 팀에서의 권한을 지정합니다.
 *       - `isPrimary: true` 이면 본팀으로 설정합니다.
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: integer }
 *         description: 팀 ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, permissionName]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *               permissionName:
 *                 type: string
 *                 enum: [LIST_READ, WRITE_MODIFY, DELETE, DOWNLOAD]
 *                 example: WRITE_MODIFY
 *               isPrimary:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *     responses:
 *       201:
 *         description: 팀원 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:    { type: string,  example: 사용자가 팀에 추가되었습니다 }
 *                 userId:     { type: integer, example: 5 }
 *                 teamId:     { type: integer, example: 1 }
 *                 permission: { type: string,  example: WRITE_MODIFY }
 *                 isPrimary:  { type: boolean, example: false }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:teamId/members', ctrl.addMember.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/teams/{teamId}/members/{userId}:
 *   delete:
 *     summary: 팀원 제거
 *     description: 팀에서 사용자를 제거합니다. **팀장 또는 ADMIN** 이어야 합니다.
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: 제거할 사용자 ID
 *         example: 5
 *     responses:
 *       200:
 *         description: 팀원 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string,  example: 사용자가 팀에서 제거되었습니다 }
 *                 userId:  { type: integer, example: 5 }
 *                 teamId:  { type: integer, example: 1 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:teamId/members/:userId', ctrl.removeMember.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/teams/{teamId}/members:
 *   get:
 *     summary: 팀원 목록 조회
 *     description: |
 *       팀에 속한 모든 팀원을 조회합니다.
 *       - 해당 팀의 팀원이거나 ADMIN 이어야 합니다.
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/User'
 *                   - type: object
 *                     properties:
 *                       permissions:
 *                         type: array
 *                         items: { type: string }
 *                         example: [LIST_READ, WRITE_MODIFY]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:teamId/members', ctrl.getMembers.bind(ctrl));

module.exports = router;
