import { createHash, randomBytes } from 'crypto';

// Token "mờ" (opaque) dùng cho refresh / xác thực email / đặt lại mật khẩu: là chuỗi
// ngẫu nhiên đủ mạnh, KHÔNG mang thông tin. Ở DB chỉ lưu bản băm SHA-256 — kể cả lộ DB
// cũng không dùng lại được token gốc. So khớp bằng cách băm token nhận vào rồi đối chiếu.

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
