/**
 * AI Check-in Notifier
 *
 * Twice-daily personalised motivational push from the AI coach.
 *
 *  - Cron: 0 9,21 * * *  (UTC by default; tune via AI_CHECKIN_HOURS env)
 *  - Audience: users with NotificationPreferences.aiCoach = true AND a push
 *    token, who have NOT received an AI_CHECKIN in the last 11h.
 *  - Personalisation: OpenRouter chat completion seeded with the user's
 *    `displayName` and language. Output is plain text, capped at ~120 chars.
 *  - Fallback: when the AI provider fails (timeout / quota / no key) we fall
 *    back to a static localized template so the user still gets a push.
 *  - Rate budget: at most AI_CHECKIN_MAX_PER_RUN OpenRouter calls per cron
 *    tick to control spend; the rest of the users get the static template.
 *
 * Wired in src/main.ts startup.
 */

import cron from 'node-cron';
import OpenAI from 'openai';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';
import {
    readLanguageFromSettings,
    renderPushTemplate,
    type SupportedLanguage,
} from './push-templates.service';

const BATCH_SIZE = 20;
const MIN_HOURS_BETWEEN_CHECKINS = 11; // dedup across cron drift / restarts
const RUN_BUDGET = parseInt(process.env.AI_CHECKIN_MAX_PER_RUN ?? '500', 10);
const MAX_BODY_LEN = 140; // hard cap so push payload stays under iOS/Android limits

// ─── AI provider ────────────────────────────────────────────────────────────

interface AICheckinClient {
    client: OpenAI;
    model: string;
}

function buildAIClient(): AICheckinClient | null {
    const apiKey = process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '';
    if (!apiKey) return null;
    const baseURL =
        process.env.AI_BASE_URL ?? process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    const model = process.env.AI_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? 'qwen/qwen3.5-flash-02-23';
    const client = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: {
            'HTTP-Referer': 'https://90plus.pro',
            'X-Title': '90Plus AI Coach',
        },
    });
    return { client, model };
}

const AI = buildAIClient();

// ─── Prompt builders ────────────────────────────────────────────────────────

/**
 * Build the system + user prompt for one user. The instructions are strict
 * about length and language so the model returns push-ready text.
 */
function buildPrompt(displayName: string, language: SupportedLanguage): {
    system: string;
    user: string;
} {
    if (language === 'ar') {
        return {
            system:
                'أنت مدرب كرة قدم ودود، تتكلم باللغة العربية الفصحى البسيطة أو العامية المصرية. ' +
                'مهمتك إرسال تذكير تحفيزي قصير جدًا (أقل من 120 حرفًا) عن التدريب أو متابعة المباريات أو ' +
                'التطور. لا تستعمل إيموجي كثير ولا قوائم. ابدأ بمناداة المستخدم باسمه.',
            user: `اسم المستخدم: ${displayName}. اكتب رسالة تحفيزية قصيرة جدًا.`,
        };
    }
    return {
        system:
            'You are a friendly football coach. Send a very short (under 120 chars) motivational ' +
            'check-in about training, watching matches, or improving skills. ' +
            'Start by addressing the user by name. No bullet points, max one emoji.',
        user: `User name: ${displayName}. Write a short motivational nudge.`,
    };
}

function clampBody(text: string): string {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= MAX_BODY_LEN) return trimmed;
    return trimmed.slice(0, MAX_BODY_LEN - 1).trimEnd() + '…';
}

/**
 * Call the AI provider for one user, returning the generated body or null on
 * failure. The caller falls back to a static template when null is returned.
 */
async function generateAIBody(
    displayName: string,
    language: SupportedLanguage,
): Promise<string | null> {
    if (!AI) return null;
    try {
        const { system, user } = buildPrompt(displayName, language);
        const completion = await AI.client.chat.completions.create({
            model: AI.model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: 0.8,
            max_tokens: 80,
        });
        const raw = completion.choices?.[0]?.message?.content ?? '';
        const cleaned = clampBody(raw);
        return cleaned.length > 8 ? cleaned : null; // discard suspiciously short outputs
    } catch (err: any) {
        logger.warn('[AI-Checkin] generation failed (falling back):', err?.message);
        return null;
    }
}

// ─── User selection ─────────────────────────────────────────────────────────

interface CheckinCandidate {
    id: string;
    displayName: string;
    settings: unknown;
}

/**
 * Find users eligible for a check-in this cron tick.
 *
 *  - aiCoach preference = true (opt-in)
 *  - push consent + token present
 *  - not banned / deleted / suspended
 *  - no AI_CHECKIN notification in the last 11 hours (dedupe)
 *
 * We cap the returned set at `RUN_BUDGET * 3` so we still have a pool when
 * many AI calls fail and we want to fall back gracefully.
 */
async function selectCandidates(): Promise<CheckinCandidate[]> {
    const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_CHECKINS * 60 * 60 * 1000);

    // First narrow by preference + push consent. This is cheap.
    const prefs = await (prisma as any).notificationPreferences.findMany({
        where: { aiCoach: true },
        select: { userId: true },
    });
    const optedInIds: string[] = prefs.map((p: { userId: string }) => p.userId);
    if (optedInIds.length === 0) return [];

    const candidates = await prisma.user.findMany({
        where: {
            id: { in: optedInIds },
            expoPushToken: { not: null },
            pushNotificationsConsent: true,
            isDeleted: false,
            isBanned: false,
            isSuspended: false,
        },
        select: { id: true, displayName: true, username: true, settings: true },
        take: RUN_BUDGET * 3,
    });

    if (candidates.length === 0) return [];

    // Exclude users with a recent AI_CHECKIN.
    const recent = await prisma.notification.findMany({
        where: {
            userId: { in: candidates.map((u) => u.id) },
            type: 'AI_CHECKIN',
            createdAt: { gte: cutoff },
        },
        select: { userId: true },
    });
    const recentSet = new Set(recent.map((r: { userId: string }) => r.userId));

    return candidates
        .filter((u) => !recentSet.has(u.id))
        .map((u) => ({
            id: u.id,
            displayName: u.displayName || u.username || 'champ',
            settings: u.settings,
        }));
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function runAICheckin(): Promise<void> {
    const startedAt = Date.now();
    let aiUsed = 0;
    let fallbacks = 0;
    let delivered = 0;
    let suppressed = 0;

    try {
        const users = await selectCandidates();
        if (users.length === 0) {
            logger.debug('[AI-Checkin] No eligible users this tick');
            return;
        }

        logger.info(`[AI-Checkin] Dispatching to ${users.length} users (budget=${RUN_BUDGET})`);

        // Half-day bucket so a restart inside the same window still dedups.
        const now = new Date();
        const halfDayBucket = `${now.toISOString().slice(0, 10)}:${now.getUTCHours() < 12 ? 'am' : 'pm'}`;

        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);

            // For each user: generate AI body (if under budget) or fall back.
            const dispatches = await Promise.all(
                batch.map(async (u) => {
                    const language = readLanguageFromSettings(u.settings);
                    let body: string | null = null;
                    if (aiUsed < RUN_BUDGET) {
                        body = await generateAIBody(u.displayName, language);
                        if (body) aiUsed++;
                    }
                    if (!body) {
                        body = renderPushTemplate('aiCheckinFallbackBody', language, {
                            name: u.displayName,
                        });
                        fallbacks++;
                    }

                    const result = await notifyUser({
                        userId: u.id,
                        type: NotificationType.AI_CHECKIN,
                        titleKey: 'aiCheckinTitle',
                        message: body, // body is pre-rendered (AI or fallback)
                        vars: { name: u.displayName },
                        data: { screen: '/(tabs)/chat', source: 'ai-checkin' },
                        idempotencyKey: `ai-checkin:${u.id}:${halfDayBucket}`,
                    });
                    if (result.delivered) delivered++; else suppressed++;
                }),
            );
            void dispatches; // unused — kept for future telemetry
        }

        logger.info(
            `[AI-Checkin] ✅ delivered=${delivered} suppressed=${suppressed} ` +
            `aiUsed=${aiUsed} fallbacks=${fallbacks} ` +
            `tookMs=${Date.now() - startedAt}`,
        );
    } catch (err: any) {
        logger.error('[AI-Checkin] ❌ Run failed:', err?.message);
    }
}

/**
 * Register the AI check-in cron. The schedule defaults to 09:00 and 21:00 UTC
 * twice a day; override with the env `AI_CHECKIN_CRON` (a valid cron string).
 */
export function startAICheckinNotifier(): void {
    const schedule = process.env.AI_CHECKIN_CRON ?? '0 9,21 * * *';
    if (!cron.validate(schedule)) {
        logger.warn(`[AI-Checkin] Invalid AI_CHECKIN_CRON "${schedule}", refusing to start`);
        return;
    }
    cron.schedule(schedule, () => {
        logger.info('⏰ Cron: AI coach check-in...');
        runAICheckin().catch((err) =>
            logger.error('[AI-Checkin] Cron tick failed:', err?.message),
        );
    });
    const aiStatus = AI ? `model=${AI.model}` : 'NO AI provider (will fall back to template)';
    logger.info(`✅ AI check-in notifier scheduled (${schedule}, ${aiStatus})`);
}
