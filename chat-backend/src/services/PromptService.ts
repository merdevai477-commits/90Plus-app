import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type Category = 'football' | 'nutrition' | 'training' | 'recovery'

const CATEGORIES: Category[] = ['football', 'nutrition', 'training', 'recovery']

class PromptService {
  private prompts: Record<string, string> = {}

  constructor() {
    // يحمّل كل ملفات الـ prompts عند start
    const promptsDir = path.join(__dirname, '../../prompts')

    for (const cat of CATEGORIES) {
      const filePath = path.join(promptsDir, `${cat}.md`)
      try {
        this.prompts[cat] = fs.readFileSync(filePath, 'utf-8')
      } catch {
        console.warn(`⚠️  Prompt file not found: ${filePath}`)
        this.prompts[cat] = `أنت 90Plus AI، مساعد ذكي متخصص في كرة القدم والرياضة.`
      }
    }

    console.log(`✅ Loaded ${Object.keys(this.prompts).length} prompt files`)
  }

  getPrompt(category: string): string {
    return this.prompts[category] ?? this.prompts['football']
  }

  /**
   * يكتشف الـ category من نص الرسالة
   */
  detectCategory(message: string): Category {
    if (/تمرين|تدريب|سرعة|قوة|لياقة|مهارة|تسديد|مراوغة/.test(message)) return 'training'
    if (/أكل|تغذية|نظام غذائي|وجبة|بروتين|كالوري|ماء|ترطيب/.test(message)) return 'nutrition'
    if (/إصابة|استشفاء|ألم|علاج|تعب|عضلة|مفصل|راحة/.test(message)) return 'recovery'
    return 'football'
  }
}

// Singleton
export const promptService = new PromptService()
