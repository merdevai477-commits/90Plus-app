import type { Request } from 'express';

export type AppLanguage = 'ar' | 'en';

/** Resolve app language from query (?language=ar|en) or Accept-Language header. */
export function resolveAppLanguage(req: Request): AppLanguage {
  const query = req.query.language;
  if (typeof query === 'string') {
    const q = query.trim().toLowerCase();
    if (q.startsWith('en')) return 'en';
    if (q.startsWith('ar')) return 'ar';
  }

  const accept = req.headers['accept-language'];
  if (typeof accept === 'string') {
    const first = accept.split(',')[0]?.trim().toLowerCase() ?? '';
    if (first.startsWith('en')) return 'en';
    if (first.startsWith('ar')) return 'ar';
  }

  const envDefault = process.env.APP_DEFAULT_LANGUAGE?.trim().toLowerCase();
  if (envDefault?.startsWith('en')) return 'en';
  return 'ar';
}
