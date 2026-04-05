const sharedRepo = require('../repositories/sharedInventoryRepository');
const roleRepo   = require('../repositories/roleRepository');
const {
  InventoryResponseDTO,
  InventoryListResponseDTO,
  AdjustResponseDTO,
  DeleteResponseDTO,
} = require('../dtos/inventoryDTO');

// ================================================================
// 공유/공용 재고 비즈니스 로직
// ================================================================
class SharedInventoryService {

  // ──────────────────────────────
  // 공유 그룹 생성 (ADMIN 전용)
  // ──────────────────────────────
  async createGroup(userId, { name, description }) {
    if (!name?.trim()) {
      const err = new Error('그룹명은 필수입니다');
      err.status = 400;
      throw err;
    }

    const isAdmin = await roleRepo.isAdmin(userId);
    if (!isAdmin) {
      const err = new Error('ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    const groupId = await sharedRepo.createGroup({ name: name.trim(), description, createdBy: userId });
    const group   = await sharedRepo.findGroupById(groupId);
    return group;
  }

  // ──────────────────────────────
  // 공유 그룹에 팀 추가 (ADMIN 전용)
  // ──────────────────────────────
  async addTeamToGroup(userId, groupId, { teamId, canEdit = false }) {
    await this._assertAdmin(userId);
    await this._assertGroupExists(groupId);

    if (!teamId) {
      const err = new Error('teamId는 필수입니다');
      err.status = 400;
      throw err;
    }
    await sharedRepo.addTeamToGroup({ groupId, teamId: parseInt(teamId), canEdit });
    return { message: '팀이 공유 그룹에 추가되었습니다', groupId, teamId };
  }

  // ──────────────────────────────
  // 공유 그룹 목록 + 소속 팀
  // ──────────────────────────────
  async getGroupList() {
    const groups = await sharedRepo.findAllGroups();
    return await Promise.all(
      groups.map(async (g) => {
        const teams = await sharedRepo.findTeamsByGroupId(g.id);
        return { ...g, teams: teams.map(t => ({ id: t.id, name: t.name, canEdit: t.can_edit })) };
      })
    );
  }

  // ──────────────────────────────
  // 접근 가능한 전체 재고 조회
  //   filters: { category, lowStock, teamId, groupId }
  // ──────────────────────────────
  async getAllAccessible(userId, filters = {}) {
    const rows = await sharedRepo.findAllAccessible(userId, filters);
    return new InventoryListResponseDTO(rows);
  }

  // ──────────────────────────────
  // 특정 그룹 재고 조회
  // ──────────────────────────────
  async getGroupItems(userId, groupId, filters = {}) {
    await this._assertGroupAccess(userId, groupId);
    const rows = await sharedRepo.findByGroupId(groupId, filters);
    return new InventoryListResponseDTO(rows);
  }

  // ──────────────────────────────
  // 전체 공용 재고 조회 (모든 인증 사용자)
  // ──────────────────────────────
  async getPublicItems(filters = {}) {
    const rows = await sharedRepo.findPublic(filters);
    return new InventoryListResponseDTO(rows);
  }

  // ──────────────────────────────
  // 그룹 공유 재고 생성 (canEdit 팀원)
  // ──────────────────────────────
  async createGroupItem(userId, dto) {
    dto.validate();
    const groupId = parseInt(dto.sharedGroupId);

    await this._assertGroupAccess(userId, groupId);
    await this._assertGroupEdit(userId, groupId);

    const insertId = await sharedRepo.createGroupItem({
      userId,
      sharedGroupId: groupId,
      productName:   dto.productName,
      quantity:      dto.quantity,
      price:         dto.price,
      category:      dto.category,
    });
    const row = await sharedRepo.findSharedById(insertId);
    return InventoryResponseDTO.fromRow(row);
  }

  // ──────────────────────────────
  // 전체 공용 재고 생성 (ADMIN 전용)
  // ──────────────────────────────
  async createPublicItem(userId, dto) {
    dto.validate();
    await this._assertAdmin(userId);

    const insertId = await sharedRepo.createPublicItem({
      userId,
      productName: dto.productName,
      quantity:    dto.quantity,
      price:       dto.price,
      category:    dto.category,
    });
    const row = await sharedRepo.findSharedById(insertId);
    return InventoryResponseDTO.fromRow(row);
  }

  // ──────────────────────────────
  // 공유 재고 수정
  //   - 그룹 공유: canEdit 팀원
  //   - 전체 공용: ADMIN
  // ──────────────────────────────
  async updateItem(userId, id, dto) {
    const item = await this._assertSharedExists(id);
    await this._assertWriteAccess(userId, item);

    await sharedRepo.update(id, dto);
    const updated = await sharedRepo.findSharedById(id);
    return InventoryResponseDTO.fromRow(updated);
  }

  // ──────────────────────────────
  // 공유 재고 삭제
  // ──────────────────────────────
  async deleteItem(userId, id) {
    const item = await this._assertSharedExists(id);
    await this._assertWriteAccess(userId, item);

    await sharedRepo.delete(id);
    return new DeleteResponseDTO(item);
  }

  // ──────────────────────────────
  // 공유 재고 수량 증감
  // ──────────────────────────────
  async adjustItem(userId, id, dto) {
    dto.validate();
    const item = await this._assertSharedExists(id);
    await this._assertWriteAccess(userId, item);

    await sharedRepo.adjustQuantity(id, dto.quantity);
    const updated = await sharedRepo.findSharedById(id);

    return new AdjustResponseDTO({
      id:          updated.id,
      productName: updated.productName,
      oldQuantity: item.quantity,
      adjustment:  dto.quantity,
      newQuantity: updated.quantity,
      reason:      dto.reason,
    });
  }

  // ──────────────────────────────
  // 내부 헬퍼
  // ──────────────────────────────

  async _assertAdmin(userId) {
    const ok = await roleRepo.isAdmin(userId);
    if (!ok) {
      const err = new Error('ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }
  }

  async _assertGroupExists(groupId) {
    const group = await sharedRepo.findGroupById(groupId);
    if (!group) {
      const err = new Error('존재하지 않는 공유 그룹입니다');
      err.status = 404;
      throw err;
    }
    return group;
  }

  async _assertGroupAccess(userId, groupId) {
    await this._assertGroupExists(groupId);
    const ok = await sharedRepo.canAccessGroup(userId, groupId);
    if (!ok) {
      const err = new Error('이 공유 그룹에 접근할 권한이 없습니다');
      err.status = 403;
      throw err;
    }
  }

  async _assertGroupEdit(userId, groupId) {
    const ok = await sharedRepo.canEditGroup(userId, groupId);
    if (!ok) {
      const err = new Error('이 공유 그룹을 편집할 권한이 없습니다');
      err.status = 403;
      throw err;
    }
  }

  async _assertSharedExists(id) {
    const item = await sharedRepo.findSharedById(id);
    if (!item) {
      const err = new Error('공유 재고를 찾을 수 없습니다');
      err.status = 404;
      throw err;
    }
    return item;
  }

  /** 쓰기 권한 검증: 그룹 공유면 canEdit, 전체 공용이면 ADMIN */
  async _assertWriteAccess(userId, item) {
    if (item.shared_group_id) {
      await this._assertGroupEdit(userId, item.shared_group_id);
    } else {
      await this._assertAdmin(userId);
    }
  }
}

module.exports = new SharedInventoryService();
