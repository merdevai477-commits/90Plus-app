/**
 * Followed Competition Watcher
 *
 * Users store followed 365 competitionIds in `User.favoriteLeagues`.
 * For each followed league, same-day fixtures are auto-subscribed into the
 * existing FavoriteMatch + LiveMatchIngestor pipeline (kickoff / goals /
 * cards / fulltime) — same pattern as FollowedTeamWatcher.
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

export class LeagueMatchWatcherService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start() {
    if (this.intervalId) {
      logger.info('[LeagueMatchWatcher] already running');
      return;
    }

    logger.info('[LeagueMatchWatcher] starting…');
    setTimeout(() => {
      void this.checkLeagueMatches();
    }, 50_000);

    this.intervalId = setInterval(() => {
      void this.checkLeagueMatches();
    }, 5 * 60 * 1000);

    logger.info('[LeagueMatchWatcher] started (first check in 50s, then every 5m)');
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[LeagueMatchWatcher] stopped');
    }
  }

  static async checkLeagueMatches() {
    if (isWorldCupOnlyMode()) {
      logSkippingNonWorldCup('LeagueMatchWatcher');
      return;
    }
    if (this.isRunning) {
      logger.debug('[LeagueMatchWatcher] pass already in progress — skipping');
      return;
    }
    this.isRunning = true;
    try {
      const users = await prisma.user.findMany({
        where: {
          favoriteLeagues: { isEmpty: false },
          expoPushToken: { not: null },
          pushNotificationsConsent: true,
        },
        select: { id: true, favoriteLeagues: true },
      });

      if (users.length === 0) {
        logger.debug('[LeagueMatchWatcher] no followed competitions');
        return;
      }

      const competitionToUsers = new Map<number, string[]>();
      for (const user of users) {
        for (const competitionId of user.favoriteLeagues) {
          if (!Number.isFinite(competitionId) || competitionId <= 0) continue;
          const list = competitionToUsers.get(competitionId) ?? [];
          list.push(user.id);
          competitionToUsers.set(competitionId, list);
        }
      }

      logger.info(
        `[LeagueMatchWatcher] checking ${competitionToUsers.size} competition(s) for ${users.length} user(s)`,
      );

      for (const [competitionId, userIds] of competitionToUsers) {
        try {
          const fixtures = await this.getTodaysFixtures(competitionId);
          logger.info(
            `[LeagueMatchWatcher] competition=${competitionId} fixtures=${fixtures.length}`,
          );
          for (const fixture of fixtures) {
            for (const userId of userIds) {
              await this.subscribeFixtureForUser(userId, fixture);
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (err: unknown) {
          logger.warn(
            `[LeagueMatchWatcher] competition ${competitionId} failed:`,
            (err as Error)?.message ?? err,
          );
        }
      }
    } catch (err: unknown) {
      logger.error('[LeagueMatchWatcher] pass error:', (err as Error)?.message ?? err);
    } finally {
      this.isRunning = false;
    }
  }

  /** Fire-and-forget after a user follows a competition. */
  static async syncCompetitionForUser(userId: string, competitionId: number): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushNotificationsConsent: true, expoPushToken: true },
      });
      if (!user?.pushNotificationsConsent || !user.expoPushToken) return;

      const fixtures = await this.getTodaysFixtures(competitionId);
      for (const fixture of fixtures) {
        await this.subscribeFixtureForUser(userId, fixture);
      }
    } catch (err: unknown) {
      logger.warn(
        `[LeagueMatchWatcher] syncCompetitionForUser ${userId}/${competitionId} failed:`,
        (err as Error)?.message ?? err,
      );
    }
  }

  static async cleanupCompetitionForUser(userId: string, competitionId: number): Promise<void> {
    try {
      const fixtures = await this.getTodaysFixtures(competitionId);
      for (const fixture of fixtures) {
        const fixtureId = fixture.fixture?.id;
        if (!fixtureId) continue;
        await prisma.favoriteMatch.deleteMany({
          where: { userId, apiMatchId: fixtureId, autoSubscribed: true },
        });
        await cancelMatchStartReminder(userId, fixtureId);
      }
    } catch (err: unknown) {
      logger.warn(
        `[LeagueMatchWatcher] cleanupCompetitionForUser ${userId}/${competitionId} failed:`,
        (err as Error)?.message ?? err,
      );
    }
  }

  private static async getTodaysFixtures(competitionId: number): Promise<ApiFixture[]> {
    const result = await threeSixFiveScoresService.getCompetitionTodaysFixtures(competitionId, 'en');
    return (result.data ?? []) as ApiFixture[];
  }

  private static async subscribeFixtureForUser(userId: string, fixture: ApiFixture): Promise<void> {
    const fixtureId = fixture.fixture?.id;
    if (!fixtureId) return;

    const status = fixture.fixture?.status?.short ?? 'NS';
    if (isFinished(status)) return;

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

    await prisma.favoriteMatch.update({
      where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
      data: { autoSubscribed: true },
    });

    if (isInProgress(status)) {
      const { notifyUser } = await import('./notify.service');
      const { NotificationType } = await import('./notification.service');
      await notifyUser({
        userId,
        type: NotificationType.MATCH_START,
        titleKey: 'matchStartTitle',
        bodyKey: 'matchStartBody',
        vars: { home, away, minutes: 0 },
        idempotencyKey: `followed-league-start:${userId}:${fixtureId}`,
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
      logger.info(`[LeagueMatchWatcher] immediate start push user=${userId} fixture=${fixtureId}`);
    } else {
      await scheduleMatchStartReminder({
        userId,
        fixtureId,
        homeTeam: home,
        awayTeam: away,
        matchDate: kickoff.toISOString(),
      });
      logger.info(`[LeagueMatchWatcher] scheduled reminders user=${userId} fixture=${fixtureId}`);
    }
  }
}

export default LeagueMatchWatcherService;
