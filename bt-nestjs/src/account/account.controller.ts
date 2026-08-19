import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// Mọi endpoint ở đây thao tác trên CHÍNH tài khoản đang đăng nhập (lấy id từ JWT), không
// nhận id từ URL — nên không cần quyền admin và không thể đụng vào tài khoản người khác.
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.getProfile(user.userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.accountService.updateProfile(user.userId, dto);
  }

  @Delete('me')
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.deleteAccount(user.userId);
  }
}
