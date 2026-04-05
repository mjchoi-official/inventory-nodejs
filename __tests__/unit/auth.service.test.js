/**
 * auth.service.test.js — AuthService 단위 테스트
 * DB 없이 Repository를 mock 처리하여 순수 비즈니스 로직 검증
 */

// 환경변수 설정 (테스트 전)
process.env.JWT_SECRET  = 'test-jwt-secret';
process.env.JWT_EXPIRES = '1h';

jest.mock('../../src/repositories/userRepository');
jest.mock('../../src/repositories/roleRepository');

const bcrypt         = require('bcryptjs');
const authService    = require('../../src/services/authService');
const userRepository = require('../../src/repositories/userRepository');
const { RegisterDTO, LoginDTO, ChangePasswordDTO } = require('../../src/dtos/authDTO');

// ──────────────────────────────────────────────────────
describe('AuthService — 단위 테스트', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── RegisterDTO 유효성 검사 ──────────────────────────
  describe('RegisterDTO.validate()', () => {
    it('유효한 데이터 — 검증 통과', () => {
      const dto = new RegisterDTO({ username: 'alice', email: 'alice@test.com', password: 'pass1234' });
      expect(() => dto.validate()).not.toThrow();
    });

    it('username 1자 — 에러', () => {
      const dto = new RegisterDTO({ username: 'a', email: 'a@test.com', password: 'pass1234' });
      expect(() => dto.validate()).toThrow('username은 2자 이상');
    });

    it('잘못된 이메일 형식 — 에러', () => {
      const dto = new RegisterDTO({ username: 'alice', email: 'not-an-email', password: 'pass1234' });
      expect(() => dto.validate()).toThrow('이메일 형식');
    });

    it('비밀번호 5자 — 에러', () => {
      const dto = new RegisterDTO({ username: 'alice', email: 'a@test.com', password: '12345' });
      expect(() => dto.validate()).toThrow('6자 이상');
    });
  });

  // ── register() ──────────────────────────────────────
  describe('register()', () => {
    it('정상 가입 — token + user 반환', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(1);
      userRepository.findById.mockResolvedValue({
        id: 1, username: 'alice', email: 'alice@test.com', createdAt: new Date(),
      });

      const dto    = new RegisterDTO({ username: 'alice', email: 'alice@test.com', password: 'pass1234' });
      const result = await authService.register(dto);

      expect(result).toHaveProperty('token');
      expect(result.user.username).toBe('alice');
      expect(result.user.email).toBe('alice@test.com');
    });

    it('중복 이메일 — 409 에러', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 1, email: 'alice@test.com' });

      const dto = new RegisterDTO({ username: 'alice', email: 'alice@test.com', password: 'pass1234' });
      await expect(authService.register(dto)).rejects.toMatchObject({
        message: expect.stringContaining('이미 사용 중인 이메일'),
        status:  409,
      });
    });

    it('비밀번호가 bcrypt 해시로 저장되는지 확인', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 2, username: 'bob', email: 'bob@test.com', createdAt: new Date(),
      });

      let savedHash = '';
      userRepository.create.mockImplementation(async ({ hashedPassword }) => {
        savedHash = hashedPassword;
        return 2;
      });

      const dto = new RegisterDTO({ username: 'bob', email: 'bob@test.com', password: 'mypassword' });
      await authService.register(dto);

      // 저장된 값이 bcrypt 해시인지 확인
      expect(savedHash).toMatch(/^\$2[aby]\$/);
      const isMatch = await bcrypt.compare('mypassword', savedHash);
      expect(isMatch).toBe(true);
    });
  });

  // ── login() ─────────────────────────────────────────
  describe('login()', () => {
    it('올바른 비밀번호 — token + user 반환', async () => {
      const hash = await bcrypt.hash('pass1234', 10);
      userRepository.findByEmail.mockResolvedValue({
        id: 1, username: 'alice', email: 'alice@test.com', password: hash, createdAt: new Date(),
      });

      const dto    = new LoginDTO({ email: 'alice@test.com', password: 'pass1234' });
      const result = await authService.login(dto);

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('alice@test.com');
    });

    it('잘못된 비밀번호 — 401 에러', async () => {
      const hash = await bcrypt.hash('pass1234', 10);
      userRepository.findByEmail.mockResolvedValue({
        id: 1, email: 'alice@test.com', password: hash,
      });

      const dto = new LoginDTO({ email: 'alice@test.com', password: 'WRONG' });
      await expect(authService.login(dto)).rejects.toMatchObject({ status: 401 });
    });

    it('존재하지 않는 이메일 — 401 에러', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const dto = new LoginDTO({ email: 'ghost@test.com', password: 'pass1234' });
      await expect(authService.login(dto)).rejects.toMatchObject({ status: 401 });
    });
  });

  // ── verifyToken() ────────────────────────────────────
  describe('verifyToken()', () => {
    it('유효한 토큰 — payload 반환', async () => {
      // register로 토큰 생성
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(3);
      userRepository.findById.mockResolvedValue({
        id: 3, username: 'charlie', email: 'charlie@test.com', createdAt: new Date(),
      });
      const { token } = await authService.register(
        new RegisterDTO({ username: 'charlie', email: 'charlie@test.com', password: 'pass1234' })
      );

      const payload = authService.verifyToken(token);
      expect(payload.id).toBe(3);
      expect(payload.email).toBe('charlie@test.com');
    });

    it('위조된 토큰 — 에러 throw', () => {
      expect(() => authService.verifyToken('fake.token.here')).toThrow();
    });
  });

  // ── changePassword() ─────────────────────────────────
  describe('changePassword()', () => {
    it('올바른 기존 비밀번호 — 변경 성공', async () => {
      const oldHash = await bcrypt.hash('oldpass', 10);
      userRepository.findById.mockResolvedValue({
        id: 1, password: oldHash,
      });
      userRepository.updatePassword = jest.fn().mockResolvedValue();

      const dto    = new ChangePasswordDTO({ oldPassword: 'oldpass', newPassword: 'newpass123' });
      const result = await authService.changePassword(1, dto);

      expect(result.message).toContain('비밀번호가 변경');
      expect(userRepository.updatePassword).toHaveBeenCalled();
    });

    it('기존 비밀번호 불일치 — 401 에러', async () => {
      const oldHash = await bcrypt.hash('oldpass', 10);
      userRepository.findById.mockResolvedValue({ id: 1, password: oldHash });

      const dto = new ChangePasswordDTO({ oldPassword: 'WRONG', newPassword: 'newpass123' });
      await expect(authService.changePassword(1, dto)).rejects.toMatchObject({ status: 401 });
    });

    it('동일 비밀번호 변경 시도 — DTO 유효성 에러', () => {
      const dto = new ChangePasswordDTO({ oldPassword: 'same', newPassword: 'same' });
      expect(() => dto.validate()).toThrow('다른 비밀번호');
    });
  });
});
