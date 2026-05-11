import { prisma } from '../config/database.js'
import { env } from '../config/env.js'

/**
 * بيرجع تاريخ النهارده كـ string "YYYY-MM-DD"
 * مش DateTime عشان نتجنب مشاكل الـ timezone
 */
function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export const LimitService = {
  /**
   * بيجيب عدد الرسائل المتبقية للـ user النهارده
   */
  async getRemaining(userId: string): Promise<number> {
    const date = todayString()

    const record = await prisma.dailyLimit.findUnique({
      where: { userId_date: { userId, date } },
    })

    const used = record?.count ?? 0
    return Math.max(0, env.DAILY_MESSAGE_LIMIT - used)
  },

  /**
   * بيتحقق إن الـ user لسه عنده رسائل
   */
  async canSend(userId: string): Promise<boolean> {
    const remaining = await this.getRemaining(userId)
    return remaining > 0
  },

  /**
   * بيزود الـ count بـ 1 — بيستخدم upsert عشان يعمل create أو update
   */
  async increment(userId: string): Promise<void> {
    const date = todayString()

    await prisma.dailyLimit.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, count: 1 },
      update: { count: { increment: 1 } },
    })
  },

  /**
   * بيرجع وقت reset الـ limit (بداية اليوم الجاي)
   */
  getResetTime(): Date {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow
  },

  /**
   * بيجيب الـ status الكامل للـ user
   */
  async getStatus(userId: string): Promise<{
    remaining: number
    used: number
    limit: number
    resetAt: Date
  }> {
    const remaining = await this.getRemaining(userId)
    return {
      remaining,
      used: env.DAILY_MESSAGE_LIMIT - remaining,
      limit: env.DAILY_MESSAGE_LIMIT,
      resetAt: this.getResetTime(),
    }
  },
}
