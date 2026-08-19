import { Controller, Get, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from './schemas/user.schema';

// Toàn bộ endpoint quản lý user chỉ dành cho admin — tạo tài khoản user mới đi qua
// POST /auth/register (public), không qua đây, để tránh admin phải tự gõ hộ mật khẩu người khác.
@Controller('users')
@Roles(UserRole.Admin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // AD-05/FE-07 — danh sách (có tìm kiếm) người dùng & quản trị viên.
  @Get()
  findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // AD-06/AD-07 — cấp / thu hồi quyền admin (chỉ SuperAdmin, kiểm tra trong service).
  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.usersService.changeRole(requester.userId, id, dto.role);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
