import { Controller, MessageEvent, Query, Sse, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Public } from '../auth/decorators/public.decorator';
import { CustomJwtService } from '../auth/jwt/custom-jwt.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SessionEventsService } from './session-events.service';

// Kênh SSE toàn app cho từng người dùng: client (app.ts) kết nối ngay khi đăng nhập.
// EventSource không gắn được header nên token đi qua query (route @Public, tự xác thực).
@Controller('realtime')
export class SessionController {
  constructor(
    private readonly jwt: CustomJwtService,
    private readonly sessions: SessionEventsService,
  ) {}

  @Public()
  @Sse('session')
  session(@Query('token') token: string): Observable<MessageEvent> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token ?? '');
    } catch {
      throw new UnauthorizedException('Token không hợp lệ cho kênh phiên');
    }
    return this.sessions.stream().pipe(
      filter((event) => event.userId === payload.sub),
      map((event) => ({ data: event }) as MessageEvent),
    );
  }
}
