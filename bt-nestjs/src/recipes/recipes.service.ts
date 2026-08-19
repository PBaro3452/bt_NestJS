import { ForbiddenException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../users/schemas/user.schema';

function assertCanModify(recipe: RecipeDocument, user: AuthenticatedUser): void {
  if (user.role === UserRole.Admin) {
    return;
  }
  if (recipe.authorEmail !== user.email) {
    throw new ForbiddenException('Bạn chỉ có thể sửa/xoá công thức do chính mình tạo');
  }
}

const SEED_RECIPES: CreateRecipeDto[] = [
  {
    name: 'Spaghetti Carbonara',
    authorEmail: 'author1@gmail.com',
    description: 'Món mì Ý truyền thống với trứng và thịt xông khói.',
    imgUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
    price: 65000,
    isFavorite: true,
    ingredients: [
      { name: 'Mì Spaghetti', quantity: 200, unit: 'g', measure: '200 g' },
      { name: 'Thịt má heo Guanciale', quantity: 100, unit: 'g', measure: '100 g' },
      { name: 'Lòng đỏ trứng', quantity: 4, unit: 'cái', measure: '4 cái' },
      { name: 'Phô mai Pecorino Romano', quantity: 50, unit: 'g', measure: '50 g' },
      { name: 'Tiêu đen', quantity: 1, unit: 'thìa cà phê', measure: '1 thìa cà phê' },
    ],
  },
  {
    name: 'Salad Caprese',
    authorEmail: 'author2@gmail.com',
    description: 'Món salad Ý đơn giản và thanh mát.',
    imgUrl: 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600',
    price: 45000,
    isFavorite: false,
    ingredients: [
      { name: 'Cà chua', quantity: 4, unit: 'quả', measure: '4 quả' },
      { name: 'Phô mai Mozzarella tươi', quantity: 200, unit: 'g', measure: '200 g' },
      { name: 'Lá húng quế tươi', quantity: 1, unit: 'nắm', measure: '1 nắm' },
      { name: 'Dầu ô liu nguyên chất', quantity: 2, unit: 'thìa canh', measure: '2 thìa canh' },
    ],
  },
  {
    name: 'Bánh mì',
    authorEmail: 'author3@gmail.com',
    description: 'Bánh Mì thơm ngon.',
    imgUrl:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3fyj2V6qaWxmjWAI_T3eFS04r4QpkKyCep5ahq0FURw&s=10',
    price: 25000,
    isFavorite: false,
    ingredients: [
      { name: 'Dưa chua', quantity: 5, unit: 'lát', measure: '5 lát' },
      { name: 'Phô mai Mozzarella tươi', quantity: 200, unit: 'g', measure: '200 g' },
      { name: 'Thịt Balogna', quantity: 4, unit: 'lát', measure: '4 lát' },
      { name: 'Patee', quantity: 2, unit: 'thìa canh', measure: '2 thìa canh' },
    ],
  },
];

@Injectable()
export class RecipesService implements OnModuleInit {
  private readonly logger = new Logger(RecipesService.name);

  constructor(@InjectModel(Recipe.name) private readonly recipeModel: Model<RecipeDocument>) {}

  async onModuleInit(): Promise<void> {
    const count = await this.recipeModel.countDocuments();
    if (count === 0) {
      await this.recipeModel.insertMany(SEED_RECIPES);
      this.logger.log(`Seeded ${SEED_RECIPES.length} recipe(s) into an empty collection.`);
    }
  }

  // FE-06 — tìm kiếm phía server (không filter ở client). Lọc theo tên món bằng regex
  // không phân biệt hoa/thường; escape ký tự đặc biệt để tránh lỗi/ReDoS từ input người dùng.
  findAll(search?: string): Promise<RecipeDocument[]> {
    const keyword = search?.trim();
    if (keyword) {
      const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return this.recipeModel.find({ name: { $regex: safe, $options: 'i' } }).exec();
    }
    return this.recipeModel.find().exec();
  }

  async findOne(id: string): Promise<RecipeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const recipe = await this.recipeModel.findById(id).exec();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return recipe;
  }

  create(createRecipeDto: CreateRecipeDto, user: AuthenticatedUser): Promise<RecipeDocument> {
    // Ép authorEmail theo tài khoản đang đăng nhập (trừ admin không có email) —
    // không cho phép giả mạo là tác giả khác qua body request.
    const authorEmail = user.email ?? createRecipeDto.authorEmail;
    return this.recipeModel.create({ ...createRecipeDto, authorEmail });
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto, user: AuthenticatedUser): Promise<RecipeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const existing = await this.recipeModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    assertCanModify(existing, user);
    // Không cho phép đổi authorEmail qua PATCH (kể cả admin) — tránh việc "chuyển nhượng"
    // quyền sở hữu công thức cho người khác bằng cách sửa trường này trong request body.
    const { authorEmail: _ignoredAuthorEmail, ...safePatch } = updateRecipeDto;
    const recipe = await this.recipeModel.findByIdAndUpdate(id, safePatch, { new: true }).exec();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return recipe;
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<RecipeDocument> {
    // Không kiểm tra quyền sở hữu: "yêu thích" là hành động cá nhân của người xem,
    // không phải sửa nội dung công thức — ai đã đăng nhập cũng đánh dấu được.
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const recipe = await this.recipeModel.findByIdAndUpdate(id, { isFavorite }, { new: true }).exec();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return recipe;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const existing = await this.recipeModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    assertCanModify(existing, user);
    await this.recipeModel.findByIdAndDelete(id).exec();
  }
}
