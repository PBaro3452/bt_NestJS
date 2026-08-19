import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument, UserRole } from './schemas/user.schema';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  // Seed đúng một tài khoản admin (SuperAdmin) từ biến môi trường nếu chưa có admin nào —
  // đảm bảo chỉ người nắm .env mới có quyền admin gốc. Admin seed luôn được xác thực email sẵn.
  async onModuleInit(): Promise<void> {
    const existingAdmin = await this.userModel.findOne({ role: UserRole.Admin }).exec();
    if (existingAdmin) {
      return;
    }

    const adminName = this.config.get<string>('ADMIN_USERNAME') ?? 'Administrator';
    const adminEmail = (this.config.get<string>('ADMIN_EMAIL') ?? 'admin@recipe.app').toLowerCase();
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (!adminPassword) {
      this.logger.warn('ADMIN_PASSWORD chưa được cấu hình trong .env — bỏ qua seed tài khoản admin.');
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await this.userModel.create({
      name: adminName,
      email: adminEmail,
      password: passwordHash,
      role: UserRole.Admin,
      emailVerified: true,
      isSuperAdmin: true, // admin gốc = SuperAdmin
    });
    this.logger.log(`Đã tạo tài khoản admin "${adminEmail}".`);
  }

  async create(createUserDto: CreateUserDto, role: UserRole = UserRole.User): Promise<UserDocument> {
    const email = createUserDto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }
    const password = await bcrypt.hash(createUserDto.password, SALT_ROUNDS);
    return this.userModel.create({ name: createUserDto.name, email, password, role });
  }

  // FE-07 — tìm thành viên phía server, theo tên hoặc email (regex, escape an toàn).
  findAll(search?: string): Promise<UserDocument[]> {
    const keyword = search?.trim();
    if (keyword) {
      const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: safe, $options: 'i' };
      return this.userModel.find({ $or: [{ name: regex }, { email: regex }] }).exec();
    }
    return this.userModel.find().exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  // Trả null nếu không hợp lệ/không tồn tại (không ném lỗi) — dùng cho guard xác thực.
  findByIdOrNull(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return Promise.resolve(null);
    }
    return this.userModel.findById(id).exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
    const patch: Partial<User> = {};
    if (updateUserDto.name !== undefined) {
      patch.name = updateUserDto.name;
    }
    if (updateUserDto.avatarUrl !== undefined) {
      patch.avatarUrl = updateUserDto.avatarUrl;
    }
    if (updateUserDto.password) {
      patch.password = await bcrypt.hash(updateUserDto.password, SALT_ROUNDS);
      // Đổi mật khẩu -> thu hồi mọi refresh token cũ để buộc đăng nhập lại ở nơi khác.
      patch.refreshTokenHashes = [];
    }
    if (updateUserDto.email !== undefined) {
      const email = updateUserDto.email.toLowerCase();
      const owner = await this.userModel.findOne({ email }).exec();
      if (owner && owner._id.toString() !== id) {
        throw new ConflictException('Email đã được đăng ký');
      }
      patch.email = email;
      // US-12 (gợi ý #2) — đổi email thì phải xác thực lại email mới.
      patch.emailVerified = false;
    }

    const user = await this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
    return user;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    }
  }

  // AD-06/AD-07 — cấp/thu hồi quyền admin theo luật SuperAdmin (gợi ý #7):
  //  - chỉ SuperAdmin mới được đổi quyền người khác;
  //  - không ai được đổi quyền chính mình hoặc đổi quyền của SuperAdmin.
  async changeRole(requesterId: string, targetId: string, role: UserRole): Promise<UserDocument> {
    const requester = await this.findOne(requesterId);
    if (!requester.isSuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin mới được cấp/thu hồi quyền admin');
    }
    if (requesterId === targetId) {
      throw new ForbiddenException('Không thể tự thay đổi quyền của chính mình');
    }
    const target = await this.findOne(targetId);
    if (target.isSuperAdmin) {
      throw new ForbiddenException('Không thể thay đổi quyền của SuperAdmin');
    }
    target.role = role;
    // Thu hồi mọi phiên hiện có của target: refresh token cũ bị vô hiệu -> lần refresh
    // kế tiếp thất bại và họ buộc đăng nhập lại, nhận đúng quyền mới (chống stale token).
    target.refreshTokenHashes = [];
    await target.save();
    return target;
  }

  // ---- BE-04: xác thực email ----
  async setVerifyToken(id: string, tokenHash: string, expires: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { verifyTokenHash: tokenHash, verifyTokenExpires: expires }).exec();
  }

  findByValidVerifyToken(tokenHash: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ verifyTokenHash: tokenHash, verifyTokenExpires: { $gt: new Date() } })
      .exec();
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { emailVerified: true, $unset: { verifyTokenHash: '', verifyTokenExpires: '' } })
      .exec();
  }

  // ---- US-03: đặt lại mật khẩu ----
  async setResetToken(id: string, tokenHash: string, expires: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { resetTokenHash: tokenHash, resetTokenExpires: expires }).exec();
  }

  findByValidResetToken(tokenHash: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ resetTokenHash: tokenHash, resetTokenExpires: { $gt: new Date() } })
      .exec();
  }

  async resetPassword(id: string, plainPassword: string): Promise<void> {
    const password = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    await this.userModel
      .findByIdAndUpdate(id, {
        password,
        refreshTokenHashes: [], // thu hồi mọi phiên cũ sau khi đổi mật khẩu
        $unset: { resetTokenHash: '', resetTokenExpires: '' },
      })
      .exec();
  }

  // ---- BE-05/BE-06: refresh token (lưu bản băm để có thể thu hồi) ----
  async addRefreshTokenHash(id: string, tokenHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $addToSet: { refreshTokenHashes: tokenHash } }).exec();
  }

  async removeRefreshTokenHash(id: string, tokenHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $pull: { refreshTokenHashes: tokenHash } }).exec();
  }

  async hasRefreshTokenHash(id: string, tokenHash: string): Promise<boolean> {
    const user = await this.userModel.exists({ _id: id, refreshTokenHashes: tokenHash }).exec();
    return user !== null;
  }
}
