/**
 * AsS dashboard totals: users per game, and every competition's entrants.
 */

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AssGameStat {
    key: string;
    name: string;
    players: number;
    actions: number;
    actionLabel: string;
}

export interface AssOverviewCompetition {
    id: string;
    prizeName: string;
    status: string;
    homeTeam: string;
    awayTeam: string;
    leagueName: string | null;
    matchDate: string;
    participants: number;
    views: number;
    winnersCount: number;
    sponsorName: string;
}

export interface AssOverview {
    generatedAt: string;
    users: {
        total: number;
        newWeek: number;
        activeWeek: number;
        banned: number;
        suspended: number;
    };
    games: AssGameStat[];
    competitionTotals: Array<{ status: string; competitions: number; participants: number }>;
    competitions: AssOverviewCompetition[];
}

function n(value: unknown): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
}

async function pair(sql: Prisma.Sql): Promise<{ players: number; actions: number }> {
    const rows = await prisma.$queryRaw<Array<{ players: number; actions: number }>>(sql);
    return { players: n(rows[0]?.players), actions: n(rows[0]?.actions) };
}

async function game(
    key: string,
    name: string,
    actionLabel: string,
    sql: Prisma.Sql,
): Promise<AssGameStat> {
    try {
        const stats = await pair(sql);
        return { key, name, actionLabel, ...stats };
    } catch (err) {
        logger.warn(`[AsS] overview game failed: ${key}`, err);
        return { key, name, actionLabel, players: 0, actions: 0 };
    }
}

export async function getAssOverview(): Promise<AssOverview> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [userRow, totals, competitions, games] = await Promise.all([
        prisma.$queryRaw<
            Array<{ total: number; new_week: number; active_week: number; banned: number; suspended: number }>
        >(Prisma.sql`
            SELECT
                COUNT(*) FILTER (WHERE "isDeleted" = false)::int AS total,
                COUNT(*) FILTER (WHERE "isDeleted" = false AND "createdAt" >= ${weekAgo})::int AS new_week,
                COUNT(*) FILTER (WHERE "isDeleted" = false AND "lastLoginDate" >= ${weekAgo})::int AS active_week,
                COUNT(*) FILTER (WHERE "isBanned" = true)::int AS banned,
                COUNT(*) FILTER (WHERE "isSuspended" = true AND "isDeleted" = false)::int AS suspended
            FROM users
        `),
        prisma.competition.groupBy({
            by: ['status'],
            _count: { _all: true },
            _sum: { participantsCount: true },
        }),
        prisma.competition.findMany({
            orderBy: [{ participantsCount: 'desc' }, { createdAt: 'desc' }],
            take: 100,
            select: {
                id: true,
                prizeName: true,
                status: true,
                homeTeam: true,
                awayTeam: true,
                leagueName: true,
                matchDate: true,
                participantsCount: true,
                viewsCount: true,
                winnersCount: true,
                sponsor: { select: { name: true } },
                _count: { select: { entries: true } },
            },
        }),
        Promise.all([
            game(
                'competitions',
                'توقع واربح',
                'اشتراك',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM competition_entries`,
            ),
            game(
                'king-game',
                'ملك اللعبة',
                'توقع',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM predictions WHERE "kingMode" = 'winner'`,
            ),
            game(
                'king-results',
                'ملك النتائج',
                'توقع',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM predictions WHERE "kingMode" = 'exact'`,
            ),
            game(
                'quiz',
                'الكويز اليومي',
                'جلسة',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM user_daily_quiz_sessions`,
            ),
            game(
                'wheel',
                'عجلة الحظ',
                'لفة',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM daily_spin_history`,
            ),
            game(
                'reels',
                'الريلز',
                'ريل',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM reels WHERE "isDeleted" = false`,
            ),
            game(
                'community',
                'المجتمع',
                'منشور',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM community_posts WHERE status <> 'DELETED'`,
            ),
            game(
                'share',
                'شير واربح',
                'مشاركة',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM share_win_standings`,
            ),
            game(
                'coach',
                'ملك المدربين',
                'تشكيلة',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM coach_king_squads`,
            ),
            game(
                'scorers',
                'خماسي الهدافين',
                'تشكيلة',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM top_scorers_five_squads`,
            ),
            game(
                'groups',
                'مجموعات التوقعات',
                'عضوية',
                Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS players, COUNT(*)::int AS actions FROM group_members WHERE "leftAt" IS NULL`,
            ),
        ]),
    ]);

    const users = userRow[0];
    return {
        generatedAt: new Date().toISOString(),
        users: {
            total: n(users?.total),
            newWeek: n(users?.new_week),
            activeWeek: n(users?.active_week),
            banned: n(users?.banned),
            suspended: n(users?.suspended),
        },
        games,
        competitionTotals: totals
            .map((row) => ({
                status: row.status,
                competitions: row._count._all,
                participants: n(row._sum.participantsCount),
            }))
            .sort((a, b) => b.participants - a.participants),
        competitions: competitions.map((row) => ({
            id: row.id,
            prizeName: row.prizeName,
            status: row.status,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
            leagueName: row.leagueName,
            matchDate: row.matchDate.toISOString(),
            participants: row._count.entries || row.participantsCount,
            views: row.viewsCount,
            winnersCount: row.winnersCount,
            sponsorName: row.sponsor?.name || '—',
        })),
    };
}
