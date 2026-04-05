const sharedInventoryService = require('../services/sharedInventoryService');
const {
  CreateInventoryDTO,
  UpdateInventoryDTO,
  AdjustInventoryDTO,
} = require('../dtos/inventoryDTO');
const { CreateSharedItemDTO } = require('../dtos/sharedInventoryDTO');

// ================================================================
// HTTP 요청/응답 처리만 담당
// ================================================================
class SharedInventoryController {

  // ──────────────────────────────
  // POST /api/shared-inventory/groups
  // Body: { name, description }
  // ──────────────────────────────
  async createGroup(req, res, next) {
    try {
      const result = await sharedInventoryService.createGroup(req.user.id, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // GET /api/shared-inventory/groups
  // ──────────────────────────────
  async getGroups(req, res, next) {
    try {
      const result = await sharedInventoryService.getGroupList();
      res.json({ groups: result });
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // POST /api/shared-inventory/groups/:groupId/teams
  // Body: { teamId, canEdit }
  // ──────────────────────────────
  async addTeamToGroup(req, res, next) {
    try {
      const result = await sharedInventoryService.addTeamToGroup(
        req.user.id,
        parseInt(req.params.groupId),
        req.body
      );
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // GET /api/shared-inventory/all
  // Query: ?category=&lowStock=&teamId=&groupId=
  // ──────────────────────────────
  async getAllAccessible(req, res, next) {
    try {
      const result = await sharedInventoryService.getAllAccessible(req.user.id, {
        category: req.query.category,
        lowStock: req.query.lowStock,
        teamId:   req.query.teamId,
        groupId:  req.query.groupId,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // GET /api/shared-inventory/groups/:groupId/items
  // ──────────────────────────────
  async getGroupItems(req, res, next) {
    try {
      const result = await sharedInventoryService.getGroupItems(
        req.user.id,
        parseInt(req.params.groupId),
        { category: req.query.category, lowStock: req.query.lowStock }
      );
      res.json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // GET /api/shared-inventory/public
  // ──────────────────────────────
  async getPublicItems(req, res, next) {
    try {
      const result = await sharedInventoryService.getPublicItems({
        category: req.query.category,
        lowStock: req.query.lowStock,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // POST /api/shared-inventory/groups/:groupId/items
  // Body: { productName, quantity, price, category }
  // ──────────────────────────────
  async createGroupItem(req, res, next) {
    try {
      const dto = new CreateSharedItemDTO({
        ...req.body,
        sharedGroupId: req.params.groupId,
      });
      const result = await sharedInventoryService.createGroupItem(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // POST /api/shared-inventory/public/items  (ADMIN 전용)
  // Body: { productName, quantity, price, category }
  // ──────────────────────────────
  async createPublicItem(req, res, next) {
    try {
      const dto = new CreateInventoryDTO(req.body);
      const result = await sharedInventoryService.createPublicItem(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // PUT /api/shared-inventory/:id
  // Body: { productName?, quantity?, price?, category? }
  // ──────────────────────────────
  async updateItem(req, res, next) {
    try {
      const dto    = new UpdateInventoryDTO(req.body);
      const result = await sharedInventoryService.updateItem(req.user.id, req.params.id, dto);
      res.json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // DELETE /api/shared-inventory/:id
  // ──────────────────────────────
  async deleteItem(req, res, next) {
    try {
      const result = await sharedInventoryService.deleteItem(req.user.id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────
  // PATCH /api/shared-inventory/:id/adjust
  // Body: { quantity, reason? }
  // ──────────────────────────────
  async adjustItem(req, res, next) {
    try {
      const dto    = new AdjustInventoryDTO(req.body);
      const result = await sharedInventoryService.adjustItem(req.user.id, req.params.id, dto);
      res.json(result);
    } catch (err) { next(err); }
  }
}

module.exports = new SharedInventoryController();
