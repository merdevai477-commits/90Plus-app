/**
 * Settles Predict & Win competitions when their linked match finishes.
 *
 * Grading rule: every entry is marked correct/incorrect. Correct entries are
 * ordered by earliest `createdAt` so the sponsor leaderboard can show who
 * answered first. `isWinner` is **not** stamped here — the sponsor confirms
 * a winner via `awardWinner`.
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

/** Applies a grading result. Winners are left unset for the sponsor to confirm. */
async function persistGrading(competitionId: string, graded: GradedEntry[], settledAt: Date) {
  await prisma.$transaction([
    prisma.competitionEntry.updateMany({
      where: { competitionId },
      data: { rank: null, isWinner: false, awardedAt: null, winnerAckAt: null },
    }),
    ...graded.map(({ entry, isCorrect }) =>
      prisma.competitionEntry.update({
        where: { id: entry.id },
        data: { isCorrect, isWinner: false, rank: null, settledAt },
      }),
    ),
    prisma.competition.update({
      where: { id: competitionId },
      data: { winnerAwardedAt: null },
    }),
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

      const correct = graded.filter((g) => g.isCorrect).length;
      logger.info(
        `[CompetitionResolver] settled ${id}: ${competition.entries.length} entries, ${correct} correct — awaiting sponsor award`,
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
        winnerAwardedAt: null,
      },
    });

    const correct = graded.filter((g) => g.isCorrect).length;
    logger.info(`[CompetitionResolver] re-settled ${competitionId}: ${correct} correct — awaiting sponsor award`);
    return { winners: 0, entries: graded.length };
  }

  static isFinishedStatus(status: string): boolean {
    return FINISHED.has(status);
  }
}
