const authService = require('../services/authService');

// ================================================================
// JWT 검증 미들웨어
//   Authorization: Bearer <token>  헤더에서 토큰 추출 후 검증
//   검증 성공 → req.user 에 payload 주입 → next()
//   검증 실패 → 401/403 반환
// ================================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader?.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' });
  }

  try {
    req.user = authService.verifyToken(token); // { id, email, username, iat, exp }
    next();
  } catch (err) {
    // TokenExpiredError → 401, JsonWebTokenError → 403
    const status  = err.name === 'TokenExpiredError' ? 401 : 403;
    const message = err.name === 'TokenExpiredError'
      ? '토큰이 만료되었습니다. 다시 로그인해주세요'
      : '유효하지 않은 토큰입니다';
    return res.status(status).json({ error: message });
  }
}

module.exports = { authenticateToken };
