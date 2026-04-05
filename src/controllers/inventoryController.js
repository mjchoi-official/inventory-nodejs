const inventoryService = require('../services/inventoryService');
const {
  CreateInventoryDTO,
  UpdateInventoryDTO,
  AdjustInventoryDTO,
} = require('../dtos/inventoryDTO');

// ================================================================
// HTTP 요청/응답 처리만 담당
// req.user.id → authMiddleware 에서 주입된 인증된 사용자 ID
// ================================================================
class InventoryController {

  // GET /api/inventory
  // Query: ?category=electronics&lowStock=100&teamId=1
  async getAll(req, res, next) {
    try {
      const result = await inventoryService.getAllInventory(req.user.id, {
        category: req.query.category,
        lowStock: req.query.lowStock,
        teamId:   req.query.teamId,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /api/inventory/:id
  async getById(req, res, next) {
    try {
      const result = await inventoryService.getInventoryById(req.user.id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  // POST /api/inventory
  // Body: { teamId, productName, quantity, price, category }
  async create(req, res, next) {
    try {
      const dto    = new CreateInventoryDTO(req.body);
      const result = await inventoryService.createInventory(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // PUT /api/inventory/:id
  // Body: { teamId?, productName?, quantity?, price?, category? }
  async update(req, res, next) {
    try {
      const dto    = new UpdateInventoryDTO(req.body);
      const result = await inventoryService.updateInventory(req.user.id, req.params.id, dto);
      res.json(result);
    } catch (err) { next(err); }
  }

  // DELETE /api/inventory/:id
  // Query (선택): ?teamId=1
  async remove(req, res, next) {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId) : undefined;
      const result = await inventoryService.deleteInventory(req.user.id, req.params.id, teamId);
      res.json(result);
    } catch (err) { next(err); }
  }

  // PATCH /api/inventory/:id/adjust
  // Body: { teamId, quantity, reason? }
  async adjust(req, res, next) {
    try {
      const dto    = new AdjustInventoryDTO(req.body);
      const result = await inventoryService.adjustInventory(req.user.id, req.params.id, dto);
      res.json(result);
    } catch (err) { next(err); }
  }
}

module.exports = new InventoryController();
