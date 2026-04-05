const { Router }            = require('express');
const ctrl                  = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: 회원가입 / 로그인 / 비밀번호 변경
 */

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 회원가입
 *     description: 새로운 사용자 계정을 생성하고 JWT 토큰을 반환합니다.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 2
 *                 example: john_doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: 이미 사용 중인 이메일
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 이미 사용 중인 이메일입니다
 */
router.post('/register', ctrl.register.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 로그인
 *     description: 이메일과 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "admin123456"
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 이메일 또는 비밀번호가 올바르지 않습니다
 */
router.post('/login', ctrl.login.bind(ctrl));

// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: 비밀번호 변경
 *     description: |
 *       로그인한 사용자의 비밀번호를 변경합니다.
 *       - 기존 비밀번호를 반드시 검증합니다.
 *       - 새 비밀번호는 기존과 달라야 하며 최소 6자 이상이어야 합니다.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 example: "admin123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "newPassword@2026"
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: 비밀번호가 변경되었습니다
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: 기존 비밀번호 불일치 또는 토큰 없음
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/change-password', authenticateToken, ctrl.changePassword.bind(ctrl));

module.exports = router;
