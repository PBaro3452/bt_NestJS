import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CustomJwtService } from '../jwt/custom-jwt.service';
import { AuthenticatedUser, JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

// Guard mặc định toàn app (đăng ký global trong AppModule): mọi request phải kèm access
// token JWT hợp lệ (tự kiểm tra bằng CustomJwtService — BE-03) trừ khi được đánh dấu @Public().
//
// QUAN TRỌNG (bảo mật): role & danh tính được lấy LẠI TỪ DB theo mỗi request, KHÔNG tin
// vào role nhúng trong token. Nhờ vậy khi admin thu hồi quyền (hoặc xoá tài khoản), thay
// đổi có hiệu lực NGAY ở request kế tiếp — không bị "stale token" giữ quyền cũ tới khi hết hạn.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: CustomJwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !raw.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu access token');
    }

    const payload = this.jwt.verify<JwtPayload>(raw.slice('Bearer '.length));

    // Đối chiếu với DB: tài khoản còn tồn tại không, và quyền HIỆN TẠI là gì.
    const user = await this.usersService.findByIdOrNull(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Tài khoản không còn tồn tại');
    }

    request.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role, // role SỐNG từ DB, không phải role trong token
    };
    return true;
  }
}
