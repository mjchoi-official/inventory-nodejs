// ================================================================
// 공유/공용 재고 전용 DTO
// ================================================================

/**
 * 그룹 공유 재고 생성 DTO
 * POST /api/shared-inventory/groups/:groupId/items
 */
class CreateSharedItemDTO {
  constructor({ sharedGroupId, productName, quantity, price, category }) {
    this.sharedGroupId = parseInt(sharedGroupId);
    this.productName   = productName;
    this.quantity      = parseInt(quantity);
    this.price         = parseFloat(price);
    this.category      = category;
  }

  validate() {
    const errors = [];
    if (!this.sharedGroupId || isNaN(this.sharedGroupId))
      errors.push('sharedGroupId는 필수입니다 (숫자)');
    if (!this.productName)
      errors.push('productName은 필수입니다');
    if (isNaN(this.quantity))
      errors.push('quantity는 숫자여야 합니다');
    if (isNaN(this.price) || !this.price)
      errors.push('price는 필수입니다');
    if (!this.category)
      errors.push('category는 필수입니다');
    if (errors.length) throw new Error(errors.join(', '));
  }
}

/**
 * 공유 그룹 생성 DTO
 * POST /api/shared-inventory/groups
 */
class CreateSharedGroupDTO {
  constructor({ name, description }) {
    this.name        = name?.trim();
    this.description = description?.trim() ?? null;
  }

  validate() {
    if (!this.name) throw new Error('그룹명(name)은 필수입니다');
  }
}

/**
 * 공유 그룹에 팀 추가 DTO
 * POST /api/shared-inventory/groups/:groupId/teams
 */
class AddTeamToGroupDTO {
  constructor({ teamId, canEdit }) {
    this.teamId  = parseInt(teamId);
    this.canEdit = canEdit === true || canEdit === 'true';
  }

  validate() {
    if (!this.teamId || isNaN(this.teamId))
      throw new Error('teamId는 필수입니다 (숫자)');
  }
}

module.exports = { CreateSharedItemDTO, CreateSharedGroupDTO, AddTeamToGroupDTO };
