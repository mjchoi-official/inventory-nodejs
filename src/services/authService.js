const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const userRepository  = require('../repositories/userRepository');
const { TokenResponseDTO } = require('../dtos/authDTO');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change-this-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ================================================================
// 인증 비즈니스 로직 담당
// ================================================================
class AuthService {

  // ──────────────────────────────
  // 회원가입
  // ──────────────────────────────
  async register(dto) {
    dto.validate();

    // 중복 이메일 확인
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      const err = new Error('이미 사용 중인 이메일입니다');
      err.status = 409;
      throw err;
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 사용자 생성
    const insertId = await userRepository.create({
      username:       dto.username,
      email:          dto.email,
      hashedPassword,
    });

    const user  = await userRepository.findById(insertId);
    const token = this._generateToken(user);
    return new TokenResponseDTO(token, user);
  }

  // ──────────────────────────────
  // 로그인
  // ──────────────────────────────
  async login(dto) {
    dto.validate();

    // 사용자 조회
    const user = await userRepository.findByEmail(dto.email);
    if (!user) {
      const err = new Error('이메일 또는 비밀번호가 올바르지 않습니다');
      err.status = 401;
      throw err;
    }

    // 비밀번호 검증
    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      const err = new Error('이메일 또는 비밀번호가 올바르지 않습니다');
      err.status = 401;
      throw err;
    }

    const token = this._generateToken(user);
    return new TokenResponseDTO(token, user);
  }

  // ──────────────────────────────
  // 토큰 생성 (내부용)
  // ──────────────────────────────
  _generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
  }

  // ──────────────────────────────
  // 토큰 검증 (미들웨어에서 호출)
  // ──────────────────────────────
  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET); // 실패 시 JsonWebTokenError throw
  }

  // ──────────────────────────────
  // 비밀번호 변경
  // ──────────────────────────────
  async changePassword(userId, dto) {
    dto.validate();

    // 사용자 조회
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('사용자를 찾을 수 없습니다');
      err.status = 404;
      throw err;
    }

    // 기존 비밀번호 검증
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      const err = new Error('기존 비밀번호가 일치하지 않습니다');
      err.status = 401;
      throw err;
    }

    // 새 비밀번호 해싱 후 저장
    const newHashed = await bcrypt.hash(dto.newPassword, 10);
    await userRepository.updatePassword(userId, newHashed);

    return { message: '비밀번호가 변경되었습니다' };
  }
}

module.exports = new AuthService();
