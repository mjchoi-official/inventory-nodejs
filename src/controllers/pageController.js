const pageService = require('../services/pageService');

// ================================================================
// HTTP 요청/응답 처리만 담당
// ================================================================
class PageController {

  // GET /api/pages/menu
  async getAccessibleMenu(req, res, next) {
    try {
      const result = await pageService.getAccessibleMenu(req.user.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /api/pages/check/:pageName
  async checkAccess(req, res, next) {
    try {
      const result = await pageService.checkPageAccess(
        req.user.id,
        decodeURIComponent(req.params.pageName)
      );
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /api/pages/:pageName
  async getPageDetail(req, res, next) {
    try {
      const result = await pageService.getPageDetail(
        req.user.id,
        decodeURIComponent(req.params.pageName)
      );
      // 접근 불가능한 경우에도 정보는 반환하되 403 상태코드 사용
      if (!result.canAccess) {
        return res.status(403).json({
          error:               '접근 권한이 없습니다',
          requiredPermissions: result.requiredPermissions,
        });
      }
      res.json(result);
    } catch (err) { next(err); }
  }
}

module.exports = new PageController();
