import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store — في production استخدم Redis
const store = new Map<string, RateLimitEntry>()

/**
 * Rate limiter بسيط — يحمي من الـ abuse على endpoints معينة
 * @param maxRequests عدد الطلبات المسموح بيها
 * @param windowMs نافذة الوقت بالـ milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()

    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      // نافذة جديدة
      store.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      })
      return
    }

    entry.count++
    next()
  }
}

// تنظيف الـ entries القديمة كل 5 دقايق
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)
