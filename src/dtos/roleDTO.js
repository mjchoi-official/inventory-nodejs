const VALID_ROLES = ['ADMIN', 'SUB_ADMIN', 'USER'];

// ================================================================
// 요청 DTO
// ================================================================

class AssignRoleDTO {
  constructor({ userId, roleName }) {
    this.userId   = parseInt(userId);
    this.roleName = roleName?.toUpperCase();
  }

  validate() {
    const errors = [];
    if (!this.userId || isNaN(this.userId)) errors.push('userId는 숫자여야 합니다');
    if (!VALID_ROLES.includes(this.roleName))
      errors.push(`roleName은 ${VALID_ROLES.join(', ')} 중 하나여야 합니다`);
    if (errors.length) throw new Error(errors.join(', '));
  }
}

class AddTeamMemberDTO {
  constructor({ teamMemberId }) {
    this.teamMemberId = parseInt(teamMemberId);
  }

  validate() {
    if (!this.teamMemberId || isNaN(this.teamMemberId))
      throw new Error('teamMemberId는 숫자여야 합니다');
  }
}

// ================================================================
// 응답 DTO
// ================================================================

class RoleResponseDTO {
  constructor({ id, name, description }) {
    this.id          = id;
    this.name        = name;
    this.description = description;
  }
}

class UserPermissionsResponseDTO {
  constructor(roles, permissions) {
    this.roles       = roles.map(r => r.name);
    this.permissions = permissions.map(p => p.name);
  }
}

module.exports = {
  AssignRoleDTO,
  AddTeamMemberDTO,
  RoleResponseDTO,
  UserPermissionsResponseDTO,
};
