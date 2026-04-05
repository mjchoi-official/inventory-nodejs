const teamRepository = require('../repositories/teamRepository');
const roleRepository  = require('../repositories/roleRepository');
const userRepository  = require('../repositories/userRepository');
const { getPool }     = require('../config/database');
const { TeamResponseDTO, TeamWithPermissionsDTO } = require('../dtos/teamDTO');

// ================================================================
// 팀 비즈니스 로직
// ================================================================
class TeamService {

  // ──────────────────────────────
  // 팀 생성 (ADMIN 전용)
  // ──────────────────────────────
  async createTeam(requesterId, dto) {
    dto.validate();

    const isAdmin = await roleRepository.isAdmin(requesterId);
    if (!isAdmin) {
      const err = new Error('ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    const leader = await userRepository.findById(dto.leaderId);
    if (!leader) {
      const err = new Error('존재하지 않는 팀장 사용자입니다');
      err.status = 404;
      throw err;
    }

    const existing = await teamRepository.findByName(dto.name);
    if (existing) {
      const err = new Error('이미 존재하는 팀명입니다');
      err.status = 409;
      throw err;
    }

    const teamId = await teamRepository.create(dto);
    const team   = await teamRepository.findById(teamId);
    return TeamResponseDTO.fromRow(team);
  }

  // ──────────────────────────────
  // 내 팀 목록 + 팀별 권한 조회
  // ──────────────────────────────
  async getMyTeams(userId) {
    const teams = await teamRepository.findByUserId(userId);

    const result = await Promise.all(
      teams.map(async (team) => {
        const permissions = await teamRepository.findPermissionsByUserAndTeam(userId, team.id);
        return new TeamWithPermissionsDTO(team, permissions, team.is_primary);
      })
    );
    return result;
  }

  // ──────────────────────────────
  // 팀에 사용자 추가 (팀장 / SUB_ADMIN / ADMIN)
  // ──────────────────────────────
  async addUserToTeam(requesterId, teamId, dto) {
    dto.validate();

    const team = await teamRepository.findById(teamId);
    if (!team) {
      const err = new Error('존재하지 않는 팀입니다');
      err.status = 404;
      throw err;
    }

    // 관리 권한 확인 (팀장 or SUB_ADMIN in team or global ADMIN)
    const [canManage, isAdmin] = await Promise.all([
      teamRepository.canManageTeam(requesterId, teamId),
      roleRepository.isAdmin(requesterId),
    ]);
    if (!canManage && !isAdmin) {
      const err = new Error('이 팀을 관리할 권한이 없습니다');
      err.status = 403;
      throw err;
    }

    const target = await userRepository.findById(dto.userId);
    if (!target) {
      const err = new Error('존재하지 않는 사용자입니다');
      err.status = 404;
      throw err;
    }

    // 권한 ID 조회
    const pool = getPool();
    const [[permRow]] = await pool.query(
      'SELECT id FROM permissions WHERE name = ?', [dto.permissionName]
    );
    if (!permRow) {
      const err = new Error('존재하지 않는 권한입니다');
      err.status = 400;
      throw err;
    }

    // USER 역할 ID 조회
    const userRole = await roleRepository.findRoleByName('USER');

    // 첫 팀이면 자동으로 본팀 설정
    const primaryTeam = await teamRepository.findPrimaryTeamByUserId(dto.userId);
    const isPrimary   = dto.isPrimary || !primaryTeam;

    await teamRepository.addUserToTeam({
      userId:       dto.userId,
      teamId,
      roleId:       userRole.id,
      permissionId: permRow.id,
      isPrimary,
      assignedBy:   requesterId,
    });

    return {
      message:        '사용자가 팀에 추가되었습니다',
      userId:         dto.userId,
      teamId,
      permissionName: dto.permissionName,
      isPrimary,
    };
  }

  // ──────────────────────────────
  // 팀에서 사용자 제거
  // ──────────────────────────────
  async removeUserFromTeam(requesterId, teamId, userId) {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      const err = new Error('존재하지 않는 팀입니다');
      err.status = 404;
      throw err;
    }

    const [canManage, isAdmin] = await Promise.all([
      teamRepository.canManageTeam(requesterId, teamId),
      roleRepository.isAdmin(requesterId),
    ]);
    if (!canManage && !isAdmin) {
      const err = new Error('이 팀을 관리할 권한이 없습니다');
      err.status = 403;
      throw err;
    }

    await teamRepository.removeUserFromTeam(userId, teamId);
    return { message: '사용자가 팀에서 제거되었습니다', userId, teamId };
  }

  // ──────────────────────────────
  // 팀원 목록 조회
  // ──────────────────────────────
  async getTeamMembers(requesterId, teamId) {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      const err = new Error('존재하지 않는 팀입니다');
      err.status = 404;
      throw err;
    }

    // 팀 소속이거나 ADMIN 이면 조회 가능
    const [inTeam, isAdmin] = await Promise.all([
      teamRepository.isUserInTeam(requesterId, teamId),
      roleRepository.isAdmin(requesterId),
    ]);
    if (!inTeam && !isAdmin) {
      const err = new Error('이 팀에 접근할 권한이 없습니다');
      err.status = 403;
      throw err;
    }

    return teamRepository.findMembersByTeamId(teamId);
  }
}

module.exports = new TeamService();
