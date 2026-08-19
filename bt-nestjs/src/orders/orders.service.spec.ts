import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from './schemas/order.schema';
import { RecipesService } from '../recipes/recipes.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../users/schemas/user.schema';

const VALID_ID = '507f1f77bcf86cd799439011';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    userId: { toString: () => 'u1' },
    status: OrderStatus.Pending,
    portions: 2,
    note: '',
    cancelReason: '',
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: () => ({ id: VALID_ID }),
    ...overrides,
  };
}

function buildService(order: ReturnType<typeof makeOrder>) {
  const orderModel = {
    findById: jest.fn(() => ({ exec: () => Promise.resolve(order) })),
  } as unknown as ConstructorParameters<typeof OrdersService>[0];
  const recipesService = {} as RecipesService;
  return new OrdersService(orderModel, recipesService);
}

const user: AuthenticatedUser = { userId: 'u1', email: 'u1@x.com', name: 'U1', role: UserRole.User };

describe('OrdersService (quy tắc nghiệp vụ)', () => {
  it('AD-03: admin huỷ đơn mà không nhập lý do -> lỗi', async () => {
    const service = buildService(makeOrder());
    await expect(service.setStatus(VALID_ID, OrderStatus.Cancelled, '  ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('US-09: không cho sửa đơn khi đã "Đang làm"', async () => {
    const service = buildService(makeOrder({ status: OrderStatus.Preparing }));
    await expect(service.update(VALID_ID, { portions: 5 }, user)).rejects.toThrow(BadRequestException);
  });

  it('US-10: user huỷ đơn đang chờ -> trạng thái Cancelled + lý do mặc định', async () => {
    const order = makeOrder();
    const service = buildService(order);
    const result = await service.cancelByUser(VALID_ID, undefined, user);
    expect(result.status).toBe(OrderStatus.Cancelled);
    expect(result.cancelReason).toBe('Người dùng tự huỷ');
    expect(order.save).toHaveBeenCalled();
  });
});
