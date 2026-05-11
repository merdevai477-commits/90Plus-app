import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
// uuid v14+ — named exports only, no default export
import { prisma } from '../config/database.js'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { env } from '../config/env.js'

const router = Router()

// ─── Schemas ──────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  })

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)
  const deviceId = uuidv4()

  // احفظ الـ refresh token
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt, deviceId },
  })

  res.status(201).json({ user, accessToken, refreshToken })
})

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', rateLimit(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const { email, password, deviceId } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)
  const resolvedDeviceId = deviceId ?? uuidv4()

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt, deviceId: resolvedDeviceId },
  })

  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  })
})

// ─── Refresh Token ────────────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const { refreshToken } = parsed.data

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  })

  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
    return
  }

  try {
    const payload = verifyToken(refreshToken)

    // Rotate: احذف القديم واعمل جديد
    await prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newAccessToken = generateAccessToken(payload.userId)
    const newRefreshToken = generateRefreshToken(payload.userId)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        token: newRefreshToken,
        expiresAt,
        deviceId: stored.deviceId,
      },
    })

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }
  res.json({ message: 'Logged out successfully' })
})

export default router
