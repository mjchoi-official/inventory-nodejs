const authService = require('../services/authService');
const { RegisterDTO, LoginDTO, ChangePasswordDTO } = require('../dtos/authDTO');

// ================================================================
// HTTP 요청/응답 처리만 담당
// ================================================================
class AuthController {

  // POST /api/auth/register
  async register(req, res, next) {
    try {
      const dto    = new RegisterDTO(req.body);
      const result = await authService.register(dto);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const dto    = new LoginDTO(req.body);
      const result = await authService.login(dto);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/auth/change-password  (JWT 필수)
  async changePassword(req, res, next) {
    try {
      const dto    = new ChangePasswordDTO(req.body);
      const result = await authService.changePassword(req.user.id, dto);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
