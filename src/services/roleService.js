const roleRepository = require('../repositories/roleRepository');
const userRepository  = require('../repositories/userRepository');
const { UserPermissionsResponseDTO } = require('../dtos/roleDTO');

// ================================================================
// 역할·권한 비즈니스 로직
// ================================================================
class RoleService {

  // ──────────────────────────────
  // 내 역할 + 권한 조회
  // ──────────────────────────────
  async getMyPermissions(userId) {
    const [roles, permissions] = await Promise.all([
      roleRepository.getRolesByUserId(userId),
      roleRepository.getPermissionsByUserId(userId),
    ]);
    return new UserPermissionsResponseDTO(roles, permissions);
  }

  // ──────────────────────────────
  // 역할 할당 (ADMIN 전용)
  // ──────────────────────────────
  async assignRole(requesterId, dto) {
    dto.validate();

    const isAdmin = await roleRepository.isAdmin(requesterId);
    if (!isAdmin) {
      const err = new Error('ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    const target = await userRepository.findById(dto.userId);
    if (!target) {
      const err = new Error('존재하지 않는 사용자입니다');
      err.status = 404;
      throw err;
    }

    const role = await roleRepository.findRoleByName(dto.roleName);
    if (!role) {
      const err = new Error('존재하지 않는 역할입니다');
      err.status = 400;
      throw err;
    }

    await roleRepository.assignRole(dto.userId, role.id, requesterId);
    return { message: `${dto.roleName} 역할이 부여되었습니다`, userId: dto.userId, roleName: dto.roleName };
  }

  // ──────────────────────────────
  // 역할 제거 (ADMIN 전용)
  // ──────────────────────────────
  async removeRole(requesterId, userId, roleName) {
    const isAdmin = await roleRepository.isAdmin(requesterId);
    if (!isAdmin) {
      const err = new Error('ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    const role = await roleRepository.findRoleByName(roleName?.toUpperCase());
    if (!role) {
      const err = new Error('존재하지 않는 역할입니다');
      err.status = 400;
      throw err;
    }

    await roleRepository.removeRole(userId, role.id);
    return { message: `${roleName} 역할이 제거되었습니다`, userId, roleName };
  }

  // ──────────────────────────────
  // 팀원 추가 (ADMIN / SUB_ADMIN)
  // ──────────────────────────────
  async addTeamMember(requesterId, dto) {
    dto.validate();

    const [isAdmin, isSubAdmin] = await Promise.all([
      roleRepository.isAdmin(requesterId),
      roleRepository.isSubAdmin(requesterId),
    ]);
    if (!isAdmin && !isSubAdmin) {
      const err = new Error('ADMIN 또는 SUB_ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    // 자기 자신은 팀원 추가 불가
    if (requesterId === dto.teamMemberId) {
      const err = new Error('자기 자신을 팀원으로 추가할 수 없습니다');
      err.status = 400;
      throw err;
    }

    const target = await userRepository.findById(dto.teamMemberId);
    if (!target) {
      const err = new Error('존재하지 않는 사용자입니다');
      err.status = 404;
      throw err;
    }

    await roleRepository.addTeamMember(requesterId, dto.teamMemberId);
    return { message: '팀원이 추가되었습니다', teamMemberId: dto.teamMemberId };
  }

  // ──────────────────────────────
  // 팀원 제거 (ADMIN / SUB_ADMIN 자신 팀만)
  // ──────────────────────────────
  async removeTeamMember(requesterId, teamMemberId) {
    const [isAdmin, isSubAdmin] = await Promise.all([
      roleRepository.isAdmin(requesterId),
      roleRepository.isSubAdmin(requesterId),
    ]);
    if (!isAdmin && !isSubAdmin) {
      const err = new Error('ADMIN 또는 SUB_ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }

    if (!isAdmin) {
      // SUB_ADMIN 은 자신의 팀원만 제거 가능
      const isMember = await roleRepository.isTeamMember(requesterId, teamMemberId);
      if (!isMember) {
        const err = new Error('자신의 팀원만 제거할 수 있습니다');
        err.status = 403;
        throw err;
      }
    }

    await roleRepository.removeTeamMember(requesterId, teamMemberId);
    return { message: '팀원이 제거되었습니다', teamMemberId };
  }

  // ──────────────────────────────
  // 팀원 목록 조회 (SUB_ADMIN / ADMIN)
  // ──────────────────────────────
  async getTeamMembers(requesterId) {
    const [isAdmin, isSubAdmin] = await Promise.all([
      roleRepository.isAdmin(requesterId),
      roleRepository.isSubAdmin(requesterId),
    ]);
    if (!isAdmin && !isSubAdmin) {
      const err = new Error('ADMIN 또는 SUB_ADMIN 권한이 필요합니다');
      err.status = 403;
      throw err;
    }
    return roleRepository.getTeamMembers(requesterId);
  }
}

module.exports = new RoleService();
