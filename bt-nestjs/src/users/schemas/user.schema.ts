import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = (ret._id as { toString(): string }).toString();
      delete ret._id;
      delete ret.__v;
      // Không bao giờ trả các trường nhạy cảm ra client.
      delete ret.password;
      delete ret.refreshTokenHashes;
      delete ret.verifyTokenHash;
      delete ret.verifyTokenExpires;
      delete ret.resetTokenHash;
      delete ret.resetTokenExpires;
    },
  },
})
export class User {
  // Tên hiển thị (trước đây là "username") — không cần duy nhất.
  @Prop({ required: true, trim: true })
  name: string;

  // US-02 — email là thông tin đăng nhập chính, phải duy nhất.
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  // Hash bcrypt, không bao giờ trả về client (bị xoá trong toJSON transform ở trên).
  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.User })
  role: UserRole;

  // AD-06/AD-07 — SuperAdmin là admin gốc được seed từ .env: chỉ SuperAdmin mới cấp/thu
  // hồi quyền admin, và không ai được đổi quyền / xoá SuperAdmin (tránh khoá chết hệ thống).
  @Prop({ default: false })
  isSuperAdmin: boolean;

  // BE-04 — email đã xác thực hay chưa; chưa xác thực thì chưa đăng nhập được.
  @Prop({ default: false })
  emailVerified: boolean;

  // FE-12 — ảnh đại diện (data URL base64 hoặc URL ngoài).
  @Prop({ default: '' })
  avatarUrl: string;

  // BE-05/BE-06 — danh sách bản băm của các refresh token còn hiệu lực. Đăng xuất hoặc
  // đổi mật khẩu sẽ gỡ bản băm tương ứng -> thu hồi (revoke) token.
  @Prop({ type: [String], default: [] })
  refreshTokenHashes: string[];

  // BE-04 — token xác thực email (lưu dạng băm) + hạn dùng.
  @Prop()
  verifyTokenHash?: string;

  @Prop()
  verifyTokenExpires?: Date;

  // US-03 — token đặt lại mật khẩu (lưu dạng băm) + hạn dùng.
  @Prop()
  resetTokenHash?: string;

  @Prop()
  resetTokenExpires?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
