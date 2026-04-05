const teamService = require('../services/teamService');
const { CreateTeamDTO, AddUserToTeamDTO } = require('../dtos/teamDTO');

// ================================================================
// HTTP 요청/응답 처리만 담당
// ================================================================
class TeamController {

  // POST /api/teams
  async create(req, res, next) {
    try {
      const dto    = new CreateTeamDTO(req.body);
      const result = await teamService.createTeam(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // GET /api/teams/my
  async getMyTeams(req, res, next) {
    try {
      const teams = await teamService.getMyTeams(req.user.id);
      res.json({ teams });
    } catch (err) { next(err); }
  }

  // POST /api/teams/:teamId/members
  async addMember(req, res, next) {
    try {
      const teamId = parseInt(req.params.teamId);
      const dto    = new AddUserToTeamDTO(req.body);
      const result = await teamService.addUserToTeam(req.user.id, teamId, dto);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  // DELETE /api/teams/:teamId/members/:userId
  async removeMember(req, res, next) {
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = parseInt(req.params.userId);
      const result = await teamService.removeUserFromTeam(req.user.id, teamId, userId);
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /api/teams/:teamId/members
  async getMembers(req, res, next) {
    try {
      const teamId  = parseInt(req.params.teamId);
      const members = await teamService.getTeamMembers(req.user.id, teamId);
      res.json({ members });
    } catch (err) { next(err); }
  }
}

module.exports = new TeamController();
