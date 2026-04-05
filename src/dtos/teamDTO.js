const VALID_PERMISSIONS = ['LIST_READ', 'WRITE_MODIFY', 'DELETE', 'DOWNLOAD'];

// ================================================================
// 공통 유틸: 검증 에러 생성 (status 400 포함)
// ================================================================
function validationError(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

// ================================================================
// 요청 DTO
// ================================================================

class CreateTeamDTO {
  constructor({ name, description, leaderId }) {
    this.name        = name?.trim();
    this.description = description?.trim() ?? null;
    this.leaderId    = parseInt(leaderId);
  }

  validate() {
    const errors = [];
    if (!this.name)                      errors.push('name은 필수입니다');
    if (!this.leaderId || isNaN(this.leaderId)) errors.push('leaderId는 숫자여야 합니다');
    if (errors.length) throw validationError(errors.join(', '));
  }
}

class AddUserToTeamDTO {
  constructor({ userId, permissionName, isPrimary }) {
    this.userId         = parseInt(userId);
    this.permissionName = permissionName?.toUpperCase();
    this.isPrimary      = isPrimary === true || isPrimary === 'true';
  }

  validate() {
    const errors = [];
    if (!this.userId || isNaN(this.userId))
      errors.push('userId는 숫자여야 합니다');
    if (!VALID_PERMISSIONS.includes(this.permissionName))
      errors.push(`permissionName은 ${VALID_PERMISSIONS.join(', ')} 중 하나여야 합니다`);
    if (errors.length) throw validationError(errors.join(', '));
  }
}

// ================================================================
// 응답 DTO
// ================================================================

class TeamResponseDTO {
  constructor({ id, name, description, leader_id, parent_team_id, createdAt }) {
    this.id           = id;
    this.name         = name;
    this.description  = description;
    this.leaderId     = leader_id;
    this.parentTeamId = parent_team_id ?? null;
    this.createdAt    = createdAt;
  }

  static fromRow(row) {
    return new TeamResponseDTO(row);
  }
}

class TeamWithPermissionsDTO {
  constructor(team, permissions, isPrimary) {
    this.id          = team.id;
    this.name        = team.name;
    this.description = team.description;
    this.leaderId    = team.leader_id;
    this.isPrimary   = isPrimary;
    this.permissions = permissions.map(p => p.name);
  }
}

module.exports = {
  CreateTeamDTO,
  AddUserToTeamDTO,
  TeamResponseDTO,
  TeamWithPermissionsDTO,
};
