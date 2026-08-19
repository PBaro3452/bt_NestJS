import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CustomJwtService } from './jwt/custom-jwt.service';
import { UsersModule } from '../users/users.module';

// BE-03 — không dùng @nestjs/jwt/passport nữa; access & refresh token do CustomJwtService
// tự ký/kiểm tra. CustomJwtService được export để JwtAuthGuard (global) dùng lại.
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, CustomJwtService],
  exports: [CustomJwtService],
})
export class AuthModule {}
