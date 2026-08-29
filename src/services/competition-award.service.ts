/**
 * Sponsor-confirmed winners for Predict & Win.
 *
 * The resolver grades entries (correct / incorrect) when the match finishes.
 * Ranking for display is earliest-correct-first. `isWinner` is stamped only
 * here, when the sponsor taps «تربيح».
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { recordCompetitionActivity, notifyAssAdmin } from './competition-moderation.service';

export interface LeaderboardCandidate {
  entryId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedWinner: string | null;
  displayRank: number;
  isWinner: boolean;
  createdAt: Date;
}

export interface OwnerLeaderboard {
  competitionId: string;
  prizeName: string;
  prizeType: string;
  sponsorName: string;
  status: string;
  resultHomeScore: number | null;
  resultAwayScore: number | null;
  matchFinished: boolean;
  winnersCount: number;
  awardedCount: number;
  stats: {
    wrong: number;
    correct: number;
    predictions: number;
    views: number;
  };
  candidates: LeaderboardCandidate[];
}

export async function getOwnerLeaderboard(
  userId: string,
  competitionId: string,
): Promise<OwnerLeaderboard> {
  const { assertCompetitionOwner } = await import('./competitions.service');
  const competition = await assertCompetitionOwner(userId, competitionId);
  const full = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      sponsor: { select: { name: true } },
      entries: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
        },
      },
    },
  });
  if (!full) throw new Error('COMPETITION_NOT_FOUND');

  const matchFinished =
    full.resultHomeScore != null && full.resultAwayScore != null && full.status === 'SETTLED';

  const predictions = full.entries.length;
  const correctEntries = full.entries.filter((e) => e.isCorrect === true);
  const wrong = full.entries.filter((e) => e.isCorrect === false).length;
  const correct = correctEntries.length;

  const sorted = [...correctEntries].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });

  const candidates: LeaderboardCandidate[] = sorted.slice(0, 4).map((e, i) => ({
    entryId: e.id,
    userId: e.user.id,
    username: e.user.username,
    displayName: e.user.displayName,
    avatar: e.user.avatar,
    predictedHomeScore: e.predictedHomeScore,
    predictedAwayScore: e.predictedAwayScore,
    predictedWinner: e.predictedWinner,
    displayRank: i + 1,
    isWinner: e.isWinner,
    createdAt: e.createdAt,
  }));

  return {
    competitionId: full.id,
    prizeName: full.prizeName,
    prizeType: full.prizeType,
    sponsorName: full.sponsor.name,
    status: full.status,
    resultHomeScore: full.resultHomeScore,
    resultAwayScore: full.resultAwayScore,
    matchFinished,
    winnersCount: full.winnersCount,
    awardedCount: full.entries.filter((e) => e.isWinner).length,
    stats: {
      wrong: matchFinished ? wrong : 0,
      correct: matchFinished ? correct : 0,
      predictions,
      views: full.viewsCount,
    },
    candidates: matchFinished ? candidates : [],
  };
}

export async function awardWinner(
  userId: string,
  competitionId: string,
  entryId: string,
): Promise<OwnerLeaderboard> {
  const { assertCompetitionOwner } = await import('./competitions.service');
  await assertCompetitionOwner(userId, competitionId);

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      sponsor: { select: { name: true, ownerId: true } },
      entries: true,
    },
  });
  if (!competition) throw new Error('COMPETITION_NOT_FOUND');
  if (competition.resultHomeScore == null || competition.resultAwayScore == null) {
    throw new Error('MATCH_NOT_FINISHED');
  }

  const entry = competition.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('ENTRY_NOT_FOUND');
  if (entry.isCorrect !== true) throw new Error('ENTRY_NOT_CORRECT');
  if (entry.isWinner) throw new Error('ALREADY_AWARDED');

  const awardedCount = competition.entries.filter((e) => e.isWinner).length;
  if (awardedCount >= competition.winnersCount) throw new Error('WINNERS_FULL');

  const nextRank = awardedCount + 1;
  const now = new Date();
  const filled = awardedCount + 1 >= competition.winnersCount;

  await prisma.competitionEntry.update({
    where: { id: entry.id },
    data: { isWinner: true, rank: nextRank, awardedAt: now },
  });
  if (filled) {
    await prisma.competition.update({
      where: { id: competitionId },
      data: { winnerAwardedAt: now },
    });
  }

  const winnerUser = await prisma.user.findUnique({
    where: { id: entry.userId },
    select: { username: true, displayName: true },
  });
  const winnerLabel = winnerUser?.displayName || winnerUser?.username || 'winner';

  await recordCompetitionActivity(competitionId, 'WINNER_AWARDED', {
    entryId: entry.id,
    userId: entry.userId,
    username: winnerUser?.username ?? null,
    displayName: winnerUser?.displayName ?? null,
    prizeName: competition.prizeName,
    prizeType: competition.prizeType,
    storeName: competition.sponsor.name,
    rank: nextRank,
  });

  await notifyWinnerAwarded({
    userId: entry.userId,
    entryId: entry.id,
    competitionId,
    prizeName: competition.prizeName,
    prizeType: competition.prizeType,
    storeName: competition.sponsor.name,
  });

  await notifyAssAdmin({
    titleKey: 'competitionAdminAwardTitle',
    bodyKey: 'competitionAdminAwardBody',
    vars: {
      winner: winnerLabel,
      prize: competition.prizeName,
      store: competition.sponsor.name,
    },
    data: {
      screen: `/predict-and-win/${competitionId}`,
      entityId: competitionId,
      kind: 'competition_admin_award',
    },
    idempotencyKey: `competitionAdminAward:${entry.id}`,
  });

  logger.info(`[CompetitionAward] ${competitionId} awarded ${entry.id} rank ${nextRank}`);
  return getOwnerLeaderboard(userId, competitionId);
}

async function notifyWinnerAwarded(opts: {
  userId: string;
  entryId: string;
  competitionId: string;
  prizeName: string;
  prizeType: string;
  storeName: string;
}): Promise<void> {
  try {
    const { notifyUser } = await import('./notify.service');
    const { NotificationType } = await import('./notification.service');
    await notifyUser({
      userId: opts.userId,
      type: NotificationType.GIFT,
      titleKey: 'competitionWinnerTitle',
      bodyKey: 'competitionWinnerBody',
      vars: {
        prize: opts.prizeName,
        prizeType: opts.prizeType,
        store: opts.storeName,
      },
      data: {
        screen: `/predict-and-win/${opts.competitionId}`,
        entityId: opts.competitionId,
        entryId: opts.entryId,
        kind: 'prize_win',
      },
      idempotencyKey: `prize-win:${opts.entryId}`,
      bypassPreferences: true,
    });
  } catch (err: any) {
    logger.warn('[CompetitionAward] winner notify failed:', err?.message);
  }
}

export async function ackPrizeWinFromNotification(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') return;
  const rec = data as Record<string, unknown>;
  if (rec.kind !== 'prize_win' || typeof rec.entryId !== 'string') return;
  await prisma.competitionEntry.updateMany({
    where: { id: rec.entryId, isWinner: true, winnerAckAt: null },
    data: { winnerAckAt: new Date() },
  });
}

export async function ackAllPrizeWinsForUser(userId: string): Promise<void> {
  await prisma.competitionEntry.updateMany({
    where: { userId, isWinner: true, winnerAckAt: null },
    data: { winnerAckAt: new Date() },
  });
}

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hourly: remind unacknowledged winners for up to 24 hours after award. */
export async function sendWinnerReminders(): Promise<number> {
  const cutoff = new Date(Date.now() - REMINDER_WINDOW_MS);
  const due = await prisma.competitionEntry.findMany({
    where: {
      isWinner: true,
      winnerAckAt: null,
      awardedAt: { gte: cutoff, not: null },
    },
    include: {
      competition: {
        select: {
          id: true,
          prizeName: true,
          prizeType: true,
          sponsor: { select: { name: true } },
        },
      },
    },
    take: 200,
  });
  if (due.length === 0) return 0;

  const hourBucket = new Date().toISOString().slice(0, 13);
  let sent = 0;
  const { notifyUser } = await import('./notify.service');
  const { NotificationType } = await import('./notification.service');

  for (const entry of due) {
    try {
      const result = await notifyUser({
        userId: entry.userId,
        type: NotificationType.GIFT,
        titleKey: 'competitionWinnerRemindTitle',
        bodyKey: 'competitionWinnerRemindBody',
        vars: {
          prize: entry.competition.prizeName,
          prizeType: entry.competition.prizeType,
          store: entry.competition.sponsor.name,
        },
        data: {
          screen: `/predict-and-win/${entry.competition.id}`,
          entityId: entry.competition.id,
          entryId: entry.id,
          kind: 'prize_win',
        },
        idempotencyKey: `prize-win-remind:${entry.id}:${hourBucket}`,
        bypassPreferences: true,
      });
      if (result.delivered) sent += 1;
    } catch (err: any) {
      logger.warn('[CompetitionAward] reminder failed:', err?.message);
    }
  }
  if (sent > 0) logger.info(`[CompetitionAward] sent ${sent} winner reminder(s)`);
  return sent;
}

export function startWinnerReminderCron(): void {
  cron.schedule('15 * * * *', () => {
    sendWinnerReminders().catch((err) =>
      logger.error('[CompetitionAward] reminder cron error:', err),
    );
  });
  logger.info('✅ Prize-winner reminder cron scheduled (hourly at :15)');
}
