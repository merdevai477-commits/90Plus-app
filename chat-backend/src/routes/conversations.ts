import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router = Router()

// كل الـ routes محتاجة authentication
router.use(authMiddleware)

// ─── GET /conversations — جيب كل المحادثات ───────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.userId! },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { text: true, createdAt: true },
      },
    },
  })

  res.json({ conversations })
})

// ─── POST /conversations — محادثة جديدة ──────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  const conversation = await prisma.conversation.create({
    data: { userId: req.userId!, title: 'محادثة جديدة' },
    select: { id: true, title: true, isPinned: true, createdAt: true },
  })

  res.status(201).json({ conversation })
})

// ─── GET /conversations/:id/messages — جيب رسائل محادثة ──────────────────────
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  // تأكد إن المحادثة بتاعت الـ user ده
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  })

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      text: true,
      category: true,
      imageUrl: true,
      createdAt: true,
    },
  })

  res.json({ messages })
})

// ─── PATCH /conversations/:id — تعديل (عنوان أو pin) ─────────────────────────
const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  isPinned: z.boolean().optional(),
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  })

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }

  const updated = await prisma.conversation.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: { id: true, title: true, isPinned: true, updatedAt: true },
  })

  res.json({ conversation: updated })
})

// ─── DELETE /conversations/:id ────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  })

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }

  await prisma.conversation.delete({ where: { id: req.params.id } })
  res.json({ message: 'Deleted successfully' })
})

export default router
