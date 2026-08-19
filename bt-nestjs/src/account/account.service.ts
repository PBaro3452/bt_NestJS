import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { generateOpaqueToken, hashOpaqueToken } from '../auth/jwt/opaque-token.util';

// US-12/US-13/US-14 — tài khoản tự phục vụ: xem/sửa profile của chính mình, xoá tài khoản.
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly verifyTtl: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    config: ConfigService,
  ) {
    this.verifyTtl = Number(config.get('VERIFY_TOKEN_TTL_SECONDS')) || 24 * 60 * 60;
  }

  getProfile(userId: string): Promise<UserDocument> {
    return this.usersService.findOne(userId);
  }

  // US-12 — sửa profile. Đổi email thì service.update tự đặt emailVerified=false; ở đây
  // sinh thêm verify token cho email mới (gợi ý #2) và trả ra để demo (chưa có mail server).
  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<{ user: UserDocument; devVerifyToken?: string }> {
    const before = await this.usersService.findOne(userId);
    const emailChanged = !!dto.email && dto.email.toLowerCase() !== before.email;

    const user = await this.usersService.update(userId, dto);

    if (emailChanged) {
      const verifyToken = generateOpaqueToken();
      const expires = new Date(Date.now() + this.verifyTtl * 1000);
      await this.usersService.setVerifyToken(userId, hashOpaqueToken(verifyToken), expires);
      this.logger.log(`Verify token (đổi email) cho ${user.email}: ${verifyToken}`);
      return { user, devVerifyToken: verifyToken };
    }
    return { user };
  }

  // US-13/US-14 — xoá cứng tài khoản + ẩn danh đơn cũ (gợi ý #3). Đăng ký lại bằng email
  // cũ sẽ tạo tài khoản mới (userId mới) nên không thấy lại đơn/thông tin cũ.
  async deleteAccount(userId: string): Promise<{ message: string }> {
    await this.ordersService.anonymizeByUser(userId);
    await this.usersService.remove(userId);
    return { message: 'Đã xoá tài khoản.' };
  }
}
