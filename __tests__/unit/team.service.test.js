/**
 * team.service.test.js — TeamService 단위 테스트
 */

process.env.JWT_SECRET  = 'test-jwt-secret';
process.env.JWT_EXPIRES = '1h';

jest.mock('../../src/repositories/teamRepository');
jest.mock('../../src/repositories/roleRepository');
jest.mock('../../src/repositories/userRepository');
jest.mock('../../src/config/database', () => ({ getPool: jest.fn() }));

const teamService    = require('../../src/services/teamService');
const teamRepository = require('../../src/repositories/teamRepository');
const roleRepository = require('../../src/repositories/roleRepository');
const userRepository = require('../../src/repositories/userRepository');
const { getPool }    = require('../../src/config/database');

const { CreateTeamDTO, AddUserToTeamDTO } = require('../../src/dtos/teamDTO');

const sampleTeam = {
  id: 1, name: '개발팀', description: '개발', leader_id: 2,
  parent_team_id: null, createdAt: new Date(),
};

const samplePermissions = [
  { id: 3, name: 'WRITE_MODIFY' },
  { id: 1, name: 'LIST_READ' },
];

describe('TeamService — 단위 테스트', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── CreateTeamDTO 유효성 검사 ────────────────────────
  describe('CreateTeamDTO.validate()', () => {
    it('유효한 데이터 — 통과', () => {
      const dto = new CreateTeamDTO({ name: '개발팀', leaderId: 2 });
      expect(() => dto.validate()).not.toThrow();
    });

    it('name 없음 — 에러', () => {
      const dto = new CreateTeamDTO({ name: '', leaderId: 2 });
      expect(() => dto.validate()).toThrow('name은 필수');
    });

    it('leaderId 문자열(NaN) — 에러', () => {
      const dto = new CreateTeamDTO({ name: '개발팀', leaderId: 'abc' });
      expect(() => dto.validate()).toThrow('leaderId는 숫자');
    });
  });

  // ── AddUserToTeamDTO 유효성 검사 ─────────────────────
  describe('AddUserToTeamDTO.validate()', () => {
    it('유효한 데이터 — 통과', () => {
      const dto = new AddUserToTeamDTO({ userId: 3, permissionName: 'WRITE_MODIFY' });
      expect(() => dto.validate()).not.toThrow();
    });

    it('잘못된 permissionName — 에러', () => {
      const dto = new AddUserToTeamDTO({ userId: 3, permissionName: 'INVALID_PERM' });
      expect(() => dto.validate()).toThrow();
    });

    it('userId 없음 — 에러', () => {
      const dto = new AddUserToTeamDTO({ permissionName: 'LIST_READ' });
      expect(() => dto.validate()).toThrow('userId는 숫자');
    });
  });

  // ── createTeam() ─────────────────────────────────────
  describe('createTeam()', () => {
    it('ADMIN이 정상적으로 팀 생성', async () => {
      roleRepository.isAdmin.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue({ id: 2, username: 'leader' });
      teamRepository.findByName.mockResolvedValue(null); // 이름 중복 없음
      teamRepository.create.mockResolvedValue(1);
      teamRepository.findById.mockResolvedValue(sampleTeam);

      const dto    = new CreateTeamDTO({ name: '개발팀', leaderId: 2 });
      const result = await teamService.createTeam(1, dto);

      expect(result.name).toBe('개발팀');
      expect(teamRepository.create).toHaveBeenCalledTimes(1);
    });

    it('ADMIN 아닌 사용자 — 403 에러', async () => {
      roleRepository.isAdmin.mockResolvedValue(false);

      const dto = new CreateTeamDTO({ name: '개발팀', leaderId: 2 });
      await expect(teamService.createTeam(2, dto)).rejects.toMatchObject({ status: 403 });
    });

    it('존재하지 않는 팀장 ID — 404 에러', async () => {
      roleRepository.isAdmin.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue(null); // 팀장 없음

      const dto = new CreateTeamDTO({ name: '개발팀', leaderId: 999 });
      await expect(teamService.createTeam(1, dto)).rejects.toMatchObject({ status: 404 });
    });

    it('팀명 중복 — 409 에러', async () => {
      roleRepository.isAdmin.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue({ id: 2 });
      teamRepository.findByName.mockResolvedValue(sampleTeam); // 이미 존재

      const dto = new CreateTeamDTO({ name: '개발팀', leaderId: 2 });
      await expect(teamService.createTeam(1, dto)).rejects.toMatchObject({ status: 409 });
    });
  });

  // ── getMyTeams() ─────────────────────────────────────
  describe('getMyTeams()', () => {
    it('소속 팀 목록 + 권한 반환', async () => {
      teamRepository.findByUserId.mockResolvedValue([{ ...sampleTeam, is_primary: true }]);
      teamRepository.findPermissionsByUserAndTeam.mockResolvedValue(samplePermissions);

      const result = await teamService.getMyTeams(2);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('개발팀');
      expect(result[0].permissions).toContain('WRITE_MODIFY');
      expect(result[0].isPrimary).toBe(true);
    });

    it('팀이 없는 사용자 — 빈 배열', async () => {
      teamRepository.findByUserId.mockResolvedValue([]);

      const result = await teamService.getMyTeams(99);

      expect(result).toHaveLength(0);
    });
  });

  // ── addUserToTeam() ──────────────────────────────────
  describe('addUserToTeam()', () => {
    beforeEach(() => {
      // getPool mock 설정
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([[{ id: 3 }]]); // permissions 조회
      getPool.mockReturnValue({ query: mockQuery });
    });

    it('권한 있는 요청자가 팀원 추가 성공', async () => {
      teamRepository.findById.mockResolvedValue(sampleTeam);
      teamRepository.canManageTeam.mockResolvedValue(true);
      roleRepository.isAdmin.mockResolvedValue(false);
      userRepository.findById.mockResolvedValue({ id: 3, username: 'newuser' });
      roleRepository.findRoleByName.mockResolvedValue({ id: 2, name: 'USER' });
      teamRepository.findPrimaryTeamByUserId.mockResolvedValue(null);
      teamRepository.addUserToTeam.mockResolvedValue();

      const dto    = new AddUserToTeamDTO({ userId: 3, permissionName: 'LIST_READ' });
      const result = await teamService.addUserToTeam(2, 1, dto);

      expect(result.message).toContain('팀에 추가');
      expect(result.isPrimary).toBe(true); // 첫 번째 팀이라 자동 본팀
    });

    it('팀 관리 권한 없음 — 403 에러', async () => {
      teamRepository.findById.mockResolvedValue(sampleTeam);
      teamRepository.canManageTeam.mockResolvedValue(false);
      roleRepository.isAdmin.mockResolvedValue(false);

      const dto = new AddUserToTeamDTO({ userId: 3, permissionName: 'LIST_READ' });
      await expect(teamService.addUserToTeam(99, 1, dto)).rejects.toMatchObject({ status: 403 });
    });

    it('존재하지 않는 팀 — 404 에러', async () => {
      teamRepository.findById.mockResolvedValue(null);

      const dto = new AddUserToTeamDTO({ userId: 3, permissionName: 'LIST_READ' });
      await expect(teamService.addUserToTeam(1, 999, dto)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── removeUserFromTeam() ─────────────────────────────
  describe('removeUserFromTeam()', () => {
    it('권한자 팀원 제거 성공', async () => {
      teamRepository.findById.mockResolvedValue(sampleTeam);
      teamRepository.canManageTeam.mockResolvedValue(true);
      roleRepository.isAdmin.mockResolvedValue(false);
      teamRepository.removeUserFromTeam.mockResolvedValue();

      const result = await teamService.removeUserFromTeam(2, 1, 3);

      expect(result.message).toContain('제거');
      expect(result.userId).toBe(3);
    });
  });

  // ── getTeamMembers() ─────────────────────────────────
  describe('getTeamMembers()', () => {
    it('팀 소속 사용자 — 팀원 목록 반환', async () => {
      teamRepository.findById.mockResolvedValue(sampleTeam);
      teamRepository.isUserInTeam.mockResolvedValue(true);
      roleRepository.isAdmin.mockResolvedValue(false);
      teamRepository.findMembersByTeamId.mockResolvedValue([
        { id: 2, username: 'user1', email: 'user1@test.com' },
        { id: 3, username: 'user2', email: 'user2@test.com' },
      ]);

      const result = await teamService.getTeamMembers(2, 1);

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('user1');
    });

    it('팀 비소속 비ADMIN — 403 에러', async () => {
      teamRepository.findById.mockResolvedValue(sampleTeam);
      teamRepository.isUserInTeam.mockResolvedValue(false);
      roleRepository.isAdmin.mockResolvedValue(false);

      await expect(teamService.getTeamMembers(99, 1)).rejects.toMatchObject({ status: 403 });
    });
  });
});
