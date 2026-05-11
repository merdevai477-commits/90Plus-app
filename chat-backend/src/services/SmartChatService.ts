import { cacheService } from './CacheService.js'
import { aiService, Message } from './AIService.js'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SmartChatResult {
  answer: string
  fromCache: boolean
  usedProvider: string
  responseTime: number
  quick_replies: string[]
  related_intents: string[]
  confidence: number
}

// ─── SmartChatService ─────────────────────────────────────────────────────────
export class SmartChatService {
  async processMessage(
    userId: string,
    message: string,
    conversationHistory: Message[],
    category: string,
    dialect: string,
    systemPrompt: string,
    maxTokens = 380
  ): Promise<SmartChatResult> {
    const start = Date.now()

    // ── Step 1: Check cache ──────────────────────────────────────────────────
    const cached = cacheService.findAnswer(message, category)
    if (cached) {
      console.log(`⚡ Cache hit for: "${message.slice(0, 50)}" (confidence: ${cached.confidence})`)
      return {
        answer: cached.answer,
        fromCache: true,
        usedProvider: 'cache',
        responseTime: Date.now() - start,
        quick_replies: cached.quick_replies,
        related_intents: cached.related_intents,
        confidence: cached.confidence,
      }
    }

    // ── Step 2: Call AI with fallback ────────────────────────────────────────
    const { content, usedProvider } = await aiService.chat(
      [...conversationHistory, { role: 'user', content: message }],
      systemPrompt,
      maxTokens
    )

    // ── Step 3: Save to cache (auto-generates quick_replies + related_intents) ─
    cacheService.saveAnswer(message, content, category, dialect)

    return {
      answer: content,
      fromCache: false,
      usedProvider,
      responseTime: Date.now() - start,
      quick_replies: [],     // مش بيرجعوا للـ AI call الأولى — بس بيتحفظوا للكاش
      related_intents: [],
      confidence: 1.0,
    }
  }
}

export const smartChatService = new SmartChatService()
