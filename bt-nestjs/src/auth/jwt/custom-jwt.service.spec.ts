import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomJwtService } from './custom-jwt.service';

// BE-03 — kiểm chứng Custom JWT tự triển khai: ký được, verify lại đúng payload,
// bắt được token bị sửa (sai chữ ký) và token hết hạn.
describe('CustomJwtService', () => {
  const config = { getOrThrow: () => 'test-secret-key' } as unknown as ConfigService;
  const jwt = new CustomJwtService(config);

  it('sign rồi verify trả lại đúng payload', () => {
    const token = jwt.sign({ sub: 'u1', role: 'user' }, { expiresInSeconds: 60 });
    const payload = jwt.verify<{ sub: string; role: string }>(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('user');
  });

  it('từ chối token bị sửa nội dung (sai chữ ký)', () => {
    const token = jwt.sign({ sub: 'u1' }, { expiresInSeconds: 60 });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', exp: 9_999_999_999 })).toString('base64url');
    const forged = `${header}.${forgedPayload}.${signature}`;
    expect(() => jwt.verify(forged)).toThrow(UnauthorizedException);
  });

  it('từ chối token đã hết hạn', () => {
    const token = jwt.sign({ sub: 'u1' }, { expiresInSeconds: -1 });
    expect(() => jwt.verify(token)).toThrow(UnauthorizedException);
  });

  it('từ chối chuỗi không đúng định dạng JWT', () => {
    expect(() => jwt.verify('không-phải-jwt')).toThrow(UnauthorizedException);
  });
});
