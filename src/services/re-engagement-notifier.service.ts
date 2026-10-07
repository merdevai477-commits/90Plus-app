/**
 * Re-engagement ("we miss you") push notifier.
 *
 *  - Runs hourly; a user is only messaged when their local time is one of
 *    RE_ENGAGEMENT_LOCAL_HOURS (default 13:00 and 20:00). Local time comes from
 *    `User.settings.timezone`, falling back to Africa/Cairo.
 *  - Copy follows `User.settings.language` (ar / en) and addresses the user by
 *    first name, with a generic vocative when no real name is known.
 *  - Frequency backs off with absence: daily for 12h–3d, every 3 days up to
 *    14d, weekly up to 90d, then stops (dormant tokens only drive uninstalls).
 *  - Variants rotate per user per day, so consecutive pushes never repeat and
 *    users in the same batch get different messages.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { sanitizeTimezone } from '../utils/chat-timezone';
import { bidiSafeName, resolvePushFirstName } from '../utils/push-display-name';
import { notifyUsers, type NotifyUserParams } from './notify.service';
import { NotificationType } from './notification.service';
import { readLanguageFromSettings, type SupportedLanguage } from './push-templates.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const MIN_INACTIVE_MS = 12 * HOUR_MS;
const MAX_INACTIVE_MS = 90 * DAY_MS;
const DEFAULT_TIMEZONE = 'Africa/Cairo';
const PAGE_SIZE = 1000;
const MAX_USERS_PER_RUN = 20_000;

export type ReEngagementTier = 'short' | 'miss' | 'comeback';

const TIER_MIN_GAP_MS: Record<ReEngagementTier, number> = {
    short: 20 * HOUR_MS,
    miss: 68 * HOUR_MS,
    comeback: 164 * HOUR_MS,
};

type Screen =
    | '/(tabs)/matches'
    | '/(tabs)/predict-and-win'
    | '/(tabs)/quiz'
    | '/(tabs)/rank'
    | '/(tabs)/reels';

interface Variant {
    id: string;
    screen: Screen;
    ar: { title: string; body: string };
    en: { title: string; body: string };
}

/** Every title carries `{name}` so the push always feels personal. */
const VARIANTS: Record<ReEngagementTier, Variant[]> = {
    short: [
        {
            id: 'where-are-you',
            screen: '/(tabs)/matches',
            ar: { title: '⚽ فينك يا {name}؟', body: 'أهم مباريات النهارده شغالة — ادخل تابع النتايج لحظة بلحظة.' },
            en: { title: '⚽ Where are you, {name}?', body: "Today's big matches are on — follow every score live." },
        },
        {
            id: 'prediction',
            screen: '/(tabs)/predict-and-win',
            ar: { title: '🎯 توقعك فين يا {name}؟', body: 'في مباريات قربت تبدأ — حط توقعك قبل صافرة البداية واكسب نقط.' },
            en: { title: '🎯 Got a prediction, {name}?', body: 'Matches kick off soon — lock in your call before the whistle and earn points.' },
        },
        {
            id: 'quiz',
            screen: '/(tabs)/quiz',
            ar: { title: '🧠 كويز النهارده مستنيك يا {name}', body: 'أسئلة جديدة نزلت — جاوب صح واكسب عملات وXP.' },
            en: { title: "🧠 Today's quiz is waiting, {name}", body: 'Fresh questions just dropped — answer right and earn coins and XP.' },
        },
        {
            id: 'leaderboard',
            screen: '/(tabs)/rank',
            ar: { title: '🏆 الترتيب بيتغير يا {name}', body: 'ادخل شوف مركزك في لوحة الصدارة واتنافس على القمة.' },
            en: { title: '🏆 The leaderboard is moving, {name}', body: 'Check your rank and push for the top spot.' },
        },
        {
            id: 'reels',
            screen: '/(tabs)/reels',
            ar: { title: '🎬 فاتك جديد الريلز يا {name}', body: 'مهارات وأهداف جديدة من المجتمع — شوفها دلوقتي.' },
            en: { title: '🎬 New reels for you, {name}', body: 'Fresh skills and goals from the community — watch now.' },
        },
    ],
    miss: [
        {
            id: 'miss-you',
            screen: '/(tabs)/matches',
            ar: { title: '💙 وحشتنا يا {name}!', body: 'بقالك كام يوم مش موجود — المباريات والتحديات مستنياك.' },
            en: { title: '💙 We miss you, {name}!', body: "It's been a few days — matches and challenges are waiting for you." },
        },
        {
            id: 'football-waits-for-no-one',
            screen: '/(tabs)/matches',
            ar: { title: '⚽ الكورة مبتستناش حد يا {name}', body: 'فاتك أهداف ونتايج كتير — ارجع تابع كل جديد في ثواني.' },
            en: { title: "⚽ Football doesn't wait, {name}", body: "You've missed goals and results — catch up in seconds." },
        },
        {
            id: 'prediction-comeback',
            screen: '/(tabs)/predict-and-win',
            ar: { title: '🎯 رجّع مستواك في التوقعات يا {name}', body: 'كل توقع صح بيكسبك نقط وعملات — مباريات جديدة مستنية توقعك.' },
            en: { title: '🎯 Back to predicting, {name}?', body: 'Every correct call earns points and coins — new matches need your pick.' },
        },
        {
            id: 'challenge',
            screen: '/(tabs)/quiz',
            ar: { title: '🔥 جاهز للتحدي يا {name}؟', body: 'كويزات جديدة كل يوم — وريهم إنك أكتر واحد فاهم كورة.' },
            en: { title: '🔥 Ready for a challenge, {name}?', body: 'New quizzes every day — prove you know football best.' },
        },
    ],
    comeback: [
        {
            id: 'been-a-while',
            screen: '/(tabs)/matches',
            ar: { title: '👋 مستنيين رجوعك يا {name}', body: 'حاجات كتير جديدة في 90Plus — ادخل اكتشفها.' },
            en: { title: "👋 It's been a while, {name}", body: "There's a lot new in 90Plus — come take a look." },
        },
        {
            id: 'spot-saved',
            screen: '/(tabs)/predict-and-win',
            ar: { title: '🏟️ مكانك لسه محفوظ يا {name}', body: 'مباريات وتوقعات وتحديات أسبوعية — كل ده مستنيك.' },
            en: { title: '🏟️ Your spot is still here, {name}', body: 'Matches, predictions and weekly challenges — all waiting for you.' },
        },
        {
            id: 'season-on',
            screen: '/(tabs)/matches',
            ar: { title: '⚽ الموسم شغال يا {name}', body: 'متفوتش الإثارة — تابع فريقك وكل النتايج لحظة بلحظة.' },
            en: { title: '⚽ The season is on, {name}', body: "Don't miss the action — follow your team and every score live." },
        },
    ],
};

const FALLBACK_NAME: Record<SupportedLanguage, string> = { ar: 'بطل', en: 'champ' };

function hashString(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
        h = (h * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

export function tierForInactivity(inactiveMs: number): ReEngagementTier | null {
    if (inactiveMs < MIN_INACTIVE_MS || inactiveMs > MAX_INACTIVE_MS) return null;
    if (inactiveMs < 3 * DAY_MS) return 'short';
    if (inactiveMs < 14 * DAY_MS) return 'miss';
    return 'comeback';
}

export interface ReEngagementMessage {
    variantId: string;
    title: string;
    body: string;
    screen: Screen;
}

export function buildReEngagementMessage(params: {
    userId: string;
    tier: ReEngagementTier;
    language: SupportedLanguage;
    firstName: string | null;
    now?: Date;
}): ReEngagementMessage {
    const { userId, tier, language, firstName } = params;
    const now = params.now ?? new Date();
    const variants = VARIANTS[tier];
    const dayIndex = Math.floor(now.getTime() / DAY_MS);
    const variant = variants[(hashString(userId) + dayIndex) % variants.length];
    const copy = variant[language];
    const name = firstName ? bidiSafeName(firstName, language) : FALLBACK_NAME[language];
    return {
        variantId: variant.id,
        title: copy.title.replace(/\{name\}/g, name),
        body: copy.body.replace(/\{name\}/g, name),
        screen: variant.screen,
    };
}

function readTimezone(settings: unknown): string {
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
        const tz = (settings as Record<string, unknown>).timezone;
        if (typeof tz === 'string' && tz.trim()) {
            const safe = sanitizeTimezone(tz);
            if (safe !== 'UTC' || tz.trim().toUpperCase() === 'UTC') return safe;
        }
    }
    return DEFAULT_TIMEZONE;
}

const hourFormatters = new Map<string, Intl.DateTimeFormat>();

function localHour(timezone: string, now: Date): number {
    let fmt = hourFormatters.get(timezone);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' });
        hourFormatters.set(timezone, fmt);
    }
    return Number(fmt.format(now)) % 24;
}

function parseLocalHours(raw: string | undefined): Set<number> {
    const hours = (raw ?? '13,20')
        .split(',')
        .map((h) => parseInt(h.trim(), 10))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
    return new Set(hours.length ? hours : [13, 20]);
}

const LOCAL_SEND_HOURS = parseLocalHours(process.env.RE_ENGAGEMENT_LOCAL_HOURS);

interface Candidate {
    id: string;
    username: string;
    displayName: string | null;
    clerkUserId: string | null;
    settings: unknown;
    lastLoginDate: Date | null;
    lastActiveAt: Date | null;
    createdAt: Date;
}

async function loadInactiveCandidates(now: Date): Promise<Candidate[]> {
    const cutoff = new Date(now.getTime() - MIN_INACTIVE_MS);
    const out: Candidate[] = [];
    let cursor: string | undefined;

    while (out.length < MAX_USERS_PER_RUN) {
        const page = await prisma.user.findMany({
            where: {
                pushNotificationsConsent: true,
                isDeleted: false,
                isBanned: false,
                isSuspended: false,
                createdAt: { lt: cutoff },
                OR: [{ expoPushToken: { not: null } }, { pushDevices: { some: {} } }],
                AND: [
                    { OR: [{ lastLoginDate: null }, { lastLoginDate: { lt: cutoff } }] },
                    { OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] },
                ],
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                clerkUserId: true,
                settings: true,
                lastLoginDate: true,
                lastActiveAt: true,
                createdAt: true,
            },
            orderBy: { id: 'asc' },
            take: PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        out.push(...page);
        if (page.length < PAGE_SIZE) break;
        cursor = page[page.length - 1].id;
    }

    return out;
}

function lastSeenAt(u: Candidate): number {
    return Math.max(
        u.lastLoginDate?.getTime() ?? 0,
        u.lastActiveAt?.getTime() ?? 0,
        u.createdAt.getTime(),
    );
}

async function lastReEngagementByUser(userIds: string[], now: Date): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const since = new Date(now.getTime() - TIER_MIN_GAP_MS.comeback);
    for (let i = 0; i < userIds.length; i += PAGE_SIZE) {
        const chunk = userIds.slice(i, i + PAGE_SIZE);
        const rows = await prisma.notification.groupBy({
            by: ['userId'],
            where: { userId: { in: chunk }, type: 'RE_ENGAGEMENT', createdAt: { gte: since } },
            _max: { createdAt: true },
        });
        for (const row of rows) {
            if (row._max.createdAt) result.set(row.userId, row._max.createdAt.getTime());
        }
    }
    return result;
}

let running = false;

export async function runReEngagement(options: { now?: Date; ignoreLocalHour?: boolean } = {}): Promise<{
    candidates: number;
    eligible: number;
    delivered: number;
    suppressed: number;
    failed: number;
}> {
    const empty = { candidates: 0, eligible: 0, delivered: 0, suppressed: 0, failed: 0 };
    if (running) {
        logger.warn('[ReEngagement] previous run still in progress — skipping tick');
        return empty;
    }
    running = true;
    const now = options.now ?? new Date();

    try {
        const candidates = await loadInactiveCandidates(now);
        if (candidates.length === 0) {
            logger.info('[ReEngagement] No inactive users this tick');
            return empty;
        }

        const inWindow = options.ignoreLocalHour
            ? candidates
            : candidates.filter((u) => LOCAL_SEND_HOURS.has(localHour(readTimezone(u.settings), now)));
        if (inWindow.length === 0) {
            return { ...empty, candidates: candidates.length };
        }

        const lastSent = await lastReEngagementByUser(inWindow.map((u) => u.id), now);
        const dayKey = now.toISOString().slice(0, 10);
        const tierCounts: Record<ReEngagementTier, number> = { short: 0, miss: 0, comeback: 0 };

        const dispatches: NotifyUserParams[] = [];
        for (const u of inWindow) {
            const tier = tierForInactivity(now.getTime() - lastSeenAt(u));
            if (!tier) continue;
            const previous = lastSent.get(u.id);
            if (previous && now.getTime() - previous < TIER_MIN_GAP_MS[tier]) continue;

            const language = readLanguageFromSettings(u.settings);
            const msg = buildReEngagementMessage({
                userId: u.id,
                tier,
                language,
                firstName: resolvePushFirstName(u),
                now,
            });
            tierCounts[tier]++;
            dispatches.push({
                userId: u.id,
                type: NotificationType.RE_ENGAGEMENT,
                title: msg.title,
                message: msg.body,
                language,
                data: { screen: msg.screen, source: 're-engagement', tier, variant: msg.variantId },
                idempotencyKey: `re-engagement:${u.id}:${dayKey}`,
            });
        }

        if (dispatches.length === 0) {
            return { ...empty, candidates: candidates.length };
        }

        const result = await notifyUsers(dispatches, { concurrency: 20 });
        logger.info(
            `[ReEngagement] ✅ candidates=${candidates.length} eligible=${dispatches.length} ` +
            `delivered=${result.delivered} suppressed=${result.suppressed} failed=${result.failed} ` +
            `tiers=${JSON.stringify(tierCounts)}`,
        );
        return { candidates: candidates.length, eligible: dispatches.length, ...result };
    } catch (err: any) {
        logger.error('[ReEngagement] ❌ Run failed:', err?.message);
        return empty;
    } finally {
        running = false;
    }
}

export function startReEngagementNotifier(): void {
    if (process.env.RE_ENGAGEMENT_ENABLED === 'false') {
        logger.info('📣 Re-engagement notifier disabled (RE_ENGAGEMENT_ENABLED=false)');
        return;
    }
    cron.schedule('2 * * * *', () => {
        runReEngagement().catch((err) =>
            logger.error('[ReEngagement] Cron tick failed:', err?.message),
        );
    });
    logger.info(
        `✅ Re-engagement notifier scheduled (hourly, local hours ${[...LOCAL_SEND_HOURS].join(',')}, default tz ${DEFAULT_TIMEZONE})`,
    );
}
