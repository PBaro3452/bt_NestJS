import { Global, Module } from '@nestjs/common';
import { SessionEventsService } from './session-events.service';
import { SessionController } from './session.controller';
import { CustomJwtService } from '../auth/jwt/custom-jwt.service';

// @Global để mọi service (vd. UsersService) inject được SessionEventsService mà không phải
// import chéo. Tự cung cấp CustomJwtService (chỉ phụ thuộc ConfigService toàn cục) để tránh
// import AuthModule -> tránh vòng lặp phụ thuộc module.
@Global()
@Module({
  controllers: [SessionController],
  providers: [SessionEventsService, CustomJwtService],
  exports: [SessionEventsService],
})
export class RealtimeModule {}
