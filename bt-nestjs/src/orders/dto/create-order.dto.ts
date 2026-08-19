import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateOrderDto {
  @IsMongoId({ message: 'Món không hợp lệ' })
  recipeId: string;

  // US-07 / gợi ý #5 — số khẩu phần 1..20.
  @IsInt({ message: 'Số khẩu phần phải là số nguyên' })
  @Min(1, { message: 'Tối thiểu 1 khẩu phần' })
  @Max(20, { message: 'Tối đa 20 khẩu phần' })
  portions: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
