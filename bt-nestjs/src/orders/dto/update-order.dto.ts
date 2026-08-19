import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// US-09 — user sửa đơn: chỉ số khẩu phần & ghi chú (không đổi món).
export class UpdateOrderDto {
  @IsOptional()
  @IsInt({ message: 'Số khẩu phần phải là số nguyên' })
  @Min(1, { message: 'Tối thiểu 1 khẩu phần' })
  @Max(20, { message: 'Tối đa 20 khẩu phần' })
  portions?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
