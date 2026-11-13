/**
 * Top 10 real candidates for each recognition badge.
 * Returns only users that exist. Never pads the list.
 */

import prisma from '../lib/prisma';
import { takeTop } from '../data/elite-badge-catalog';
import { loadFeaturedBadges } from './elite-badge.service';
import { coachKingLeaderboard } from './coach-king.service';
import { getTsfLeaderboard } from './top-scorers-five.service';

export type CandidatePeriod = '7d' | '30d' | 'all';

export interface BadgeCandidate {
    rank: number;
    userId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
    isDeveloper: boolean;
    metricLabel: string;
    metricValue: number;
    badge: { key: string; title: string } | null;
}

function since(period: CandidatePeriod): Date | null {
    if (period === 'all') return null;
    const days = period === '7d' ? 7 : 30;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function usersByIds(ids: string[]) {
    if (!ids.length) return new Map<string, {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        isVerified: boolean;
        isDeveloper: boolean;
    }>();
    const rows = await prisma.user.findMany({
        where: { id: { in: ids }, isDeleted: false },
        select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            isVerified: true,
            isDeveloper: true,
        },
    });
    return new Map(rows.map((row) => [row.id, row]));
}

async function decorate(
    ranked: Array<{ userId: string; metricLabel: string; metricValue: number }>,
    query?: string,
): Promise<BadgeCandidate[]> {
    const users = await usersByIds(ranked.map((row) => row.userId));
    const badges = await loadFeaturedBadges([...users.keys()]);
    const needle = query?.trim().toLowerCase();
    const out: BadgeCandidate[] = [];
    for (const row of ranked) {
        const user = users.get(row.userId);
        if (!user) continue;
        if (needle && !`${user.username} ${user.displayName || ''}`.toLowerCase().includes(needle)) continue;
        const badge = badges.get(user.id);
        out.push({
            rank: out.length + 1,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            isVerified: user.isVerified,
            isDeveloper: user.isDeveloper,
            metricLabel: row.metricLabel,
            metricValue: row.metricValue,
            badge: badge ? { key: badge.key, title: badge.title } : null,
        });
        if (out.length >= 10) break;
    }
    return out;
}

async function countGroup(
    model: 'communityPost' | 'reel' | 'comment' | 'communityComment' | 'reelShare' | 'communityShare',
    period: CandidatePeriod,
    extra?: Record<string, unknown>,
) {
    const from = since(period);
    const where: Record<string, unknown> = { ...(extra || {}) };
    if (from) where.createdAt = { gte: from };
    const rows = await (prisma[model] as any).groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
    });
    return (rows as Array<{ userId: string; _count: { _all: number } }>).map((row) => ({
        userId: row.userId,
        metricValue: row._count._all,
    }));
}

async function predictionCandidates(kind: 'correct' | 'accuracy' | 'streak', period: CandidatePeriod) {
    const from = since(period);
    const where: Record<string, unknown> = { isCorrect: { not: null } };
    if (from) where.createdAt = { gte: from };
    const rows = await prisma.prediction.groupBy({
        by: ['userId'],
        where: where as any,
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 40,
    });
    const correctRows = await prisma.prediction.groupBy({
        by: ['userId'],
        where: { ...where, isCorrect: true } as any,
        _count: { _all: true },
    });
    const graded = new Map(rows.map((row) => [row.userId, row._count._all]));
    const correct = new Map(correctRows.map((row) => [row.userId, row._count._all]));
    if (kind !== 'streak') {
        const ranked = [...graded.entries()]
            .map(([userId, total]) => {
                const hits = correct.get(userId) ?? 0;
                const metricValue = kind === 'accuracy' ? (total ? Math.round((hits / total) * 100) : 0) : hits;
                return { userId, metricValue };
            })
            .filter((row) => row.metricValue > 0)
            .sort((a, b) => b.metricValue - a.metricValue);
        return ranked;
    }
    const ids = [...graded.keys()].slice(0, 40);
    if (!ids.length) return [];
    const history = await prisma.prediction.findMany({
        where: { userId: { in: ids }, isCorrect: { not: null }, ...(from ? { createdAt: { gte: from } } : {}) },
        select: { userId: true, isCorrect: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 4000,
    });
    const byUser = new Map<string, boolean[]>();
    for (const row of history) {
        const list = byUser.get(row.userId) ?? [];
        if (list.length < 80) list.push(!!row.isCorrect);
        byUser.set(row.userId, list);
    }
    return [...byUser.entries()]
        .map(([userId, flags]) => {
            let current = 0;
            for (const hit of flags) {
                if (!hit) break;
                current += 1;
            }
            return { userId, metricValue: current };
        })
        .filter((row) => row.metricValue > 0)
        .sort((a, b) => b.metricValue - a.metricValue);
}

export async function listBadgeCompetitions() {
    const rows = await prisma.competition.findMany({
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: { id: true, prizeName: true, status: true, participantsCount: true, homeTeam: true, awayTeam: true },
    });
    return rows;
}

export async function listBadgeCandidates(opts: {
    category: string;
    period?: CandidatePeriod;
    competitionId?: string | null;
    query?: string;
}): Promise<BadgeCandidate[]> {
    const period: CandidatePeriod = opts.period === '7d' || opts.period === '30d' ? opts.period : 'all';
    const category = opts.category;
    let ranked: Array<{ userId: string; metricLabel: string; metricValue: number }> = [];

    if (category === 'prediction_accuracy' || category === 'king_results' || category === 'king_game' || category === 'prediction_streak') {
        const kind = category === 'prediction_accuracy' ? 'accuracy' : category === 'prediction_streak' ? 'streak' : 'correct';
        const rows = await predictionCandidates(kind, period);
        const label = kind === 'accuracy' ? 'دقة %' : kind === 'streak' ? 'سلسلة' : 'توقع صحيح';
        ranked = rows.map((row) => ({ ...row, metricLabel: label }));
    } else if (category === 'points' || category === 'ranking_champion') {
        const users = await prisma.user.findMany({
            where: { isDeleted: false, xp: { gt: 0 } },
            orderBy: { xp: 'desc' },
            take: 10,
            select: { id: true },
        });
        ranked = users.map((user) => ({ userId: user.id, metricLabel: 'نقاط', metricValue: 0 }));
        const full = await prisma.user.findMany({
            where: { id: { in: users.map((user) => user.id) } },
            select: { id: true, xp: true },
        });
        const xp = new Map(full.map((user) => [user.id, user.xp]));
        ranked = ranked.map((row) => ({ ...row, metricValue: xp.get(row.userId) ?? 0 }));
    } else if (category === 'daily_streak' || category === 'activity_streak') {
        const users = await prisma.user.findMany({
            where: { isDeleted: false, consecutiveLoginDays: { gt: 0 } },
            orderBy: { consecutiveLoginDays: 'desc' },
            take: 10,
            select: { id: true, consecutiveLoginDays: true },
        });
        ranked = users.map((user) => ({ userId: user.id, metricLabel: 'أيام', metricValue: user.consecutiveLoginDays }));
    } else if (category === 'posts' || category === 'community_activity') {
        const rows = await countGroup('communityPost', period, { status: { not: 'DELETED' } });
        ranked = rows.map((row) => ({ ...row, metricLabel: 'منشور' }));
    } else if (category === 'reels' || category === 'reel_engagement') {
        const rows = category === 'reel_engagement'
            ? await prisma.reel.findMany({
                where: { isDeleted: false, ...(since(period) ? { createdAt: { gte: since(period)! } } : {}) },
                orderBy: { views: 'desc' },
                take: 30,
                select: { userId: true, views: true },
            })
            : null;
        if (rows) {
            const totals = new Map<string, number>();
            for (const row of rows) totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.views);
            ranked = [...totals.entries()]
                .map(([userId, metricValue]) => ({ userId, metricLabel: 'مشاهدة', metricValue }))
                .sort((a, b) => b.metricValue - a.metricValue);
        } else {
            const counted = await countGroup('reel', period, { isDeleted: false });
            ranked = counted.map((row) => ({ ...row, metricLabel: 'ريل' }));
        }
    } else if (category === 'comments') {
        const [reelComments, communityComments] = await Promise.all([
            countGroup('comment', period, { isDeleted: false }),
            countGroup('communityComment', period, { status: { not: 'DELETED' } }),
        ]);
        const totals = new Map<string, number>();
        for (const row of [...reelComments, ...communityComments]) {
            totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.metricValue);
        }
        ranked = [...totals.entries()]
            .map(([userId, metricValue]) => ({ userId, metricLabel: 'تعليق', metricValue }))
            .sort((a, b) => b.metricValue - a.metricValue);
    } else if (category === 'shares') {
        const [reelShares, communityShares] = await Promise.all([
            countGroup('reelShare', period),
            countGroup('communityShare', period),
        ]);
        const totals = new Map<string, number>();
        for (const row of [...reelShares, ...communityShares]) {
            totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.metricValue);
        }
        ranked = [...totals.entries()]
            .map(([userId, metricValue]) => ({ userId, metricLabel: 'مشاركة', metricValue }))
            .sort((a, b) => b.metricValue - a.metricValue);
    } else if (category === 'coach' || category === 'coach_tactics') {
        const board = await coachKingLeaderboard('all', 10).catch(() => []);
        ranked = board.map((row) => ({ userId: row.userId, metricLabel: 'نقاط تدريب', metricValue: row.points }));
    } else if (category === 'scorers_europe' || category === 'scorers_egypt' || category === 'scorers_overall' || category === 'scorers_streak') {
        const tournament = category === 'scorers_egypt' ? 'egypt' : 'europe';
        const board = await getTsfLeaderboard({
            clerkUserId: 'ass-desk',
            period: 'all',
            limit: 10,
            tournament,
        }).catch(() => ({ entries: [] as Array<{ userId: string; xp: number }> }));
        ranked = (board.entries || []).map((row) => ({
            userId: row.userId,
            metricLabel: 'نقاط',
            metricValue: row.xp,
        }));
    } else if (category === 'competition_champion' || opts.competitionId) {
        const competitionId = opts.competitionId;
        if (!competitionId) return [];
        const entries = await prisma.competitionEntry.findMany({
            where: { competitionId },
            select: { userId: true, isCorrect: true, isWinner: true },
        });
        const totals = new Map<string, { correct: number; total: number; wins: number }>();
        for (const entry of entries) {
            const current = totals.get(entry.userId) ?? { correct: 0, total: 0, wins: 0 };
            current.total += 1;
            if (entry.isCorrect) current.correct += 1;
            if (entry.isWinner) current.wins += 1;
            totals.set(entry.userId, current);
        }
        ranked = [...totals.entries()]
            .map(([userId, value]) => ({
                userId,
                metricLabel: category === 'competition_champion' ? 'فوز' : 'إجابة صحيحة',
                metricValue: category === 'competition_champion' ? value.wins : value.correct,
            }))
            .filter((row) => row.metricValue > 0 || category !== 'competition_champion')
            .sort((a, b) => b.metricValue - a.metricValue);
    }

    return decorate(takeTop(ranked, 20), opts.query);
}
