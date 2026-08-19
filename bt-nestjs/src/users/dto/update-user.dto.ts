import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// US-12 — người dùng tự sửa profile: tên hiển thị, email, mật khẩu, avatar.
// KHÔNG cho đổi role qua đây (tránh leo thang đặc quyền) — việc cấp/thu quyền admin
// đi qua endpoint riêng dành cho admin (AD-06/AD-07).
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên hiển thị phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên hiển thị tối đa 50 ký tự' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, { message: 'Ảnh đại diện quá lớn' })
  avatarUrl?: string;
}
