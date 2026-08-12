import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class Ingredient {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Number, default: null })
  quantity: number | null;

  @Prop({ default: '' })
  unit: string;

  @Prop({ default: '' })
  measure: string;
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = (ret._id as { toString(): string }).toString();
      delete ret._id;
      delete ret.__v;
    },
  },
})
export class Recipe {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  imgUrl: string;

  @Prop({ default: false })
  isFavorite: boolean;

  @Prop({ type: [IngredientSchema], default: [] })
  ingredients: Ingredient[];

  @Prop({ required: true })
  authorEmail: string;
}

export type RecipeDocument = HydratedDocument<Recipe>;
export const RecipeSchema = SchemaFactory.createForClass(Recipe);
