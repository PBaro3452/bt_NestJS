import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

// BE-03 — Custom JWT: tự ký/kiểm tra JWT (HS256) bằng module crypto của Node, KHÔNG
// dùng @nestjs/jwt. Mục đích là tự kiểm soát toàn bộ vòng đời token (header, payload,
// chữ ký, hạn dùng) thay vì phụ thuộc hoàn toàn vào thư viện có sẵn.

export interface JwtSignOptions {
  expiresInSeconds: number;
}

interface BaseClaims {
  iat: number;
  exp: number;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

@Injectable()
export class CustomJwtService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  // Ký token: base64url(header).base64url(payload).HMAC-SHA256(header.payload)
  sign(payload: Record<string, unknown>, options: JwtSignOptions): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const fullPayload: Record<string, unknown> & BaseClaims = {
      ...payload,
      iat: now,
      exp: now + options.expiresInSeconds,
    };
    const headerPart = base64urlEncode(JSON.stringify(header));
    const payloadPart = base64urlEncode(JSON.stringify(fullPayload));
    const signingInput = `${headerPart}.${payloadPart}`;
    return `${signingInput}.${this.signHmac(signingInput)}`;
  }

  // Kiểm tra chữ ký (timing-safe) + hạn dùng; trả payload đã giải mã hoặc ném lỗi 401.
  verify<T extends object = Record<string, unknown>>(token: string): T {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const [headerPart, payloadPart, signature] = parts;
    const expected = this.signHmac(`${headerPart}.${payloadPart}`);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Chữ ký token không hợp lệ');
    }

    let payload: T & Partial<BaseClaims>;
    try {
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as T & Partial<BaseClaims>;
    } catch {
      throw new UnauthorizedException('Không đọc được nội dung token');
    }

    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token đã hết hạn');
    }
    return payload;
  }

  private signHmac(signingInput: string): string {
    return createHmac('sha256', this.secret).update(signingInput).digest('base64url');
  }
}
