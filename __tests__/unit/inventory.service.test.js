/**
 * inventory.service.test.js — InventoryService 단위 테스트
 */

process.env.JWT_SECRET  = 'test-jwt-secret';
process.env.JWT_EXPIRES = '1h';

jest.mock('../../src/repositories/inventoryRepository');
jest.mock('../../src/repositories/teamRepository');
// 캐시 모듈 mock — 단위 테스트에서 Redis 불필요
jest.mock('../../src/config/cache', () => ({
  getCache:             jest.fn().mockResolvedValue(null),
  setCache:             jest.fn().mockResolvedValue(undefined),
  deleteCache:          jest.fn().mockResolvedValue(undefined),
  deleteCacheByPattern: jest.fn().mockResolvedValue(undefined),
}));

const inventoryService    = require('../../src/services/inventoryService');
const inventoryRepository = require('../../src/repositories/inventoryRepository');
const teamRepository      = require('../../src/repositories/teamRepository');
const {
  CreateInventoryDTO,
  UpdateInventoryDTO,
  AdjustInventoryDTO,
} = require('../../src/dtos/inventoryDTO');

// 공통 샘플 row
const sampleRow = {
  id: 1, team_id: 10, productName: '노트북',
  quantity: 50, price: 1500000, category: 'electronics', lastUpdated: new Date(),
};

describe('InventoryService — 단위 테스트', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getAllInventory() ────────────────────────────────
  describe('getAllInventory()', () => {
    it('소속 팀 재고 목록 반환', async () => {
      inventoryRepository.findAllAccessible.mockResolvedValue([sampleRow]);

      const result = await inventoryService.getAllInventory(1, {});

      expect(result.total).toBe(1);
      expect(result.items[0].productName).toBe('노트북');
    });

    it('팀 없는 사용자 — 빈 배열', async () => {
      inventoryRepository.findAllAccessible.mockResolvedValue([]);

      const result = await inventoryService.getAllInventory(99, {});

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('category 필터 전달 확인', async () => {
      inventoryRepository.findAllAccessible.mockResolvedValue([sampleRow]);

      await inventoryService.getAllInventory(1, { category: 'electronics' });

      expect(inventoryRepository.findAllAccessible).toHaveBeenCalledWith(
        1, expect.objectContaining({ category: 'electronics' })
      );
    });
  });

  // ── getInventoryById() ───────────────────────────────
  describe('getInventoryById()', () => {
    it('존재하는 상품 — DTO 반환', async () => {
      inventoryRepository.findById.mockResolvedValue(sampleRow);

      const result = await inventoryService.getInventoryById(1, 1);

      expect(result.id).toBe(1);
      expect(result.productName).toBe('노트북');
    });

    it('존재하지 않는 상품 — 404 에러', async () => {
      inventoryRepository.findById.mockResolvedValue(null);

      await expect(inventoryService.getInventoryById(1, 999)).rejects.toMatchObject({
        status: 404, message: expect.stringContaining('찾을 수 없습니다'),
      });
    });
  });

  // ── createInventory() ────────────────────────────────
  describe('createInventory()', () => {
    it('WRITE_MODIFY 권한 보유 시 생성 성공', async () => {
      teamRepository.isUserInTeam.mockResolvedValue(true);
      teamRepository.hasPermissionInTeam.mockResolvedValue(true);
      inventoryRepository.create.mockResolvedValue(5);
      inventoryRepository.findById.mockResolvedValue({ ...sampleRow, id: 5 });

      const dto    = new CreateInventoryDTO({ teamId: 10, productName: '모니터', quantity: 10, price: 500000, category: 'electronics' });
      const result = await inventoryService.createInventory(1, dto);

      expect(result.id).toBe(5);
      expect(inventoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 10, productName: '모니터' })
      );
    });

    it('팀 미소속 — 403 에러', async () => {
      teamRepository.isUserInTeam.mockResolvedValue(false);

      const dto = new CreateInventoryDTO({ teamId: 10, productName: '모니터', quantity: 10, price: 500000, category: 'electronics' });
      await expect(inventoryService.createInventory(1, dto)).rejects.toMatchObject({ status: 403 });
    });

    it('WRITE_MODIFY 권한 없음 — 403 에러', async () => {
      teamRepository.isUserInTeam.mockResolvedValue(true);
      teamRepository.hasPermissionInTeam.mockResolvedValue(false);

      const dto = new CreateInventoryDTO({ teamId: 10, productName: '모니터', quantity: 10, price: 500000, category: 'electronics' });
      await expect(inventoryService.createInventory(1, dto)).rejects.toMatchObject({ status: 403 });
    });
  });

  // ── CreateInventoryDTO 유효성 검사 ──────────────────
  describe('CreateInventoryDTO.validate()', () => {
    it('teamId 없음 — 에러', () => {
      const dto = new CreateInventoryDTO({ productName: 'X', quantity: 1, price: 100, category: 'A' });
      expect(() => dto.validate()).toThrow('teamId는 필수');
    });

    it('productName 없음 — 에러', () => {
      const dto = new CreateInventoryDTO({ teamId: 1, quantity: 1, price: 100, category: 'A' });
      expect(() => dto.validate()).toThrow('productName은 필수');
    });

    it('price 없음 — 에러', () => {
      const dto = new CreateInventoryDTO({ teamId: 1, productName: 'X', quantity: 1, category: 'A' });
      expect(() => dto.validate()).toThrow('price는 필수');
    });
  });

  // ── updateInventory() ────────────────────────────────
  describe('updateInventory()', () => {
    it('수정 성공 — 업데이트된 DTO 반환', async () => {
      const updatedRow = { ...sampleRow, productName: '업데이트 노트북', quantity: 30 };
      inventoryRepository.findById
        .mockResolvedValueOnce(sampleRow)    // _assertExists
        .mockResolvedValueOnce(updatedRow);  // 최종 조회
      teamRepository.isUserInTeam.mockResolvedValue(true);
      teamRepository.hasPermissionInTeam.mockResolvedValue(true);
      inventoryRepository.update.mockResolvedValue(true);

      const dto    = new UpdateInventoryDTO({ productName: '업데이트 노트북', quantity: 30 });
      const result = await inventoryService.updateInventory(1, 1, dto);

      expect(result.productName).toBe('업데이트 노트북');
      expect(result.quantity).toBe(30);
    });
  });

  // ── deleteInventory() ────────────────────────────────
  describe('deleteInventory()', () => {
    it('DELETE 권한 보유 시 삭제 성공', async () => {
      inventoryRepository.findById.mockResolvedValue(sampleRow);
      teamRepository.isUserInTeam.mockResolvedValue(true);
      teamRepository.hasPermissionInTeam.mockResolvedValue(true);
      inventoryRepository.delete.mockResolvedValue(true);

      const result = await inventoryService.deleteInventory(1, 1, 10);

      expect(result.message).toContain('삭제 완료');
      expect(inventoryRepository.delete).toHaveBeenCalledWith(1, 10);
    });

    it('DELETE 권한 없음 — 403 에러', async () => {
      inventoryRepository.findById.mockResolvedValue(sampleRow);
      teamRepository.isUserInTeam.mockResolvedValue(true);
      // hasPermissionInTeam: 첫 호출(권한 확인)은 false
      teamRepository.hasPermissionInTeam.mockResolvedValue(false);

      await expect(inventoryService.deleteInventory(1, 1, 10)).rejects.toMatchObject({ status: 403 });
    });
  });

  // ── adjustInventory() ────────────────────────────────
  describe('adjustInventory()', () => {
    it('재고 감소 — oldQty/newQty/adjustment 반환', async () => {
      const adjustedRow = { ...sampleRow, quantity: 45 };
      inventoryRepository.findById
        .mockResolvedValueOnce(sampleRow)      // _assertExists (qty=50)
        .mockResolvedValueOnce(adjustedRow);   // 조정 후 (qty=45)
      teamRepository.isUserInTeam.mockResolvedValue(true);
      teamRepository.hasPermissionInTeam.mockResolvedValue(true);
      inventoryRepository.adjustQuantity.mockResolvedValue(true);

      const dto    = new AdjustInventoryDTO({ teamId: 10, quantity: -5, reason: 'sale' });
      const result = await inventoryService.adjustInventory(1, 1, dto);

      expect(result.oldQuantity).toBe(50);
      expect(result.adjustment).toBe(-5);
      expect(result.newQuantity).toBe(45);
      expect(result.reason).toBe('sale');
    });

    it('AdjustInventoryDTO — teamId 없음 에러', () => {
      const dto = new AdjustInventoryDTO({ quantity: -5 });
      expect(() => dto.validate()).toThrow('teamId는 필수');
    });
  });
});
