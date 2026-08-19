import { IsEnum } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

// AD-06/AD-07 — cấp (admin) hoặc thu hồi (user) quyền của một tài khoản.
export class SetRoleDto {
  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role: UserRole;
}
