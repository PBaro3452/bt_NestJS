import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Dùng chung cho các endpoint chỉ nhận một token mờ (refresh / logout / verify email).
export class TokenDto {
  @IsString()
  @MinLength(1)
  token: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password: string;
}
