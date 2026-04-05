const inventoryRepository = require('../repositories/inventoryRepository');
const teamRepository      = require('../repositories/teamRepository');
const { getCache, setCache, deleteCache, deleteCacheByPattern } = require('../config/cache');
const {
  InventoryResponseDTO,
  InventoryListResponseDTO,
  AdjustResponseDTO,
  DeleteResponseDTO,
} = require('../dtos/inventoryDTO');

// ================================================================
// 재고 비즈니스 로직 — 팀 기반 격리 + Redis 캐싱
//
// 캐시 키 규칙:
//   inventory:list:user:{userId}:{filterHash}  → 목록 (TTL 300s)
//   inventory:item:{id}:user:{userId}          → 단건 (TTL 300s)
//   inventory:stats:team:{teamId}              → 팀 통계 (TTL 120s)
// ================================================================

// 필터 객체를 캐시 키 문자열로 변환
function _filterHash({ category = '', lowStock = '', teamId = '' } = {}) {
  return `${category}|${lowStock}|${teamId}`;
}

class InventoryService {

  // ──────────────────────────────
  // 전체 조회 (캐시 우선)
  //   filters: { category, lowStock, teamId }
  // ──────────────────────────────
  async getAllInventory(userId, filters = {}) {
    const cacheKey = `inventory:list:user:${userId}:${_filterHash(filters)}`;

    // 캐시 히트 시 즉시 반환
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    // DB 조회
    const rows   = await inventoryRepository.findAllAccessible(userId, filters);
    const result = new InventoryListResponseDTO(rows);

    // 캐시 저장 (5분)
    await setCache(cacheKey, result, 300);
    return result;
  }

  // ──────────────────────────────
  // 단건 조회 (캐시 우선)
  // ──────────────────────────────
  async getInventoryById(userId, id) {
    const cacheKey = `inventory:item:${id}:user:${userId}`;

    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const row = await inventoryRepository.findById(userId, id);
    if (!row) {
      const err = new Error('상품을 찾을 수 없습니다');
      err.status = 404;
      throw err;
    }
    const result = InventoryResponseDTO.fromRow(row);

    await setCache(cacheKey, result, 300);
    return result;
  }

  // ──────────────────────────────
  // 생성 (WRITE_MODIFY 권한 + 팀 소속 검증)
  //   → 해당 사용자 전체 목록 캐시 무효화
  // ──────────────────────────────
  async createInventory(userId, dto) {
    dto.validate();
    const { teamId } = dto;
    await this._assertTeamPermission(userId, teamId, 'WRITE_MODIFY');

    const insertId = await inventoryRepository.create({ userId, ...dto });
    const row      = await inventoryRepository.findById(userId, insertId);

    // 목록 캐시 무효화 (사용자의 모든 필터 변형)
    await deleteCacheByPattern(`inventory:list:user:${userId}:*`);

    return InventoryResponseDTO.fromRow(row);
  }

  // ──────────────────────────────
  // 수정 (WRITE_MODIFY 권한 필요)
  //   → 해당 아이템 + 목록 캐시 무효화
  // ──────────────────────────────
  async updateInventory(userId, id, dto) {
    const existing = await this._assertExists(userId, id);
    const teamId   = dto.teamId ?? existing.team_id;
    await this._assertTeamPermission(userId, teamId, 'WRITE_MODIFY');

    await inventoryRepository.update(id, teamId, dto);
    const updated = await inventoryRepository.findById(userId, id);

    // 캐시 무효화
    await deleteCache(`inventory:item:${id}:user:${userId}`);
    await deleteCacheByPattern(`inventory:list:user:${userId}:*`);

    return InventoryResponseDTO.fromRow(updated);
  }

  // ──────────────────────────────
  // 삭제 (DELETE 권한 필요)
  //   → 해당 아이템 + 목록 캐시 무효화
  // ──────────────────────────────
  async deleteInventory(userId, id, teamId) {
    const existing   = await this._assertExists(userId, id);
    const resolvedId = teamId ?? existing.team_id;
    await this._assertTeamPermission(userId, resolvedId, 'DELETE');

    await inventoryRepository.delete(id, resolvedId);

    // 캐시 무효화
    await deleteCache(`inventory:item:${id}:user:${userId}`);
    await deleteCacheByPattern(`inventory:list:user:${userId}:*`);

    return new DeleteResponseDTO(existing);
  }

  // ──────────────────────────────
  // 재고 증감 (WRITE_MODIFY 권한 필요)
  //   dto: AdjustInventoryDTO (teamId 포함)
  // ──────────────────────────────
  async adjustInventory(userId, id, dto) {
    dto.validate();
    const existing = await this._assertExists(userId, id);
    const teamId   = dto.teamId ?? existing.team_id;
    await this._assertTeamPermission(userId, teamId, 'WRITE_MODIFY');

    await inventoryRepository.adjustQuantity(id, teamId, dto.quantity);
    const updated = await inventoryRepository.findById(userId, id);

    // 캐시 무효화
    await deleteCache(`inventory:item:${id}:user:${userId}`);
    await deleteCacheByPattern(`inventory:list:user:${userId}:*`);

    return new AdjustResponseDTO({
      id:          updated.id,
      productName: updated.productName,
      oldQuantity: existing.quantity,
      adjustment:  dto.quantity,
      newQuantity: updated.quantity,
      reason:      dto.reason,
    });
  }

  // ──────────────────────────────
  // 팀별 통계 (캐시 TTL 120초)
  // ──────────────────────────────
  async getTeamStats(userId, teamId) {
    // 팀 소속 검증
    const inTeam = await teamRepository.isUserInTeam(userId, teamId);
    if (!inTeam) {
      const err = new Error('해당 팀에 소속되어 있지 않습니다');
      err.status = 403;
      throw err;
    }

    const cacheKey = `inventory:stats:team:${teamId}`;
    const cached   = await getCache(cacheKey);
    if (cached) return cached;

    const stats = await inventoryRepository.getStatsByTeam(teamId);
    await setCache(cacheKey, stats, 120);
    return stats;
  }

  // ──────────────────────────────
  // 저재고 알림 조회
  // ──────────────────────────────
  async getLowStockAlerts(userId, teamId, threshold = 10) {
    const inTeam = await teamRepository.isUserInTeam(userId, teamId);
    if (!inTeam) {
      const err = new Error('해당 팀에 소속되어 있지 않습니다');
      err.status = 403;
      throw err;
    }
    return inventoryRepository.findLowStockByTeam(teamId, threshold, 50);
  }

  // ──────────────────────────────
  // 내부 헬퍼: 상품 존재 여부 확인
  // ──────────────────────────────
  async _assertExists(userId, id) {
    const row = await inventoryRepository.findById(userId, id);
    if (!row) {
      const err = new Error('상품을 찾을 수 없습니다');
      err.status = 404;
      throw err;
    }
    return row;
  }

  // ──────────────────────────────
  // 내부 헬퍼: 팀 소속 + 권한 검증
  // ──────────────────────────────
  async _assertTeamPermission(userId, teamId, permissionName) {
    const inTeam = await teamRepository.isUserInTeam(userId, teamId);
    if (!inTeam) {
      const err = new Error('해당 팀에 소속되어 있지 않습니다');
      err.status = 403;
      throw err;
    }
    const hasPermission = await teamRepository.hasPermissionInTeam(userId, teamId, permissionName);
    if (!hasPermission) {
      const err = new Error(`이 팀에서 '${permissionName}' 권한이 없습니다`);
      err.status = 403;
      throw err;
    }
  }
}

module.exports = new InventoryService();
