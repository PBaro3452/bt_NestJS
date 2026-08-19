import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// BE-10 — Middleware: ghi log mọi request HTTP (method, URL, mã trạng thái, thời gian xử lý).
// Đăng ký toàn cục trong AppModule qua MiddlewareConsumer.
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
    });
    next();
  }
}
