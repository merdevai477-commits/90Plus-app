/**
 * Simple server — OpenAI-compatible SDK
 * يشتغل مع OpenRouter / DeepSeek / أي OpenAI-compatible API
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { smartChatService } from './services/SmartChatService.js'
import { cacheService } from './services/CacheService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT ?? 3001
const AI_API_KEY = process.env.AI_API_KEY ?? ''
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1'
const AI_MODEL = process.env.AI_MODEL ?? 'deepseek/deepseek-chat'
const DAILY_LIMIT = Number(process.env.DAILY_MESSAGE_LIMIT ?? 5)

// ─── AI Client ────────────────────────────────────────────────────────────────
const ai = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:5173',
    'X-Title': '90Plus AI Chat',
  },
})

// ─── Persistent Daily Limit (stored in chat-store.json) ──────────────────────
function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getRemaining(userId: string): number {
  const store = ensureStore()
  const today = getToday()
  const userLimit = store.limits?.[userId]
  if (!userLimit || userLimit.date !== today) {
    return DAILY_LIMIT
  }
  return Math.max(0, DAILY_LIMIT - userLimit.count)
}

function incrementLimit(userId: string): void {
  const store = ensureStore()
  const today = getToday()
  if (!store.limits) store.limits = {}
  if (!store.limits[userId] || store.limits[userId].date !== today) {
    store.limits[userId] = { count: 1, date: today }
  } else {
    store.limits[userId].count++
  }
  saveStore(store)
}

function decrementLimit(userId: string): void {
  const store = ensureStore()
  const today = getToday()
  if (!store.limits?.[userId] || store.limits[userId].date !== today) return
  store.limits[userId].count = Math.max(0, store.limits[userId].count - 1)
  saveStore(store)
}

function getResetTime(): Date {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(0, 0, 0, 0)
  return t
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────
const promptsDir = path.join(__dirname, '../prompts')

function buildSystemPrompt(category: string, lengthMode: string = 'medium'): string {
  let base = ''
  try {
    base = fs.readFileSync(path.join(promptsDir, 'base.md'), 'utf-8')
  } catch {
    base = 'You are 90Plus AI, a helpful Arabic sports assistant.'
  }

  let categoryPrompt = ''
  try {
    categoryPrompt = fs.readFileSync(path.join(promptsDir, `${category}.md`), 'utf-8')
  } catch {
    try {
      categoryPrompt = fs.readFileSync(path.join(promptsDir, 'football.md'), 'utf-8')
    } catch {
      categoryPrompt = ''
    }
  }

  // short mode — أضف تعليمة الاختصار في البداية لتوفير tokens
  if (lengthMode === 'short') {
    return `${base}\n\n---\n\nSHORT MODE: Answer in 1-2 lines max. No examples needed.\n\n${categoryPrompt}`
  }

  return `${base}\n\n---\n\n${categoryPrompt}`
}

type Category = 'football' | 'training' | 'nutrition' | 'recovery'

function detectCategory(message: string): Category {
  const msg = message.toLowerCase()

  const scores: Record<Category, number> = {
    training:  0,
    nutrition: 0,
    recovery:  0,
    football:  0,
  }

  // ─── Training ───────────────────────────────────────
  const trainingPatterns = [
    { pattern: /تمرين|تدريب|تمارين|تدريبات/, weight: 3 },
    { pattern: /سرعة|قوة|لياقة|مهارة|رياضة/, weight: 2 },
    { pattern: /workout|training|exercise|drill/i, weight: 3 },
    { pattern: /sprint|agility|endurance|fitness/i, weight: 2 },
    { pattern: /كيف أتدرب|برنامج تدريب|خطة تدريب/, weight: 3 },
  ]

  // ─── Nutrition ──────────────────────────────────────
  const nutritionPatterns = [
    { pattern: /أكل|تغذية|وجبة|وجبات|طعام|غذاء/, weight: 3 },
    { pattern: /بروتين|كالوري|كربوهيدرات|دهون|فيتامين/, weight: 3 },
    { pattern: /diet|nutrition|protein|calorie|carb/i, weight: 3 },
    { pattern: /meal|eat|food|supplement|vitamin/i, weight: 2 },
    // سياق مهم جداً — قبل/بعد المباراة أو التمرين
    { pattern: /قبل\s*(التمرين|المباراة|اللعب)/, weight: 4 },
    { pattern: /بعد\s*(التمرين|المباراة|اللعب)/, weight: 4 },
    { pattern: /before\s*(training|match|game)/i, weight: 4 },
    { pattern: /after\s*(training|match|game)/i,  weight: 4 },
    { pattern: /وزن|نحافة|سمنة|حرق دهون/, weight: 2 },
    { pattern: /نظام غذائي|حمية|رجيم/, weight: 3 },
  ]

  // ─── Recovery ───────────────────────────────────────
  const recoveryPatterns = [
    { pattern: /إصابة|إصابات|جرح|كسر|خلع/, weight: 4 },
    { pattern: /ألم|أوجاع|وجع|تعب|إرهاق/, weight: 3 },
    { pattern: /استشفاء|تعافي|راحة|نوم/, weight: 3 },
    { pattern: /عضلة|مفصل|ركبة|كاحل|ظهر|رقبة|فخذ|ساق/, weight: 3 },
    { pattern: /injury|pain|recovery|rehab|rest/i, weight: 3 },
    { pattern: /muscle|joint|knee|ankle|back|hamstring|thigh/i, weight: 2 },
    { pattern: /تمزق|شد عضلي|شد|التواء|إجهاد/, weight: 4 },
  ]

  // ─── Football ───────────────────────────────────────
  const footballPatterns = [
    { pattern: /مباراة|ماتش|كأس|دوري|بطولة/, weight: 2 },
    { pattern: /لاعب|فريق|مدرب|حكم|ملعب/, weight: 2 },
    { pattern: /هدف|تسديد|تمريرة|دفاع|هجوم/, weight: 2 },
    { pattern: /match|game|league|cup|tournament/i, weight: 2 },
    { pattern: /player|team|coach|goal|assist/i, weight: 2 },
    { pattern: /تكتيك|تشكيل|استراتيجية|نظام/, weight: 2 },
    { pattern: /ميسي|رونالدو|مبابي|صلاح|نيمار/, weight: 2 },
    { pattern: /برشلونة|ريال|ليفربول|سيتي|يونايتد/, weight: 2 },
    // أسئلة عن لاعبين بالاسم — مين + اسم
    { pattern: /مين\s+\S+|who\s+is\s+\S+/i, weight: 2 },
    { pattern: /ويا|weah|زيدان|zidane|رونالدينيو|ronaldinho|رومارييو|romario/i, weight: 3 },
  ]

  const allPatterns: Record<Category, typeof trainingPatterns> = {
    training:  trainingPatterns,
    nutrition: nutritionPatterns,
    recovery:  recoveryPatterns,
    football:  footballPatterns,
  }

  // احسب الـ score لكل category
  for (const [cat, patterns] of Object.entries(allPatterns)) {
    for (const { pattern, weight } of patterns) {
      if (pattern.test(msg)) {
        scores[cat as Category] += weight
      }
    }
  }

  // لو الـ scores متساوية أو كلها صفر → football default
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
  return sorted[0][0] as Category
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8081',   // Expo dev server
    'http://10.0.2.2:8081',   // Android emulator → Expo
    process.env.FRONTEND_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json())

// ─── Request / Response Logger ────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now()
  const { method, path: reqPath } = req

  // Intercept res.end to capture status after response is sent
  const originalEnd = res.end.bind(res)
  ;(res as any).end = function (...args: any[]) {
    const ms = Date.now() - start
    const status = res.statusCode
    const statusIcon = status >= 500 ? '🔴' : status >= 400 ? '🟡' : status >= 200 ? '🟢' : '⚪'
    console.log(`${statusIcon} ${method} ${reqPath} → ${status} (${ms}ms)`)
    return originalEnd(...args)
  }

  next()
})

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', model: AI_MODEL, baseURL: AI_BASE_URL })
})

// ─── GET /api/chat/limit ──────────────────────────────────────────────────────
app.get('/api/chat/limit', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const remaining = getRemaining(userId)
  res.json({
    remaining,
    used: DAILY_LIMIT - remaining,
    limit: DAILY_LIMIT,
    resetAt: getResetTime(),
  })
})

app.get('/api/user/preferences', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const profile = getOrCreateUserProfile(userId)
  res.json({ preferences: profile.preferences, updatedAt: profile.updatedAt })
})

app.patch('/api/user/preferences', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const body = req.body ?? {}
  const next = updateUserPreferences(userId, {
    dialect: typeof body.dialect === 'string' ? body.dialect : undefined,
    responseLength: typeof body.responseLength === 'string' ? body.responseLength : undefined,
    tone: typeof body.tone === 'string' ? body.tone : undefined,
    format: typeof body.format === 'string' ? body.format : undefined,
    interests: Array.isArray(body.interests) ? body.interests.filter((v: unknown) => typeof v === 'string') : undefined,
    goal: typeof body.goal === 'string' ? body.goal : undefined,
  })
  res.json({ preferences: next.preferences, updatedAt: next.updatedAt })
})

// ─── POST /api/chat/send ──────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type StoredRole = 'user' | 'ai'

interface StoredMessage {
  id: string
  role: StoredRole
  text: string
  createdAt: string
}

interface Conversation {
  id: string
  userId: string
  title: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  messages: StoredMessage[]
}

interface PersistedStore {
  conversations: Conversation[]
  userProfiles: UserProfile[]
  limits: Record<string, { count: number; date: string }>
}

type PreferredLength = 'short' | 'medium' | 'detailed' | 'auto'
type PreferredFormat = 'bullets' | 'paragraphs' | 'table-when-needed' | 'auto'

interface UserPreferences {
  dialect: string
  responseLength: PreferredLength
  tone: string
  format: PreferredFormat
  interests: string[]
  goal: string
}

interface UserProfile {
  userId: string
  preferences: UserPreferences
  memory: {
    usedQuickFacts: string[]
    usedLeagueStats: string[]
  }
  updatedAt: string
}

const DEFAULT_PREFERENCES: UserPreferences = {
  dialect: 'auto',
  responseLength: 'auto',
  tone: 'friendly-professional',
  format: 'auto',
  interests: [],
  goal: '',
}

const dataDir = path.join(__dirname, '../data')
const storeFile = path.join(dataDir, 'chat-store.json')

function ensureStore(): PersistedStore {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  if (!fs.existsSync(storeFile)) {
    const initial: PersistedStore = { conversations: [], userProfiles: [], limits: {} }
    fs.writeFileSync(storeFile, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
  try {
    const raw = fs.readFileSync(storeFile, 'utf-8')
    const parsed = JSON.parse(raw) as PersistedStore
    if (!Array.isArray(parsed.conversations)) {
      return { conversations: [], userProfiles: [], limits: {} }
    }
    if (!Array.isArray(parsed.userProfiles)) {
      parsed.userProfiles = []
    }
    if (!parsed.limits || typeof parsed.limits !== 'object') {
      parsed.limits = {}
    }
    return parsed
  } catch {
    return { conversations: [], userProfiles: [], limits: {} }
  }
}

function saveStore(store: PersistedStore): void {
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf-8')
}

function getUserConversations(userId: string): Conversation[] {
  const store = ensureStore()
  return store.conversations
    .filter(c => c.userId === userId)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
}

function createConversation(userId: string, title = 'محادثة جديدة'): Conversation {
  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: randomUUID(),
    userId,
    title,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }

  const store = ensureStore()
  store.conversations.push(conversation)
  saveStore(store)
  return conversation
}

function findConversation(userId: string, conversationId: string): Conversation | null {
  const store = ensureStore()
  return store.conversations.find(c => c.userId === userId && c.id === conversationId) ?? null
}

function updateConversation(
  userId: string,
  conversationId: string,
  updates: Partial<Pick<Conversation, 'title' | 'isPinned'>>
): Conversation | null {
  const store = ensureStore()
  const index = store.conversations.findIndex(c => c.userId === userId && c.id === conversationId)
  if (index === -1) return null
  const old = store.conversations[index]
  const updated: Conversation = {
    ...old,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  store.conversations[index] = updated
  saveStore(store)
  return updated
}

function deleteConversation(userId: string, conversationId: string): boolean {
  const store = ensureStore()
  const before = store.conversations.length
  store.conversations = store.conversations.filter(c => !(c.userId === userId && c.id === conversationId))
  if (store.conversations.length === before) return false
  saveStore(store)
  return true
}

function appendMessage(userId: string, conversationId: string, role: StoredRole, text: string): StoredMessage | null {
  const store = ensureStore()
  const index = store.conversations.findIndex(c => c.userId === userId && c.id === conversationId)
  if (index === -1) return null

  const msg: StoredMessage = {
    id: randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
  }
  store.conversations[index].messages.push(msg)
  store.conversations[index].updatedAt = new Date().toISOString()
  saveStore(store)
  return msg
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function detectDialect(message: string): string {
  if (/ازاي|ليه|عايز|بتاع|دلوقتي|كدا|اوي|مش/.test(message)) return 'egyptian'
  if (/شلون|هواي|وايد|زين|تره/.test(message)) return 'gulf'
  return 'auto'
}

function detectTone(message: string): string {
  if (/لو سمحت|من فضلك|بعد اذنك|شكرا/.test(message)) return 'polite'
  if (/بسرعة|مختصر|على طول|فوري/.test(message)) return 'direct'
  return 'friendly-professional'
}

function detectFormatPreference(message: string): PreferredFormat {
  if (/جدول|table|tabular/i.test(message)) return 'table-when-needed'
  if (/نقاط|bullet|steps|خطوات/i.test(message)) return 'bullets'
  if (/شرح|تفصيلي|فقرة/i.test(message)) return 'paragraphs'
  return 'auto'
}

function detectGoal(message: string): string {
  if (/خس|وزن|دهون/.test(message)) return 'fat-loss'
  if (/زيادة وزن|كتلة|عضلات/.test(message)) return 'muscle-gain'
  if (/لياقة|جاهزية|ماتش|مباراة/.test(message)) return 'performance'
  return ''
}

function getOrCreateUserProfile(userId: string): UserProfile {
  const store = ensureStore()
  const existing = store.userProfiles.find(p => p.userId === userId)
  if (existing) return existing
  const created: UserProfile = {
    userId,
    preferences: { ...DEFAULT_PREFERENCES },
    memory: { usedQuickFacts: [], usedLeagueStats: [] },
    updatedAt: new Date().toISOString(),
  }
  store.userProfiles.push(created)
  saveStore(store)
  return created
}

function updateUserPreferences(userId: string, updates: Partial<UserPreferences>): UserProfile {
  const store = ensureStore()
  const idx = store.userProfiles.findIndex(p => p.userId === userId)
  if (idx === -1) {
    const created: UserProfile = {
      userId,
      preferences: { ...DEFAULT_PREFERENCES, ...updates },
      memory: { usedQuickFacts: [], usedLeagueStats: [] },
      updatedAt: new Date().toISOString(),
    }
    store.userProfiles.push(created)
    saveStore(store)
    return created
  }

  const mergedInterests = Array.from(
    new Set([...(store.userProfiles[idx].preferences.interests ?? []), ...(updates.interests ?? [])])
  ).slice(-10)

  const next: UserProfile = {
    ...store.userProfiles[idx],
    preferences: {
      ...store.userProfiles[idx].preferences,
      ...updates,
      interests: mergedInterests,
    },
    memory: store.userProfiles[idx].memory ?? { usedQuickFacts: [], usedLeagueStats: [] },
    updatedAt: new Date().toISOString(),
  }
  store.userProfiles[idx] = next
  saveStore(store)
  return next
}

function ensureUserProfileShape(userId: string): UserProfile {
  const store = ensureStore()
  const idx = store.userProfiles.findIndex(p => p.userId === userId)
  if (idx === -1) return getOrCreateUserProfile(userId)
  const current = store.userProfiles[idx]
  if (!current.memory) {
    const fixed: UserProfile = {
      ...current,
      memory: { usedQuickFacts: [], usedLeagueStats: [] },
      updatedAt: new Date().toISOString(),
    }
    store.userProfiles[idx] = fixed
    saveStore(store)
    return fixed
  }
  return current
}

const QUICK_FOOTBALL_FACTS: Array<{ id: string; text: string }> = [
  { id: 'fact-offside', text: 'قاعدة التسلل مش بتطبق في رمية التماس، ولا في ضربة مرمى، ولا في ركلة ركنية.' },
  { id: 'fact-pen-kick', text: 'بعد تنفيذ ركلة الجزاء، اللاعب اللي سدد ماينفعش يلمس الكرة تاني إلا لو حد تاني لمسها الأول.' },
  { id: 'fact-advantage', text: 'الحكم ممكن يطبق “إتاحة الفرصة” بدل ما يوقف اللعب لو الفريق المتضرر عنده أفضلية واضحة.' },
  { id: 'fact-red-card', text: 'لو لاعب صدّ هدف محقق بيده/بجسمه بشكل متعمد (مش الحارس داخل منطقة الجزاء)، غالبًا ده طرد مباشر.' },
  { id: 'fact-wall-distance', text: 'المسافة القانونية لحائط الصد في الركلات الحرة هي 9.15 متر (10 ياردات).' },
  { id: 'fact-backpass', text: 'التمرير للخلف للحارس ممنوع يلمسها بإيده فقط لو كانت “ركلة” بالقدم بشكل متعمد من زميله.' },
]

const QUICK_LEAGUE_STATS_INSIGHTS: Array<{ id: string; text: string }> = [
  { id: 'stat-xg', text: 'لو فريق بيكسب نقاط كتير مع xG أقل من خصومه لفترة طويلة، غالبًا الأداء مش مستدام وبيتراجع مع الوقت.' },
  { id: 'stat-ppda', text: 'مؤشر PPDA الأقل عادة يعني ضغط أعلى. لو PPDA منخفض بس الفريق بيتلقى فرص كتير، يبقى الضغط “مكشوف” وبيحتاج توازن.' },
  { id: 'stat-setpieces', text: 'كتير من الدوريات بتشوف 25%± من الأهداف من كرات ثابتة. تحسين الركنيات والفاولات ممكن يدي نقاط “رخيصة” في الموسم.' },
  { id: 'stat-transitions', text: 'فرق الهجمات المرتدة الناجحة غالبًا بتحتاج تمريرة أولى سريعة + جري عمودي. بطء التمريرة الأولى يقتل التحول.' },
  { id: 'stat-shot-quality', text: 'عدد التسديدات لوحده مش كفاية: فريق بـ 8 تسديدات “جودة عالية” أخطر من فريق بـ 18 تسديدة ضعيفة.' },
  { id: 'stat-home-away', text: 'فرق الأرض/الخارج بيبان في شدة الضغط والقرارات التحكيمية. تحليل منفصل لمباريات البيت/بره يعطي صورة أدق.' },
]

function pickNonRepeating<T extends { id: string }>(pool: T[], usedIds: string[], keepLast = 8): T {
  const unused = pool.filter(x => !usedIds.includes(x.id))
  const picked = (unused.length ? unused : pool)[Math.floor(Math.random() * (unused.length ? unused.length : pool.length))]
  const nextUsed = [...usedIds.filter(id => id !== picked.id), picked.id].slice(-keepLast)
  usedIds.splice(0, usedIds.length, ...nextUsed)
  return picked
}

function isQuickChipIntent(message: string): 'football_fact' | 'league_stats' | null {
  const m = message.trim()
  if (m === 'معلومات كرة القدم' || m === 'معلومة كروية' || m === 'معلومات كرويه') return 'football_fact'
  if (m === 'إحصائيات الدوريات' || m === 'احصائيات الدوريات' || m === 'إحصائيات الدوري') return 'league_stats'
  return null
}

function inferPreferencesFromMessage(message: string): Partial<UserPreferences> {
  const inferred: Partial<UserPreferences> = {}
  const dialect = detectDialect(message)
  if (dialect !== 'auto') inferred.dialect = dialect

  const tone = detectTone(message)
  if (tone !== 'friendly-professional') inferred.tone = tone

  const fmt = detectFormatPreference(message)
  if (fmt !== 'auto') inferred.format = fmt

  const goal = detectGoal(message)
  if (goal) inferred.goal = goal

  const interests: string[] = []
  if (/تدريب|تمرين|مهارة|سرعة/.test(message)) interests.push('training')
  if (/تغذية|وجبة|بروتين|سعرات/.test(message)) interests.push('nutrition')
  if (/استشفاء|اصابة|إصابة|نوم|ألم/.test(message)) interests.push('recovery')
  if (/دوري|مباراة|لاعب|تكتيك/.test(message)) interests.push('football')
  if (interests.length) inferred.interests = interests

  if (/مختصر|قصير|بسرعة/.test(message)) inferred.responseLength = 'short'
  if (/تفصيلي|تحليل|شرح كامل/.test(message)) inferred.responseLength = 'detailed'

  return inferred
}

function buildPreferenceInstruction(profile: UserProfile, detectedMode: LengthMode): string {
  const p = profile.preferences
  const length = p.responseLength === 'auto' ? detectedMode : p.responseLength
  return [
    'User preference profile:',
    `- Preferred dialect: ${p.dialect}`,
    `- Preferred tone: ${p.tone}`,
    `- Preferred response length: ${length}`,
    `- Preferred format: ${p.format}`,
    `- User goal: ${p.goal || 'unspecified'}`,
    `- Interests: ${p.interests.length ? p.interests.join(', ') : 'unspecified'}`,
    '- Follow these preferences unless the current request explicitly asks otherwise.',
  ].join('\n')
}

type LengthMode = 'short' | 'medium' | 'detailed'

function detectLengthMode(message: string): LengthMode {
  const normalized = message.toLowerCase()
  const words = countWords(message)

  if (/تحليل|تفصيلي|قارن|مقارنة|استراتيجية|خطة كاملة|مسيرة|مسيره/.test(normalized)) {
    return 'detailed'
  }

  if (/اشرح|شرح|خطوات|ازاي|كيف|ليه|لماذا/.test(normalized)) {
    return 'medium'
  }

  // Advice/health topics always need medium — even if short sentence
  if (/ألم|الم|توجع|بيوجع|توئلم|تؤلم|إصابة|اصابة|تعب|إرهاق|استشفاء|تعافي|نظام غذائي|وجبة|تمرين|تدريب|نصائح/.test(normalized)) {
    return 'medium'
  }

  if (words <= 4 || /^(كم|مين|فين|متى|ايه|ما هو)[؟?\s]/.test(normalized)) {
    return 'short'
  }

  return 'medium'
}

function buildAdaptiveInstruction(mode: LengthMode): string {
  if (mode === 'short') {
    return 'Adaptive Response Length: المستخدم سأل سؤال بسيط. رد في سطر إلى سطرين فقط.'
  }
  if (mode === 'detailed') {
    return 'Adaptive Response Length: المستخدم يريد تحليل تفصيلي. قدّم إجابة مركزة حوالي 150 كلمة.'
  }
  return 'Adaptive Response Length: المستخدم يحتاج شرح متوسط. رد في 3 إلى 5 نقاط واضحة ومباشرة.'
}

const CORE_BEHAVIOR_PROMPT = `
هوية المساعد:
- اسمك الرسمي: 90Plus agent.
- لا تذكر اسم المطور إلا إذا المستخدم سأل بشكل مباشر: "انت مين" أو "مين طورك" أو "مميزاتك".
- في هذه الحالات فقط، عرف نفسك بوضوح:
  "أنا 90Plus agent، مطور بواسطة mr.dev ai."

أسلوب الرد:
- أجب بنفس لغة المستخدم. إذا كان السؤال بالإنجليزية فأجب بالإنجليزية، وإذا كان بالعربية فأجب بالعربية.
- طابق لهجة المستخدم (مصري/خليجي/فصحى...) بدون مبالغة أو تصنع.
- لو المستخدم عايز رد سريع: ادي المختصر المفيد مباشرة.
- لو محتاج شرح: كن منظم وواضح.
- تجنب الحشو وتكرار نفس الفكرة.
- في حال كان الرد بالعربية، قلل الكلمات الأجنبية واستخدم العربية الطبيعية.

فهم السياق والمتابعة:
- افهم نية السؤال قبل الإجابة.
- اربط إجابتك بما تم ذكره سابقًا عندما يكون ذلك مفيدًا.
- لو المستخدم كمل على نقطة قديمة، وضّح إنك فاكر السياق.

تنسيق عالي الجودة:
- عند طلب جدول: اعمل جدول Markdown منظم وقصير الخلايا وسهل القراءة على الموبايل.
- لا تكتب جداول ضخمة غير ضرورية؛ لو البيانات كثيرة، قسّمها على خطوات.
- عندما تحتاج بيانات إضافية من المستخدم، اطلبها بشكل مختصر وواضح بدون اختراع قيم أو وضع أمثلة رقمية افتراضية.

قيود النطاق:
- نطاقك فقط: كرة القدم، التمارين، الاحماء، الاستشفاء، والتغذية الرياضية.
- لا تقدم أخبار رياضية أو أخبار انتقالات. بدلًا من ذلك اعتذر بلطف واقترح مصادر متابعة أخبار موثوقة.
- لو السؤال خارج النطاق، اعتذر باختصار واطلب سؤالًا داخل نطاقك.

السلامة والسلوك:
- إذا كانت رسالة المستخدم تحتوي سبابًا أو إساءة واضحة، ارفض المتابعة باحترام واطلب منه بدء محادثة جديدة بلغة مناسبة.

فهم المتابعة:
- لو المستخدم سأل متابعة قصيرة مثل "وأفضل مدافع؟" بعد سؤال عن بطولة معينة، اعتبر نفس البطولة تلقائيًا من السياق القريب.
`.trim()

function buildAntiRepetitionInstruction(history: ChatMessage[]): string {
  if (history.length < 2) return ''

  // استخلص الكلمات المفتاحية من ردود الـ AI السابقة
  const aiResponses = history
    .filter(m => m.role === 'assistant')
    .slice(-3)
    .map(m => m.content)

  if (aiResponses.length === 0) return ''

  const mentionedTopics: string[] = []

  for (const response of aiResponses) {
    if (/سبرينت|sprint/i.test(response))          mentionedTopics.push('sprint training')
    if (/RICE/.test(response))                     mentionedTopics.push('RICE protocol')
    if (/بروتين|protein/i.test(response))          mentionedTopics.push('protein advice')
    if (/ميسي|messi/i.test(response))              mentionedTopics.push('Messi stats')
    if (/ريال مدريد|real madrid/i.test(response))  mentionedTopics.push('Real Madrid')
    if (/سلم السرعة|ladder/i.test(response))       mentionedTopics.push('ladder drills')
    if (/تمرين الفتلة|interval/i.test(response))   mentionedTopics.push('interval training')
    if (/أرز|rice.*meal|carb/i.test(response))     mentionedTopics.push('carb meal advice')
  }

  if (mentionedTopics.length === 0) return ''

  return `[Anti-Repetition] Already mentioned in this conversation: ${mentionedTopics.join(', ')}. Add NEW information or different angles. Do NOT repeat the same advice.`
}

function getCrossConversationMemory(userId: string, activeConversationId: string, currentMessage: string = ''): string {
  const allConvs = getUserConversations(userId).filter(c => c.id !== activeConversationId)
  if (!allConvs.length) return ''

  // استخلص معلومات المستخدم الشخصية من كل المحادثات
  const userFacts: string[] = []

  for (const conv of allConvs) {
    for (const msg of conv.messages) {
      if (msg.role !== 'user') continue
      const content = msg.text

      // عمر المستخدم
      if (/عمري|عندي\s*\d+\s*سنة|أنا\s*\d+/.test(content)) {
        const age = content.match(/(\d+)\s*سنة/)
        if (age) userFacts.push(`عمر المستخدم: ${age[1]} سنة`)
      }
      // مركزه
      if (/مركزي|بلعب|لاعب\s*(وسط|مهاجم|مدافع|حارس)/.test(content)) {
        const pos = content.match(/(وسط|مهاجم|مدافع|حارس)/)
        if (pos) userFacts.push(`مركزه: ${pos[1]}`)
      }
      // وزنه
      if (/وزني|كيلو|كجم/.test(content)) {
        const weight = content.match(/(\d+)\s*(كيلو|كجم|kg)/i)
        if (weight) userFacts.push(`وزنه: ${weight[1]} كجم`)
      }
      // فريقه
      if (/فريقي|بلعب في|ناديي/.test(content)) {
        userFacts.push('ذكر فريقه أو ناديه في محادثة سابقة')
      }
      // إصابة سابقة
      if (/إصابتي|عندي\s*(ألم|إصابة)/.test(content)) {
        userFacts.push('سبق وذكر إصابة أو ألم')
      }
    }
  }

  // إزالة التكرار
  const uniqueFacts = [...new Set(userFacts)]

  if (uniqueFacts.length === 0) return ''

  return `[معلومات المستخدم من محادثات سابقة]\n${uniqueFacts.join('\n')}\nاستخدم هذه المعلومات لتخصيص ردودك.`
}

function isGreeting(message: string): boolean {
  return /^(hi|hello|hey|اهلا|أهلا|السلام عليكم|سلام|ازيك|عامل ايه|صباح الخير|مساء الخير)[\s!.,؟?]*$/i.test(
    message.trim()
  )
}

function isIdentityOrCapabilitiesQuestion(message: string): boolean {
  const msg = message.toLowerCase().trim()

  // Must be a short message (≤12 words) — long messages are almost never identity questions
  const wordCount = msg.trim().split(/\s+/).length
  if (wordCount > 12) return false

  const patterns = [
    // Arabic — must refer to "you/the bot" directly, not a third person
    // "من أنت" / "أنت مين" — asking about the bot itself
    /^(من أنت|مين أنت|أنت مين|من انت|مين انت|انت مين)[؟?!.\s]*$/,
    /^(ما اسمك|اسمك ايه|اسمك إيه|إيه اسمك|ايه اسمك)[؟?!.\s]*$/,
    /^(عرّف نفسك|عرف نفسك|قدم نفسك)[؟?!.\s]*$/,
    /^(إنت إيه|انت ايه|إيه أنت|ايه انت)[؟?!.\s]*$/,
    /^(مطورك|صنعك|بناك|عملك|اشتغل عليك|من درّبك)[؟?!.\s]*$/,
    /^(قدراتك|تقدر تعمل إيه|بتعمل إيه|وظيفتك|مميزاتك|ميزاتك)[؟?!.\s]*$/,
    // "انت مين" or "اسمك ايه" anywhere in a short sentence
    /\b(انت مين|أنت مين|اسمك ايه|اسمك إيه)\b/,
    // English — must be asking about the bot, not a third person
    /^(who are you|what are you)[؟?!.\s]*$/,
    /^(what'?s your name|your name\??)[؟?!.\s]*$/,
    /^(what can you do|your capabilities|introduce yourself)[؟?!.\s]*$/,
    /^(who made you|who built you|who developed you|who created you|who trained you)[؟?!.\s]*$/,
    /^(who is your developer)[؟?!.\s]*$/,
  ]
  return patterns.some(p => p.test(msg))
}

function containsProfanity(message: string): boolean {
  return /(عرص|خول|متناك|كسم|كسمك|ابن\s*متناكة|شرموط|fuck|f\*+k|bitch|asshole)/i.test(message)
}

function isSportsNewsRequest(message: string): boolean {
  return /(اخبار|أخبار|تريند|مستجدات|انتقالات|سوق الانتقالات|breaking|news|transfer)/i.test(message)
}

function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
}

function isInDomain(message: string): boolean {
  const msg = message.toLowerCase()
  const msgNorm = normalizeArabic(message)

  const domainPatterns = [
    // ─── Arabic (normalized — بدون همزات) ────────────
    /كره القدم|كره|ملعب|مباراه|ماتش|فريق|لاعب|مدرب|حكم/,
    /دوري|بطوله|كاس|تصفيات|منتخب|نادي|انديه/,
    /هدف|تسديد|تمريره|دفاع|هجوم|وسط|مهاجم|مدافع|حارس/,
    /تكتيك|تشكيل|استراتيجيه|تسلل|ركله|ضربه/,
    /تمرين|تدريب|لياقه|سرعه|قوه|مهاره/,
    /اكل|تغذيه|وجبه|بروتين|كالوري|نظام غذائي/,
    /اصابه|الم|استشفاء|تعافي|عضله|مفصل|شد|فخذ|ساق|ركبه|كاحل/,
    /ميسي|رونالدو|صلاح|مبابي|نيمار|بنزيمه|هالاند|ويا|زيدان|رونالدينيو/,
    /برشلونه|ريال|ليفربول|سيتي|يونايتد|باريس|بايرن|ميلان|يوفنتوس/,
    // ─── مسيرة / إحصائيات / أهداف / معلومات عن لاعب ──
    /مسيره|مسيرة|احصائيات|إحصائيات|اهداف|أهداف|معلومات|سيرة|تاريخ/,
    /بطل|فاز|فازت|كسب|خسر|نتيجه|نتيجة|سجل|سجلت/,
    // ─── English ──────────────────────────────────────
    /football|soccer|match|game|league|cup|tournament/,
    /player|team|coach|referee|stadium|pitch/,
    /goal|shoot|pass|defend|attack|midfielder|forward|goalkeeper/,
    /tactic|formation|strategy|offside|penalty|free.?kick|corner/,
    /training|workout|exercise|speed|strength|agility|fitness/,
    /diet|nutrition|protein|calorie|meal|supplement/,
    /injury|pain|recovery|rehab|muscle|joint|hamstring|ankle|knee|thigh/,
    /messi|ronaldo|salah|mbappe|neymar|benzema|haaland|weah|zidane|ronaldinho/,
    /barcelona|real madrid|liverpool|city|united|psg|bayern|milan|juventus/,
    /premier league|la liga|serie a|bundesliga|champions league/,
    /world cup|euro|afcon|copa america|ballon d.?or/,
    /dribble|tackle|header|cross|assist|clean sheet|hat.?trick/,
    /offside|rule|foul|card|red card|yellow card|var/,
    /career|stats|biography|goals|assists|biography|history/,
  ]

  return domainPatterns.some(p => p.test(msgNorm) || p.test(msg))
}

function hasRecentInDomainContext(conversation: Conversation | null): boolean {
  if (!conversation) return false
  const recent = conversation.messages.slice(-6).map(m => m.text)
  return recent.some(msg => isInDomain(msg))
}

// ─── Conversations API (saved history) ────────────────────────────────────────
app.get('/api/conversations', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const conversations = getUserConversations(userId).map(c => ({
    id: c.id,
    title: c.title,
    isPinned: c.isPinned,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastMessage: c.messages[c.messages.length - 1]?.text ?? null,
  }))
  res.json({ conversations })
})

app.post('/api/conversations', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const title = typeof req.body?.title === 'string' && req.body.title.trim()
    ? req.body.title.trim()
    : 'محادثة جديدة'
  const conversation = createConversation(userId, title)
  res.status(201).json({ conversation })
})

app.get('/api/conversations/:id/messages', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const conversation = findConversation(userId, req.params.id)
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json({ messages: conversation.messages })
})

app.patch('/api/conversations/:id', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const updates: Partial<Pick<Conversation, 'title' | 'isPinned'>> = {}
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    updates.title = req.body.title.trim()
  }
  if (typeof req.body?.isPinned === 'boolean') {
    updates.isPinned = req.body.isPinned
  }
  const updated = updateConversation(userId, req.params.id, updates)
  if (!updated) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json({ conversation: updated })
})

app.delete('/api/conversations/:id', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const ok = deleteConversation(userId, req.params.id)
  if (!ok) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json({ message: 'Deleted successfully' })
})

// ─── GET /api/cache/stats ─────────────────────────────────────────────────────
app.get('/api/cache/stats', (_req, res) => {
  const stats = cacheService.getStats()
  res.json(stats)
})

// ─── POST /api/chat/stream (SSE streaming) ───────────────────────────────────
app.post('/api/chat/stream', async (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const { message, history = [], conversationId } = req.body as {
    message: string
    history?: ChatMessage[]
    conversationId?: string
  }

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  const trimmedMessage = message.trim()

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const sendToken = (token: string) => {
    res.write(`data: ${JSON.stringify({ token })}\n\n`)
  }
  const sendDone = (extra: Record<string, unknown> = {}) => {
    res.write(`data: ${JSON.stringify({ done: true, ...extra })}\n\n`)
    res.end()
  }
  const sendError = (msg: string, status = 500) => {
    res.write(`data: ${JSON.stringify({ error: msg, done: true })}\n\n`)
    res.end()
  }

  // ── Profanity check ───────────────────────────────────────────────────────
  if (containsProfanity(trimmedMessage)) {
    sendToken('اعتذر، لا يمكنني متابعة المحادثة بهذه اللغة. من فضلك ابدأ محادثة جديدة بصياغة محترمة.')
    sendDone()
    return
  }

  // ── Identity question ─────────────────────────────────────────────────────
  if (isIdentityOrCapabilitiesQuestion(trimmedMessage)) {
    const isEnglish = /[a-zA-Z]{3,}/.test(trimmedMessage) && !/[\u0600-\u06FF]/.test(trimmedMessage)
    const text = isEnglish
      ? "I'm **90Plus AI** ⚽ — your smart football & sports assistant, developed by **mr.dev ai**.\n\nI can help you with:\n- 📊 Football info, stats & tactics\n- 💪 Personalized training plans\n- 🥗 Sports nutrition & meal plans\n- 🏥 Recovery & injury advice"
      : 'أنا **90Plus AI** ⚽ — مساعدك الرياضي الذكي، طوّرني **mr.dev ai**.\n\nأقدر أساعدك في:\n- 📊 معلومات وإحصائيات كرة القدم\n- 💪 خطط تدريب مخصصة\n- 🥗 نظام غذائي للرياضيين\n- 🏥 نصائح استشفاء وإعادة تأهيل'
    sendToken(text)
    sendDone()
    return
  }

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (isGreeting(trimmedMessage)) {
    sendToken('أهلًا بك! جاهز أساعدك في كرة القدم، التمارين، الاستشفاء، والإعداد الغذائي.')
    sendDone()
    return
  }

  // ── Acknowledgement / filler words (تمام، شكرا، ok، حلو...) ─────────────
  if (/^(تمام|تمام\.?|oke?|okay|ok|حلو|عظيم|شكرا|شكراً|thanks?|👍|🙏|يسلمو|مشكور|ممتاز|رائع|جميل|كويس|good|great|nice|cool|perfect|got it|understood|👌)[!.,؟?\s]*$/i.test(trimmedMessage)) {
    sendToken('عندك أي سؤال تاني؟ 😊')
    sendDone()
    return
  }

  // ── Sports news ───────────────────────────────────────────────────────────
  if (isSportsNewsRequest(trimmedMessage)) {
    sendToken('اعتذر، أنا لا أقدم أخبارًا رياضية أو أخبار انتقالات مباشرة. لمتابعة الأخبار يمكنك الاعتماد على: FIFA، ESPN، Sky Sports، Fabrizio Romano، والحسابات الرسمية للأندية.')
    sendDone()
    return
  }

  // ── Daily limit ───────────────────────────────────────────────────────────
  if (getRemaining(userId) <= 0) {
    res.status(429).json({ error: 'Daily limit reached', code: 'LIMIT_REACHED', resetAt: getResetTime() })
    return
  }

  // ── Resolve conversation ──────────────────────────────────────────────────
  let targetConversation = conversationId ? findConversation(userId, conversationId) : null
  if (!targetConversation) {
    targetConversation = createConversation(userId, 'محادثة جديدة')
  }

  // ── Quick chip intents ────────────────────────────────────────────────────
  const quickIntent = isQuickChipIntent(trimmedMessage)
  if (quickIntent) {
    incrementLimit(userId)
    const profile = ensureUserProfileShape(userId)
    appendMessage(userId, targetConversation.id, 'user', trimmedMessage)
    const picked = quickIntent === 'football_fact'
      ? pickNonRepeating(QUICK_FOOTBALL_FACTS, profile.memory.usedQuickFacts)
      : pickNonRepeating(QUICK_LEAGUE_STATS_INSIGHTS, profile.memory.usedLeagueStats)
    const store = ensureStore()
    const idx = store.userProfiles.findIndex(p => p.userId === userId)
    if (idx !== -1) {
      store.userProfiles[idx] = { ...store.userProfiles[idx], memory: profile.memory, updatedAt: new Date().toISOString() }
      saveStore(store)
    }
    appendMessage(userId, targetConversation.id, 'ai', picked.text)
    sendToken(picked.text)
    sendDone()
    return
  }

  // ── Out of domain ─────────────────────────────────────────────────────────
  const inDomainByMessage = isInDomain(trimmedMessage)
  const inDomainByContext = hasRecentInDomainContext(targetConversation)
  if (!inDomainByMessage && !inDomainByContext) {
    sendToken('أعتذر، هذا خارج نطاقي الحالي. أقدر أساعدك فقط في كرة القدم، التمارين، الإحماء، الاستشفاء، والتغذية الرياضية.')
    sendDone()
    return
  }

  // ── Save user message & increment limit ───────────────────────────────────
  const userMessage = appendMessage(userId, targetConversation.id, 'user', trimmedMessage)
  if (!userMessage) { sendError('Failed to save user message'); return }
  incrementLimit(userId)

  // ── Build prompts ─────────────────────────────────────────────────────────
  const category = detectCategory(trimmedMessage)
  const lengthMode = detectLengthMode(trimmedMessage)
  const systemPrompt = buildSystemPrompt(category, lengthMode)
  const adaptiveInstruction = buildAdaptiveInstruction(lengthMode)
  const inferredPrefs = inferPreferencesFromMessage(trimmedMessage)
  const profile = updateUserPreferences(userId, inferredPrefs)
  const preferenceInstruction = buildPreferenceInstruction(profile, lengthMode)

  const conversationHistory: ChatMessage[] = targetConversation.messages
    .slice(0, -1).slice(-10)
    .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))

  const memoryContext  = getCrossConversationMemory(userId, targetConversation.id, trimmedMessage)
  const antiRepetition = buildAntiRepetitionInstruction(conversationHistory)
  const fullSystemPrompt = [
    CORE_BEHAVIOR_PROMPT, systemPrompt, adaptiveInstruction,
    preferenceInstruction, memoryContext, antiRepetition,
  ].filter(Boolean).join('\n\n')

  const maxTokensByMode: Record<LengthMode, number> = { short: 450, medium: 700, detailed: 1200 }

  // ── Stream from OpenAI-compatible API ─────────────────────────────────────
  try {
    const stream = await ai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: maxTokensByMode[lengthMode],
      stream: true,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...conversationHistory,
        { role: 'user', content: trimmedMessage },
      ],
    })

    let fullText = ''
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        fullText += token
        sendToken(token)
      }
    }

    // ── Save AI response ────────────────────────────────────────────────────
    const aiSaved = appendMessage(userId, targetConversation.id, 'ai', fullText)
    if (!aiSaved) decrementLimit(userId)

    // ── Auto-title conversation ─────────────────────────────────────────────
    if (targetConversation.title === 'محادثة جديدة' && targetConversation.messages.length <= 2) {
      const titleCandidate = trimmedMessage.split(/\s+/).slice(0, 4).join(' ')
      updateConversation(userId, targetConversation.id, { title: titleCandidate || 'محادثة جديدة' })
    }

    // ── Log model used ──────────────────────────────────────────────────────
    const wordCount = fullText.trim().split(/\s+/).length
    console.log(`\n┌─────────────────────────────────────────────────────`)
    console.log(`│ 🤖 Model   : ${AI_MODEL}`)
    console.log(`│ 👤 User    : ${userId}`)
    console.log(`│ ❓ Question: ${trimmedMessage.slice(0, 80)}${trimmedMessage.length > 80 ? '...' : ''}`)
    console.log(`│ 💬 Answer  : ${fullText.slice(0, 120)}${fullText.length > 120 ? '...' : ''}`)
    console.log(`│ 📊 Stats   : ${wordCount} words | ${fullText.length} chars`)
    console.log(`└─────────────────────────────────────────────────────\n`)

    sendDone({ remaining: getRemaining(userId), resetAt: getResetTime() })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.log(`\n┌─────────────────────────────────────────────────────`)
    console.log(`│ 🔴 Stream Error`)
    console.log(`│ 🤖 Model   : ${AI_MODEL}`)
    console.log(`│ 👤 User    : ${userId}`)
    console.log(`│ ❓ Question: ${trimmedMessage.slice(0, 80)}`)
    console.log(`│ ❌ Error   : ${errMsg.slice(0, 120)}`)
    console.log(`└─────────────────────────────────────────────────────\n`)
    decrementLimit(userId)
    sendError('AI service error. Please try again.')
  }
})

// ─── POST /api/chat/send ──────────────────────────────────────────────────────
app.post('/api/chat/send', async (req, res) => {
  const userId = (req.headers['x-user-id'] as string) ?? 'guest'
  const { message, history = [], conversationId } = req.body as {
    message: string
    history?: ChatMessage[]
    conversationId?: string
  }

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  const trimmedMessage = message.trim()
  const isIdentityQuestion = isIdentityOrCapabilitiesQuestion(trimmedMessage)
  const quickIntent = isQuickChipIntent(trimmedMessage)

  if (containsProfanity(trimmedMessage)) {
    res.status(403).json({
      error: 'لغة غير مناسبة',
      code: 'ABUSIVE_LANGUAGE',
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: 'اعتذر، لا يمكنني متابعة المحادثة بهذه اللغة. من فضلك ابدأ محادثة جديدة بصياغة محترمة.',
        createdAt: new Date().toISOString(),
      },
    })
    return
  }

  if (isIdentityQuestion) {
    const isEnglish = /[a-zA-Z]{3,}/.test(trimmedMessage) && !/[\u0600-\u06FF]/.test(trimmedMessage)
    const identityText = isEnglish
      ? "I'm **90Plus AI** ⚽ — your smart football & sports assistant, developed by **mr.dev ai**.\n\nI can help you with:\n- 📊 Football info, stats & tactics\n- 💪 Personalized training plans\n- 🥗 Sports nutrition & meal plans\n- 🏥 Recovery & injury advice\n\nWhat would you like to know?"
      : 'أنا **90Plus AI** ⚽ — مساعدك الرياضي الذكي، طوّرني **mr.dev ai**.\n\nأقدر أساعدك في:\n- 📊 معلومات وإحصائيات كرة القدم\n- 💪 خطط تدريب مخصصة\n- 🥗 نظام غذائي للرياضيين\n- 🏥 نصائح استشفاء وإعادة تأهيل\n\nبسألني إيه؟'
    res.json({
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: identityText,
        createdAt: new Date().toISOString(),
      },
      aiMetrics: {
        lengthMode: 'short',
        wordCount: 30,
      },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  if (isGreeting(trimmedMessage)) {
    res.json({
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: 'أهلًا بك! جاهز أساعدك في كرة القدم، التمارين، الاستشفاء، والإعداد الغذائي.',
        createdAt: new Date().toISOString(),
      },
      aiMetrics: {
        lengthMode: 'short',
        wordCount: 20,
      },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  if (/^(تمام|تمام\.?|oke?|okay|ok|حلو|عظيم|شكرا|شكراً|thanks?|👍|🙏|يسلمو|مشكور|ممتاز|رائع|جميل|كويس|good|great|nice|cool|perfect|got it|understood|👌)[!.,؟?\s]*$/i.test(trimmedMessage)) {
    res.json({
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: 'عندك أي سؤال تاني؟ 😊',
        createdAt: new Date().toISOString(),
      },
      aiMetrics: { lengthMode: 'short', wordCount: 5 },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  if (isSportsNewsRequest(trimmedMessage)) {
    res.json({
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: 'اعتذر، أنا لا أقدم أخبارًا رياضية أو أخبار انتقالات مباشرة. لمتابعة الأخبار يمكنك الاعتماد على: FIFA، ESPN، Sky Sports، Fabrizio Romano، والحسابات الرسمية للأندية.',
        createdAt: new Date().toISOString(),
      },
      aiMetrics: {
        lengthMode: 'short',
        wordCount: 24,
      },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  if (getRemaining(userId) <= 0) {
    res.status(429).json({
      error: 'Daily limit reached',
      code: 'LIMIT_REACHED',
      resetAt: getResetTime(),
    })
    return
  }

  // NOTE: incrementLimit is called inside each branch (quickIntent / AI call)
  // to avoid double-counting

  const category = detectCategory(trimmedMessage)
  const lengthMode = detectLengthMode(trimmedMessage)
  const systemPrompt = buildSystemPrompt(category, lengthMode)
  const adaptiveInstruction = buildAdaptiveInstruction(lengthMode)
  const inferredPrefs = inferPreferencesFromMessage(trimmedMessage)
  const profile = updateUserPreferences(userId, inferredPrefs)
  const preferenceInstruction = buildPreferenceInstruction(profile, lengthMode)

  let targetConversation = conversationId ? findConversation(userId, conversationId) : null
  if (!targetConversation) {
    targetConversation = createConversation(userId, 'محادثة جديدة')
  }

  // Quick chips: fast random content, no model call, no repetition for same user
  if (quickIntent) {
    incrementLimit(userId)
    const profile = ensureUserProfileShape(userId)

    const userSaved = appendMessage(userId, targetConversation.id, 'user', trimmedMessage)
    if (!userSaved) {
      decrementLimit(userId)
      res.status(500).json({ error: 'Failed to save user message' })
      return
    }

    const picked =
      quickIntent === 'football_fact'
        ? pickNonRepeating(QUICK_FOOTBALL_FACTS, profile.memory.usedQuickFacts)
        : pickNonRepeating(QUICK_LEAGUE_STATS_INSIGHTS, profile.memory.usedLeagueStats)

    // persist updated memory
    const store = ensureStore()
    const idx = store.userProfiles.findIndex(p => p.userId === userId)
    if (idx !== -1) {
      store.userProfiles[idx] = { ...store.userProfiles[idx], memory: profile.memory, updatedAt: new Date().toISOString() }
      saveStore(store)
    }

    const aiSaved = appendMessage(userId, targetConversation.id, 'ai', picked.text)
    if (!aiSaved) {
      decrementLimit(userId)
      res.status(500).json({ error: 'Failed to save AI message' })
      return
    }

    // title on first interaction
    if (targetConversation.title === 'محادثة جديدة' && targetConversation.messages.length <= 2) {
      const title = quickIntent === 'football_fact' ? 'معلومة كروية' : 'إحصائيات الدوريات'
      updateConversation(userId, targetConversation.id, { title })
    }

    res.json({
      conversationId: targetConversation.id,
      userMessage: {
        id: userSaved.id,
        role: 'user',
        text: userSaved.text,
        createdAt: userSaved.createdAt,
      },
      aiMessage: {
        id: aiSaved.id,
        role: 'ai',
        text: picked.text,
        category: quickIntent === 'football_fact' ? 'football' : 'football',
        createdAt: aiSaved.createdAt,
      },
      aiMetrics: {
        lengthMode: 'short',
        wordCount: countWords(picked.text),
      },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  const inDomainByMessage = isInDomain(trimmedMessage)
  const inDomainByContext = hasRecentInDomainContext(targetConversation)

  if (!inDomainByMessage && !inDomainByContext) {
    res.json({
      aiMessage: {
        id: randomUUID(),
        role: 'ai',
        text: 'أعتذر، هذا خارج نطاقي الحالي. أقدر أساعدك فقط في كرة القدم، التمارين، الإحماء، الاستشفاء، والتغذية الرياضية.',
        createdAt: new Date().toISOString(),
      },
      aiMetrics: {
        lengthMode: 'short',
        wordCount: 18,
      },
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
    return
  }

  const userMessage = appendMessage(userId, targetConversation.id, 'user', trimmedMessage)
  if (!userMessage) {
    res.status(500).json({ error: 'Failed to save user message' })
    return
  }

  incrementLimit(userId)

  const conversationHistory: ChatMessage[] = targetConversation.messages
    .slice(0, -1)
    .slice(-10)
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }))

  // ── Build full system prompt with all context layers ──────────────────────
  const memoryContext    = getCrossConversationMemory(userId, targetConversation.id, trimmedMessage)
  const antiRepetition   = buildAntiRepetitionInstruction(conversationHistory)
  const fullSystemPrompt = [
    CORE_BEHAVIOR_PROMPT,
    systemPrompt,
    adaptiveInstruction,
    preferenceInstruction,
    memoryContext,
    antiRepetition,
  ].filter(Boolean).join('\n\n')

  const maxTokensByMode: Record<LengthMode, number> = {
    short:    450,
    medium:   700,
    detailed: 1200,
  }

  // ── SmartChatService: cache → AI fallback chain ───────────────────────────
  try {
    const dialect = profile.preferences.dialect
    const result = await smartChatService.processMessage(
      userId,
      trimmedMessage,
      conversationHistory.slice(-8),
      category,
      dialect,
      fullSystemPrompt,
      maxTokensByMode[lengthMode]
    )

    const aiText = result.answer
    const aiSaved = appendMessage(userId, targetConversation.id, 'ai', aiText)

    if (!aiSaved) {
      decrementLimit(userId)
      res.status(500).json({ error: 'Failed to save AI message' })
      return
    }

    if (targetConversation.title === 'محادثة جديدة' && targetConversation.messages.length <= 2) {
      const titleCandidate = trimmedMessage.split(/\s+/).slice(0, 4).join(' ')
      updateConversation(userId, targetConversation.id, {
        title: titleCandidate || 'محادثة جديدة',
      })
    }

    res.json({
      conversationId: targetConversation.id,
      userMessage: {
        id: userMessage.id,
        role: 'user',
        text: userMessage.text,
        createdAt: userMessage.createdAt,
      },
      aiMessage: {
        id: aiSaved.id,
        role: 'ai',
        text: aiText,
        category,
        createdAt: aiSaved.createdAt,
      },
      aiMetrics: {
        lengthMode,
        wordCount: countWords(aiText),
        fromCache: result.fromCache,
        usedProvider: result.usedProvider,
        responseTime: result.responseTime,
        confidence: result.confidence,
      },
      quick_replies: result.quick_replies,
      related_intents: result.related_intents,
      userPreferences: profile.preferences,
      limit: {
        remaining: getRemaining(userId),
        used: DAILY_LIMIT - getRemaining(userId),
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
      },
    })
  } catch (err: unknown) {
    console.error('AI Error:', err)
    decrementLimit(userId)
    res.status(502).json({ error: 'AI service error. Please try again.' })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────
const server = createServer(app)
server.listen(PORT, () => {
  console.log(`\n🚀 90Plus AI Backend running on http://localhost:${PORT}`)
  console.log(`🤖 Model: ${AI_MODEL}`)
  console.log(`🔗 Base URL: ${AI_BASE_URL}`)
  console.log(`📊 Daily limit: ${DAILY_LIMIT} messages\n`)
})
