import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Rate limiting en 2 capas para el endpoint de login.
 * El estado se guarda en memoria (Map). Para escalar a múltiples instancias,
 * reemplazar los Maps por llamadas a Redis (ioredis) sin cambiar la interfaz.
 *
 * Capa 1 — por IP:
 *   10 intentos en 15 minutos.
 *   Si supera → 429 + { captchaRequired: true }  ← hook para CAPTCHA futuro
 *
 * Capa 2 — por IP + email:
 *   5 intentos en 15 minutos para la misma combinación IP+email.
 *   Si supera → 429 Too Many Requests
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LIMIT_IP = 10;
const LIMIT_IP_EMAIL = 5;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Almacenamiento en memoria. Se limpia automáticamente cuando expira la ventana.
const storeIp = new Map<string, RateLimitEntry>();
const storeIpEmail = new Map<string, RateLimitEntry>();

function increment(store: Map<string, RateLimitEntry>, key: string): number {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

export function resetRateLimit(ip: string, email: string): void {
  storeIp.delete(ip);
  storeIpEmail.delete(buildIpEmailKey(ip, email));
}

function buildIpEmailKey(ip: string, email: string): string {
  const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${ip}:${emailHash}`;
}

@Injectable()
export class ThrottleLoginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Leer IP real (trust proxy configurado en main.ts)
    const ip: string =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    // Capa 1: por IP
    const ipCount = increment(storeIp, ip);
    if (ipCount > LIMIT_IP) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'RATE_LIMITED',
          message: 'Demasiados intentos. Inténtalo más tarde.',
          captchaRequired: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Capa 2: por IP + email (solo si viene el email en el body)
    const email: string | undefined = req.body?.email;
    if (email) {
      const key = buildIpEmailKey(ip, email);
      const ipEmailCount = increment(storeIpEmail, key);
      if (ipEmailCount > LIMIT_IP_EMAIL) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'RATE_LIMITED',
            message: 'Demasiados intentos para esta cuenta. Inténtalo más tarde.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
