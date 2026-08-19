import { UserRole } from '../../users/schemas/user.schema';

// Payload nhúng trong access token (JWT). `sub` = id người dùng.
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

// Đối tượng user được gắn vào request sau khi guard xác thực token thành công.
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}
