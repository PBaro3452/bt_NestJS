import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';

const SEED_RECIPES: CreateRecipeDto[] = [
  {
    name: 'Spaghetti Carbonara',
    authorEmail: 'author1@gmail.com',
    description: 'Món mì Ý truyền thống với trứng và thịt xông khói.',
    imgUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
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

  findAll(): Promise<RecipeDocument[]> {
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

  create(createRecipeDto: CreateRecipeDto): Promise<RecipeDocument> {
    return this.recipeModel.create(createRecipeDto);
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto): Promise<RecipeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const recipe = await this.recipeModel.findByIdAndUpdate(id, updateRecipeDto, { new: true }).exec();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return recipe;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    const recipe = await this.recipeModel.findByIdAndDelete(id).exec();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
  }
}
