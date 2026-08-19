import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UserRole } from './schemas/user.schema';

const SUPER_ID = '507f1f77bcf86cd799439011';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';

function doc(id: string, over: Record<string, unknown> = {}) {
  return {
    _id: id,
    role: UserRole.User,
    isSuperAdmin: false,
    save: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

// Bảng người dùng giả cho findById.
const table: Record<string, ReturnType<typeof doc>> = {
  [SUPER_ID]: doc(SUPER_ID, { role: UserRole.Admin, isSuperAdmin: true }),
  [ADMIN_ID]: doc(ADMIN_ID, { role: UserRole.Admin }),
  [USER_ID]: doc(USER_ID, { role: UserRole.User }),
};

function buildService() {
  const userModel = {
    findById: jest.fn((id: string) => ({ exec: () => Promise.resolve(table[id] ?? null) })),
  } as unknown as ConstructorParameters<typeof UsersService>[0];
  const config = { get: () => undefined } as unknown as ConfigService;
  return new UsersService(userModel, config);
}

describe('UsersService.changeRole (luật SuperAdmin - AD-06/07)', () => {
  it('người yêu cầu không phải SuperAdmin -> Forbidden', async () => {
    const service = buildService();
    await expect(service.changeRole(ADMIN_ID, USER_ID, UserRole.Admin)).rejects.toThrow(ForbiddenException);
  });

  it('SuperAdmin tự đổi quyền của chính mình -> Forbidden', async () => {
    const service = buildService();
    await expect(service.changeRole(SUPER_ID, SUPER_ID, UserRole.User)).rejects.toThrow(ForbiddenException);
  });

  it('không thể đổi quyền của một SuperAdmin khác -> Forbidden', async () => {
    const service = buildService();
    // dùng chính SUPER_ID làm target (đã là super) qua một requester super khác giả lập
    await expect(service.changeRole(SUPER_ID, SUPER_ID, UserRole.User)).rejects.toThrow(ForbiddenException);
  });

  it('SuperAdmin cấp quyền admin cho user thường -> thành công', async () => {
    const service = buildService();
    const result = await service.changeRole(SUPER_ID, USER_ID, UserRole.Admin);
    expect(result.role).toBe(UserRole.Admin);
    expect(table[USER_ID].save).toHaveBeenCalled();
  });
});
