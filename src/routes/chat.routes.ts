/**
 * Chat Routes — 90Plus AI Chat API
 *
 * Prisma-backed storage (ChatConversation, ChatMessage, ChatLimit).
 * All conversation + message CRUD goes through `chat.service.ts`.
 *
 * Endpoints:
 *   GET    /api/chat/limit                                    remaining daily messages
 *   POST   /api/chat/stream                                   SSE streaming reply
 *   POST   /api/chat/transcribe                               voice → text (optional; 501 if no provider)
 *   GET    /api/conversations                                 list user conversations
 *   POST   /api/conversations                                 create new conversation
 *   GET    /api/conversations/:id/messages                    fetch messages
 *   PATCH  /api/conversations/:id                             rename / pin
 *   DELETE /api/conversations/:id                             remove
 *   DELETE /api/conversations/:id/messages/:messageId         remove message + cascade
 *
 * Auth:
 *   - Clerk JWT via `Authorization: Bearer` (requireAuth on all routes)
 *   - `x-user-timezone` header (IANA timezone) — used for daily-limit reset
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import multer from 'multer';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '../utils/logger';
import { sanitizeTimezone } from '../utils/chat-timezone';
import {
    buildLanguageLockPrompt,
    resolveChatLanguage,
} from '../utils/message-language.util';
import {
    listConversations,
    createConversation,
    findConversation,
    updateConversation,
    deleteConversation as dbDeleteConversation,
    listMessages,
    appendMessage,
    deleteMessageCascade,
    countMessages,
    isPlaceholderConversationTitle,
    buildTitleFromFirstMessage,
    getRemaining,
    incrementLimit,
    decrementLimit,
    getResetTimeForUser,
    getDailyMessageLimit,
    isChatUnlimitedUser,
    toConversationDTO,
    migrateLegacyFileStore,
} from '../services/chat.service';
import {
    buildFootballChatContext,
    shouldUseComplexModel,
} from '../services/chat-football-tools.service';
import {
    getCachedAnswer,
    saveCachedAnswer,
} from '../services/chat-answer-cache.service';
import {
    detectPlayerInfoQuery,
    resolvePlayerInfoAnswer,
    savePlayerInfoAnswer,
} from '../services/player-info-cache.service';
import { getTeamSuggestions } from '../services/chat-suggestions.service';
import {
    buildBedrockChatClient,
    isBedrockChatConfigured,
    resolveBedrockChatModel,
    type BedrockChatStreamClient,
} from '../services/bedrock-chat.client';
import {
    buildGeminiChatClient,
    isGeminiChatConfigured,
    resolveGeminiChatFallbackModel,
    resolveGeminiChatModel,
    type GeminiChatStreamClient,
} from '../services/gemini-chat.client';
import {
    isChatAgentConfigured,
    runFootballAgent,
} from '../services/chat-agent.service';
import { tryDeterministicFootballReply } from '../services/chat-deterministic-fallback.service';

// Data-backed factual answers stay valid for a few hours; live data is excluded
// from caching upstream (see FootballChatContext.cacheable).
const CHAT_ANSWER_CACHE_TTL_MS = 6 * 60 * 60_000;

const router = Router();

/** Only chat + conversation paths belong to this router — skip auth for unrelated /api/* traffic. */
router.use((req, res, next) => {
    const path = (req.path || '').split('?')[0];
    if (!path.startsWith('/chat') && !path.startsWith('/conversations')) {
        next('router');
        return;
    }
    void requireAuth(req, res, next);
});

// Run the one-shot file-store → Prisma migration at module load (non-blocking).
// Safe to call repeatedly — it short-circuits once the legacy file is archived.
migrateLegacyFileStore().catch((err) => {
    logger.warn('[chat] legacy migration failed (non-fatal):', err?.message ?? err);
});

// ─── Helpers: read headers ───────────────────────────────────────────────────
function getUserId(req: Request): string {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
        throw new Error('Unauthorized');
    }
    return clerkUserId;
}

function getTimezone(req: Request): string {
    return sanitizeTimezone(req.headers['x-user-timezone']);
}

// ─── Config: AI providers ────────────────────────────────────────────────────
type ChatStreamClient = OpenAI | BedrockChatStreamClient | GeminiChatStreamClient;

interface ProviderConfig {
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    client: ChatStreamClient;
}

function buildOpenRouterClient(apiKey: string, baseURL: string): OpenAI {
    return new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: {
            // OpenRouter uses these for analytics / attribution. Gemini's
            // OpenAI-compatible endpoint ignores unknown headers safely.
            'HTTP-Referer': 'https://90plus.pro',
            'X-Title': '90Plus AI Chat',
        },
    });
}

function initOpenRouterProviders(): ProviderConfig[] {
    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
    if (!apiKey) return [];

    const baseURL =
        process.env.OPENROUTER_BASE_URL ??
        process.env.AI_BASE_URL ??
        'https://openrouter.ai/api/v1';
    const client = buildOpenRouterClient(apiKey, baseURL);

    // FAST model: Qwen3.5 Flash — cheaper multilingual chat via OpenRouter.
    const FAST: ProviderConfig = {
        name: 'fast',
        apiKey,
        baseURL,
        model:
            process.env.AI_MODEL ??
            process.env.OPENROUTER_CHAT_MODEL ??
            'qwen/qwen3.5-flash-02-23',
        client,
    };

    // COMPLEX model: same primary; override via OPENROUTER_CHAT_COMPLEX_MODEL if needed.
    const COMPLEX: ProviderConfig = {
        name: 'complex',
        apiKey,
        baseURL,
        model:
            process.env.OPENROUTER_CHAT_COMPLEX_MODEL ??
            process.env.OPENROUTER_CHAT_SIMPLE_MODEL ??
            process.env.OPENROUTER_GEMINI_FLASH_MODEL ??
            process.env.OPENROUTER_CHAT_MODEL ??
            process.env.AI_MODEL ??
            'qwen/qwen3.5-flash-02-23',
        client,
    };

    // FALLBACK: alternate model when primary is rate-limited upstream.
    const FALLBACK: ProviderConfig = {
        name: 'fallback',
        apiKey,
        baseURL,
        model:
            process.env.OPENROUTER_CHAT_FALLBACK_MODEL ??
            'qwen/qwen3.5-flash-02-23',
        client,
    };

    return [FAST, COMPLEX, FALLBACK];
}

function initGeminiProviders(): ProviderConfig[] {
    const client = buildGeminiChatClient();
    if (!client) return [];

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
    const baseURL =
        process.env.GEMINI_BASE_URL ??
        'https://generativelanguage.googleapis.com/v1beta';
    const primaryModel = resolveGeminiChatModel();
    const fallbackModel = resolveGeminiChatFallbackModel();

    const PRIMARY: ProviderConfig = {
        name: 'gemini',
        apiKey,
        baseURL,
        model: primaryModel,
        client,
    };

    const FALLBACK: ProviderConfig = {
        name: 'gemini-fallback',
        apiKey,
        baseURL,
        model: fallbackModel,
        client,
    };

    return fallbackModel !== primaryModel ? [PRIMARY, FALLBACK] : [PRIMARY];
}

function initBedrockProviders(): ProviderConfig[] {
    const client = buildBedrockChatClient();
    if (!client) return [];

    const region =
        process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
    const model = resolveBedrockChatModel();

    return [
        {
            name: 'bedrock',
            apiKey: 'aws-iam',
            baseURL: `bedrock://${region}`,
            model,
            client,
        },
    ];
}

const OPENROUTER_PROVIDERS = initOpenRouterProviders();
const GEMINI_PROVIDERS = isGeminiChatConfigured() ? initGeminiProviders() : [];
const BEDROCK_PROVIDERS = isBedrockChatConfigured() ? initBedrockProviders() : [];
const PROVIDERS: ProviderConfig[] =
    GEMINI_PROVIDERS.length > 0
        ? GEMINI_PROVIDERS
        : BEDROCK_PROVIDERS.length > 0
          ? BEDROCK_PROVIDERS
          : OPENROUTER_PROVIDERS;

const GEMINI_PRIMARY = GEMINI_PROVIDERS.find((p) => p.name === 'gemini') ?? null;
const GEMINI_FALLBACK = GEMINI_PROVIDERS.find((p) => p.name === 'gemini-fallback') ?? null;

const OR_FAST = OPENROUTER_PROVIDERS.find((p) => p.name === 'fast') ?? null;
const OR_COMPLEX = OPENROUTER_PROVIDERS.find((p) => p.name === 'complex') ?? null;
const OR_FALLBACK = OPENROUTER_PROVIDERS.find((p) => p.name === 'fallback') ?? null;

const DAILY_LIMIT = getDailyMessageLimit();

if (PROVIDERS.length === 0) {
    logger.warn('[chat] ⚠️ no AI provider configured — /api/chat/stream will return 503');
} else {
    const summary = PROVIDERS.map((p) => `${p.name}=${p.model}`).join(' | ');
    logger.info(`[chat] 🤖 providers: ${summary}`);
}

/**
 * Build the provider attempt chain.
 * Gemini: primary 3 Flash (+ optional 2.5 Flash fallback).
 * Bedrock: single Haiku model.
 * OpenRouter: complex football → Gemini/Qwen chain.
 */
function providersForRequest(useComplex: boolean): ProviderConfig[] {
    const chain: ProviderConfig[] = [];
    const seen = new Set<string>();

    const push = (p: ProviderConfig | null) => {
        if (!p || seen.has(p.model)) return;
        seen.add(p.model);
        chain.push(p);
    };

    // Prefer Gemini when configured, but always keep OpenRouter as backup so a
    // dead Gemini key does not hard-fail chat when OpenRouter still works.
    if (GEMINI_PROVIDERS.length > 0) {
        if (GEMINI_PRIMARY) push(GEMINI_PRIMARY);
        if (GEMINI_FALLBACK) push(GEMINI_FALLBACK);
    } else if (BEDROCK_PROVIDERS.length > 0) {
        for (const p of BEDROCK_PROVIDERS) push(p);
    }

    if (useComplex) {
        push(OR_COMPLEX);
        push(OR_FALLBACK);
        push(OR_FAST);
    } else {
        push(OR_FAST);
        push(OR_COMPLEX);
        push(OR_FALLBACK);
    }

    return chain.length > 0 ? chain : PROVIDERS;
}

// ─── Domain helpers ──────────────────────────────────────────────────────────
function isGreeting(message: string): boolean {
    return /^(hi|hello|hey|اهلا|أهلا|السلام عليكم|سلام|ازيك|عامل ايه|صباح الخير|مساء الخير)[\s!.,؟?]*$/i.test(
        message.trim(),
    );
}

function isIdentityQuestion(message: string): boolean {
    const msg = message.toLowerCase().trim();
    if (msg.split(/\s+/).length > 12) return false;
    return (
        /^(من أنت|مين أنت|أنت مين|من انت|مين انت|انت مين)[؟?!.\s]*$/.test(msg) ||
        /^(ما اسمك|اسمك ايه|اسمك إيه|إيه اسمك|ايه اسمك)[؟?!.\s]*$/.test(msg) ||
        /^(who are you|what are you|what'?s your name)[؟?!.\s]*$/.test(msg) ||
        /^(what can you do|your capabilities|introduce yourself)[؟?!.\s]*$/.test(msg)
    );
}

function containsProfanity(message: string): boolean {
    return /(عرص|خول|متناك|كسم|كسمك|شرموط|fuck|bitch|asshole)/i.test(message);
}

function isSportsNewsRequest(message: string): boolean {
    return /(اخبار|أخبار|تريند|مستجدات|انتقالات|breaking|news|transfer)/i.test(message);
}

type Category = 'football' | 'training' | 'nutrition' | 'recovery';

function detectCategory(message: string): Category {
    const msg = message.toLowerCase();
    if (/تمرين|تدريب|سرعة|قوة|لياقة|workout|training|sprint/i.test(msg)) return 'training';
    if (/أكل|تغذية|وجبة|بروتين|كالوري|diet|nutrition|protein/i.test(msg)) return 'nutrition';
    if (/إصابة|ألم|استشفاء|تعافي|injury|pain|recovery/i.test(msg)) return 'recovery';
    return 'football';
}

type LengthMode = 'short' | 'medium' | 'detailed';

function detectLengthMode(message: string): LengthMode {
    const normalized = message.toLowerCase();
    const words = message.trim().split(/\s+/).length;

    // Player / career questions are often short but need thorough answers.
    if (
        /مسيرة|سيرة|تاريخ\s*اللاعب|career|biography|bio|history|titles|trophies|ألقاب|القاب|انتقالات|transfers|who\s+is|tell\s+me\s+about|من\s+هو|مين\s+هو|عن\s+اللاعب|about\s+the\s+player|player\s+profile/i.test(
            normalized,
        )
    ) {
        return 'detailed';
    }

    if (/تحليل|تفصيلي|قارن|مقارنة|استراتيجية|خطة كاملة/.test(normalized)) return 'detailed';
    if (/اشرح|شرح|خطوات|ازاي|كيف|ليه|لماذا/.test(normalized)) return 'medium';
    if (/ألم|إصابة|تعب|استشفاء|نظام غذائي|وجبة|تمرين|تدريب|نصائح/.test(normalized)) return 'medium';
    if (words <= 4 || /^(كم|مين|فين|متى|ايه|ما هو)[؟?\s]/.test(normalized)) return 'short';
    return 'medium';
}

function footballContextNeedsLongReply(block: string | undefined): boolean {
    if (!block) return false;
    return /365SCORES PLAYER|PLAYER UCL CAREER|LIVE FOOTBALL API DATA — PLAYER/i.test(block);
}

// Dynamic temperature per category: tactical/nutrition info should be precise,
// general chit-chat can be a bit more creative.
const TEMPERATURES: Record<Category, number> = {
    football: 0.4,
    training: 0.35,
    nutrition: 0.35,
    recovery: 0.4,
};

const CORE_BEHAVIOR_PROMPT = `
هوية المساعد:
- اسمك الرسمي: 90Plus agent.
- لا تذكر اسم المطور إلا إذا المستخدم سأل بشكل مباشر.
- في هذه الحالات فقط عرّف نفسك: "أنا 90Plus agent، مطور بواسطة mr.dev ai."

الشخصية والأسلوب:
- انت جمهوري متحمس وعارف كورة صح — رد بثقة ومباشرة، من غير حشو ولا مقدمات طويلة.
- ردودك قصيرة وقوية إلا لو المستخدم طلب تفاصيل أكتر.
- أجب بنفس لغة المستخدم؛ لو عربي رد باللهجة المصرية العامية إلا لو كتب بلهجة/لغة تانية فطابقها.
- استخدم إيموجي كورة باعتدال لما يناسب (⚽🟨🟥) من غير إفراط.
- لو المستخدم عايز رد سريع: ادي المختصر المفيد. لو محتاج شرح: كن منظم وواضح.

قاعدة المعلومات الوقتية (صارمة جدًا):
- معرفتك المدرّبة قديمة وممكن تكون غلط: نادي اللاعب الحالي، سنه، إصابته، حالة انتقاله، إحصائيات الموسم، مواعيد ونتائج المباريات، الدقيقة الحالية، التشكيل، والأحداث (جون/كارت/تبديل) — كل ده وقتي.
- أي معلومة وقتية لازم تيجي من بلوك بيانات مرفق في رسالة النظام. لو مفيش بلوك مرفق للسؤال الوقتي، قول إنك مش عندك تحديث لحظي دلوقتي — من غير ما تخمّن من الذاكرة.
- ممنوع نهائيًا "غالبًا" أو "على حد علمي" أو أي تخمين في نتيجة، دقيقة مباراة، سن لاعب، أو ناديه الحالي.
- بيانات اللايف بتتغير كل لحظة: ماتعيدش استخدام نتيجة/دقيقة قديمة ظهرت قبل كده في نفس المحادثة كأنها لسه صح.

إمتى ترد من غير بيانات (للسرعة):
- قواعد اللعبة العامة (التسلل، مدة الشوط) والتاريخ الثابت القديم (مين كسب مونديال 2018) → جاوب مباشرة، دي معلومة ثابتة مش هتتغير.
- الكلام العام عن التطبيق أو أسئلة مالهاش علاقة بلاعب/مباراة بعينها → رد عادي.

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
- عندما يُرفق بلوك "LIVE FOOTBALL DATA" أو "LIVE FOOTBALL API DATA" أو "TEAM DOSSIER" في رسالة النظام، استخدمه كمصدر وحيد للأرقام والإحصائيات.
- قاعدة صارمة: أي رقم (أهداف، صناعة، مباريات، تقييم، بطولات، ترتيب) يجب أن يأتي حصراً من سطر مُعلّم بـ "source: api" أو "source: cache". ممنوع منعاً تاماً اختراع أو تخمين أي رقم.
- إذا كان السطر مُعلّماً بـ "source: unavailable" أو ظهر بلوك "NO-VERIFIED-DATA GUARD"، فلا تذكر أي أرقام إطلاقاً — قل بوضوح: "مفيش بيانات موثقة دلوقتي" وقدّم فقط معلومات وصفية عامة بدون أرقام.
- إن لم يُرفق أي بلوك بيانات أصلاً، لا تخترع إحصائيات؛ تحدث بشكل وصفي عام أو وضّح أن البيانات غير متاحة.
- لا تخترع أهدافاً أو بطولات أو أندية أو مدربين — إذا لم تتوفر البيانات، قل ذلك بوضوح.
- للاعبين والفرق والترتيب: استخدم الجداول Markdown عند عرض أكثر من 3 حقول.
- عند سؤال عن مباريات اليوم: اذكر فقط أهم المباريات المرفقة في السياق (لا تسرد كل المباريات). في نهاية الرد وجّه المستخدم لصفحة المباريات في تطبيق 90Plus لو عايز يشوف باقي المباريات.

الفولباك (لما البيانات تفشل أو تكون فاضية):
- لو الداتا رجعت فاضية أو فشلت: قول إن المعلومة مش متاحة دلوقتي وجرّب تاني بعد شوية — من غير ما تملا الفراغ بتخمين من الذاكرة.
- لو اسم اللاعب غامض وفيه أكتر من احتمال: اختار الأشهر واستخدمه، أو اسأل بسرعة "قصدك مين؟" مع 2-3 خيارات.

ممنوعات:
- ماتذكرش كلمة "tool" أو "API" أو "endpoint" للمستخدم — رد طبيعي وكأنك عارف من نفسك.
- ماتقولش "على حد علمي" أو "غالبًا" في أي معلومة وقتية (نتيجة، دقيقة، سن، نادي حالي).

السلامة:
- إذا احتوت الرسالة سبابًا، ارفض المتابعة باحترام.
`.trim();

function buildSystemPrompt(category: Category, mode: LengthMode): string {
    const categoryFocus: Record<Category, string> = {
        football:
            'ركز على معلومات كرة القدم والتكتيك والتاريخ الرياضي. أجب عن كل المسابقات (الدوريات المحلية، دوري الأبطال، كأس العالم، المنتخبات) حسب سؤال المستخدم — لا تقصر الإجابة على كأس العالم فقط.',
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

// ─── Token-aware history window ──────────────────────────────────────────────
//
// Approximate token count ≈ characters / 4 (OpenAI's published heuristic).
// We budget 2000 tokens max for history and always keep the last 4 messages
// regardless of length — cutting context too aggressively kills conversation
// continuity, especially for long threads about a single topic.
const HISTORY_TOKEN_BUDGET = 2000;
const HISTORY_MIN_MESSAGES = 4;

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

interface HistoryItem {
    role: 'user' | 'assistant';
    content: string;
}

function buildHistoryWindow(history: HistoryItem[]): HistoryItem[] {
    const clean = history.filter(
        (m) => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    );
    if (clean.length === 0) return [];

    const result: HistoryItem[] = [];
    let tokens = 0;

    // Walk newest → oldest, stop once the budget is full (but never drop the
    // tail of the last 4 messages — they're always needed for continuity).
    for (let i = clean.length - 1; i >= 0; i--) {
        const msg = clean[i];
        const t = estimateTokens(msg.content);
        if (result.length >= HISTORY_MIN_MESSAGES && tokens + t > HISTORY_TOKEN_BUDGET) break;
        result.unshift(msg);
        tokens += t;
    }
    return result;
}

// ─── Dynamic max_tokens ──────────────────────────────────────────────────────
//
// We deliberately allow the model enough room to finish any reasonable reply
// so responses never get cut mid-sentence. The floor scales with length mode
// and the message length so a long question implicitly unlocks a longer
// answer budget.
function computeMaxTokens(
    mode: LengthMode,
    messageLength: number,
    opts?: { playerData?: boolean },
): number {
    const cap = Number(process.env.CHAT_MAX_OUTPUT_TOKENS ?? 1200);
    const playerFloor = Number(process.env.CHAT_PLAYER_MAX_OUTPUT_TOKENS ?? 900);
    const base: Record<LengthMode, number> = {
        short: 500,
        medium: 800,
        detailed: 1000,
    };
    const bonus = Math.min(200, Math.floor(messageLength / 20));
    let total = base[mode] + bonus;
    if (opts?.playerData) {
        total = Math.max(total, playerFloor);
    }
    return Math.min(total, Number.isFinite(cap) && cap > 0 ? cap : 1200);
}

// ─── GET /chat/limit ─────────────────────────────────────────────────────────
router.get('/chat/limit', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const tz = getTimezone(req);
    try {
        const unlimited = isChatUnlimitedUser(userId);
        const remaining = await getRemaining(userId, tz);
        res.json({
            remaining,
            used: unlimited ? 0 : DAILY_LIMIT - remaining,
            limit: DAILY_LIMIT,
            unlimited,
            resetAt: await getResetTimeForUser(userId),
            timezone: tz,
        });
    } catch (err: any) {
        logger.error('[chat] /limit failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

/** Rename placeholder conversations from the first user message text. */
async function maybeAutoTitleConversation(
    userId: string,
    conversationId: string,
    titleSource: string,
): Promise<string | undefined> {
    const conv = await findConversation(userId, conversationId);
    if (!conv || !isPlaceholderConversationTitle(conv.title)) return undefined;
    const title = buildTitleFromFirstMessage(titleSource);
    await updateConversation(userId, conversationId, { title });
    return title;
}

// ─── POST /chat/stream (SSE) ─────────────────────────────────────────────────
router.post('/chat/stream', async (req: Request, res: Response): Promise<void> => {
    const { TEMP_FREEZE_AI_CHAT } = await import('../config/temp-surface-freeze.config');
    if (TEMP_FREEZE_AI_CHAT) {
        res.status(503).json({
            error: 'AI temporarily unavailable',
            message: 'المساعد الذكي متوقف مؤقتًا. حاول لاحقًا.',
        });
        return;
    }

    const userId = getUserId(req);
    const tz = getTimezone(req);

    const {
        message,
        history = [],
        conversationId,
        systemPromptSuffix,
        resumeFromToken,
        preferredLanguage,
    } = (req.body ?? {}) as {
        message?: string;
        history?: HistoryItem[];
        conversationId?: string;
        systemPromptSuffix?: string;
        resumeFromToken?: number;
        preferredLanguage?: string;
    };

    const headerLang = req.headers['x-user-language'];
    const appLanguage =
        typeof headerLang === 'string' && headerLang.trim()
            ? headerLang.trim()
            : preferredLanguage;

    if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
    }

    const trimmedMessage = message.trim();
    const isResume = typeof resumeFromToken === 'number' && resumeFromToken > 0;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();

    const sendToken = (token: string): void => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
    };
    const sendDone = (extra: Record<string, unknown> = {}): void => {
        res.write(`data: ${JSON.stringify({ done: true, ...extra })}\n\n`);
        res.end();
    };
    const sendError = (msg: string): void => {
        res.write(`data: ${JSON.stringify({ error: msg, done: true })}\n\n`);
        res.end();
    };

    // If the client disconnects mid-stream, upstream will throw the next time
    // we try to write. No server-side cleanup needed beyond the try/catch.
    let clientClosed = false;
    req.on('close', () => {
        clientClosed = true;
    });

    try {
        // ─── Limit check ─────────────────────────────────────────────────────
        const remaining = await getRemaining(userId, tz);
        if (remaining <= 0 && !isResume) {
            sendError('انتهت رسائلك اليومية');
            return;
        }

        // ─── Ensure conversation exists ──────────────────────────────────────
        let targetConversation = conversationId ? await findConversation(userId, conversationId) : null;
        if (!targetConversation) {
            targetConversation = await createConversation(userId, 'محادثة جديدة');
        }

        // ─── Save user message + consume a credit (new requests only) ───────
        if (!isResume) {
            const userMsg = await appendMessage(userId, targetConversation.id, 'user', trimmedMessage);
            if (!userMsg) {
                sendError('Failed to save user message');
                return;
            }
            await incrementLimit(userId, tz);
        }

        const finishCannedReply = async (replyText: string): Promise<void> => {
            sendToken(replyText);
            await appendMessage(userId, targetConversation!.id, 'assistant', replyText);
            const conversationTitle = await maybeAutoTitleConversation(
                userId,
                targetConversation!.id,
                trimmedMessage,
            );
            sendDone({
                remaining,
                limit: DAILY_LIMIT,
                resetAt: await getResetTimeForUser(userId),
                ...(conversationTitle ? { conversationTitle } : {}),
            });
        };

        const messageLanguage = resolveChatLanguage(trimmedMessage, appLanguage);

        // ─── Fast-path short-circuits (skipped on resume) ────────────────────
        if (!isResume) {
            if (containsProfanity(trimmedMessage)) {
                await finishCannedReply(
                    messageLanguage === 'en'
                        ? 'Sorry, I cannot continue with that language. Please start a new conversation with respectful wording.'
                        : 'اعتذر، لا يمكنني متابعة المحادثة بهذه اللغة. ابدأ محادثة جديدة بصياغة محترمة.',
                );
                return;
            }

            if (isIdentityQuestion(trimmedMessage)) {
                const identityText =
                    messageLanguage === 'en'
                        ? "I'm 90Plus AI — your smart football & sports assistant, developed by mr.dev ai. I help with football info, training plans, sports nutrition, and recovery advice."
                        : 'أنا 90Plus AI ⚽ — مساعدك الرياضي الذكي، طوّرني mr.dev ai. أقدر أساعدك في كرة القدم، خطط التدريب، التغذية الرياضية، ونصائح الاستشفاء.';
                await finishCannedReply(identityText);
                return;
            }

            if (isGreeting(trimmedMessage)) {
                await finishCannedReply(
                    messageLanguage === 'en'
                        ? 'Welcome! I can help with football, training, recovery, and sports nutrition.'
                        : 'أهلًا بك! جاهز أساعدك في كرة القدم، التمارين، الاستشفاء، والإعداد الغذائي.',
                );
                return;
            }

            if (isSportsNewsRequest(trimmedMessage)) {
                await finishCannedReply(
                    messageLanguage === 'en'
                        ? 'Live news is outside my scope, but you can follow it on:\n\n' +
                          '• **BBC Sport** — bbc.com/sport\n' +
                          '• **Goal** — goal.com\n' +
                          '• **ESPN** — espn.com/soccer\n\n' +
                          'Any other football, training, or nutrition questions?'
                        : 'الأخبار اللحظية مش في نطاقي، بس تقدر تتابعها على:\n\n' +
                          '• **BBC Sport Arabic** — bbc.com/arabic/sports\n' +
                          '• **Goal بالعربي** — goal.com/ar\n' +
                          '• **يلا كورة** — yallakora.com\n\n' +
                          'عندك أي سؤال تاني عن كرة القدم أو التمارين أو التغذية؟ 🎯',
                );
                return;
            }
        }

        const sanitizedSuffix =
            typeof systemPromptSuffix === 'string' && systemPromptSuffix.trim().length > 0
                ? systemPromptSuffix.trim().slice(0, 1500)
                : '';

        const cacheLang = messageLanguage;
        // The grounded tool agent must run even when the client sends a
        // personalization suffix (profile block). Previously any suffix forced
        // the legacy prefetch+LLM path, which has none of the 365 grounding —
        // so real users with a completed profile always got stale answers even
        // though the suffix-less test battery passed. The suffix is merged into
        // the agent system prompt below instead of disabling the agent.
        const agentEnabled = !isResume && isChatAgentConfigured();
        const playerInfoQuery =
            !agentEnabled && !isResume && !sanitizedSuffix
                ? detectPlayerInfoQuery(trimmedMessage)
                : null;

        // ─── player_info cache (skipped when tool agent is on — avoids stale answers)
        if (playerInfoQuery && !clientClosed) {
            const playerCached = await resolvePlayerInfoAnswer({
                ...playerInfoQuery,
                language: cacheLang,
            });
            if (playerCached?.answer) {
                sendToken(playerCached.answer);
                await appendMessage(
                    userId,
                    targetConversation.id,
                    'assistant',
                    playerCached.answer,
                    playerCached.usedModel ?? undefined,
                );
                const conversationTitle = await maybeAutoTitleConversation(
                    userId,
                    targetConversation.id,
                    trimmedMessage,
                );
                const suggestions = await getTeamSuggestions({
                    playerName: playerInfoQuery.playerName,
                    language: cacheLang,
                });
                sendDone({
                    remaining,
                    limit: DAILY_LIMIT,
                    resetAt: await getResetTimeForUser(userId),
                    cached: true,
                    playerInfo: true,
                    playerInfoSource: playerCached.source,
                    ...(conversationTitle ? { conversationTitle } : {}),
                    ...(suggestions.length ? { suggestions } : {}),
                });
                return;
            }
        }

        // ─── Tool-calling agent (OpenRouter Qwen) — preferred path ───────────
        // Bypasses the generic answer cache so temporal questions never get
        // stale hallucinated tables. Falls through to legacy on failure.
        if (agentEnabled && !clientClosed) {
            const category = detectCategory(trimmedMessage);
            const lengthMode = detectLengthMode(trimmedMessage);
            const agentSystemPrompt = [
                buildLanguageLockPrompt(messageLanguage),
                buildSystemPrompt(category, lengthMode),
                // Preserve profile personalization inside the grounded path.
                // The agent's tool data still overrides anything here for facts.
                sanitizedSuffix,
            ]
                .filter(Boolean)
                .join('\n\n');

            const historyForAgent = buildHistoryWindow(
                Array.isArray(history) ? history : [],
            );

            try {
                const abort = new AbortController();
                req.on('close', () => abort.abort());

                const agentResult = await runFootballAgent({
                    systemPrompt: agentSystemPrompt,
                    history: historyForAgent,
                    userMessage: trimmedMessage,
                    language: messageLanguage,
                    onToken: (token) => {
                        if (!clientClosed) sendToken(token);
                    },
                    signal: abort.signal,
                });

                if (agentResult.fullText.trim().length > 0 && !clientClosed) {
                    await appendMessage(
                        userId,
                        targetConversation.id,
                        'assistant',
                        agentResult.fullText,
                        agentResult.usedModel,
                    );
                    const conversationTitle = await maybeAutoTitleConversation(
                        userId,
                        targetConversation.id,
                        trimmedMessage,
                    );
                    sendDone({
                        remaining: await getRemaining(userId, tz),
                        limit: DAILY_LIMIT,
                        resetAt: await getResetTimeForUser(userId),
                        usedModel: agentResult.usedModel,
                        usedProvider: 'agent',
                        toolsUsed: agentResult.toolsUsed,
                        ...(conversationTitle ? { conversationTitle } : {}),
                    });
                    return;
                }
            } catch (err: any) {
                logger.warn(
                    `[chat] agent path failed — falling back to legacy: ${err?.message ?? err}`,
                );
            }

            // If the agent is configured but produced nothing (credits/keys),
            // try a deterministic tools reply before the legacy LLM path.
            try {
                const deterministic = await tryDeterministicFootballReply(
                    trimmedMessage,
                    messageLanguage,
                );
                if (deterministic?.text && !clientClosed) {
                    sendToken(deterministic.text);
                    await appendMessage(
                        userId,
                        targetConversation.id,
                        'assistant',
                        deterministic.text,
                        'deterministic-tools',
                    );
                    const conversationTitle = await maybeAutoTitleConversation(
                        userId,
                        targetConversation.id,
                        trimmedMessage,
                    );
                    sendDone({
                        remaining: await getRemaining(userId, tz),
                        limit: DAILY_LIMIT,
                        resetAt: await getResetTimeForUser(userId),
                        usedModel: 'deterministic-tools',
                        usedProvider: 'tools',
                        toolsUsed: deterministic.toolsUsed,
                        ...(conversationTitle ? { conversationTitle } : {}),
                    });
                    return;
                }
            } catch (err: any) {
                logger.warn(
                    `[chat] post-agent deterministic fallback failed: ${err?.message ?? err}`,
                );
            }
        }

        // ─── Build prompt (legacy pre-fetch path) ────────────────────────────
        const category = detectCategory(trimmedMessage);
        let lengthMode = detectLengthMode(trimmedMessage);

        const footballCtx = !isResume
            ? await buildFootballChatContext(trimmedMessage, { language: messageLanguage })
            : null;

        const playerDataReply =
            !!playerInfoQuery || footballContextNeedsLongReply(footballCtx?.block);
        if (playerDataReply) {
            lengthMode = 'detailed';
        }

        const baseSystemPrompt = buildSystemPrompt(category, lengthMode);
        const useComplexModel = shouldUseComplexModel(lengthMode, !!footballCtx?.usedApi);
        const activeProviders = providersForRequest(useComplexModel);

        // ─── DB answer cache (stable, data-backed questions only) ─────────────
        // Serve identical factual questions from Postgres to skip the LLM.
        // Excluded: resumes, live data, and personalized (suffix) prompts.
        const cacheEligible =
            !isResume &&
            !!footballCtx?.usedApi &&
            footballCtx?.cacheable === true &&
            !sanitizedSuffix;

        if (cacheEligible) {
            const cached = await getCachedAnswer(
                cacheLang,
                trimmedMessage,
                CHAT_ANSWER_CACHE_TTL_MS,
            );
            if (cached?.answer && !clientClosed) {
                sendToken(cached.answer);
                await appendMessage(
                    userId,
                    targetConversation.id,
                    'assistant',
                    cached.answer,
                    cached.usedModel ?? undefined,
                );
                const conversationTitle = await maybeAutoTitleConversation(
                    userId,
                    targetConversation.id,
                    trimmedMessage,
                );
                sendDone({
                    remaining,
                    limit: DAILY_LIMIT,
                    resetAt: await getResetTimeForUser(userId),
                    cached: true,
                    ...(conversationTitle ? { conversationTitle } : {}),
                });
                return;
            }
        }

        let systemPrompt = [
            buildLanguageLockPrompt(messageLanguage),
            sanitizedSuffix ? `${baseSystemPrompt}\n\n${sanitizedSuffix}` : baseSystemPrompt,
        ]
            .filter(Boolean)
            .join('\n\n');

        if (footballCtx?.block) {
            systemPrompt += `\n\n${footballCtx.block}`;
        }

        if (isResume && resumeFromToken) {
            systemPrompt +=
                messageLanguage === 'en'
                    ? `\n\nSystem note: The previous reply was cut off after ${resumeFromToken} characters. Continue from where you stopped without repeating earlier content.`
                    : `\n\nملاحظة نظام: الرد السابق انقطع بعد ${resumeFromToken} حرف. أكمل من حيث توقفت بدون تكرار ما سبق.`;
        }

        const trimmedHistory = buildHistoryWindow(Array.isArray(history) ? history : []);

        const temperature = TEMPERATURES[category] ?? 0.45;
        const maxTokens = computeMaxTokens(lengthMode, trimmedMessage.length, {
            playerData: playerDataReply,
        });

        // ─── Stream with automatic provider fallback ─────────────────────────
        if (activeProviders.length === 0) {
            logger.error('[chat] no AI provider configured — check AI_PROVIDER / GEMINI_API_KEY / AWS_* / OPENROUTER_API_KEY');
            if (!isResume) await decrementLimit(userId, tz);
            sendError('AI service not configured');
            return;
        }

        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...trimmedHistory,
            { role: 'user', content: trimmedMessage },
        ];

        const requestBody = {
            max_tokens: maxTokens,
            stream: true as const,
            messages,
            temperature,
        };

        let fullText = '';
        let usedProvider: ProviderConfig | null = null;
        let firstTokenSent = false;
        const providerErrors: string[] = [];

        for (const provider of activeProviders) {
            if (firstTokenSent || clientClosed) break;

            try {
                // Qwen3.6 Flash (and similar) default to heavy thinking tokens.
                // Disable for chat so replies stay fast/cheap; OpenRouter ignores
                // unknown params on non-reasoning models.
                const openRouterExtras =
                    provider.name === 'fast' ||
                    provider.name === 'complex' ||
                    provider.name === 'fallback'
                        ? { reasoning: { effort: 'none' as const } }
                        : {};
                const stream = await provider.client.chat.completions.create({
                    model: provider.model,
                    ...requestBody,
                    ...openRouterExtras,
                });
                usedProvider = provider;
                for await (const chunk of stream) {
                    if (clientClosed) break;
                    const token = chunk.choices[0]?.delta?.content ?? '';
                    if (token) {
                        fullText += token;
                        firstTokenSent = true;
                        sendToken(token);
                    }
                }
                break; // success
            } catch (err: any) {
                const msg = err?.message ?? String(err);
                providerErrors.push(`${provider.name}: ${msg.slice(0, 120)}`);
                logger.warn(
                    `[chat] provider ${provider.name} (${provider.model}) failed: ${msg.slice(0, 200)}`,
                );
                if (firstTokenSent) break; // too late to fall back
            }
        }

        if (clientClosed) {
            // Client disconnected mid-stream; persist what we have so resume works.
            if (firstTokenSent && usedProvider && fullText.length > 0) {
                try {
                    await appendMessage(
                        userId,
                        targetConversation.id,
                        'assistant',
                        fullText,
                        usedProvider.model,
                    );
                } catch {
                    /* ignore */
                }
            }
            return;
        }

        if (!firstTokenSent || !usedProvider) {
            logger.error('[chat] all providers failed:', providerErrors.join(' | '));

            // Last-resort: answer from football tools without an LLM so chat
            // still works when Gemini/OpenRouter keys or credits are down.
            try {
                const deterministic = await tryDeterministicFootballReply(
                    trimmedMessage,
                    messageLanguage,
                );
                if (deterministic?.text && !clientClosed) {
                    sendToken(deterministic.text);
                    await appendMessage(
                        userId,
                        targetConversation.id,
                        'assistant',
                        deterministic.text,
                        'deterministic-tools',
                    );
                    const conversationTitle = await maybeAutoTitleConversation(
                        userId,
                        targetConversation.id,
                        trimmedMessage,
                    );
                    sendDone({
                        remaining: await getRemaining(userId, tz),
                        limit: DAILY_LIMIT,
                        resetAt: await getResetTimeForUser(userId),
                        usedModel: 'deterministic-tools',
                        usedProvider: 'tools',
                        toolsUsed: deterministic.toolsUsed,
                        ...(conversationTitle ? { conversationTitle } : {}),
                    });
                    return;
                }
            } catch (err: any) {
                logger.warn(
                    `[chat] deterministic fallback failed: ${err?.message ?? err}`,
                );
            }

            if (!isResume) await decrementLimit(userId, tz);
            sendError('AI service error. Please try again.');
            return;
        }

        // ─── Persist assistant reply ────────────────────────────────────────
        try {
            await appendMessage(
                userId,
                targetConversation.id,
                'assistant',
                fullText,
                usedProvider.model,
            );

            // Cache stable, data-backed answers so identical questions skip the
            // LLM next time (best-effort, never blocks the response).
            if (cacheEligible && fullText.trim().length > 0) {
                void saveCachedAnswer(cacheLang, trimmedMessage, fullText, usedProvider.model);
            }

            if (playerInfoQuery && footballCtx?.block && fullText.trim().length > 0) {
                void savePlayerInfoAnswer({
                    lookup: { ...playerInfoQuery, language: cacheLang },
                    question: trimmedMessage,
                    answer: fullText,
                    // Fingerprint over the RAW player block (matches the drift
                    // check in fetchPlayerApiContext) so cache hits keep skipping
                    // the LLM instead of regenerating on every fingerprint check.
                    apiContext: footballCtx.playerApiContext ?? footballCtx.block,
                    usedModel: usedProvider.model,
                    apiPlayerId: footballCtx.playerMeta?.athleteId,
                    displayName: footballCtx.playerMeta?.displayName,
                });
            }

            // Auto-title on first exchange (≤ 2 messages total in the convo
            // after we just saved the assistant reply — meaning we're finishing
            // the very first user/assistant pair).
            let titleSource = trimmedMessage;
            const total = await countMessages(targetConversation.id);
            if (total > 2) {
                const history = await listMessages(userId, targetConversation.id, 50);
                const firstUser = history?.find((m) => m.role === 'user');
                if (firstUser?.text?.trim()) titleSource = firstUser.text;
            }
            const conversationTitle = await maybeAutoTitleConversation(
                userId,
                targetConversation.id,
                titleSource,
            );

            const suggestions = playerInfoQuery
                ? await getTeamSuggestions({
                      playerName: playerInfoQuery.playerName,
                      language: cacheLang,
                  })
                : [];

            sendDone({
                remaining: await getRemaining(userId, tz),
                limit: DAILY_LIMIT,
                resetAt: await getResetTimeForUser(userId),
                usedModel: usedProvider.model,
                usedProvider: usedProvider.name,
                ...(conversationTitle ? { conversationTitle } : {}),
                ...(suggestions.length ? { suggestions } : {}),
                ...(footballCtx?.sources?.length ? { dataSources: footballCtx.sources } : {}),
            });
        } catch (err: any) {
            logger.error('[chat] post-stream housekeeping failed:', err?.message ?? err);
            sendDone({
                remaining: await getRemaining(userId, tz).catch(() => 0),
                limit: DAILY_LIMIT,
                resetAt: await getResetTimeForUser(userId),
                usedModel: usedProvider.model,
            });
        }
    } catch (err: any) {
        logger.error('[chat] /stream error:', err?.message ?? err);
        try {
            sendError('Internal error');
        } catch {
            /* res already ended */
        }
    }
});

// ─── POST /chat/transcribe (voice → text) ────────────────────────────────────
//
// Accepts an audio file (multipart/form-data, field name "audio") and returns
// `{ text }`. Uses OpenAI-compatible `audio.transcriptions` so OpenRouter (or
// anything else exposing the Whisper endpoint via env) can serve it.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap — plenty for short voice memos
});

router.post('/chat/transcribe', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
    const transcribeKey = process.env.AI_TRANSCRIBE_KEY ?? process.env.OPENAI_API_KEY ?? '';
    const transcribeBaseURL =
        process.env.AI_TRANSCRIBE_BASE_URL ??
        (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : '');
    const model = process.env.AI_TRANSCRIBE_MODEL ?? 'whisper-1';

    if (!transcribeKey || !transcribeBaseURL) {
        res.status(501).json({ error: 'Transcription not configured' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ error: 'Audio file is required (multipart field "audio")' });
        return;
    }

    try {
        const client = new OpenAI({ apiKey: transcribeKey, baseURL: transcribeBaseURL });
        // OpenAI SDK v6 accepts a `toFile`-compatible argument for `file`.
        const { toFile } = await import('openai/uploads');
        const file = await toFile(req.file.buffer, req.file.originalname || 'audio.m4a', {
            type: req.file.mimetype || 'audio/m4a',
        });
        const result = await client.audio.transcriptions.create({
            file,
            model,
        });
        res.json({ text: (result as { text?: string }).text ?? '' });
    } catch (err: any) {
        logger.warn('[chat] transcribe failed:', err?.message ?? err);
        res.status(502).json({ error: 'Transcription failed' });
    }
});

// ─── Conversation CRUD ───────────────────────────────────────────────────────
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    try {
        const rows = await listConversations(userId);
        res.json({ conversations: rows.map(toConversationDTO) });
    } catch (err: any) {
        logger.error('[chat] list conversations failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.post('/conversations', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const { title } = (req.body ?? {}) as { title?: string };
    try {
        const conversation = await createConversation(userId, title?.trim() || 'محادثة جديدة');
        res.status(201).json({
            conversation: {
                id: conversation.id,
                title: conversation.title,
                isPinned: conversation.pinned,
                createdAt: conversation.createdAt.toISOString(),
                updatedAt: conversation.updatedAt.toISOString(),
                lastMessage: null,
            },
        });
    } catch (err: any) {
        logger.error('[chat] create conversation failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
        const messages = await listMessages(userId, conversationId);
        if (!messages) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        res.json({ messages });
    } catch (err: any) {
        logger.error('[chat] list messages failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.patch('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, isPinned } = (req.body ?? {}) as { title?: string; isPinned?: boolean };

    const updates: { title?: string; pinned?: boolean } = {};
    if (typeof title === 'string' && title.trim().length > 0) updates.title = title.trim().slice(0, 100);
    if (typeof isPinned === 'boolean') updates.pinned = isPinned;

    try {
        const updated = await updateConversation(userId, conversationId, updates);
        if (!updated) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        res.json({
            conversation: {
                id: updated.id,
                title: updated.title,
                isPinned: updated.pinned,
                updatedAt: updated.updatedAt.toISOString(),
            },
        });
    } catch (err: any) {
        logger.error('[chat] update conversation failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.delete('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
        const ok = await dbDeleteConversation(userId, conversationId);
        if (!ok) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        res.json({ message: 'Deleted successfully' });
    } catch (err: any) {
        logger.error('[chat] delete conversation failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.delete('/conversations/:id/messages/:messageId', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const messageId = Array.isArray(req.params.messageId)
        ? req.params.messageId[0]
        : req.params.messageId;

    try {
        const ok = await deleteMessageCascade(userId, conversationId, messageId);
        if (!ok) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }
        res.json({ message: 'Deleted successfully' });
    } catch (err: any) {
        logger.error('[chat] delete message failed:', err?.message ?? err);
        res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
