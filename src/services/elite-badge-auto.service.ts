/**
 * Idempotent milestone awards. Never changes points or prediction results.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { awardEliteBadge, EliteBadgeError } from './elite-badge.service';

async function grant(input: {
    userId: string;
    badgeKey: string;
    customTitle: string;
    description?: string;
    competitionId?: string;
}) {
    try {
        await awardEliteBadge({
            ...input,
            duration: 'permanent',
            actor: 'system',
        });
    } catch (err) {
        if (err instanceof EliteBadgeError && (err.code === 'ALREADY_ACTIVE' || err.code === 'USER_NOT_FOUND')) return;
        logger.warn('[elite-badge] auto grant skipped', { badge: input.badgeKey, message: (err as Error)?.message });
    }
}

export async function awardLoginStreakMilestone(userId: string, days: number) {
    if (days < 7) return;
    await grant({
        userId,
        badgeKey: 'daily_streak',
        customTitle: days >= 30 ? 'سلسلة شهر' : 'سلسلة أسبوع',
        description: `${days} يوم دخول متتالي`,
    });
}

export async function awardCompetitionChampion(userId: string, competitionId: string, prizeName: string) {
    await grant({
        userId,
        badgeKey: 'competition_champion',
        competitionId,
        customTitle: prizeName.slice(0, 80) || 'بطل المسابقة',
        description: prizeName,
    });
}

export async function evaluateEliteMilestones() {
    const streakUsers = await prisma.user.findMany({
        where: { isDeleted: false, consecutiveLoginDays: { gte: 7 } },
        select: { id: true, consecutiveLoginDays: true },
        take: 100,
        orderBy: { consecutiveLoginDays: 'desc' },
    });
    for (const user of streakUsers) {
        await awardLoginStreakMilestone(user.id, user.consecutiveLoginDays);
    }

    const winners = await prisma.competitionEntry.findMany({
        where: { isWinner: true },
        select: { userId: true, competitionId: true, competition: { select: { prizeName: true } } },
        orderBy: { awardedAt: 'desc' },
        take: 50,
    });
    for (const winner of winners) {
        await awardCompetitionChampion(winner.userId, winner.competitionId, winner.competition.prizeName);
    }

    const correct = await prisma.prediction.groupBy({
        by: ['userId'],
        where: { isCorrect: true },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 30,
    });
    const ids = correct.map((row) => row.userId);
    if (!ids.length) return;
    const history = await prisma.prediction.findMany({
        where: { userId: { in: ids }, isCorrect: { not: null } },
        select: { userId: true, isCorrect: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3000,
    });
    const flags = new Map<string, boolean[]>();
    for (const row of history) {
        const list = flags.get(row.userId) ?? [];
        if (list.length < 40) list.push(!!row.isCorrect);
        flags.set(row.userId, list);
    }
    for (const [userId, list] of flags) {
        let streak = 0;
        for (const hit of list) {
            if (!hit) break;
            streak += 1;
        }
        if (streak >= 5) {
            await grant({
                userId,
                badgeKey: 'prediction_streak',
                customTitle: streak >= 10 ? 'سلسلة عشرية' : 'سلسلة توقعات',
                description: `${streak} توقع صحيح متتالي`,
            });
        }
    }
}
