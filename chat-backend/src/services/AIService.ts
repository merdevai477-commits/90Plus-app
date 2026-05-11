import OpenAI from 'openai'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface Provider {
  name: string
  model: string
  baseUrl: string
  apiKey: string
  priority: number
}

// ─── Providers ────────────────────────────────────────────────────────────────
// Priority: Gemini Flash (primary) → GPT-OSS 120B (first fallback) → others
const PROVIDERS: Provider[] = [
  {
    name: 'Gemini Flash',
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GOOGLE_AI_KEY ?? '',
    priority: 1,
  },
  {
    name: 'GPT-OSS 120B',
    model: 'openai/gpt-oss-120b:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '',
    priority: 2,
  },
  {
    name: 'Gemma 4 26B',
    model: 'google/gemma-4-26b-a4b-it:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '',
    priority: 3,
  },
  {
    name: 'GPT-OSS 20B',
    model: 'openai/gpt-oss-20b:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '',
    priority: 4,
  },
  {
    name: 'Nemotron Super',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '',
    priority: 5,
  },
]

// ─── AIService ────────────────────────────────────────────────────────────────
export class AIService {
  // ── Try a single provider ──────────────────────────────────────────────────
  async tryProvider(
    provider: Provider,
    messages: Message[],
    systemPrompt: string,
    maxTokens: number
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new Error(`No API key for provider: ${provider.name}`)
    }

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': '90Plus AI Chat',
      },
    })

    const response = await client.chat.completions.create({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: maxTokens,
      temperature: 0.45,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from provider')
    return content
  }

  // ── Chat with automatic fallback ───────────────────────────────────────────
  async chat(
    messages: Message[],
    systemPrompt: string,
    maxTokens = 380
  ): Promise<{ content: string; usedProvider: string; fromCache: boolean }> {
    const errors: string[] = []

    for (const provider of PROVIDERS) {
      try {
        console.log(`🤖 Trying provider: ${provider.name}`)
        const content = await this.tryProvider(provider, messages, systemPrompt, maxTokens)
        console.log(`✅ Success: ${provider.name}`)
        return { content, usedProvider: provider.name, fromCache: false }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit')
        const isUnavailable = msg.includes('503') || msg.toLowerCase().includes('unavailable')

        console.warn(`⚠️  Provider ${provider.name} failed: ${msg.slice(0, 80)}`)
        errors.push(`${provider.name}: ${msg.slice(0, 60)}`)

        // Only skip to next on rate limit / unavailable — rethrow on auth errors
        if (!isRateLimit && !isUnavailable && msg.includes('401')) {
          console.error(`🔑 Auth error on ${provider.name} — skipping`)
        }
        // Continue to next provider
      }
    }

    throw new Error(`All providers failed:\n${errors.join('\n')}`)
  }
}

export const aiService = new AIService()
