// ================================================================
// 공통 유틸: 검증 에러 생성 (status 400 포함)
// ================================================================
function validationError(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

// ================================================================
// 요청 DTO (Request) — 클라이언트 → 서버
// ================================================================

class CreateInventoryDTO {
  constructor({ teamId, productName, quantity, price, category }) {
    this.teamId      = parseInt(teamId);
    this.productName = productName;
    this.quantity    = parseInt(quantity);
    this.price       = parseFloat(price);
    this.category    = category;
  }

  validate() {
    const errors = [];
    if (!this.teamId || isNaN(this.teamId)) errors.push('teamId는 필수입니다 (숫자)');
    if (!this.productName)                  errors.push('productName은 필수입니다');
    if (isNaN(this.quantity))               errors.push('quantity는 숫자여야 합니다');
    if (isNaN(this.price) || !this.price)   errors.push('price는 필수입니다');
    if (!this.category)                     errors.push('category는 필수입니다');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

class UpdateInventoryDTO {
  constructor({ teamId, productName, quantity, price, category }) {
    this.teamId      = teamId ? parseInt(teamId) : undefined;
    this.productName = productName;
    this.quantity    = quantity    !== undefined ? parseInt(quantity)   : undefined;
    this.price       = price       !== undefined ? parseFloat(price)    : undefined;
    this.category    = category;
  }

  validate() {
    if (this.teamId !== undefined && isNaN(this.teamId))
      throw validationError('teamId는 숫자여야 합니다');
  }
}

class AdjustInventoryDTO {
  constructor({ teamId, quantity, reason }) {
    this.teamId   = parseInt(teamId);
    this.quantity = parseInt(quantity);
    this.reason   = reason || 'manual';
  }

  validate() {
    const errors = [];
    if (!this.teamId || isNaN(this.teamId)) errors.push('teamId는 필수입니다 (숫자)');
    if (isNaN(this.quantity))               errors.push('quantity는 숫자여야 합니다');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

// ================================================================
// 응답 DTO (Response) — 서버 → 클라이언트
// ================================================================

class InventoryResponseDTO {
  constructor({ id, teamId, team_id, productName, quantity, price, category, lastUpdated }) {
    this.id          = id;
    this.teamId      = teamId ?? team_id;   // DB row(snake_case) 또는 직접 지정 모두 수용
    this.productName = productName;
    this.quantity    = quantity;
    this.price       = price;
    this.category    = category;
    this.lastUpdated = lastUpdated;
  }

  // DB row → DTO 변환 팩토리
  static fromRow(row) {
    return new InventoryResponseDTO(row);
  }
}

class InventoryListResponseDTO {
  constructor(items) {
    this.total = items.length;
    this.items = items.map(InventoryResponseDTO.fromRow);
  }
}

class AdjustResponseDTO {
  constructor({ id, productName, oldQuantity, adjustment, newQuantity, reason }) {
    this.id          = id;
    this.productName = productName;
    this.oldQuantity = oldQuantity;
    this.adjustment  = adjustment;
    this.newQuantity = newQuantity;
    this.reason      = reason;
    this.timestamp   = new Date();
  }
}

class DeleteResponseDTO {
  constructor(item) {
    this.message = '삭제 완료';
    this.item    = InventoryResponseDTO.fromRow(item);
  }
}

module.exports = {
  CreateInventoryDTO,
  UpdateInventoryDTO,
  AdjustInventoryDTO,
  InventoryResponseDTO,
  InventoryListResponseDTO,
  AdjustResponseDTO,
  DeleteResponseDTO,
};
