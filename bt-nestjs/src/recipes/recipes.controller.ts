import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, Query } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SetFavoriteDto } from './dto/set-favorite.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // Chỉ admin được tạo công thức mới — chặn cả ở đây (không chỉ ẩn nút trên UI),
  // vì client-side chỉ ẩn nút thì vẫn gọi thẳng API được nếu không chặn ở backend.
  @Post()
  @Roles(UserRole.Admin)
  create(@Body() createRecipeDto: CreateRecipeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recipesService.create(createRecipeDto, user);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.recipesService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  // Bất kỳ ai đã đăng nhập cũng đánh dấu/bỏ yêu thích được — không cần là chủ công thức.
  @Patch(':id/favorite')
  setFavorite(@Param('id') id: string, @Body() dto: SetFavoriteDto) {
    return this.recipesService.setFavorite(id, dto.isFavorite);
  }

  // AD-08/09 — CRUD công thức chỉ dành cho admin. RolesGuard đọc role SỐNG từ DB (qua
  // JwtAuthGuard), nên admin vừa bị thu hồi quyền sẽ bị chặn ngay, kể cả công thức họ tạo.
  @Patch(':id')
  @Roles(UserRole.Admin)
  update(
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recipesService.update(id, updateRecipeDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.recipesService.remove(id, user);
  }
}
