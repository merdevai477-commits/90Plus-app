/**
 * World-class chat simulation.
 *
 * Reproduces the EXACT production chat pipeline for a batch of players & clubs:
 *
 *     buildFootballChatContext(question)  →  LLM (same model + system prompt)  →  answer  →  suggestions
 *
 * - `buildFootballChatContext`, `shouldUseComplexModel`, `detectPlayerInfoQuery`
 *   and `getTeamSuggestions` are imported directly from the production services.
 * - The provider chain, system prompt, temperature and max_tokens below are an
 *   exact mirror of src/routes/chat.routes.ts (kept in sync intentionally).
 * - All API-Football calls flow through the existing Redis cache layer.
 * - p-limit concurrency = 2 (LLM calls are heavy).
 * - One failure never stops the batch.
 *
 * Usage:
 *   npm run test:world-class-chat
 *   npx ts-node scripts/test-world-class-chat.ts
 */

import 'dotenv/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { closeRedis } from '../src/lib/redis';
import { prisma } from '../src/lib/prisma';
import { footballService } from '../src/services/football.service';
import {
  buildFootballChatContext,
  shouldUseComplexModel,
  detectPlayerInfoQuery,
} from '../src/services/chat-football-tools.service';
import { getTeamSuggestions } from '../src/services/chat-suggestions.service';
import { pLimit } from '../src/workers/concurrency.util';

// ── Test subjects ────────────────────────────────────────────────────────────
const TEST_PLAYERS = [
  'صلاح', 'مبابي', 'هالاند', 'فينيسيوس',
  'بيلينغهام', 'حكيمي', 'يامال', 'ليفاندوفسكي',
  'دي بروين', 'فودن', 'رودري',
];

const TEST_CLUBS = ['ريال مدريد', 'مانشستر سيتي', 'برشلونة', 'PSG', 'ليفربول'];

const TOTAL = TEST_PLAYERS.length + TEST_CLUBS.length;

// Question phrasing mode. `stats` (default) uses a data-triggering phrasing so
// buildFootballChatContext injects real API-Football data; `news` uses the
// "أخبار" phrasing which production answers from model memory (no data path).
//   npx ts-node scripts/test-world-class-chat.ts news
const QUESTION_MODE: 'stats' | 'news' =
  (process.argv[2] ?? process.env.QUESTION_MODE ?? 'stats') === 'news' ? 'news' : 'stats';

function buildQuestion(name: string): string {
  return QUESTION_MODE === 'news' ? `إيه أخبار ${name}؟` : `إيه إحصائيات ${name}؟`;
}

// ── Provider chain — EXACT mirror of chat.routes.ts ──────────────────────────
interface ProviderConfig {
  name: string;
  model: string;
  client: OpenAI;
}

function buildClient(apiKey: string, baseURL: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: { 'HTTP-Referer': 'https://90plus.pro', 'X-Title': '90Plus AI Chat' },
  });
}

const FAST: ProviderConfig | null = (() => {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL = process.env.AI_BASE_URL ?? process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
  return {
    name: 'fast',
    model: process.env.AI_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? 'qwen/qwen3.6-flash',
    client: buildClient(apiKey, baseURL),
  };
})();

const COMPLEX: ProviderConfig | null = (() => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
  const model =
    process.env.OPENROUTER_CHAT_COMPLEX_MODEL ??
    process.env.OPENROUTER_CHAT_SIMPLE_MODEL ??
    process.env.OPENROUTER_GEMINI_FLASH_MODEL ??
    'google/gemini-3-flash-preview';
  return { name: 'complex', model, client: buildClient(apiKey, baseURL) };
})();

const FALLBACK: ProviderConfig | null = (() => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
  return {
    name: 'fallback',
    model: process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash',
    client: buildClient(apiKey, baseURL),
  };
})();

const PROVIDERS = [FAST, COMPLEX, FALLBACK].filter((p): p is ProviderConfig => p !== null);

function providersForRequest(useComplex: boolean): ProviderConfig[] {
  const chain: ProviderConfig[] = [];
  const seen = new Set<string>();
  const push = (p: ProviderConfig | null) => {
    if (!p || seen.has(p.model)) return;
    seen.add(p.model);
    chain.push(p);
  };
  if (useComplex) {
    push(COMPLEX); push(FALLBACK); push(FAST);
  } else {
    push(FAST); push(COMPLEX); push(FALLBACK);
  }
  return chain.length > 0 ? chain : PROVIDERS;
}

// ── System prompt — EXACT mirror of chat.routes.ts ───────────────────────────
type Category = 'football' | 'training' | 'nutrition' | 'recovery';
type LengthMode = 'short' | 'medium' | 'detailed';

function detectCategory(message: string): Category {
  const msg = message.toLowerCase();
  if (/تمرين|تدريب|سرعة|قوة|لياقة|workout|training|sprint/i.test(msg)) return 'training';
  if (/أكل|تغذية|وجبة|بروتين|كالوري|diet|nutrition|protein/i.test(msg)) return 'nutrition';
  if (/إصابة|ألم|استشفاء|تعافي|injury|pain|recovery/i.test(msg)) return 'recovery';
  return 'football';
}

function detectLengthMode(message: string): LengthMode {
  const normalized = message.toLowerCase();
  const words = message.trim().split(/\s+/).length;
  if (/تحليل|تفصيلي|قارن|مقارنة|استراتيجية|خطة كاملة/.test(normalized)) return 'detailed';
  if (/اشرح|شرح|خطوات|ازاي|كيف|ليه|لماذا/.test(normalized)) return 'medium';
  if (/ألم|إصابة|تعب|استشفاء|نظام غذائي|وجبة|تمرين|تدريب|نصائح/.test(normalized)) return 'medium';
  if (words <= 4 || /^(كم|مين|فين|متى|ايه|ما هو)[؟?\s]/.test(normalized)) return 'short';
  return 'medium';
}

const TEMPERATURES: Record<Category, number> = {
  football: 0.4, training: 0.35, nutrition: 0.35, recovery: 0.4,
};

const CORE_BEHAVIOR_PROMPT = `
هوية المساعد:
- اسمك الرسمي: 90Plus agent.
- لا تذكر اسم المطور إلا إذا المستخدم سأل بشكل مباشر.
- في هذه الحالات فقط عرّف نفسك: "أنا 90Plus agent، مطور بواسطة mr.dev ai."

أسلوب الرد:
- أجب بنفس لغة المستخدم (عربية/إنجليزية).
- طابق لهجة المستخدم بدون مبالغة.
- لو المستخدم عايز رد سريع: ادي المختصر المفيد.
- لو محتاج شرح: كن منظم وواضح.
- تجنب الحشو.

اكتمال الرد:
- أكمل إجابتك دائماً حتى النهاية — لا تقطع الرد في منتصف جملة أو فكرة.
- لو الموضوع طويل، نظّم الرد في نقاط أو فقرات مختصرة لكن انهِ الفكرة كاملة.
- ابدأ بالمعلومة الأهم أولاً حتى لو انقطعت الإجابة لأي سبب يكون المستخدم عرف المهم.

تنسيق الجداول (Markdown):
- استخدم جدول Markdown دائمًا لأي محتوى مقسم على أيام أو أعمدة، مثل:
  • نظام غذائي أسبوعي/يومي.
  • خطة تمرين مقسمة على أيام.
  • تاريخ لاعب (الفرق، السنوات، الأرقام).
  • تاريخ نادي (المواسم، البطولات، المدربين).
  • قائمة الألقاب أو المنتخب (البطولة، الموسم، النتيجة).
  • أي مقارنة بين عناصر متعددة.
- صياغة الجدول الصحيحة:
  | العمود الأول | العمود الثاني | العمود الثالث |
  |---|---|---|
  | قيمة | قيمة | قيمة |
- استخدم رؤوس أعمدة قصيرة (كلمة أو اثنين).
- اضبط القيم في خلية واحدة لكل صف — لا تكسر الصفوف بأسطر متعددة.
- أضف فقرة قصيرة قبل أو بعد الجدول للسياق إذا لزم.

قيود النطاق:
- نطاقك فقط: كرة القدم، التمارين، الإحماء، الاستشفاء، والتغذية الرياضية.
- لا تقدم أخبار رياضية أو انتقالات — اعتذر واقترح مصادر موثوقة.
- لو السؤال خارج النطاق، اعتذر باختصار.

بيانات كرة القدم الحية:
- عندما يُرفق بلوك "LIVE FOOTBALL API DATA" في رسالة النظام، استخدمه كمصدر وحيد للأرقام والإحصائيات.
- لا تخترع أهدافاً أو بطولات أو أندية — إذا لم تتوفر البيانات، قل ذلك بوضوح.
- للاعبين والترتيب: استخدم الجداول Markdown عند عرض أكثر من 3 حقول.

السلامة:
- إذا احتوت الرسالة سبابًا، ارفض المتابعة باحترام.
`.trim();

function buildSystemPrompt(category: Category, mode: LengthMode): string {
  const categoryFocus: Record<Category, string> = {
    football: 'ركز على معلومات كرة القدم والتكتيك والتاريخ الرياضي.',
    training: 'ركز على التمارين وخطط التدريب وتطوير المهارات.',
    nutrition: 'ركز على التغذية الرياضية والوجبات قبل/بعد المباراة.',
    recovery: 'ركز على الاستشفاء والتعامل مع الإصابات الخفيفة.',
  };
  const lengthGuide: Record<LengthMode, string> = {
    short: 'المستخدم سأل سؤالاً بسيطًا. رد في سطر إلى سطرين فقط، وأنهِ الجملة كاملة.',
    medium: 'المستخدم يحتاج شرحًا متوسطًا. رد في 3-5 نقاط واضحة، ونظّم الرد لتضمن إكماله.',
    detailed: 'المستخدم يريد تحليلًا تفصيليًا. قدم إجابة مركزة متكاملة، وابدأ بالخلاصة ثم التفاصيل.',
  };
  return [CORE_BEHAVIOR_PROMPT, categoryFocus[category], lengthGuide[mode]].join('\n\n');
}

function computeMaxTokens(mode: LengthMode, messageLength: number): number {
  const base: Record<LengthMode, number> = { short: 600, medium: 1200, detailed: 2400 };
  const bonus = Math.min(800, Math.floor(messageLength / 8));
  return base[mode] + bonus;
}

// ── Metrics instrumentation (counts via the real footballService) ─────────────
let redisHits = 0;
const svc = footballService as any;
const originalGetCached = svc.getCachedData?.bind(svc);
if (typeof originalGetCached === 'function') {
  svc.getCachedData = async (key: string) => {
    const result = await originalGetCached(key);
    if (result) redisHits += 1;
    return result;
  };
}
function realApiCalls(): number {
  return typeof svc.requestCount === 'number' ? svc.requestCount : 0;
}

// ── Single chat simulation ───────────────────────────────────────────────────
interface ChatResult {
  name: string;
  kind: 'player' | 'club';
  question: string;
  contextChars: number;
  usedApi: boolean;
  model: string | null;
  answer: string;
  suggestions: string[];
  error?: string;
}

async function simulateChat(name: string, kind: 'player' | 'club'): Promise<ChatResult> {
  const question = buildQuestion(name);
  const result: ChatResult = {
    name, kind, question, contextChars: 0, usedApi: false, model: null, answer: '', suggestions: [],
  };

  try {
    // 1. EXACT production context builder (Redis-cached API calls inside).
    const footballCtx = await buildFootballChatContext(question);
    result.usedApi = !!footballCtx?.usedApi;
    result.contextChars = footballCtx?.block?.length ?? 0;

    // 2. Build the exact production messages + params.
    const category = detectCategory(question);
    const lengthMode = detectLengthMode(question);
    const useComplex = shouldUseComplexModel(lengthMode, !!footballCtx?.usedApi);
    const chain = providersForRequest(useComplex);

    let systemPrompt = buildSystemPrompt(category, lengthMode);
    if (footballCtx?.block) systemPrompt += `\n\n${footballCtx.block}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];
    const temperature = TEMPERATURES[category] ?? 0.45;
    const maxTokens = computeMaxTokens(lengthMode, question.length);

    // 3. Same provider fallback loop as production (non-streamed to capture full text).
    const errors: string[] = [];
    for (const provider of chain) {
      try {
        const completion = await provider.client.chat.completions.create({
          model: provider.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });
        result.answer = completion.choices[0]?.message?.content?.trim() ?? '';
        result.model = provider.model;
        if (result.answer) break;
      } catch (err: any) {
        errors.push(`${provider.name}: ${(err?.message ?? String(err)).slice(0, 120)}`);
      }
    }
    if (!result.answer && errors.length) result.error = errors.join(' | ');

    // 4. Suggestions — only for players, same wiring as production sendDone.
    if (kind === 'player') {
      const detected = detectPlayerInfoQuery(question);
      const suggestions = await getTeamSuggestions({
        playerName: detected?.playerName ?? name,
        language: 'ar',
      });
      result.suggestions = suggestions.map((s) => s.name);
    }
  } catch (err: any) {
    result.error = err?.message ?? String(err);
  }

  return result;
}

function printResult(r: ChatResult): void {
  console.log('═'.repeat(60));
  console.log(`▶ ${r.name}${r.kind === 'club' ? ' (نادي)' : ''}`);
  console.log(`   Q: "${r.question}"`);
  if (r.usedApi) {
    console.log(`   API context: ✅ injected (${r.contextChars} chars)`);
  } else {
    console.log('   API context: ⚪ none → model memory');
  }
  if (r.error && !r.answer) {
    console.log(`   ❌ error: ${r.error}`);
  } else {
    console.log(`   LLM answer (${r.model ?? '—'}):`);
    console.log('   ' + '─'.repeat(57));
    const preview = r.answer.length > 600 ? r.answer.slice(0, 600) + ' …' : r.answer;
    for (const line of preview.split('\n')) console.log(`   ${line}`);
    console.log('   ' + '─'.repeat(57));
  }
  if (r.kind === 'player') {
    const sug = r.suggestions.length ? r.suggestions.join(', ') : 'نون (لا توجد روابط فريق بعد)';
    console.log(`   suggestions: ${sug}`);
  }
  console.log('═'.repeat(60));
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log(' World-class chat simulation — buildFootballChatContext → LLM');
  console.log('═'.repeat(60));
  const providerSummary = PROVIDERS.map((p) => `${p.name}=${p.model}`).join(' | ');
  console.log(` Providers: ${providerSummary || 'NONE (no API key)'}`);
  console.log(` Mode     : ${QUESTION_MODE} (${QUESTION_MODE === 'stats' ? 'إيه إحصائيات {name}؟ — triggers API data' : 'إيه أخبار {name}؟ — model memory'})`);
  console.log(` Subjects : ${TEST_PLAYERS.length} players + ${TEST_CLUBS.length} clubs = ${TOTAL}`);

  if (PROVIDERS.length === 0) {
    console.error('\n❌ No AI provider configured (AI_API_KEY / OPENROUTER_API_KEY). Aborting.');
    return;
  }

  const startTime = Date.now();
  const apiCallsBefore = realApiCalls();

  const limit = pLimit(2); // LLM calls are heavy
  const jobs: Array<Promise<ChatResult>> = [
    ...TEST_PLAYERS.map((p) => limit(() => simulateChat(p, 'player'))),
    ...TEST_CLUBS.map((c) => limit(() => simulateChat(c, 'club'))),
  ];

  const results = await Promise.all(jobs);

  // Print in submission order.
  for (const r of results) printResult(r);

  const elapsedS = ((Date.now() - startTime) / 1000).toFixed(1);
  const apiCalls = realApiCalls() - apiCallsBefore;
  const withApi = results.filter((r) => r.usedApi && r.answer).length;
  const fromMemory = results.filter((r) => !r.usedApi && r.answer).length;
  const errored = results.filter((r) => !r.answer).length;

  console.log('\n' + '═'.repeat(60));
  console.log(` RESULT: ${withApi}/${TOTAL} answered with API context | ${fromMemory} from model memory${errored ? ` | ${errored} failed` : ''}`);
  console.log(` Total time: ${elapsedS}s | API calls: ${apiCalls} | Redis hits: ${redisHits}`);
  console.log('═'.repeat(60));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ test-world-class-chat crashed:', err);
    await prisma.$disconnect();
    await closeRedis();
    process.exit(1);
  });
