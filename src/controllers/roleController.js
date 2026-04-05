const roleService = require('../services/roleService');
const { AssignRoleDTO, AddTeamMemberDTO } = require('../dtos/roleDTO');

// ================================================================
// HTTP 요청/응답 처리만 담당
// ================================================================
class RoleController {

  // GET /api/roles/me
  async getMyPermissions(req, res, next) {
    try {
      const result = await roleService.getMyPermissions(req.user.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  // POST /api/roles/assign
  async assignRole(req, res, next) {
    try {
      const dto    = new AssignRoleDTO(req.body);
      const result = await roleService.assignRole(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // DELETE /api/roles/remove
  async removeRole(req, res, next) {
    try {
      const { userId, roleName } = req.body;
      const result = await roleService.removeRole(req.user.id, userId, roleName);
      res.json(result);
    } catch (err) { next(err); }
  }

  // POST /api/roles/team
  async addTeamMember(req, res, next) {
    try {
      const dto    = new AddTeamMemberDTO(req.body);
      const result = await roleService.addTeamMember(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // DELETE /api/roles/team/:memberId
  async removeTeamMember(req, res, next) {
    try {
      const result = await roleService.removeTeamMember(
        req.user.id,
        parseInt(req.params.memberId)
      );
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /api/roles/team
  async getTeamMembers(req, res, next) {
    try {
      const members = await roleService.getTeamMembers(req.user.id);
      res.json({ members });
    } catch (err) { next(err); }
  }
}

module.exports = new RoleController();
