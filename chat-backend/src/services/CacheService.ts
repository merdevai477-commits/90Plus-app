import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Types ────────────────────────────────────────────────────────────────────
interface CacheEntry {
  id: string
  category: string
  keywords: string[]
  question: string
  answer: string
  dialect: string
  hits: number
  createdAt: string
  lastHit: string
  quick_replies: string[]
  related_intents: string[]
  confidence: number
}

interface CacheStore {
  version: string
  totalHits: number
  totalSaved: number
  lastUpdated: string
  cache: CacheEntry[]
}

// ─── Result type for findAnswer ───────────────────────────────────────────────
export interface CacheHit {
  answer: string
  quick_replies: string[]
  related_intents: string[]
  confidence: number
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CACHE_FILE = process.env.CACHE_FILE_PATH
  ? path.resolve(process.env.CACHE_FILE_PATH)
  : path.join(__dirname, '../../data/qa-cache.json')

const SIMILARITY_THRESHOLD = Number(process.env.CACHE_SIMILARITY_THRESHOLD ?? 70)

// ─── Quick Reply Templates ────────────────────────────────────────────────────
const QUICK_REPLY_TEMPLATES: Record<string, string[]> = {
  football: [
    'مين أفضل لاعب في التاريخ؟',
    'إيه أفضل تشكيلة في الكرة؟',
    'إيه الفرق بين الـ 4-3-3 والـ 4-4-2؟',
  ],
  training: [
    'كام مرة أتدرب في الأسبوع؟',
    'إيه أفضل وقت للتدريب؟',
    'إزاي أزود سرعتي؟',
  ],
  nutrition: [
    'إيه أكل قبل التمرين؟',
    'كام بروتين محتاج في اليوم؟',
    'إيه أفضل وجبة بعد التدريب؟',
  ],
  recovery: [
    'كام ساعة نوم محتاج بعد التدريب؟',
    'إزاي أخف شد عضلي؟',
    'هل الماء البارد بيساعد في الاستشفاء؟',
  ],
}

// ─── Related Intent Generator ─────────────────────────────────────────────────
function generateRelatedIntents(keywords: string[], category: string): string[] {
  const intents: string[] = []

  // كلمات مفتاحية → intents مرتبطة
  const keywordMap: Record<string, string> = {
    'كأس العالم': 'world_cup_history',
    'مونديال': 'world_cup_history',
    'ميسي': 'messi_profile',
    'رونالدو': 'ronaldo_profile',
    'صلاح': 'salah_profile',
    'مبابي': 'mbappe_profile',
    'تدريب': 'training_plan',
    'سرعة': 'speed_training',
    'لياقة': 'fitness_training',
    'بروتين': 'nutrition_protein',
    'وجبة': 'nutrition_meal',
    'إصابة': 'injury_recovery',
    'استشفاء': 'recovery_tips',
    'تكتيك': 'tactics_guide',
    'تشكيل': 'formation_guide',
    '2022': 'wc_2022',
    '2026': 'wc_2026',
    'قطر': 'wc_2022',
  }

  for (const kw of keywords) {
    const intent = keywordMap[kw]
    if (intent && !intents.includes(intent)) {
      intents.push(intent)
    }
  }

  // أضف intent عام للـ category لو مفيش intents محددة
  if (intents.length === 0) {
    intents.push(`${category}_general`)
  }

  return intents.slice(0, 3)
}

// ─── Quick Replies Generator ──────────────────────────────────────────────────
function generateQuickReplies(keywords: string[], category: string): string[] {
  const pool = QUICK_REPLY_TEMPLATES[category] ?? QUICK_REPLY_TEMPLATES['football']

  // ابحث عن quick replies مخصصة بناءً على الكلمات المفتاحية
  const customReplies: string[] = []

  if (keywords.some(k => ['كأس العالم', 'مونديال', '2022', '2026'].includes(k))) {
    customReplies.push('مين سجل في النهائي؟', 'إيه نتيجة المباراة النهائية؟')
  }
  if (keywords.some(k => ['ميسي', 'رونالدو', 'صلاح', 'مبابي'].includes(k))) {
    customReplies.push('كام هدف سجل في موسمه ده؟', 'إيه أفضل موسم عمله؟')
  }
  if (keywords.some(k => ['تدريب', 'تمرين', 'سرعة', 'لياقة'].includes(k))) {
    customReplies.push('كام تمرين في الأسبوع؟', 'إزاي أقيس تقدمي؟')
  }
  if (keywords.some(k => ['إصابة', 'ألم', 'استشفاء'].includes(k))) {
    customReplies.push('امتى أرجع للتدريب؟', 'هل محتاج دكتور؟')
  }

  // لو في custom replies استخدمهم، غير كده استخدم الـ templates
  const source = customReplies.length >= 2 ? customReplies : pool
  return source.slice(0, 2)
}

// ─── CacheService ─────────────────────────────────────────────────────────────
export class CacheService {
  // ── Store I/O ──────────────────────────────────────────────────────────────
  private load(): CacheStore {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        const initial: CacheStore = {
          version: '1.1',
          totalHits: 0,
          totalSaved: 0,
          lastUpdated: '',
          cache: [],
        }
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
        fs.writeFileSync(CACHE_FILE, JSON.stringify(initial, null, 2), 'utf-8')
        return initial
      }
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
      return JSON.parse(raw) as CacheStore
    } catch {
      return { version: '1.1', totalHits: 0, totalSaved: 0, lastUpdated: '', cache: [] }
    }
  }

  private save(store: CacheStore): void {
    store.lastUpdated = new Date().toISOString()
    fs.writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2), 'utf-8')
  }

  // ── Keyword Extraction ─────────────────────────────────────────────────────
  extractKeywords(question: string): string[] {
    const stopWords = new Set([
      'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هل', 'ما', 'ماذا', 'كيف', 'لماذا',
      'متى', 'أين', 'من', 'هو', 'هي', 'هم', 'أنا', 'أنت', 'نحن', 'كان', 'يكون',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when',
      'where', 'who', 'which', 'that', 'this', 'and', 'or', 'but', 'in', 'on',
      'at', 'to', 'for', 'of', 'with', 'by', 'do', 'does', 'did', 'can', 'could',
      'إيه', 'ايه', 'مين', 'فين', 'امتى', 'ليه', 'ازاي', 'وش', 'شو', 'كيف',
    ])

    return question
      .toLowerCase()
      .replace(/[؟?!.,،؛;:]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 8)
  }

  // ── Similarity (0-100) ─────────────────────────────────────────────────────
  similarity(q1: string, q2: string): number {
    const kw1 = new Set(this.extractKeywords(q1))
    const kw2 = new Set(this.extractKeywords(q2))

    if (kw1.size === 0 || kw2.size === 0) return 0

    const intersection = [...kw1].filter(k => kw2.has(k)).length
    const union = new Set([...kw1, ...kw2]).size

    // Jaccard similarity → percentage
    return Math.round((intersection / union) * 100)
  }

  // ── Find Answer ────────────────────────────────────────────────────────────
  findAnswer(question: string, category: string): CacheHit | null {
    const store = this.load()
    const q = question.trim().toLowerCase()

    // 1. Exact match (case-insensitive) → confidence 1.0
    const exact = store.cache.find(
      e => e.category === category && e.question.toLowerCase() === q
    )
    if (exact) {
      exact.hits++
      exact.lastHit = new Date().toISOString()
      store.totalHits++
      this.save(store)
      return {
        answer: exact.answer,
        quick_replies: exact.quick_replies ?? [],
        related_intents: exact.related_intents ?? [],
        confidence: 1.0,
      }
    }

    // 2. Keyword similarity ≥ threshold
    let bestMatch: CacheEntry | null = null
    let bestScore = 0

    const userKeywordsLength = this.extractKeywords(question).length

    // 💡 Dynamic Threshold:
    // لو الكلمات المفتاحية للسؤال قليلة جداً (أقل من 3 كلمات)، ممكن يحصل False Positives عالية.
    // فهنطلب نسبة تشابه أعلى (90% أو 100%). لو الكلمات كثيرة، نكتفي بـ 75% أو 80%.
    const dynamicThreshold = userKeywordsLength <= 2 ? 100 : Math.max(SIMILARITY_THRESHOLD, 80)

    for (const entry of store.cache) {
      if (entry.category !== category) continue
      const score = this.similarity(question, entry.question)
      if (score >= dynamicThreshold && score > bestScore) {
        bestScore = score
        bestMatch = entry
      }
    }

    if (bestMatch) {
      bestMatch.hits++
      bestMatch.lastHit = new Date().toISOString()
      store.totalHits++
      this.save(store)
      return {
        answer: bestMatch.answer,
        quick_replies: bestMatch.quick_replies ?? [],
        related_intents: bestMatch.related_intents ?? [],
        confidence: Math.round(bestScore) / 100,
      }
    }

    return null
  }

  // ── Save Answer ────────────────────────────────────────────────────────────
  saveAnswer(
    question: string,
    answer: string,
    category: string,
    dialect: string
  ): void {
    const store = this.load()

    // Don't cache very short answers or error messages or greetings
    if (
      answer.length < 20 || 
      answer.includes('عذراً، حدث خطأ') || 
      answer.includes('أهلاً! كيف أقدر أساعدك')
    ) return

    // Don't duplicate
    const exists = store.cache.some(
      e => e.category === category && e.question.toLowerCase() === question.trim().toLowerCase()
    )
    if (exists) return

    const keywords = this.extractKeywords(question)
    const entry: CacheEntry = {
      id: randomUUID(),
      category,
      keywords,
      question: question.trim(),
      answer,
      dialect,
      hits: 0,
      createdAt: new Date().toISOString(),
      lastHit: '',
      quick_replies: generateQuickReplies(keywords, category),
      related_intents: generateRelatedIntents(keywords, category),
      confidence: 1.0,
    }

    store.cache.push(entry)
    store.totalSaved++
    this.save(store)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats(): {
    totalEntries: number
    totalHits: number
    totalSaved: number
    hitRate: string
    topEntries: Array<{ question: string; hits: number; category: string; confidence: number }>
  } {
    const store = this.load()
    const totalRequests = store.totalHits + store.totalSaved
    const hitRate = totalRequests > 0
      ? `${Math.round((store.totalHits / totalRequests) * 100)}%`
      : '0%'

    const topEntries = [...store.cache]
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5)
      .map(e => ({
        question: e.question,
        hits: e.hits,
        category: e.category,
        confidence: e.confidence ?? 1.0,
      }))

    return {
      totalEntries: store.cache.length,
      totalHits: store.totalHits,
      totalSaved: store.totalSaved,
      hitRate,
      topEntries,
    }
  }
}

export const cacheService = new CacheService()
