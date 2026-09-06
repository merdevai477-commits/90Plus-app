import type { Request } from 'express';

const PRIVATE_IP =
  /^(::1|localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc00:|fe80:)/i;

export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const raw =
    (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() ||
    req.headers['x-real-ip']?.toString()?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    '';
  return raw.replace(/^::ffff:/, '');
}

export function isPublicIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  return !PRIVATE_IP.test(ip);
}

export function countryCodeFromHeaders(req: Request): string | null {
  const keys = [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'cloudfront-viewer-country',
    'x-country-code',
    'x-appengine-country',
  ] as const;
  for (const key of keys) {
    const value = req.headers[key];
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'string' && /^[A-Z]{2}$/i.test(raw.trim()) && raw.trim().toUpperCase() !== 'XX') {
      return raw.trim();
    }
  }
  return null;
}
