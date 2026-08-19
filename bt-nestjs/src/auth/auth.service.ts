import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserDocument, UserRole } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { CustomJwtService } from './jwt/custom-jwt.service';
import { generateOpaqueToken, hashOpaqueToken } from './jwt/opaque-token.util';

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string;
  isSuperAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

interface RefreshClaims {
  sub: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly verifyTtl: number;
  private readonly resetTtl: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: CustomJwtService,
    config: ConfigService,
  ) {
    this.accessTtl = Number(config.get('JWT_ACCESS_EXPIRES_SECONDS')) || 15 * 60; // 15 phút
    this.refreshTtl = Number(config.get('JWT_REFRESH_EXPIRES_SECONDS')) || 7 * 24 * 60 * 60; // 7 ngày
    this.verifyTtl = Number(config.get('VERIFY_TOKEN_TTL_SECONDS')) || 24 * 60 * 60; // 24 giờ
    this.resetTtl = Number(config.get('RESET_TOKEN_TTL_SECONDS')) || 15 * 60; // 15 phút (gợi ý #1)
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl ?? '',
      isSuperAdmin: user.isSuperAdmin ?? false,
    };
  }

  // Cấp cặp access + refresh token, đồng thời lưu bản băm refresh token để có thể thu hồi.
  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = this.jwt.sign({ ...payload }, { expiresInSeconds: this.accessTtl });
    const refreshToken = this.jwt.sign(
      { sub: user._id.toString(), type: 'refresh' },
      { expiresInSeconds: this.refreshTtl },
    );
    await this.usersService.addRefreshTokenHash(user._id.toString(), hashOpaqueToken(refreshToken));
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  // ---- US-01/US-02: đăng ký & đăng nhập ----

  async register(dto: RegisterDto): Promise<{ message: string; devVerifyToken: string }> {
    // create() tự kiểm tra trùng email và ném ConflictException nếu đã tồn tại.
    const user = await this.usersService.create(dto, UserRole.User);

    // BE-04 — sinh verify token, lưu băm + hạn dùng. Cố ý KHÔNG tự đăng nhập (US-01):
    // người dùng phải xác thực email rồi tự đăng nhập lại.
    const verifyToken = generateOpaqueToken();
    const expires = new Date(Date.now() + this.verifyTtl * 1000);
    await this.usersService.setVerifyToken(user._id.toString(), hashOpaqueToken(verifyToken), expires);

    // Chưa cấu hình mail server thật -> trả token ra response để demo (và log lại).
    this.logger.log(`Verify token cho ${user.email}: ${verifyToken}`);
    return {
      message: 'Đăng ký thành công. Vui lòng xác thực email để đăng nhập.',
      devVerifyToken: verifyToken,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.usersService.findByValidVerifyToken(hashOpaqueToken(token));
    if (!user) {
      throw new UnauthorizedException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }
    await this.usersService.markEmailVerified(user._id.toString());
    return { message: 'Xác thực email thành công. Bạn có thể đăng nhập.' };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email chưa được xác thực. Vui lòng kiểm tra và xác thực email.');
    }
    return this.issueTokens(user);
  }

  // ---- BE-05/BE-06: refresh & thu hồi token ----

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let claims: RefreshClaims;
    try {
      claims = this.jwt.verify<RefreshClaims>(refreshToken); // kiểm tra chữ ký + hạn dùng
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
    if (claims.type !== 'refresh') {
      throw new UnauthorizedException('Loại token không đúng');
    }

    const oldHash = hashOpaqueToken(refreshToken);
    // Token phải còn trong danh sách hợp lệ — nếu đã bị thu hồi (logout/đổi mật khẩu) thì chặn.
    if (!(await this.usersService.hasRefreshTokenHash(claims.sub, oldHash))) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    const user = await this.usersService.findOne(claims.sub);
    // Xoay vòng token: gỡ bản băm cũ rồi cấp cặp mới (issueTokens tự thêm bản băm mới).
    await this.usersService.removeRefreshTokenHash(claims.sub, oldHash);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const claims = this.jwt.verify<RefreshClaims>(refreshToken);
      await this.usersService.removeRefreshTokenHash(claims.sub, hashOpaqueToken(refreshToken));
    } catch {
      // Token hỏng/hết hạn thì coi như đã đăng xuất — không cần báo lỗi.
    }
    return { message: 'Đã đăng xuất' };
  }

  // ---- US-03: quên & đặt lại mật khẩu ----

  async forgotPassword(email: string): Promise<{ message: string; devResetToken?: string }> {
    const user = await this.usersService.findByEmail(email);
    // Không tiết lộ email có tồn tại hay không (chống dò tài khoản).
    if (!user) {
      return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' };
    }
    const resetToken = generateOpaqueToken();
    const expires = new Date(Date.now() + this.resetTtl * 1000);
    await this.usersService.setResetToken(user._id.toString(), hashOpaqueToken(resetToken), expires);
    this.logger.log(`Reset token cho ${user.email}: ${resetToken}`);
    return {
      message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
      devResetToken: resetToken,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findByValidResetToken(hashOpaqueToken(token));
    if (!user) {
      throw new UnauthorizedException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    await this.usersService.resetPassword(user._id.toString(), newPassword);
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' };
  }
}
