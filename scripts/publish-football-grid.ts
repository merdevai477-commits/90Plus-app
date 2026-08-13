/**
 * PUBLISH TODAY'S FOOTBALL GRID ROUND
 * =============================================================================
 *
 * Football Grid's board is composed entirely from stored 365Scores career data
 * (`cached_365_player_career`), so unlike the authored modes it can be built on
 * demand in seconds. This script runs that real generation — the same builder
 * and the same publish gate the daily job uses — for one day and language.
 *
 * It is NOT a bypass. Nothing is written unless a genuine 3×3 board comes out
 * of the stored data and passes the round contract; a day that cannot support a
 * board still publishes nothing.
 *
 * Use it to produce today's round during development, or to recover the mode in
 * production without regenerating the other seven modes underneath players who
 * are part-way through them.
 *
 *   npx ts-node --transpile-only scripts/publish-football-grid.ts
 *   npx ts-node --transpile-only scripts/publish-football-grid.ts --language=en
 *   npx ts-node --transpile-only scripts/publish-football-grid.ts --date=2026-08-14
 *
 * If it reports that no board could be built, the career cache is too thin for
 * that language — fill it first with:
 *
 *   npx ts-node --transpile-only scripts/warm-365-career-cache.ts --lang=en
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { publishFootballGridRound } from '../src/services/questions-challenges.service';
import type { QuizLanguage } from '../src/types/quiz.types';

function arg(name: string): string | null {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : null;
}

async function main(): Promise<void> {
  const languageRaw = arg('language');
  if (languageRaw && languageRaw !== 'en' && languageRaw !== 'ar') {
    throw new Error(`--language must be "en" or "ar" (got "${languageRaw}")`);
  }
  const language = (languageRaw ?? undefined) as QuizLanguage | undefined;

  const dateRaw = arg('date');
  if (dateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new Error(`--date must be YYYY-MM-DD (got "${dateRaw}")`);
  }
  // Midnight UTC, matching the `@db.Date` refreshDate column the round is keyed by.
  const refreshDate = dateRaw ? new Date(`${dateRaw}T00:00:00.000Z`) : undefined;
  const timezone = arg('timezone') ?? 'UTC';

  console.log(
    `[publish-grid] language=${language ?? 'en+ar'} date=${dateRaw ?? 'today'} timezone=${timezone}`,
  );

  const published = await publishFootballGridRound({ language, timezone, refreshDate });

  if (!published) {
    console.error(
      '[publish-grid] NO ROUND PUBLISHED — the stored career data could not produce a ' +
        'complete 3x3 board, or the board was refused by the round contract. ' +
        'Nothing was written. See the [QuestionsGrid] log lines above for the reason.',
    );
    process.exitCode = 1;
    return;
  }

  // Report what is actually in the table now, so the script's own claim is
  // checkable rather than taken on trust.
  const rows = await prisma.$queryRawUnsafe<
    Array<{ d: string; language: string; status: string; source: string; questions: number }>
  >(
    `select to_char("refreshDate",'YYYY-MM-DD') as d, language, status::text, source,
            jsonb_array_length(coalesce(content->'questions','[]'::jsonb)) as questions
       from public.daily_question_challenges
      where type = 'FOOTBALL_GRID'
        and "refreshDate" = coalesce($1::date, current_date)
      order by language`,
    dateRaw,
  );
  console.table(rows);
}

main()
  .catch((err) => {
    console.error('[publish-grid] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeRedis().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
