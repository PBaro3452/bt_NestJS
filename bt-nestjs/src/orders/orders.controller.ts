import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CancelOrderDto, SetStatusDto } from './dto/order-action.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser, JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../users/schemas/user.schema';
import { CustomJwtService } from '../auth/jwt/custom-jwt.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwt: CustomJwtService,
  ) {}

  // US-07 — đặt món. AD-00: chỉ role 'user' được đặt — chặn admin ngay ở backend
  // (không chỉ ẩn nút trên UI), nếu không admin vẫn gọi thẳng API để đặt được.
  @Post()
  @Roles(UserRole.User)
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.create(dto, user);
  }

  // US-08 — đơn của chính mình.
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findMine(user);
  }

  // AD-04 — thống kê dashboard (đặt trước ':id' để không bị nuốt route).
  @Get('stats')
  @Roles(UserRole.Admin)
  stats() {
    return this.ordersService.stats();
  }

  // AD-01 — toàn bộ đơn (admin).
  @Get()
  @Roles(UserRole.Admin)
  findAll() {
    return this.ordersService.findAll();
  }

  // US-09 — user sửa đơn.
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.update(id, dto, user);
  }

  // US-10 — user tự huỷ đơn.
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.cancelByUser(id, dto.reason, user);
  }

  // AD-02/AD-03 — admin đổi trạng thái (huỷ bắt buộc lý do).
  @Patch(':id/status')
  @Roles(UserRole.Admin)
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.ordersService.setStatus(id, dto.status, dto.cancelReason);
  }

  // BE-18 — SSE: thông báo realtime khi có đơn mới / đổi trạng thái.
  // EventSource không gắn được header Authorization, nên access token truyền qua query
  // và được tự xác thực tại đây (route @Public để bỏ qua guard mặc định).
  @Public()
  @Sse('events')
  events(@Query('token') token: string): Observable<MessageEvent> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token ?? '');
    } catch {
      throw new UnauthorizedException('Token không hợp lệ cho kết nối realtime');
    }
    const isAdmin = payload.role === UserRole.Admin;
    return this.ordersService.stream().pipe(
      // User chỉ nhận sự kiện đơn của mình; admin nhận tất cả.
      filter((event) => isAdmin || event.ownerId === payload.sub),
      map((event) => ({ data: event }) as MessageEvent),
    );
  }
}
