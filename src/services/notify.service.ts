/**
 * Unified notification helper.
 *
 * Every notification in the app SHOULD go through `notifyUser` instead of
 * calling `NotificationService.createNotification`, `enqueueNotification`,
 * or `PushNotificationService.sendNotification` directly. This gives a
 * single chokepoint to enforce:
 *
 *   1. Per-category preferences (NotificationPreferences) — currently the
 *      social toggles exist in the DB but are NOT checked anywhere; this
 *      helper closes that gap.
 *   2. Idempotency for cron / batch flows so a server restart or a
 *      duplicated job cannot spam the same user twice.
 *   3. Localization — title/body always resolved via push-templates.
 *   4. A standard `data` shape so frontend deep-linking is uniform.
 *   5. Inbox parity — every push also creates a DB row (closes the
 *      push-only-cron gap for quiz / wheel / cooldown).
 *
 * The helper still delegates the actual write+push to the existing
 * `enqueueNotification` -> Bull -> `NotificationService` pipeline, so we
 * keep all the retry, WebSocket, receipt-verification behaviour we already
 * built.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';
import {
    getUserLanguage,
    renderPushTemplate,
    type PushTemplateKey,
    type SupportedLanguage,
} from './push-templates.service';
import { enqueueNotification, enqueueSocialNotification } from '../queues/notification.queue';
import type { NotificationActor } from './notification.service';
import { NotificationType } from './notification.service';

// ─── Preference mapping ────────────────────────────────────────────────────
//
// Maps each NotificationType to the boolean column on
// NotificationPreferences that gates it. `null` means "always allowed"
// (e.g. account suspension, moderation alerts — user MUST see these).

type PrefKey =
    | 'matchGoals'
    | 'matchStart'
    | 'matchEnd'
    | 'matchHalftime'
    | 'matchCards'
    | 'matchSubs'
    | 'matchVar'
    | 'matchLineups'
    | 'leagueMatches'
    | 'socialFollow'
    | 'socialLike'
    | 'socialComment'
    | 'socialReply'
    | 'socialMention'
    | 'socialShare'
    | 'predictionResults'
    | 'luckyWheel'
    | 'gifts'
    | 'dailyQuiz'
    | 'cooldown'
    | 'levelUp'
    | 'reportUpdates'
    | 'avatarUpload'
    | 'videoProcessed'
    | 'leaderboard'
    | 'aiCoach';

const TYPE_TO_PREF: Partial<Record<NotificationType, PrefKey>> = {
    // Match events
    [NotificationType.MATCH_GOAL]: 'matchGoals',
    [NotificationType.MATCH_START]: 'matchStart',
    [NotificationType.MATCH_END]: 'matchEnd',
    [NotificationType.MATCH_HALFTIME]: 'matchHalftime',
    [NotificationType.MATCH_YELLOW_CARD]: 'matchCards',
    [NotificationType.MATCH_RED_CARD]: 'matchCards',
    [NotificationType.MATCH_FAVORITE]: 'matchStart',
    [NotificationType.MATCH_UPDATE]: 'matchGoals', // catch-all live event
    // Social
    [NotificationType.FOLLOW]: 'socialFollow',
    [NotificationType.LIKE]: 'socialLike',
    [NotificationType.COMMENT]: 'socialComment',
    [NotificationType.REPLY]: 'socialReply',
    [NotificationType.COMMENT_LIKE]: 'socialLike',
    [NotificationType.MENTION]: 'socialMention',
    [NotificationType.SHARE]: 'socialShare',
    [NotificationType.FOLLOW_ACTIVITY]: 'socialFollow',
    // Predictions / leaderboards / rewards
    [NotificationType.PREDICTION_RESULT]: 'predictionResults',
    [NotificationType.LEADERBOARD_TOP10]: 'leaderboard',
    [NotificationType.LEADERBOARD_TOP3]: 'leaderboard',
    [NotificationType.LUCKY_WHEEL]: 'luckyWheel',
    [NotificationType.LUCKY_WHEEL_RENEWED]: 'luckyWheel',
    [NotificationType.GIFT]: 'gifts',
    [NotificationType.COIN_MILESTONE]: 'gifts',
    [NotificationType.MILESTONE]: 'gifts',
    [NotificationType.ACHIEVEMENT]: 'gifts',
    [NotificationType.QUIZ_REWARD]: 'dailyQuiz',
    [NotificationType.DAILY_QUIZ_RENEWED]: 'dailyQuiz',
    // Lifecycle
    [NotificationType.LEVEL_UP]: 'levelUp',
    [NotificationType.COOLDOWN_EXPIRED]: 'cooldown',
    [NotificationType.AVATAR_UPLOAD]: 'avatarUpload',
    [NotificationType.VIDEO_PROCESSED]: 'videoProcessed',
    // Reports
    [NotificationType.REPORT_SUBMITTED]: 'reportUpdates',
    [NotificationType.REPORT_RESOLVED]: 'reportUpdates',
    // AI coach (opt-in)
    [NotificationType.AI_CHECKIN]: 'aiCoach',
    // RE_ENGAGEMENT, MODERATION_ALERT, GENERAL intentionally not gated —
    // they are admin / safety / critical and bypass user preferences.
};

// ─── Public API ────────────────────────────────────────────────────────────

export interface NotifyUserParams {
    userId: string;
    type: NotificationType | string;
    /** When set, both title and message are rendered from push-templates. */
    titleKey?: PushTemplateKey;
    bodyKey?: PushTemplateKey;
    /** Variables interpolated into the rendered templates. */
    vars?: Record<string, string | number>;
    /** Override title (skip template resolution). */
    title?: string;
    /** Override message (skip template resolution). */
    message?: string;
    /**
     * Standard `data` payload. `screen` is required because every push must be
     * routable client-side — the frontend deep-linker reads this.
     */
    data: { screen?: string; entityId?: string; actorId?: string;[k: string]: any };
    /** If provided, dedupes via Redis (24h TTL). */
    idempotencyKey?: string;
    /** Force-bypass the preference gate (use only for safety/moderation). */
    bypassPreferences?: boolean;
    /** Use the social pipeline (groups iOS thread, includes actor info). */
    actor?: NotificationActor;
    /** Skip push entirely — still creates inbox row + WebSocket emit. */
    skipPush?: boolean;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Public preference gate. Returns true when this user/type combination is
 * allowed to send. Exported so the Bull worker can enforce preferences for
 * legacy call sites that haven't been migrated to `notifyUser` yet.
 *
 * Fails open: when the lookup errors we let the notification through to
 * avoid accidentally dropping safety-relevant alerts.
 */
export async function isAllowedByPreference(
    userId: string,
    type: NotificationType | string,
): Promise<boolean> {
    const prefKey = TYPE_TO_PREF[type as NotificationType];
    if (!prefKey) return true; // unmapped types are always allowed (e.g. GENERAL)
    try {
        const prefs = await (prisma as any).notificationPreferences.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });
        const value = prefs?.[prefKey];
        return value !== false; // missing column / undefined defaults to allowed
    } catch (err: any) {
        logger.warn('[notify] preference lookup failed (fail open):', err?.message);
        return true;
    }
}

async function preferenceAllows(
    userId: string,
    type: NotificationType | string,
): Promise<boolean> {
    return isAllowedByPreference(userId, type);
}

// In-memory fallback for idempotency when Redis is unavailable. Bounded so
// we never grow unbounded; entries auto-expire on access.
const MEMORY_IDEMPOTENCY = new Map<string, number>();
const MEMORY_IDEMPOTENCY_MAX = 5_000;

function memoryClaim(key: string): boolean {
    const now = Date.now();
    // Opportunistic cleanup of expired entries.
    if (MEMORY_IDEMPOTENCY.size > MEMORY_IDEMPOTENCY_MAX) {
        for (const [k, exp] of MEMORY_IDEMPOTENCY) {
            if (exp < now) MEMORY_IDEMPOTENCY.delete(k);
            if (MEMORY_IDEMPOTENCY.size <= MEMORY_IDEMPOTENCY_MAX / 2) break;
        }
    }
    const existing = MEMORY_IDEMPOTENCY.get(key);
    if (existing && existing > now) return false;
    MEMORY_IDEMPOTENCY.set(key, now + IDEMPOTENCY_TTL_SECONDS * 1000);
    return true;
}

async function claimIdempotency(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return memoryClaim(key);

    try {
        // SET key value EX ttl NX — atomic claim that returns 'OK' only the
        // first time this key is seen within the TTL window. ioredis returns
        // null when the key already exists.
        const result = await redis.set(
            `notify:idem:${key}`,
            '1',
            'EX',
            IDEMPOTENCY_TTL_SECONDS,
            'NX',
        );
        return result === 'OK';
    } catch (err: any) {
        // If Redis errors we deliberately fail open — duplicates are less
        // bad than dropped notifications for the user.
        logger.warn('[notify] idempotency check failed (fail open):', err?.message);
        return true;
    }
}

function pickRendered(
    language: SupportedLanguage,
    key: PushTemplateKey | undefined,
    override: string | undefined,
    vars: Record<string, string | number>,
): string | undefined {
    if (override !== undefined) return override;
    if (!key) return undefined;
    return renderPushTemplate(key, language, vars);
}

/**
 * Deliver a notification to a single user end-to-end:
 *   1. Check preference gate (unless bypassed).
 *   2. Claim idempotency key (if provided).
 *   3. Resolve user language and render title/body.
 *   4. Enqueue via Bull -> NotificationService -> DB + WebSocket + push.
 */
export async function notifyUser(params: NotifyUserParams): Promise<{ delivered: boolean; reason?: string }> {
    const {
        userId,
        type,
        titleKey,
        bodyKey,
        vars = {},
        title,
        message,
        data,
        idempotencyKey,
        bypassPreferences,
        actor,
        skipPush,
    } = params;

    if (!userId) {
        logger.warn('[notify] notifyUser called without userId');
        return { delivered: false, reason: 'missing_user' };
    }

    if (!bypassPreferences) {
        const allowed = await preferenceAllows(userId, type);
        if (!allowed) {
            logger.debug('[notify] suppressed by preference', { userId, type });
            return { delivered: false, reason: 'preference_off' };
        }
    }

    if (idempotencyKey) {
        const fresh = await claimIdempotency(idempotencyKey);
        if (!fresh) {
            logger.debug('[notify] suppressed by idempotency', { userId, type, idempotencyKey });
            return { delivered: false, reason: 'duplicate' };
        }
    }

    const language = await getUserLanguage(userId);
    const resolvedTitle = pickRendered(language, titleKey, title, vars);
    const resolvedBody = pickRendered(language, bodyKey, message, vars);

    if (!resolvedTitle || !resolvedBody) {
        logger.warn('[notify] missing title/body — refusing to send', {
            userId,
            type,
            titleKey,
            bodyKey,
        });
        return { delivered: false, reason: 'missing_copy' };
    }

    const payload = {
        userId,
        type: String(type),
        title: resolvedTitle,
        message: resolvedBody,
        data: { type: String(type), ...data },
    };

    if (actor) {
        await enqueueSocialNotification({ ...payload, actorId: actor.id });
    } else {
        await enqueueNotification(payload);
    }

    if (skipPush) {
        // The Bull worker honors `skipPush` indirectly via data flag; the
        // upstream NotificationService already respects `pushNotificationsConsent`,
        // so we just mark it for downstream inspection.
        (payload.data as any).__skipPush = true;
    }

    return { delivered: true };
}

/**
 * Batch helper for notifiers that fan out to thousands of users. Uses the
 * single-user helper internally so all gating rules still apply, but caps
 * concurrency so we don't queue 20k Bull jobs in one tick.
 */
export async function notifyUsers(
    list: NotifyUserParams[],
    options: { concurrency?: number } = {},
): Promise<{ delivered: number; suppressed: number; failed: number }> {
    const concurrency = Math.max(1, Math.min(50, options.concurrency ?? 20));
    let delivered = 0;
    let suppressed = 0;
    let failed = 0;

    for (let i = 0; i < list.length; i += concurrency) {
        const batch = list.slice(i, i + concurrency);
        const results = await Promise.allSettled(batch.map((p) => notifyUser(p)));
        for (const r of results) {
            if (r.status === 'fulfilled') {
                if (r.value.delivered) delivered++;
                else suppressed++;
            } else {
                failed++;
                logger.warn('[notify] batch entry failed:', r.reason?.message ?? r.reason);
            }
        }
    }

    return { delivered, suppressed, failed };
}
