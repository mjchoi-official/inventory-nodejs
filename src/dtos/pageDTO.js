// ================================================================
// 응답 DTO
// ================================================================

class PageDetailResponseDTO {
  constructor(page, canAccess, requiredPermissions) {
    this.id                  = page.id;
    this.name                = page.name;
    this.path                = page.path;
    this.description         = page.description;
    this.icon                = page.icon;
    this.canAccess           = canAccess;
    this.requiredPermissions = requiredPermissions.map(p => p.name);
  }
}

class MenuItemDTO {
  constructor(page) {
    this.id       = page.id;
    this.name     = page.name;
    this.path     = page.path;
    this.icon     = page.icon;
    this.order    = page.order_num;
    this.parentId = page.parent_id ?? null;
  }
}

class MenuResponseDTO {
  constructor(pages) {
    this.menu = pages.map(p => new MenuItemDTO(p));
  }
}

module.exports = {
  PageDetailResponseDTO,
  MenuItemDTO,
  MenuResponseDTO,
};
