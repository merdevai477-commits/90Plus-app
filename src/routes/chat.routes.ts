/**
 * Chat Routes — 90Plus AI Chat API
 *
 * Self-contained AI chat endpoints merged from the old standalone
 * chat-backend into the main 90Plus backend. Storage is file-based
 * (chat-store.json) so no new DB tables are required.
 *
 * Endpoints:
 *   GET    /api/chat/limit                      → remaining daily messages
 *   POST   /api/chat/stream                     → SSE streaming reply
 *   GET    /api/conversations                   → list user conversations
 *   POST   /api/conversations                   → create new conversation
 *   GET    /api/conversations/:id/messages      → fetch messages
 *   PATCH  /api/conversations/:id               → rename / pin
 *   DELETE /api/conversations/:id               → remove
 *
 * Auth: uses the `x-user-id` header (frontend-generated UUID stored on device).
 * This mirrors the original chat-backend so the React Native hook works unchanged.
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const router = Router();

// ─── Config ──────────────────────────────────────────────────────────────────
const AI_API_KEY = process.env.AI_API_KEY ?? process.env.GOOGLE_AI_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
const AI_MODEL = process.env.AI_MODEL ?? 'gemini-2.5-flash';
const DAILY_LIMIT = Number(process.env.CHAT_DAILY_MESSAGE_LIMIT ?? 20);

const ai = new OpenAI({
    apiKey: AI_API_KEY,
    baseURL: AI_BASE_URL,
    defaultHeaders: {
        'HTTP-Referer': 'https://90plus.app',
        'X-Title': '90Plus AI Chat',
    },
});

// ─── Persistent store (JSON file) ────────────────────────────────────────────
type StoredRole = 'user' | 'ai';

interface StoredMessage {
    id: string;
    role: StoredRole;
    text: string;
    createdAt: string;
}

interface Conversation {
    id: string;
    userId: string;
    title: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    messages: StoredMessage[];
}

interface PersistedStore {
    conversations: Conversation[];
    limits: Record<string, { count: number; date: string }>;
}

const dataDir = path.join(process.cwd(), 'data', 'chat');
const storeFile = path.join(dataDir, 'chat-store.json');

function ensureStore(): PersistedStore {
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(storeFile)) {
            const initial: PersistedStore = { conversations: [], limits: {} };
            fs.writeFileSync(storeFile, JSON.stringify(initial, null, 2), 'utf-8');
            return initial;
        }
        const raw = fs.readFileSync(storeFile, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedStore;
        if (!Array.isArray(parsed.conversations)) parsed.conversations = [];
        if (!parsed.limits || typeof parsed.limits !== 'object') parsed.limits = {};
        return parsed;
    } catch (err) {
        logger.warn('[chat] store load failed, using empty store:', err);
        return { conversations: [], limits: {} };
    }
}

function saveStore(store: PersistedStore): void {
    try {
        fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
        logger.warn('[chat] store save failed:', err);
    }
}

// ─── Daily limits ────────────────────────────────────────────────────────────
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getResetTime(): Date {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t;
}

function getRemaining(userId: string): number {
    const store = ensureStore();
    const today = getToday();
    const userLimit = store.limits[userId];
    if (!userLimit || userLimit.date !== today) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - userLimit.count);
}

function incrementLimit(userId: string): void {
    const store = ensureStore();
    const today = getToday();
    if (!store.limits[userId] || store.limits[userId].date !== today) {
        store.limits[userId] = { count: 1, date: today };
    } else {
        store.limits[userId].count++;
    }
    saveStore(store);
}

function decrementLimit(userId: string): void {
    const store = ensureStore();
    const today = getToday();
    if (!store.limits[userId] || store.limits[userId].date !== today) return;
    store.limits[userId].count = Math.max(0, store.limits[userId].count - 1);
    saveStore(store);
}

// ─── Conversation helpers ────────────────────────────────────────────────────
function getUserConversations(userId: string): Conversation[] {
    const store = ensureStore();
    return store.conversations
        .filter((c) => c.userId === userId)
        .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
}

function createConversation(userId: string, title = 'محادثة جديدة'): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
        id: randomUUID(),
        userId,
        title,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        messages: [],
    };
    const store = ensureStore();
    store.conversations.push(conversation);
    saveStore(store);
    return conversation;
}

function findConversation(userId: string, conversationId: string): Conversation | null {
    const store = ensureStore();
    return store.conversations.find((c) => c.userId === userId && c.id === conversationId) ?? null;
}

function updateConversation(
    userId: string,
    conversationId: string,
    updates: Partial<Pick<Conversation, 'title' | 'isPinned'>>,
): Conversation | null {
    const store = ensureStore();
    const idx = store.conversations.findIndex((c) => c.userId === userId && c.id === conversationId);
    if (idx === -1) return null;
    const updated: Conversation = {
        ...store.conversations[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    store.conversations[idx] = updated;
    saveStore(store);
    return updated;
}

function removeConversation(userId: string, conversationId: string): boolean {
    const store = ensureStore();
    const before = store.conversations.length;
    store.conversations = store.conversations.filter(
        (c) => !(c.userId === userId && c.id === conversationId),
    );
    if (store.conversations.length === before) return false;
    saveStore(store);
    return true;
}

function appendMessage(
    userId: string,
    conversationId: string,
    role: StoredRole,
    text: string,
): StoredMessage | null {
    const store = ensureStore();
    const idx = store.conversations.findIndex(
        (c) => c.userId === userId && c.id === conversationId,
    );
    if (idx === -1) return null;

    const msg: StoredMessage = {
        id: randomUUID(),
        role,
        text,
        createdAt: new Date().toISOString(),
    };
    store.conversations[idx].messages.push(msg);
    store.conversations[idx].updatedAt = new Date().toISOString();
    saveStore(store);
    return msg;
}

// ─── Identity / domain / safety helpers (trimmed port of simple-server) ──────
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
        short: 'المستخدم سأل سؤالاً بسيطًا. رد في سطر إلى سطرين فقط.',
        medium: 'المستخدم يحتاج شرحًا متوسطًا. رد في 3-5 نقاط واضحة.',
        detailed: 'المستخدم يريد تحليلًا تفصيليًا. قدم إجابة مركزة ~150 كلمة.',
    };
    return [CORE_BEHAVIOR_PROMPT, categoryFocus[category], lengthGuide[mode]].join('\n\n');
}

// ─── Route: GET /limit ───────────────────────────────────────────────────────
router.get('/chat/limit', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const remaining = getRemaining(userId);
    res.json({
        remaining,
        used: DAILY_LIMIT - remaining,
        limit: DAILY_LIMIT,
        resetAt: getResetTime(),
    });
});

// ─── Route: POST /chat/stream (SSE) ──────────────────────────────────────────
router.post('/chat/stream', async (req: Request, res: Response): Promise<void> => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const {
        message,
        history = [],
        conversationId,
    } = (req.body ?? {}) as {
        message?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        conversationId?: string;
    };

    if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
    }

    const trimmedMessage = message.trim();

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

    // ─── Limit check ─────────────────────────────────────────────────────────
    if (getRemaining(userId) <= 0) {
        res.write(
            `data: ${JSON.stringify({
                error: 'انتهت رسائلك اليومية',
                resetAt: getResetTime(),
                done: true,
            })}\n\n`,
        );
        res.end();
        return;
    }

    // ─── Fast-path short-circuits ────────────────────────────────────────────
    if (containsProfanity(trimmedMessage)) {
        sendToken('اعتذر، لا يمكنني متابعة المحادثة بهذه اللغة. ابدأ محادثة جديدة بصياغة محترمة.');
        sendDone({ remaining: getRemaining(userId), resetAt: getResetTime() });
        return;
    }

    if (isIdentityQuestion(trimmedMessage)) {
        const isEnglish =
            /[a-zA-Z]{3,}/.test(trimmedMessage) && !/[\u0600-\u06FF]/.test(trimmedMessage);
        const identityText = isEnglish
            ? "I'm 90Plus AI — your smart football & sports assistant, developed by mr.dev ai. I help with football info, training plans, sports nutrition, and recovery advice."
            : 'أنا 90Plus AI ⚽ — مساعدك الرياضي الذكي، طوّرني mr.dev ai. أقدر أساعدك في كرة القدم، خطط التدريب، التغذية الرياضية، ونصائح الاستشفاء.';
        sendToken(identityText);
        sendDone({ remaining: getRemaining(userId), resetAt: getResetTime() });
        return;
    }

    if (isGreeting(trimmedMessage)) {
        sendToken('أهلًا بك! جاهز أساعدك في كرة القدم، التمارين، الاستشفاء، والإعداد الغذائي.');
        sendDone({ remaining: getRemaining(userId), resetAt: getResetTime() });
        return;
    }

    if (isSportsNewsRequest(trimmedMessage)) {
        sendToken(
            'اعتذر، أنا لا أقدم أخبارًا أو انتقالات مباشرة. للمتابعة يمكنك الاعتماد على: FIFA, ESPN, Sky Sports, Fabrizio Romano.',
        );
        sendDone({ remaining: getRemaining(userId), resetAt: getResetTime() });
        return;
    }

    // ─── Ensure conversation exists ──────────────────────────────────────────
    let targetConversation = conversationId ? findConversation(userId, conversationId) : null;
    if (!targetConversation) {
        targetConversation = createConversation(userId, 'محادثة جديدة');
    }

    // ─── Save user message + consume one daily credit ────────────────────────
    const userMessage = appendMessage(userId, targetConversation.id, 'user', trimmedMessage);
    if (!userMessage) {
        sendError('Failed to save user message');
        return;
    }
    incrementLimit(userId);

    // ─── Build prompt ────────────────────────────────────────────────────────
    const category = detectCategory(trimmedMessage);
    const lengthMode = detectLengthMode(trimmedMessage);
    const systemPrompt = buildSystemPrompt(category, lengthMode);

    const trimmedHistory = (Array.isArray(history) ? history : [])
        .filter(
            (m): m is { role: 'user' | 'assistant'; content: string } =>
                !!m &&
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string',
        )
        .slice(-10);

    const maxTokensByMode: Record<LengthMode, number> = {
        short: 450,
        medium: 700,
        detailed: 1200,
    };

    // ─── Stream from AI provider ─────────────────────────────────────────────
    try {
        const stream = await ai.chat.completions.create({
            model: AI_MODEL,
            max_tokens: maxTokensByMode[lengthMode],
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                ...trimmedHistory,
                { role: 'user', content: trimmedMessage },
            ],
            temperature: 0.45,
        });

        let fullText = '';
        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content ?? '';
            if (token) {
                fullText += token;
                sendToken(token);
            }
        }

        // ─── Save AI reply ───────────────────────────────────────────────────
        appendMessage(userId, targetConversation.id, 'ai', fullText);

        // ─── Auto-title on first exchange ────────────────────────────────────
        if (
            targetConversation.title === 'محادثة جديدة' &&
            targetConversation.messages.length <= 2
        ) {
            const titleCandidate = trimmedMessage.split(/\s+/).slice(0, 4).join(' ');
            updateConversation(userId, targetConversation.id, {
                title: titleCandidate || 'محادثة جديدة',
            });
        }

        sendDone({
            remaining: getRemaining(userId),
            resetAt: getResetTime(),
            usedModel: AI_MODEL,
        });
    } catch (err: any) {
        logger.error('[chat] stream error:', err?.message ?? err);
        decrementLimit(userId);
        sendError('AI service error. Please try again.');
    }
});

// ─── Conversation CRUD ───────────────────────────────────────────────────────
router.get('/conversations', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const conversations = getUserConversations(userId).map((c) => ({
        id: c.id,
        title: c.title,
        isPinned: c.isPinned,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessage:
            c.messages.length > 0 ? c.messages[c.messages.length - 1].text.slice(0, 80) : null,
    }));
    res.json({ conversations });
});

router.post('/conversations', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const { title } = (req.body ?? {}) as { title?: string };
    const conversation = createConversation(userId, title?.trim() || 'محادثة جديدة');
    res.status(201).json({
        conversation: {
            id: conversation.id,
            title: conversation.title,
            isPinned: conversation.isPinned,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            lastMessage: null,
        },
    });
});

router.get('/conversations/:id/messages', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversation = findConversation(userId, conversationId);
    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    res.json({
        messages: conversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
        })),
    });
});

router.patch('/conversations/:id', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, isPinned } = (req.body ?? {}) as { title?: string; isPinned?: boolean };

    const updates: Partial<Pick<Conversation, 'title' | 'isPinned'>> = {};
    if (typeof title === 'string' && title.trim().length > 0) updates.title = title.trim().slice(0, 100);
    if (typeof isPinned === 'boolean') updates.isPinned = isPinned;

    const updated = updateConversation(userId, conversationId, updates);
    if (!updated) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    res.json({
        conversation: {
            id: updated.id,
            title: updated.title,
            isPinned: updated.isPinned,
            updatedAt: updated.updatedAt,
        },
    });
});

router.delete('/conversations/:id', (req: Request, res: Response): void => {
    const userId = (req.headers['x-user-id'] as string) ?? 'guest';
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = removeConversation(userId, conversationId);
    if (!ok) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    res.json({ message: 'Deleted successfully' });
});

export default router;
