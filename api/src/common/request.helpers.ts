import type { Request } from 'express';

export function extractIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export function extractSource(req: Request): 'web' | 'app' {
  return req.headers['x-source'] === 'app' ? 'app' : 'web';
}
