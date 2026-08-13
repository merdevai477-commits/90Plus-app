/**
 * Followed Team Watcher Service
 *
 * When a user follows a club / national team (FavoriteTeam.apiTeamId = 365
 * competitorId), they should be notified about that team's matches that:
 *   - have already STARTED (kickoff), or
 *   - are UPCOMING but only when kickoff is on the SAME calendar day.
 *
 * This does NOT introduce a new push/polling stack. It reuses the existing
 * per-match subscription pipeline:
 *   - `subscribeWithBaseline` creates a FavoriteMatch row (flagged
 *     `autoSubscribed`) so the LiveMatchIngestor already fans out
 *     kickoff/goal/fulltime pushes for it.
 *   - `scheduleMatchStartReminder` schedules the Bull T-30 + kickoff jobs for
 *     still-upcoming same-day fixtures.
 *   - Matches that are already live when the user follows get one immediate
 *     "match started" push (idempotent via `notifyUser`).
 *
 * All pushes remain gated by `pushNotificationsConsent` +
 * `NotificationPreferences.matchStart` downstream.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
    isWorldCupOnlyMode,
    logSkippingNonWorldCup,
} from '../config/world-cup-only-mode.config';
import { LIVE_STATUSES, FINISHED_STATUSES } from './match-events/match-event-normalizer';
import { subscribeWithBaseline } from './match-events/match-subscription.service';
import {
    scheduleMatchStartReminder,
    cancelMatchStartReminder,
} from '../queues/match-start-reminder.queue';
import { threeSixFiveScoresService } from './threeSixFiveScores.service';
import { calendarDateFromKickoff, calendarTodayKey } from '../utils/calendar-day-bounds.util';

interface ApiFixture {
    fixture?: { id?: number; date?: string; status?: { short?: string } };
    teams?: {
        home?: { id?: number; name?: string; logo?: string };
        away?: { id?: number; name?: string; logo?: string };
    };
    league?: { id?: number; name?: string };
}

const IN_PROGRESS_EXTRA_STATUSES = ['HT', '2H', 'ET', 'BT', 'P', 'INT', 'SUSP'];

function isFinished(status: string): boolean {
    return FINISHED_STATUSES.has(status) || ['CANC', 'ABD', 'AWD', 'WO', 'PST'].includes(status);
}

function isInProgress(status: string): boolean {
    return LIVE_STATUSES.has(status) || IN_PROGRESS_EXTRA_STATUSES.includes(status);
}

export class FollowedTeamWatcherService {
    private static intervalId: NodeJS.Timeout | null = null;
    private static isRunning = false;

    /** Start the periodic watcher (first pass after 60s, then every 5 minutes). */
    static start(): void {
        if (this.intervalId) {
            logger.info('⚠️ Followed-team watcher already running');
            return;
        }

        logger.info('🔄 Starting followed-team watcher service...');

        setTimeout(() => {
            this.checkFollowedTeams().catch((err) =>
                logger.error('[FollowedTeamWatcher] initial pass failed:', err?.message ?? err),
            );
        }, 60_000);

        this.intervalId = setInterval(() => {
            this.checkFollowedTeams().catch((err) =>
                logger.error('[FollowedTeamWatcher] pass failed:', err?.message ?? err),
            );
        }, 5 * 60 * 1000);

        logger.info('✅ Followed-team watcher started (first check in 60s, then every 5 minutes)');
    }

    static stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('✅ Followed-team watcher stopped');
        }
    }

    /** Periodic pass over every followed team of every eligible user. */
    static async checkFollowedTeams(): Promise<void> {
        if (isWorldCupOnlyMode()) {
            logSkippingNonWorldCup('FollowedTeamWatcher');
            return;
        }
        if (this.isRunning) {
            logger.debug('[FollowedTeamWatcher] pass already in progress — skipping');
            return;
        }
        this.isRunning = true;
        try {
            // Only users who can actually receive a push.
            const rows = await prisma.favoriteTeam.findMany({
                where: {
                    user: {
                        pushNotificationsConsent: true,
                        expoPushToken: { not: null },
                    },
                },
                select: { apiTeamId: true, userId: true },
            });

            if (rows.length === 0) {
                logger.debug('[FollowedTeamWatcher] no followed teams to check');
                return;
            }

            const teamToUsers = new Map<number, string[]>();
            for (const row of rows) {
                const list = teamToUsers.get(row.apiTeamId) ?? [];
                list.push(row.userId);
                teamToUsers.set(row.apiTeamId, list);
            }

            logger.info(`[FollowedTeamWatcher] checking ${teamToUsers.size} followed team(s)`);

            for (const [apiTeamId, userIds] of teamToUsers) {
                try {
                    const fixtures = await this.getTodaysFixtures(apiTeamId);
                    logger.info(
                        `[FollowedTeamWatcher] competitor=${apiTeamId} source=365 fixtures=${fixtures.length}`,
                    );
                    for (const fixture of fixtures) {
                        for (const userId of userIds) {
                            await this.subscribeFixtureForUser(userId, fixture);
                        }
                    }
                    // Gentle pacing to respect API rate limits.
                    await new Promise((resolve) => setTimeout(resolve, 1_000));
                } catch (err: any) {
                    logger.warn(`[FollowedTeamWatcher] team ${apiTeamId} failed:`, err?.message ?? err);
                }
            }
        } catch (err: any) {
            logger.error('[FollowedTeamWatcher] pass error:', err?.message ?? err);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Immediately sync one user's newly-followed team so notifications don't
     * wait for the next periodic pass. Called (fire-and-forget) from the
     * follow route. No-ops when the user cannot receive pushes yet.
     */
    static async syncTeamForUser(userId: string, apiTeamId: number): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { pushNotificationsConsent: true, expoPushToken: true },
            });
            if (!user?.pushNotificationsConsent || !user.expoPushToken) {
                return; // will be picked up later once push is enabled
            }

            const fixtures = await this.getTodaysFixtures(apiTeamId);
            for (const fixture of fixtures) {
                await this.subscribeFixtureForUser(userId, fixture);
            }
        } catch (err: any) {
            logger.warn(`[FollowedTeamWatcher] syncTeamForUser ${userId}/${apiTeamId} failed:`, err?.message ?? err);
        }
    }

    /**
     * On unfollow, remove the auto-created subscriptions for this team's
     * same-day fixtures and cancel their reminders — unless the user still
     * follows the opponent in that fixture.
     */
    static async cleanupTeamForUser(userId: string, apiTeamId: number): Promise<void> {
        try {
            const fixtures = await this.getTodaysFixtures(apiTeamId);
            for (const fixture of fixtures) {
                const fixtureId = fixture.fixture?.id;
                if (!fixtureId) continue;

                const homeId = fixture.teams?.home?.id;
                const awayId = fixture.teams?.away?.id;
                const opponentIds = [homeId, awayId].filter(
                    (id): id is number => typeof id === 'number' && id !== apiTeamId,
                );

                if (opponentIds.length > 0) {
                    const stillFollowed = await prisma.favoriteTeam.findFirst({
                        where: { userId, apiTeamId: { in: opponentIds } },
                        select: { id: true },
                    });
                    if (stillFollowed) continue;
                }

                await prisma.favoriteMatch.deleteMany({
                    where: { userId, apiMatchId: fixtureId, autoSubscribed: true },
                });
                await cancelMatchStartReminder(userId, fixtureId);
            }
        } catch (err: any) {
            logger.warn(`[FollowedTeamWatcher] cleanupTeamForUser ${userId}/${apiTeamId} failed:`, err?.message ?? err);
        }
    }

    /**
     * Same-calendar-day fixtures for a 365 competitor (live + upcoming).
     * `apiTeamId` on FavoriteTeam now stores the 365 competitorId.
     */
    private static async getTodaysFixtures(competitorId: number): Promise<ApiFixture[]> {
        const today = calendarTodayKey();
        const result = await threeSixFiveScoresService.getCompetitorMatches(competitorId, 'en');
        const live = result.data?.live ?? [];
        const upcoming = result.data?.upcoming ?? [];
        return [...live, ...upcoming].filter((fx) => {
            const day = calendarDateFromKickoff(fx.fixture?.date);
            return day === today;
        }) as ApiFixture[];
    }

    /**
     * Ensure a single fixture is subscribed for one user and the right reminder
     * / immediate push is issued. Never touches an existing subscription (manual
     * favorite or a prior auto-subscription) so baselines are preserved.
     */
    private static async subscribeFixtureForUser(userId: string, fixture: ApiFixture): Promise<void> {
        const fixtureId = fixture.fixture?.id;
        if (!fixtureId) return;

        const status = fixture.fixture?.status?.short ?? 'NS';
        if (isFinished(status)) return; // already over — no start/upcoming push

        // Skip if already subscribed (manual or auto) — avoids resetting baseline
        // and prevents duplicate start pushes.
        const existing = await prisma.favoriteMatch.findUnique({
            where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
            select: { id: true },
        });
        if (existing) return;

        const kickoff = fixture.fixture?.date ? new Date(fixture.fixture.date) : new Date();
        const home = fixture.teams?.home?.name ?? 'Home';
        const away = fixture.teams?.away?.name ?? 'Away';
        const homeLogo = fixture.teams?.home?.logo ?? null;
        const awayLogo = fixture.teams?.away?.logo ?? null;
        const leagueName = fixture.league?.name ?? null;

        await subscribeWithBaseline({
            userId,
            fixtureId,
            matchDate: kickoff,
            homeTeam: home,
            awayTeam: away,
            homeTeamLogo: homeLogo,
            awayTeamLogo: awayLogo,
            leagueName,
        });

        // Tag as watcher-owned so it stays out of the user's favorites/bell UI.
        await prisma.favoriteMatch.update({
            where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
            data: { autoSubscribed: true },
        });

        if (isInProgress(status)) {
            // Already kicked off — one immediate "started" push (idempotent).
            const { notifyUser } = await import('./notify.service');
            const { NotificationType } = await import('./notification.service');
            await notifyUser({
                userId,
                type: NotificationType.MATCH_START,
                titleKey: 'matchStartTitle',
                bodyKey: 'matchStartBody',
                vars: { home, away, minutes: 0 },
                idempotencyKey: `followed-team-start:${userId}:${fixtureId}`,
                data: {
                    type: 'MATCH_START',
                    matchId: String(fixtureId),
                    fixtureId: String(fixtureId),
                    homeTeam: home,
                    awayTeam: away,
                    homeTeamLogo: homeLogo ?? '',
                    awayTeamLogo: awayLogo ?? '',
                    leagueName: leagueName ?? '',
                    screen: '/(tabs)/match-details',
                    priority: 'high',
                },
            });
            logger.info(`[FollowedTeamWatcher] immediate start push user=${userId} fixture=${fixtureId}`);
        } else {
            // Upcoming same-day — schedule T-30 + kickoff reminders (idempotent job ids).
            await scheduleMatchStartReminder({
                userId,
                fixtureId,
                homeTeam: home,
                awayTeam: away,
                matchDate: kickoff.toISOString(),
            });
            logger.info(`[FollowedTeamWatcher] scheduled reminders user=${userId} fixture=${fixtureId}`);
        }
    }
}

export default FollowedTeamWatcherService;
