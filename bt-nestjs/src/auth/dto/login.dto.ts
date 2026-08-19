import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // US-02 — đăng nhập bằng email + mật khẩu.
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  password: string;
}
