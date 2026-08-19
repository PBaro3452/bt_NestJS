import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Trạng thái đơn. Đề yêu cầu 3 trạng thái admin quản lý (Đang làm/Hoàn thành/Bị huỷ);
// thêm `pending` (Chờ xác nhận) là trạng thái khởi tạo — theo gợi ý #4, user chỉ được
// sửa/huỷ đơn khi đơn CHƯA chuyển sang "Đang làm".
export enum OrderStatus {
  Pending = 'pending',
  Preparing = 'preparing',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

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
export class Order {
  // Chủ đơn. Lưu cả bản chụp tên/email tại thời điểm đặt để đơn cũ vẫn hiển thị đúng
  // ngay cả khi user đổi thông tin hoặc xoá tài khoản (US-14 — ẩn danh, không mất đơn).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  customerEmail: string;

  // Bản chụp thông tin món tại thời điểm đặt (đơn không đổi khi công thức bị sửa/xoá).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Recipe', required: true })
  recipeId: Types.ObjectId;

  @Prop({ required: true })
  recipeName: string;

  @Prop({ default: '' })
  recipeImgUrl: string;

  @Prop({ required: true, default: 0 })
  unitPrice: number;

  // US-07 — số khẩu phần (1..20 theo gợi ý #5).
  @Prop({ required: true, min: 1, max: 20 })
  portions: number;

  @Prop({ default: '' })
  note: string;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.Pending, index: true })
  status: OrderStatus;

  // US-11/AD-03 — lý do huỷ (bắt buộc khi admin huỷ), hiển thị cho user.
  @Prop({ default: '' })
  cancelReason: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
