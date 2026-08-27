/**
 * Settles Predict & Win competitions when their linked match finishes.
 *
 * Grading rule: every entry is marked correct/incorrect, then the correct ones
 * are ranked by earliest `createdAt` and the first `winnersCount` become
 * winners (first correct predictor wins).
 *
 * Safety properties:
 *  - **Atomic claim.** A competition is moved out of `PUBLISHED`/`LOCKED` with a
 *    conditional `updateMany`. Only the caller whose update matched a row does
 *    the grading, so two watcher ticks (or two instances) cannot both settle it.
 *  - **Idempotent.** Re-running is a no-op because the claim no longer matches.
 *  - **Correctable.** `resettleCompetition` is the explicit path for a revised
 *    official result; ordinary retries never rewrite a settled competition.
 *
 * `notify.service` is imported lazily: it transitively pulls in the websocket
 * gateway and the BullMQ queue, which must not be constructed just because
 * something imported this module.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/** Fixture statuses that mean "played to a result". */
const FINISHED = new Set(['FT', 'AET', 'PEN']);
/** Fixture statuses that mean "this match will not produce a result". */
const ABANDONED = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP', 'INT']);

export function actualWinner(homeScore: number, awayScore: number): 'home' | 'draw' | 'away' {
  if (homeScore > awayScore) return 'home';
  if (homeScore < awayScore) return 'away';
  return 'draw';
}

export interface GradeableEntry {
  id: string;
  userId: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedWinner: string | null;
  createdAt: Date;
}

export interface GradedEntry {
  entry: GradeableEntry;
  isCorrect: boolean;
  rank: number | null;
}

/**
 * Pure grading — exported so the rule can be tested without a database.
 * Winners are capped at `winnersCount`; ties are broken by entry time, which is
 * unique enough in practice and always deterministic for a fixed input set.
 */
export function gradeEntries(
  entries: GradeableEntry[],
  opts: {
    mode: 'EXACT_SCORE' | 'WINNER';
    homeScore: number;
    awayScore: number;
    winnersCount: number;
  },
): GradedEntry[] {
  const winner = actualWinner(opts.homeScore, opts.awayScore);

  const scored = entries.map((entry) => ({
    entry,
    isCorrect:
      opts.mode === 'EXACT_SCORE'
        ? entry.predictedHomeScore === opts.homeScore &&
          entry.predictedAwayScore === opts.awayScore
        : entry.predictedWinner === winner,
  }));

  const ranked = new Map<string, number>();
  scored
    .filter((s) => s.isCorrect)
    .sort((a, b) => {
      const t = a.entry.createdAt.getTime() - b.entry.createdAt.getTime();
      return t !== 0 ? t : a.entry.id.localeCompare(b.entry.id);
    })
    .slice(0, Math.max(0, opts.winnersCount))
    .forEach((s, i) => ranked.set(s.entry.id, i + 1));

  return scored.map(({ entry, isCorrect }) => ({
    entry,
    isCorrect,
    rank: ranked.get(entry.id) ?? null,
  }));
}

async function notifyOutcome(
  graded: GradedEntry[],
  competition: { id: string; prizeName: string; sponsorName: string },
  /**
   * Scopes the idempotency key to one settlement. Without it a re-settled
   * competition would reuse the first settlement's key and the new winners
   * would never be told.
   */
  settlementKey: string,
): Promise<void> {
  let notifyUser: typeof import('./notify.service').notifyUser;
  let NotificationType: typeof import('./notification.service').NotificationType;
  try {
    ({ notifyUser } = await import('./notify.service'));
    ({ NotificationType } = await import('./notification.service'));
  } catch (err: any) {
    logger.warn('[CompetitionResolver] notifications unavailable:', err?.message);
    return;
  }

  for (const { entry, rank, isCorrect } of graded) {
    const won = rank != null;
    // Losing entrants are told too, so a participant always learns the outcome.
    await notifyUser({
      userId: entry.userId,
      type: NotificationType.PREDICTION_RESULT,
      title: won ? 'مبروك! ربحت المسابقة 🎉' : 'انتهت المسابقة',
      message: won
        ? `توقعك كان صح في مسابقة "${competition.prizeName}" من ${competition.sponsorName}`
        : isCorrect
          ? `توقعك كان صح في "${competition.prizeName}" لكن عدد الفائزين اكتمل`
          : `للأسف توقعك لم يكن صحيحاً في "${competition.prizeName}"`,
      data: { screen: `/predict-and-win/${competition.id}`, entityId: competition.id },
      idempotencyKey: `competitionResult:${entry.id}:${settlementKey}`,
    }).catch((err) => logger.warn('[CompetitionResolver] notify failed:', err?.message));
  }
}

/** Applies a grading result to the database in one transaction. */
async function persistGrading(competitionId: string, graded: GradedEntry[], settledAt: Date) {
  await prisma.$transaction([
    // Clear ranks first: the [competitionId, rank] unique index would otherwise
    // collide with the previous settlement when re-settling.
    prisma.competitionEntry.updateMany({
      where: { competitionId },
      data: { rank: null, isWinner: false },
    }),
    ...graded.map(({ entry, isCorrect, rank }) =>
      prisma.competitionEntry.update({
        where: { id: entry.id },
        data: { isCorrect, isWinner: rank != null, rank, settledAt },
      }),
    ),
  ]);
}

export class CompetitionResolverService {
  /**
   * Settles every open competition attached to a finished match.
   * Safe to call repeatedly and concurrently.
   */
  static async resolveMatchCompetitions(
    apiMatchId: number,
    homeScore: number,
    awayScore: number,
    /**
     * The fixture status that produced the result. Stamped verbatim so a match
     * decided in extra time or on penalties is not mislabelled "FT" — the app
     * shows this string, and "انتهت بركلات الترجيح" is a different sentence.
     */
    finishedStatus: string = 'FT',
  ): Promise<void> {
    const open = await prisma.competition.findMany({
      where: { apiMatchId, status: { in: ['PUBLISHED', 'LOCKED'] } },
      select: { id: true },
    });
    if (open.length === 0) return;

    for (const { id } of open) {
      const settledAt = new Date();

      // Atomic claim — whoever flips the row owns the settlement.
      const claimed = await prisma.competition.updateMany({
        where: { id, status: { in: ['PUBLISHED', 'LOCKED'] } },
        data: {
          status: 'SETTLED',
          settledAt,
          resultHomeScore: homeScore,
          resultAwayScore: awayScore,
          matchStatus: FINISHED.has(finishedStatus) ? finishedStatus : 'FT',
        },
      });
      if (claimed.count === 0) {
        logger.debug(`[CompetitionResolver] ${id} already claimed, skipping`);
        continue;
      }

      const competition = await prisma.competition.findUnique({
        where: { id },
        include: { sponsor: { select: { name: true } }, entries: true },
      });
      if (!competition) continue;

      const graded = gradeEntries(competition.entries, {
        mode: competition.predictionMode,
        homeScore,
        awayScore,
        winnersCount: competition.winnersCount,
      });

      await persistGrading(id, graded, settledAt);

      const winners = graded.filter((g) => g.rank != null).length;
      logger.info(
        `[CompetitionResolver] settled ${id}: ${competition.entries.length} entries, ${winners} winner(s)`,
      );

      await notifyOutcome(
        graded,
        { id, prizeName: competition.prizeName, sponsorName: competition.sponsor.name },
        settledAt.toISOString(),
      );
    }
  }

  /**
   * Marks competitions as cancelled when their match will never produce a
   * result, so they don't sit "open" forever.
   */
  static async cancelForAbandonedMatch(apiMatchId: number, status: string): Promise<void> {
    if (!ABANDONED.has(status)) return;
    const res = await prisma.competition.updateMany({
      where: { apiMatchId, status: { in: ['PUBLISHED', 'LOCKED', 'DRAFT'] } },
      data: { status: 'CANCELLED', matchStatus: status },
    });
    if (res.count > 0) {
      logger.info(
        `[CompetitionResolver] cancelled ${res.count} competition(s) for match ${apiMatchId} (${status})`,
      );
    }
  }

  /** Closes entry at the deadline so late submissions are impossible. */
  static async lockExpiredCompetitions(): Promise<number> {
    const res = await prisma.competition.updateMany({
      where: { status: 'PUBLISHED', predictionDeadline: { lte: new Date() } },
      data: { status: 'LOCKED' },
    });
    if (res.count > 0) logger.info(`[CompetitionResolver] locked ${res.count} competition(s)`);
    return res.count;
  }

  /**
   * Re-grades an already-settled competition against a corrected official
   * result. This is the only path that rewrites a settlement, and it is
   * explicit (admin-triggered) rather than something a retry can trigger.
   */
  static async resettleCompetition(
    competitionId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<{ winners: number; entries: number }> {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: { sponsor: { select: { name: true } }, entries: true },
    });
    if (!competition) throw new Error('COMPETITION_NOT_FOUND');

    const settledAt = new Date();
    const graded = gradeEntries(competition.entries, {
      mode: competition.predictionMode,
      homeScore,
      awayScore,
      winnersCount: competition.winnersCount,
    });

    await persistGrading(competitionId, graded, settledAt);
    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        status: 'SETTLED',
        settledAt,
        resultHomeScore: homeScore,
        resultAwayScore: awayScore,
      },
    });

    // Keyed on this settlement, so entrants whose outcome changed are told.
    await notifyOutcome(
      graded,
      {
        id: competitionId,
        prizeName: competition.prizeName,
        sponsorName: competition.sponsor.name,
      },
      settledAt.toISOString(),
    );

    const winners = graded.filter((g) => g.rank != null).length;
    logger.info(`[CompetitionResolver] re-settled ${competitionId}: ${winners} winner(s)`);
    return { winners, entries: graded.length };
  }

  static isFinishedStatus(status: string): boolean {
    return FINISHED.has(status);
  }
}
