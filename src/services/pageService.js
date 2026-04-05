const pageRepository = require('../repositories/pageRepository');
const { MenuResponseDTO, PageDetailResponseDTO } = require('../dtos/pageDTO');

// ================================================================
// 페이지/메뉴 권한 비즈니스 로직
// ================================================================
class PageService {

  // ──────────────────────────────
  // 사용자가 접근 가능한 메뉴 목록
  // ──────────────────────────────
  async getAccessibleMenu(userId) {
    const pages = await pageRepository.findAccessiblePages(userId);
    return new MenuResponseDTO(pages);
  }

  // ──────────────────────────────
  // 특정 페이지 접근 가능 여부 확인
  // ──────────────────────────────
  async checkPageAccess(userId, pageName) {
    const page = await pageRepository.findByName(pageName);
    if (!page) {
      const err = new Error('존재하지 않는 페이지입니다');
      err.status = 404;
      throw err;
    }

    const canAccess = await pageRepository.canAccess(userId, page.id);
    return {
      pageName,
      canAccess,
      message: canAccess ? '접근 가능합니다' : '접근 권한이 없습니다',
    };
  }

  // ──────────────────────────────
  // 페이지 상세 + 접근 권한 정보
  // ──────────────────────────────
  async getPageDetail(userId, pageName) {
    const page = await pageRepository.findByName(pageName);
    if (!page) {
      const err = new Error('존재하지 않는 페이지입니다');
      err.status = 404;
      throw err;
    }

    const [canAccess, requiredPermissions] = await Promise.all([
      pageRepository.canAccess(userId, page.id),
      pageRepository.getPermissionsByPageId(page.id),
    ]);

    return new PageDetailResponseDTO(page, canAccess, requiredPermissions);
  }
}

module.exports = new PageService();
