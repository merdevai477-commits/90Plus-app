/**
 * Community moderation — two layers:
 *   1. Synchronous: obfuscation-aware word list (static + BannedWord table).
 *      Offending posts/comments are rejected before they are stored.
 *   2. Asynchronous: OpenAI omni-moderation on every stored post/comment.
 *      Anything that slipped past the list is hidden within seconds.
 */

import Bull, { Queue } from 'bull';
import OpenAI from 'openai';
import prisma from '../lib/prisma';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import {
    createProfanityMatcher,
    DEFAULT_PROFANITY_LISTS,
    mergeBannedWords,
    type ProfanityMatcher,
} from './community-profanity';
import { notifyUser } from './notify.service';
import { suspendUser } from './moderation.service';

export type CommunityContentKind = 'post' | 'comment';

export type CommunityTextVerdict =
    | { ok: true }
    | { ok: false; code: 'PROFANITY_DETECTED' | 'SPAM_DETECTED'; matches: string[] };

const BANNED_WORDS_REFRESH_MS = 5 * 60 * 1000;
const URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;
const MAX_URLS = 2;
const REPEATED_CHAR = /(.)\1{14,}/u;

/** AI-hidden items in this window before an automatic 1-day suspension. */
const AI_STRIKES_FOR_SUSPENSION = 3;
const AI_STRIKE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Blocked submit attempts (word list) in this window before suspension. */
const BLOCKED_ATTEMPTS_FOR_SUSPENSION = 10;
const BLOCKED_WINDOW_MS = 24 * 60 * 60 * 1000;

let matcher: ProfanityMatcher = createProfanityMatcher();
let matcherLoadedAt = 0;
let matcherRefresh: Promise<void> | null = null;

async function refreshMatcher(): Promise<void> {
    try {
        const rows = await prisma.bannedWord.findMany({
            where: { isActive: true },
            select: { word: true, language: true },
        });
        matcher = createProfanityMatcher(mergeBannedWords(DEFAULT_PROFANITY_LISTS, rows));
    } catch (err: any) {
        logger.warn('[community-moderation] banned words refresh failed:', err?.message);
    } finally {
        matcherLoadedAt = Date.now();
    }
}

function currentMatcher(): ProfanityMatcher {
    if (Date.now() - matcherLoadedAt > BANNED_WORDS_REFRESH_MS && !matcherRefresh) {
        matcherRefresh = refreshMatcher().finally(() => {
            matcherRefresh = null;
        });
    }
    return matcher;
}

/** Pre-load the BannedWord table at boot so the first request uses it. */
export function warmCommunityModeration(): Promise<void> {
    return refreshMatcher();
}

export function checkCommunityText(text: string): CommunityTextVerdict {
    const result = currentMatcher().check(text);
    if (result.flagged) {
        return { ok: false, code: 'PROFANITY_DETECTED', matches: result.matches };
    }
    const urls = text.match(URL_PATTERN) ?? [];
    if (urls.length > MAX_URLS || REPEATED_CHAR.test(text)) {
        return { ok: false, code: 'SPAM_DETECTED', matches: [] };
    }
    return { ok: true };
}

/** Records a blocked attempt and suspends users who keep hammering the filter. */
export async function recordBlockedAttempt(
    userId: string,
    kind: CommunityContentKind,
    verdict: Extract<CommunityTextVerdict, { ok: false }>,
): Promise<void> {
    try {
        await prisma.moderationLog.create({
            data: {
                userId,
                contentType: `community_${kind}`,
                action: 'BLOCKED',
                reason: verdict.code,
                detectedWords: verdict.matches.slice(0, 10),
                severity: 'high',
            },
        });
        const recent = await prisma.moderationLog.count({
            where: {
                userId,
                action: 'BLOCKED',
                contentType: { startsWith: 'community_' },
                createdAt: { gte: new Date(Date.now() - BLOCKED_WINDOW_MS) },
            },
        });
        if (recent >= BLOCKED_ATTEMPTS_FOR_SUSPENSION) {
            await suspendIfNotAlready(userId, 'Repeated abusive language in Community');
        }
    } catch (err: any) {
        logger.warn('[community-moderation] recordBlockedAttempt failed:', err?.message);
    }
}

async function suspendIfNotAlready(userId: string, reason: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuspended: true, suspendedUntil: true },
    });
    if (user?.isSuspended && user.suspendedUntil && user.suspendedUntil > new Date()) return;
    await suspendUser(userId, reason, 1);
}

// ─── Async AI layer ───────────────────────────────────────────────────────

interface AiModerationJob {
    kind: CommunityContentKind;
    id: string;
    userId: string;
    text: string;
}

let openai: OpenAI | null | undefined;

function moderationClient(): OpenAI | null {
    if (openai !== undefined) return openai;
    const apiKey = process.env.OPENAI_MODERATION_KEY ?? process.env.OPENAI_API_KEY ?? '';
    if (!apiKey) {
        logger.warn('[community-moderation] OPENAI_API_KEY not set — AI moderation layer disabled');
        openai = null;
        return null;
    }
    openai = new OpenAI({ apiKey, timeout: 10_000, maxRetries: 2 });
    return openai;
}

type HideHandler = (kind: CommunityContentKind, id: string) => Promise<boolean>;
let hideHandler: HideHandler | null = null;

/** community.service registers how to hide content (keeps counters + caches consistent). */
export function registerCommunityHideHandler(handler: HideHandler): void {
    hideHandler = handler;
}

async function runAiModeration(job: AiModerationJob): Promise<void> {
    const client = moderationClient();
    if (!client || !job.text.trim()) return;

    const res = await client.moderations.create({
        model: 'omni-moderation-latest',
        input: job.text,
    });
    const result = res.results?.[0];
    if (!result?.flagged) return;

    const categories = Object.entries(result.categories ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);

    const hidden = hideHandler ? await hideHandler(job.kind, job.id) : false;
    if (!hidden) return;

    await prisma.moderationLog.create({
        data: {
            userId: job.userId,
            contentType: `community_${job.kind}`,
            contentId: job.id,
            action: 'REMOVED',
            reason: 'AI moderation',
            detectedWords: categories,
            severity: 'high',
            metadata: { scores: result.category_scores as any },
        },
    });

    await notifyUser({
        userId: job.userId,
        type: 'MODERATION_ALERT',
        titleKey: 'communityHiddenTitle',
        bodyKey: 'communityHiddenBody',
        data: { screen: '/(tabs)/community', kind: 'community', contentKind: job.kind, contentId: job.id },
        skipPush: true,
        bypassPreferences: true,
    }).catch(() => undefined);

    const strikes = await prisma.moderationLog.count({
        where: {
            userId: job.userId,
            action: 'REMOVED',
            contentType: { startsWith: 'community_' },
            createdAt: { gte: new Date(Date.now() - AI_STRIKE_WINDOW_MS) },
        },
    });
    if (strikes >= AI_STRIKES_FOR_SUSPENSION) {
        await suspendIfNotAlready(job.userId, 'Repeated community guideline violations');
    }
}

let queue: Queue<AiModerationJob> | null | undefined;

function getQueue(): Queue<AiModerationJob> | null {
    if (queue !== undefined) return queue;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        queue = null;
        return null;
    }
    queue = new Bull<AiModerationJob>('community-moderation', {
        createClient: bullCreateClient(redisUrl),
    });
    queue.process(10, async (job) => runAiModeration(job.data));
    queue.on('failed', (job, err) => {
        logger.warn('[community-moderation] AI job failed', { id: job?.data?.id, err: err?.message });
    });
    queue.on('error', (err) => logger.warn('[community-moderation] queue error:', err));
    return queue;
}

export async function enqueueCommunityAiModeration(job: AiModerationJob): Promise<void> {
    if (!moderationClient()) return;
    const q = getQueue();
    const runInline = () =>
        setImmediate(() => {
            runAiModeration(job).catch((err) =>
                logger.warn('[community-moderation] inline AI check failed:', err?.message),
            );
        });
    if (!q) {
        runInline();
        return;
    }
    try {
        await q.add(job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 500 });
    } catch (err: any) {
        logger.warn('[community-moderation] enqueue failed — running inline:', err?.message);
        runInline();
    }
}
