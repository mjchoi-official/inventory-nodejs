const roleRepository = require('../repositories/roleRepository');

// ================================================================
// 권한 검증 미들웨어 팩토리
//   authenticateToken 이후에 사용 (req.user 존재 전제)
// ================================================================

// 하나의 권한 필수
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      const ok = await roleRepository.hasPermission(req.user.id, permissionName);
      if (!ok) {
        return res.status(403).json({ error: `'${permissionName}' 권한이 필요합니다` });
      }
      next();
    } catch (err) { next(err); }
  };
}

// 여러 권한 중 하나 이상 보유 시 통과
function requireAnyPermission(...permissionNames) {
  return async (req, res, next) => {
    try {
      for (const name of permissionNames) {
        const ok = await roleRepository.hasPermission(req.user.id, name);
        if (ok) return next();
      }
      return res.status(403).json({
        error: `'${permissionNames.join("' 또는'")}' 권한 중 하나가 필요합니다`,
      });
    } catch (err) { next(err); }
  };
}

// 여러 권한 모두 보유 시 통과
function requireAllPermissions(...permissionNames) {
  return async (req, res, next) => {
    try {
      for (const name of permissionNames) {
        const ok = await roleRepository.hasPermission(req.user.id, name);
        if (!ok) {
          return res.status(403).json({ error: `'${name}' 권한이 필요합니다` });
        }
      }
      next();
    } catch (err) { next(err); }
  };
}

module.exports = { requirePermission, requireAnyPermission, requireAllPermissions };
