import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../schemas/order.schema';

// AD-02/AD-03 — admin đổi trạng thái; nếu chọn "Bị huỷ" thì cancelReason là bắt buộc
// (kiểm tra thêm ở service để chắc chắn không rỗng).
export class SetStatusDto {
  @IsEnum(OrderStatus, { message: 'Trạng thái không hợp lệ' })
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Lý do huỷ tối đa 300 ký tự' })
  cancelReason?: string;
}

// US-10 — user tự huỷ đơn, lý do không bắt buộc.
export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Lý do tối đa 300 ký tự' })
  reason?: string;
}
