import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable, Subject } from 'rxjs';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RecipesService } from '../recipes/recipes.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../users/schemas/user.schema';

// Sự kiện phát qua SSE (BE-18). `ownerId` để lọc: user chỉ nhận đơn của mình, admin nhận tất cả.
export interface OrderEvent {
  type: 'created' | 'updated' | 'status';
  ownerId: string;
  order: Record<string, unknown>;
}

// Các trạng thái mà user còn được phép sửa/huỷ đơn (gợi ý #4: chỉ khi CHƯA "Đang làm").
const USER_EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.Pending];

@Injectable()
export class OrdersService {
  private readonly events$ = new Subject<OrderEvent>();

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly recipesService: RecipesService,
  ) {}

  // Luồng sự kiện cho SSE controller subscribe.
  stream(): Observable<OrderEvent> {
    return this.events$.asObservable();
  }

  private emit(type: OrderEvent['type'], order: OrderDocument): void {
    this.events$.next({
      type,
      ownerId: order.userId.toString(),
      order: order.toJSON() as unknown as Record<string, unknown>,
    });
  }

  private async findOwned(id: string, user: AuthenticatedUser): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy đơn #${id}`);
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn #${id}`);
    }
    if (user.role !== UserRole.Admin && order.userId.toString() !== user.userId) {
      throw new ForbiddenException('Bạn chỉ thao tác được trên đơn của chính mình');
    }
    return order;
  }

  // US-07 — tạo đơn, chụp lại thông tin món & người đặt tại thời điểm đặt.
  async create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<OrderDocument> {
    const recipe = await this.recipesService.findOne(dto.recipeId); // ném 404 nếu món không tồn tại
    const order = await this.orderModel.create({
      userId: new Types.ObjectId(user.userId),
      customerName: user.name,
      customerEmail: user.email,
      recipeId: recipe._id,
      recipeName: recipe.name,
      recipeImgUrl: recipe.imgUrl,
      unitPrice: recipe.price,
      portions: dto.portions,
      note: dto.note ?? '',
      status: OrderStatus.Pending,
    });
    this.emit('created', order);
    return order;
  }

  // US-14 — khi user xoá tài khoản: ẩn danh các đơn cũ (giữ lại để admin/dashboard vẫn
  // thống kê đúng, nhưng không lộ danh tính). Đơn không còn link tới tài khoản mới cùng email
  // vì được lọc theo userId — nên đăng ký lại bằng email cũ sẽ ra profile hoàn toàn mới.
  async anonymizeByUser(userId: string): Promise<void> {
    await this.orderModel
      .updateMany(
        { userId: new Types.ObjectId(userId) },
        { customerName: '(Tài khoản đã xoá)', customerEmail: '(đã xoá)' },
      )
      .exec();
  }

  // US-08 — đơn của chính user. Cast tường minh sang ObjectId để chắc chắn khớp
  // (không phụ thuộc việc Mongoose tự cast string trong filter).
  findMine(user: AuthenticatedUser): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ userId: new Types.ObjectId(user.userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // AD-01 — toàn bộ đơn (chỉ admin, đã chặn ở controller bằng @Roles).
  findAll(): Promise<OrderDocument[]> {
    return this.orderModel.find().sort({ createdAt: -1 }).exec();
  }

  // US-09 — user sửa đơn (số khẩu phần/ghi chú), chỉ khi đơn chưa chuyển "Đang làm".
  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser): Promise<OrderDocument> {
    const order = await this.findOwned(id, user);
    if (!USER_EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Chỉ sửa được đơn khi đang ở trạng thái "Chờ xác nhận".');
    }
    if (dto.portions !== undefined) {
      order.portions = dto.portions;
    }
    if (dto.note !== undefined) {
      order.note = dto.note;
    }
    await order.save();
    this.emit('updated', order);
    return order;
  }

  // US-10 — user tự huỷ đơn, chỉ khi chưa "Đang làm".
  async cancelByUser(id: string, reason: string | undefined, user: AuthenticatedUser): Promise<OrderDocument> {
    const order = await this.findOwned(id, user);
    if (!USER_EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Không thể huỷ đơn đã được tiếp nhận. Vui lòng liên hệ quản trị.');
    }
    order.status = OrderStatus.Cancelled;
    order.cancelReason = reason?.trim() || 'Người dùng tự huỷ';
    await order.save();
    this.emit('status', order);
    return order;
  }

  // AD-02/AD-03 — admin đổi trạng thái; huỷ thì bắt buộc có lý do.
  async setStatus(id: string, status: OrderStatus, cancelReason: string | undefined): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Không tìm thấy đơn #${id}`);
    }
    if (status === OrderStatus.Cancelled && !cancelReason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do huỷ đơn.');
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn #${id}`);
    }
    order.status = status;
    order.cancelReason = status === OrderStatus.Cancelled ? cancelReason!.trim() : '';
    await order.save();
    this.emit('status', order);
    return order;
  }

  // AD-04 — số liệu cho dashboard (gợi ý #6).
  async stats(): Promise<{
    byStatus: Record<string, number>;
    last7Days: { date: string; count: number }[];
    topRecipes: { recipeName: string; count: number }[];
    totalRevenue: number;
    totalOrders: number;
  }> {
    const [byStatusAgg, last7DaysAgg, topRecipesAgg, revenueAgg, totalOrders] = await Promise.all([
      this.orderModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.buildLast7Days(),
      this.orderModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$recipeName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      // Doanh thu tính trên đơn đã Hoàn thành.
      this.orderModel.aggregate<{ total: number }>([
        { $match: { status: OrderStatus.Completed } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$unitPrice', '$portions'] } } } },
      ]),
      this.orderModel.countDocuments().exec(),
    ]);

    const byStatus: Record<string, number> = {
      [OrderStatus.Pending]: 0,
      [OrderStatus.Preparing]: 0,
      [OrderStatus.Completed]: 0,
      [OrderStatus.Cancelled]: 0,
    };
    for (const row of byStatusAgg) {
      byStatus[row._id] = row.count;
    }

    return {
      byStatus,
      last7Days: last7DaysAgg,
      topRecipes: topRecipesAgg.map((row) => ({ recipeName: row._id, count: row.count })),
      totalRevenue: revenueAgg[0]?.total ?? 0,
      totalOrders,
    };
  }

  // Đếm số đơn theo từng ngày trong 7 ngày gần nhất (bao gồm cả ngày không có đơn = 0).
  private async buildLast7Days(): Promise<{ date: string; count: number }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const rows = await this.orderModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]);
    const counts = new Map(rows.map((r) => [r._id, r.count]));

    const result: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      result.push({ date: key, count: counts.get(key) ?? 0 });
    }
    return result;
  }
}
