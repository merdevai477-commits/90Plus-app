/**
 * Mentor and automatic recognition awards.
 * Does not change prediction, XP, or coin scoring.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { notifyUser } from './notify.service';
import {
    activeSlotFor,
    expiresAtFor,
    isAwardActive,
    type EliteAwardDuration,
} from '../data/elite-badge-catalog';

export class EliteBadgeError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export interface FeaturedBadge {
    key: string;
    title: string;
    accent: string;
    nameAr: string;
    nameEn: string;
}

export interface PublicIdentity {
    isVerified: boolean;
    isDeveloper: boolean;
    badge: FeaturedBadge | null;
}

const awardInclude = {
    badge: true,
    user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true, isDeveloper: true } },
    competition: { select: { id: true, prizeName: true } },
} as const;

function featuredFrom(award: {
    customTitle: string;
    badge: { key: string; accent: string; nameAr: string; nameEn: string };
}): FeaturedBadge {
    return {
        key: award.badge.key,
        title: award.customTitle,
        accent: award.badge.accent,
        nameAr: award.badge.nameAr,
        nameEn: award.badge.nameEn,
    };
}

export async function loadFeaturedBadges(userIds: string[]): Promise<Map<string, FeaturedBadge>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    const map = new Map<string, FeaturedBadge>();
    if (!ids.length) return map;
    const now = new Date();
    const rows = await prisma.eliteBadgeAward.findMany({
        where: {
            userId: { in: ids },
            revokedAt: null,
            activeSlot: { not: null },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
        include: { badge: true },
    });
    for (const row of rows) {
        if (map.has(row.userId) || !isAwardActive(row, now)) continue;
        map.set(row.userId, featuredFrom(row));
    }
    return map;
}

export function identityFor(
    user: { id: string; isVerified?: boolean | null; isDeveloper?: boolean | null },
    badges: Map<string, FeaturedBadge>,
): PublicIdentity {
    return {
        isVerified: !!user.isVerified,
        isDeveloper: !!user.isDeveloper,
        badge: badges.get(user.id) ?? null,
    };
}

export async function attachIdentity<T extends { id: string; isVerified?: boolean | null; isDeveloper?: boolean | null }>(
    users: T[],
): Promise<Array<T & { identity: PublicIdentity }>> {
    const badges = await loadFeaturedBadges(users.map((user) => user.id));
    return users.map((user) => ({ ...user, identity: identityFor(user, badges) }));
}

export async function listBadgeDefinitions() {
    return prisma.eliteBadgeDefinition.findMany({ orderBy: [{ category: 'asc' }, { nameEn: 'asc' }] });
}

export async function awardEliteBadge(input: {
    userId: string;
    badgeKey: string;
    customTitle: string;
    description?: string | null;
    duration: EliteAwardDuration;
    competitionId?: string | null;
    actor: string;
}): Promise<{ id: string; expiresAt: string | null }> {
    const title = input.customTitle.trim().slice(0, 80);
    if (!title) throw new EliteBadgeError(400, 'TITLE_REQUIRED', 'Custom title is required');
    const description = input.description?.trim().slice(0, 500) || null;
    const badge = await prisma.eliteBadgeDefinition.findUnique({ where: { key: input.badgeKey } });
    if (!badge) throw new EliteBadgeError(404, 'BADGE_NOT_FOUND', 'Badge not found');
    if (badge.key === 'competition_champion' && !input.competitionId) {
        throw new EliteBadgeError(400, 'COMPETITION_REQUIRED', 'Competition champion needs a competition');
    }
    const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, isDeleted: true },
    });
    if (!user || user.isDeleted) throw new EliteBadgeError(404, 'USER_NOT_FOUND', 'User not found');
    if (input.competitionId) {
        const competition = await prisma.competition.findUnique({
            where: { id: input.competitionId },
            select: { id: true, prizeName: true },
        });
        if (!competition) throw new EliteBadgeError(404, 'COMPETITION_NOT_FOUND', 'Competition not found');
    }

    const now = new Date();
    const expiresAt = expiresAtFor(input.duration, now);
    const slot = activeSlotFor(user.id, badge.id, input.competitionId);
    const existing = await prisma.eliteBadgeAward.findFirst({
        where: { activeSlot: slot, revokedAt: null },
        select: { id: true, expiresAt: true },
    });
    if (existing && isAwardActive({ ...existing, revokedAt: null, activeSlot: slot }, now)) {
        throw new EliteBadgeError(409, 'ALREADY_ACTIVE', 'This user already has this badge active');
    }
    if (existing) {
        await prisma.eliteBadgeAward.update({
            where: { id: existing.id },
            data: { activeSlot: null },
        });
    }

    let created: { id: string; expiresAt: Date | null };
    try {
        created = await prisma.$transaction(async (tx) => {
            const award = await tx.eliteBadgeAward.create({
                data: {
                    userId: user.id,
                    badgeId: badge.id,
                    customTitle: title,
                    description,
                    competitionId: input.competitionId || null,
                    awardedBy: input.actor,
                    startsAt: now,
                    expiresAt,
                    activeSlot: slot,
                },
            });
            await tx.eliteBadgeAwardLog.create({
                data: {
                    awardId: award.id,
                    action: 'AWARDED',
                    actor: input.actor,
                    metadata: { badgeKey: badge.key, duration: input.duration, title } as any,
                },
            });
            return award;
        });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            throw new EliteBadgeError(409, 'ALREADY_ACTIVE', 'This user already has this badge active');
        }
        throw err;
    }

    const badgeName = badge.nameAr;
    void notifyUser({
        userId: user.id,
        type: 'MODERATION_ALERT',
        titleKey: 'eliteBadgeAwardedTitle',
        bodyKey: 'eliteBadgeAwardedBody',
        vars: { badge: badgeName, title },
        data: {
            screen: '/(tabs)/profile',
            kind: 'elite-badge',
            badgeKey: badge.key,
            awardId: created.id,
        },
        bypassPreferences: true,
    }).catch((err: any) => logger.warn('[elite-badge] notify failed:', err?.message));

    return { id: created.id, expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null };
}

export async function revokeEliteBadge(awardId: string, actor: string): Promise<{ id: string }> {
    const award = await prisma.eliteBadgeAward.findUnique({ where: { id: awardId }, select: { id: true, revokedAt: true } });
    if (!award) throw new EliteBadgeError(404, 'AWARD_NOT_FOUND', 'Award not found');
    if (award.revokedAt) return { id: award.id };
    await prisma.$transaction([
        prisma.eliteBadgeAward.update({
            where: { id: award.id },
            data: { revokedAt: new Date(), activeSlot: null },
        }),
        prisma.eliteBadgeAwardLog.create({
            data: { awardId: award.id, action: 'REVOKED', actor },
        }),
    ]);
    return { id: award.id };
}

export async function expireDueAwards(now = new Date()): Promise<number> {
    const due = await prisma.eliteBadgeAward.findMany({
        where: { revokedAt: null, activeSlot: { not: null }, expiresAt: { lte: now } },
        select: { id: true },
        take: 200,
    });
    if (!due.length) return 0;
    await prisma.$transaction([
        prisma.eliteBadgeAward.updateMany({
            where: { id: { in: due.map((row) => row.id) } },
            data: { activeSlot: null },
        }),
        prisma.eliteBadgeAwardLog.createMany({
            data: due.map((row) => ({ awardId: row.id, action: 'EXPIRED', actor: 'system' })),
        }),
    ]);
    return due.length;
}

export async function badgeDeskOverview() {
    await expireDueAwards();
    const now = new Date();
    const [definitions, active, expired, users, recent, grouped] = await Promise.all([
        prisma.eliteBadgeDefinition.count(),
        prisma.eliteBadgeAward.count({
            where: { revokedAt: null, activeSlot: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        }),
        prisma.eliteBadgeAward.count({
            where: { revokedAt: null, expiresAt: { lte: now } },
        }),
        prisma.eliteBadgeAward.findMany({
            where: { revokedAt: null, activeSlot: { not: null } },
            distinct: ['userId'],
            select: { userId: true },
        }),
        prisma.eliteBadgeAward.findMany({
            orderBy: { createdAt: 'desc' },
            take: 12,
            include: awardInclude,
        }),
        prisma.eliteBadgeAward.groupBy({
            by: ['badgeId'],
            _count: { _all: true },
            orderBy: { _count: { badgeId: 'desc' } },
            take: 5,
        }),
    ]);
    const badgeIds = grouped.map((row) => row.badgeId);
    const badges = badgeIds.length
        ? await prisma.eliteBadgeDefinition.findMany({ where: { id: { in: badgeIds } } })
        : [];
    const byId = new Map(badges.map((badge) => [badge.id, badge]));
    return {
        definitions,
        active,
        expired,
        recognizedUsers: users.length,
        mostAwarded: grouped.map((row) => ({
            key: byId.get(row.badgeId)?.key ?? row.badgeId,
            nameAr: byId.get(row.badgeId)?.nameAr ?? '',
            count: row._count._all,
        })),
        recent: recent.map((row) => ({
            id: row.id,
            title: row.customTitle,
            badgeKey: row.badge.key,
            badgeName: row.badge.nameAr,
            accent: row.badge.accent,
            username: row.user.username,
            displayName: row.user.displayName,
            avatar: row.user.avatar,
            expiresAt: row.expiresAt?.toISOString() ?? null,
            revokedAt: row.revokedAt?.toISOString() ?? null,
            active: isAwardActive(row, now),
            createdAt: row.createdAt.toISOString(),
            competitionName: row.competition?.prizeName ?? null,
        })),
    };
}

export async function listUserEliteBadges(userId: string) {
    const now = new Date();
    const rows = await prisma.eliteBadgeAward.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { badge: true, competition: { select: { id: true, prizeName: true } } },
    });
    return rows.map((row) => ({
        id: row.id,
        key: row.badge.key,
        nameAr: row.badge.nameAr,
        nameEn: row.badge.nameEn,
        accent: row.badge.accent,
        rarity: row.badge.rarity,
        title: row.customTitle,
        description: row.description,
        competitionId: row.competitionId,
        competitionName: row.competition?.prizeName ?? null,
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
        active: isAwardActive(row, now),
        permanent: row.expiresAt == null && row.revokedAt == null,
    }));
}
