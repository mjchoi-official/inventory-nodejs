// ================================================================
// 공통 유틸: 검증 에러 생성 (status 400 포함)
// ================================================================
function validationError(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

// ================================================================
// 요청 DTO (Request)
// ================================================================

class RegisterDTO {
  constructor({ username, email, password }) {
    this.username = username?.trim();
    this.email    = email?.trim().toLowerCase();
    this.password = password;
  }

  validate() {
    const errors = [];
    if (!this.username || this.username.length < 2)
      errors.push('username은 2자 이상이어야 합니다');
    if (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email))
      errors.push('유효한 이메일 형식이 아닙니다');
    if (!this.password || this.password.length < 6)
      errors.push('password는 6자 이상이어야 합니다');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

class LoginDTO {
  constructor({ email, password }) {
    this.email    = email?.trim().toLowerCase();
    this.password = password;
  }

  validate() {
    const errors = [];
    if (!this.email)    errors.push('email은 필수입니다');
    if (!this.password) errors.push('password는 필수입니다');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

// ================================================================
// 응답 DTO (Response)
// ================================================================

class UserResponseDTO {
  constructor({ id, username, email, createdAt }) {
    this.id        = id;
    this.username  = username;
    this.email     = email;
    this.createdAt = createdAt;
  }

  static fromRow(row) {
    return new UserResponseDTO(row);
  }
}

class TokenResponseDTO {
  constructor(token, user) {
    this.token = token;
    this.user  = UserResponseDTO.fromRow(user);
  }
}

// ================================================================
// 비밀번호 변경 DTO
// ================================================================

class ChangePasswordDTO {
  constructor({ oldPassword, newPassword }) {
    this.oldPassword = oldPassword;
    this.newPassword = newPassword;
  }

  validate() {
    const errors = [];
    if (!this.oldPassword)
      errors.push('기존 비밀번호는 필수입니다');
    if (!this.newPassword || this.newPassword.length < 6)
      errors.push('새 비밀번호는 6자 이상이어야 합니다');
    if (this.oldPassword && this.newPassword && this.oldPassword === this.newPassword)
      errors.push('기존 비밀번호와 다른 비밀번호를 입력하세요');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

module.exports = {
  RegisterDTO,
  LoginDTO,
  UserResponseDTO,
  TokenResponseDTO,
  ChangePasswordDTO,
};
