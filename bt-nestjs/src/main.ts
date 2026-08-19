import { setServers } from 'dns';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Máy dev này cấu hình DNS nội bộ (127.0.0.1) không trả lời được truy vấn SRV record
// mà "mongodb+srv://" cần để tìm cluster Atlas -> ép Node dùng DNS công cộng.
setServers(['8.8.8.8', '1.1.1.1']);

async function bootstrap() {
  // Tắt body-parser mặc định (giới hạn 100kb) để tự cấu hình giới hạn lớn hơn —
  // cần thiết vì ảnh công thức tải lên được mã hoá base64 rồi gửi trong JSON body.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  // Cho phép localhost:4200 (dev trên chính máy này) lẫn bất kỳ IP LAN nào ở cổng 4200
  // — IP LAN của máy có thể đổi mỗi lần kết nối Wi-Fi khác, nên dùng regex thay vì
  // hardcode một IP cụ thể, để chia sẻ app cho người khác trong cùng mạng luôn hoạt động.
  app.enableCors({
    origin: [/^http:\/\/localhost:4200$/, /^http:\/\/(\d{1,3}\.){3}\d{1,3}:4200$/],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
