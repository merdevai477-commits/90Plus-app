import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { Server } from 'http'
import { verifyToken } from '../middleware/auth.js'
import { LimitService } from '../services/LimitService.js'
import { promptService } from '../services/PromptService.js'
import { prisma } from '../config/database.js'
import { aiOrchestrator } from '../services/ai.orchestrator.js'

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string
  isAlive: boolean
}

interface WSMessage {
  type: 'chat' | 'typing' | 'ping'
  conversationId?: string
  message?: string
}

type WSResponse =
  | { type: 'connected'; userId: string }
  | { type: 'typing'; isTyping: boolean }
  | { type: 'message'; userMessage: object; aiMessage: object; limit: object }
  | { type: 'error'; code: string; message: string; resetAt?: Date }
  | { type: 'pong' }

function send(ws: WebSocket, data: WSResponse): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    ws.isAlive = true

    // ─── JWT Authentication ────────────────────────────────────────────────
    // Token يجي في الـ query string: /ws?token=xxx
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Missing token' })
      ws.close(1008, 'Unauthorized')
      return
    }

    try {
      const payload = verifyToken(token)
      ws.userId = payload.userId
    } catch {
      send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired token' })
      ws.close(1008, 'Unauthorized')
      return
    }

    send(ws, { type: 'connected', userId: ws.userId! })
    console.log(`🔌 WS connected: user ${ws.userId}`)

    // ─── Message Handler ───────────────────────────────────────────────────
    ws.on('message', async (raw) => {
      let data: WSMessage

      try {
        data = JSON.parse(raw.toString()) as WSMessage
      } catch {
        send(ws, { type: 'error', code: 'INVALID_JSON', message: 'Invalid JSON' })
        return
      }

      // Ping/Pong
      if (data.type === 'ping') {
        send(ws, { type: 'pong' })
        return
      }

      if (data.type === 'chat') {
        await handleChatMessage(ws, data)
      }
    })

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('close', () => {
      console.log(`🔌 WS disconnected: user ${ws.userId}`)
    })

    ws.on('error', (err) => {
      console.error(`WS error for user ${ws.userId}:`, err.message)
    })
  })

  // ─── Heartbeat — يكتشف الـ connections الميتة ─────────────────────────────
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket
      if (!ws.isAlive) {
        ws.terminate()
        return
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))

  return wss
}

// ─── Chat Message Handler ──────────────────────────────────────────────────────
async function handleChatMessage(
  ws: AuthenticatedWebSocket,
  data: WSMessage
): Promise<void> {
  const userId = ws.userId!
  const { conversationId, message } = data

  if (!conversationId || !message?.trim()) {
    send(ws, { type: 'error', code: 'INVALID_INPUT', message: 'conversationId and message are required' })
    return
  }

  // 1. تحقق من المحادثة
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  })

  if (!conversation) {
    send(ws, { type: 'error', code: 'NOT_FOUND', message: 'Conversation not found' })
    return
  }

  // 2. تحقق من الـ limit
  const canSend = await LimitService.canSend(userId)
  if (!canSend) {
    const status = await LimitService.getStatus(userId)
    send(ws, {
      type: 'error',
      code: 'LIMIT_REACHED',
      message: 'Daily limit reached',
      resetAt: status.resetAt,
    })
    return
  }

  // 3. أظهر typing indicator
  send(ws, { type: 'typing', isTyping: true })

  // 4. جيب تاريخ المحادثة
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: { role: true, text: true },
  })

  // 5. احفظ رسالة الـ user
  const category = promptService.detectCategory(message)

  const userMsg = await prisma.message.create({
    data: { conversationId, role: 'user', text: message.trim(), category },
    select: { id: true, role: true, text: true, category: true, createdAt: true },
  })

  // 6. زود الـ count
  await LimitService.increment(userId)

  // 7. ابعت للـ AI
  let aiText = '';
  try {
    const stream = aiOrchestrator.streamChat(
      message.trim(),
      history.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
      'أنت مساعد رياضي متخصص.'
    );
    for await (const chunk of stream) {
      if (!chunk.done) aiText += chunk.token;
    }
  } catch (err) {
    console.error('AI error:', err)
    send(ws, { type: 'typing', isTyping: false })
    send(ws, { type: 'error', code: 'AI_ERROR', message: 'AI service unavailable' })
    return
  }

  // 8. احفظ رد الـ AI
  const aiMsg = await prisma.message.create({
    data: { conversationId, role: 'ai', text: aiText, category },
    select: { id: true, role: true, text: true, category: true, createdAt: true },
  })

  // 9. لو أول رسالة، ولّد عنوان مبسط
  if (history.length === 0) {
    const title = message.trim().substring(0, 30) + '...';
    await prisma.conversation.update({ where: { id: conversationId }, data: { title } }).catch(console.error);
  }

  // 10. حدّث المحادثة
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  // 11. جيب الـ limit الجديد وابعت الرد
  const limitStatus = await LimitService.getStatus(userId)

  send(ws, { type: 'typing', isTyping: false })
  send(ws, {
    type: 'message',
    userMessage: userMsg,
    aiMessage: aiMsg,
    limit: limitStatus,
  })
}
