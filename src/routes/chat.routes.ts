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
    getResetTime,
    toConversationDTO,
    migrateLegacyFileStore,
} from '../services/chat.service';

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
interface ProviderConfig {
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    client: OpenAI;
}

function buildClient(apiKey: string, baseURL: string): OpenAI {
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

const PRIMARY: ProviderConfig | null = (() => {
    const apiKey = process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '';
    if (!apiKey) return null;
    const baseURL = process.env.AI_BASE_URL ?? process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    return {
        name: 'primary',
        apiKey,
        baseURL,
        model: process.env.AI_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? 'qwen/qwen3.6-flash',
        client: buildClient(apiKey, baseURL),
    };
})();

const FALLBACK: ProviderConfig | null = (() => {
    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
    if (!apiKey) return null;
    const baseURL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    // Use a different model as fallback (Gemini via OpenRouter)
    const fallbackModel = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
    const primaryModel = process.env.AI_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? 'qwen/qwen3.6-flash';
    // Only create fallback if we have a different model to fall back to
    if (fallbackModel === primaryModel) return null;
    return {
        name: 'fallback',
        apiKey,
        baseURL,
        model: fallbackModel,
        client: buildClient(apiKey, baseURL),
    };
})();

const PROVIDERS: ProviderConfig[] = [PRIMARY, FALLBACK].filter(
    (p): p is ProviderConfig => p !== null,
);

const DAILY_LIMIT = Number(process.env.CHAT_DAILY_MESSAGE_LIMIT ?? 20);

if (PROVIDERS.length === 0) {
    logger.warn('[chat] ⚠️ no AI provider configured — /api/chat/stream will return 503');
} else {
    const summary = PROVIDERS.map((p) => `${p.name}=${p.model}`).join(' → ');
    logger.info(`[chat] 🤖 providers: ${summary}`);
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
    if (/تحليل|تفصيلي|قارن|مقارنة|استراتيجية|خطة كاملة/.test(normalized)) return 'detailed';
    if (/اشرح|شرح|خطوات|ازاي|كيف|ليه|لماذا/.test(normalized)) return 'medium';
    if (/ألم|إصابة|تعب|استشفاء|نظام غذائي|وجبة|تمرين|تدريب|نصائح/.test(normalized)) return 'medium';
    if (words <= 4 || /^(كم|مين|فين|متى|ايه|ما هو)[؟?\s]/.test(normalized)) return 'short';
    return 'medium';
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
function computeMaxTokens(mode: LengthMode, messageLength: number): number {
    const base: Record<LengthMode, number> = {
        short: 600,
        medium: 1200,
        detailed: 2400,
    };
    const bonus = Math.min(800, Math.floor(messageLength / 8)); // ~1 token per 4 chars ≈ ¼ of user's chars
    return base[mode] + bonus;
}

// ─── GET /chat/limit ─────────────────────────────────────────────────────────
router.get('/chat/limit', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const tz = getTimezone(req);
    try {
        const remaining = await getRemaining(userId, tz);
        res.json({
            remaining,
            used: DAILY_LIMIT - remaining,
            limit: DAILY_LIMIT,
            resetAt: getResetTime(tz),
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
    const userId = getUserId(req);
    const tz = getTimezone(req);

    const {
        message,
        history = [],
        conversationId,
        systemPromptSuffix,
        resumeFromToken,
    } = (req.body ?? {}) as {
        message?: string;
        history?: HistoryItem[];
        conversationId?: string;
        systemPromptSuffix?: string;
        resumeFromToken?: number;
    };

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
                resetAt: getResetTime(tz),
                ...(conversationTitle ? { conversationTitle } : {}),
            });
        };

        // ─── Fast-path short-circuits (skipped on resume) ────────────────────
        if (!isResume) {
            if (containsProfanity(trimmedMessage)) {
                await finishCannedReply(
                    'اعتذر، لا يمكنني متابعة المحادثة بهذه اللغة. ابدأ محادثة جديدة بصياغة محترمة.',
                );
                return;
            }

            if (isIdentityQuestion(trimmedMessage)) {
                const isEnglish =
                    /[a-zA-Z]{3,}/.test(trimmedMessage) &&
                    !/[\u0600-\u06FF]/.test(trimmedMessage);
                const identityText = isEnglish
                    ? "I'm 90Plus AI — your smart football & sports assistant, developed by mr.dev ai. I help with football info, training plans, sports nutrition, and recovery advice."
                    : 'أنا 90Plus AI ⚽ — مساعدك الرياضي الذكي، طوّرني mr.dev ai. أقدر أساعدك في كرة القدم، خطط التدريب، التغذية الرياضية، ونصائح الاستشفاء.';
                await finishCannedReply(identityText);
                return;
            }

            if (isGreeting(trimmedMessage)) {
                await finishCannedReply(
                    'أهلًا بك! جاهز أساعدك في كرة القدم، التمارين، الاستشفاء، والإعداد الغذائي.',
                );
                return;
            }

            if (isSportsNewsRequest(trimmedMessage)) {
                await finishCannedReply(
                    'الأخبار اللحظية مش في نطاقي، بس تقدر تتابعها على:\n\n' +
                    '• **BBC Sport Arabic** — bbc.com/arabic/sports\n' +
                    '• **Goal بالعربي** — goal.com/ar\n' +
                    '• **يلا كورة** — yallakora.com\n\n' +
                    'عندك أي سؤال تاني عن كرة القدم أو التمارين أو التغذية؟ 🎯',
                );
                return;
            }
        }

        // ─── Build prompt ────────────────────────────────────────────────────
        const category = detectCategory(trimmedMessage);
        const lengthMode = detectLengthMode(trimmedMessage);
        const baseSystemPrompt = buildSystemPrompt(category, lengthMode);

        const sanitizedSuffix =
            typeof systemPromptSuffix === 'string' && systemPromptSuffix.trim().length > 0
                ? systemPromptSuffix.trim().slice(0, 1500)
                : '';
        let systemPrompt = sanitizedSuffix
            ? `${baseSystemPrompt}\n\n${sanitizedSuffix}`
            : baseSystemPrompt;

        if (isResume && resumeFromToken) {
            systemPrompt += `\n\nملاحظة نظام: الرد السابق انقطع بعد ${resumeFromToken} حرف. أكمل من حيث توقفت بدون تكرار ما سبق.`;
        }

        const trimmedHistory = buildHistoryWindow(Array.isArray(history) ? history : []);

        const temperature = TEMPERATURES[category] ?? 0.45;
        const maxTokens = computeMaxTokens(lengthMode, trimmedMessage.length);

        // ─── Stream with automatic provider fallback ─────────────────────────
        if (PROVIDERS.length === 0) {
            logger.error('[chat] no AI provider configured — check AI_API_KEY / OPENROUTER_API_KEY');
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

        for (const provider of PROVIDERS) {
            if (firstTokenSent || clientClosed) break;

            try {
                const stream = await provider.client.chat.completions.create({
                    model: provider.model,
                    ...requestBody,
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

            sendDone({
                remaining: await getRemaining(userId, tz),
                limit: DAILY_LIMIT,
                resetAt: getResetTime(tz),
                usedModel: usedProvider.model,
                usedProvider: usedProvider.name,
                ...(conversationTitle ? { conversationTitle } : {}),
            });
        } catch (err: any) {
            logger.error('[chat] post-stream housekeeping failed:', err?.message ?? err);
            sendDone({
                remaining: await getRemaining(userId, tz).catch(() => 0),
                limit: DAILY_LIMIT,
                resetAt: getResetTime(tz),
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
