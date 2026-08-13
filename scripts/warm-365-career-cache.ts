/**
 * WARM THE 365SCORES CAREER CACHE FOR ONE LANGUAGE
 * =============================================================================
 *
 * `cached_365_player_career` holds one provider payload per athlete PER
 * LANGUAGE — 365 returns player names, club labels and trophy labels in the
 * language you ask for, so the English and Arabic rows are different rows.
 *
 * The table only ever fills from app traffic (someone opened a player card), so
 * a language nobody browses in stays empty. Football Grid reads career rows in
 * the language it is publishing for, and with ~10 English rows against ~564
 * Arabic ones it could not build an English board at all: no round was
 * published and the app showed "Today's challenge isn't available".
 *
 * This script fills the gap the honest way — it asks 365Scores for the SAME
 * real athletes in the missing language. Nothing is translated, copied between
 * rows, or invented: every field comes back from the provider.
 *
 *   npx ts-node --transpile-only scripts/warm-365-career-cache.ts --lang=en
 *   npx ts-node --transpile-only scripts/warm-365-career-cache.ts --lang=ar --limit=200
 *   npx ts-node --transpile-only scripts/warm-365-career-cache.ts --lang=en --force
 *
 * Flags:
 *   --lang=en|ar   language to fill                            (default: en)
 *   --limit=N      stop after N athletes                       (default: all)
 *   --concurrency=N  parallel athletes                         (default: 6)
 *   --force        refetch athletes already cached in --lang   (default: skip)
 *   --max-age-days=N  with --force, only refetch rows older than this
 *
 * Safe to re-run: it upserts and skips what it already has.
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { footballDataCacheService } from '../src/services/football-data-cache.service';
import { logger } from '../src/utils/logger';

/** 365Scores language ids the app publishes in. */
const LANG_ID: Record<'en' | 'ar', number> = { en: 1, ar: 27 };

interface Options {
  lang: 'en' | 'ar';
  limit: number | null;
  concurrency: number;
  force: boolean;
  maxAgeDays: number | null;
}

function parseArgs(argv: string[]): Options {
  const get = (name: string): string | null => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const num = (name: string): number | null => {
    const raw = get(name);
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const lang = (get('lang') ?? 'en').toLowerCase();
  if (lang !== 'en' && lang !== 'ar') {
    throw new Error(`--lang must be "en" or "ar" (got "${lang}")`);
  }

  return {
    lang,
    limit: num('limit'),
    concurrency: Math.min(num('concurrency') ?? 6, 12),
    force: argv.includes('--force'),
    maxAgeDays: num('max-age-days'),
  };
}

/**
 * Athletes to warm: every athlete id the cache already knows, in any language.
 *
 * These are provider ids the app has genuinely seen — the script never invents
 * an id or guesses a range. Athletes with the richest payloads come first, so a
 * `--limit`ed run warms the players most likely to carry trophies and a long
 * club history (i.e. the ones a grid cell can actually be built from).
 */
async function selectAthletes(options: Options): Promise<number[]> {
  const langId = LANG_ID[options.lang];
  const staleBefore =
    options.force && options.maxAgeDays != null
      ? new Date(Date.now() - options.maxAgeDays * 86_400_000)
      : null;

  const rows = await prisma.$queryRawUnsafe<Array<{ athleteId: number }>>(
    `
    select c."athleteId"
      from public.cached_365_player_career c
     where ${
       options.force
         ? staleBefore
           ? `(c."langId" <> $1 or c."updatedAt" < $2)`
           : 'true'
         : `not exists (
              select 1 from public.cached_365_player_career hit
               where hit."athleteId" = c."athleteId" and hit."langId" = $1)`
     }
     group by c."athleteId"
     order by max(jsonb_array_length(coalesce(c.data->'trophies', '[]'::jsonb))) desc,
              max(jsonb_array_length(coalesce(c.data->'seasons',  '[]'::jsonb))) desc,
              c."athleteId" asc
    `,
    langId,
    ...(staleBefore ? [staleBefore] : []),
  );

  const ids = rows.map((row) => row.athleteId);
  return options.limit ? ids.slice(0, options.limit) : ids;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const langId = LANG_ID[options.lang];

  const before = await countRows(langId);
  const athletes = await selectAthletes(options);

  console.log(
    `[warm-career] language=${options.lang} (langId=${langId}) ` +
      `rows_before=${before} to_fetch=${athletes.length} concurrency=${options.concurrency}` +
      `${options.force ? ' force' : ''}`,
  );
  if (!athletes.length) {
    console.log('[warm-career] nothing to do');
    return;
  }

  let done = 0;
  let stored = 0;
  let empty = 0;
  const started = Date.now();

  // A simple worker pool: N athletes in flight, each of which is itself a
  // handful of upstream calls. Kept modest on purpose — this is a background
  // fill, not a race, and 365 is a shared dependency of the whole app.
  const queue = [...athletes];
  const workers = Array.from({ length: options.concurrency }, async () => {
    for (;;) {
      const athleteId = queue.shift();
      if (athleteId == null) return;
      try {
        const result = await footballDataCacheService.refresh365PlayerCareer(
          athleteId,
          options.lang,
          langId,
        );
        if (result.data?.seasons?.length) stored += 1;
        else empty += 1;
      } catch (err) {
        empty += 1;
        logger.warn(`[warm-career] athlete ${athleteId} failed: ${(err as Error)?.message}`);
      }
      done += 1;
      if (done % 25 === 0 || done === athletes.length) {
        const rate = done / Math.max((Date.now() - started) / 1000, 1);
        console.log(
          `[warm-career] ${done}/${athletes.length} stored=${stored} empty=${empty} ` +
            `(${rate.toFixed(1)}/s)`,
        );
      }
    }
  });

  await Promise.all(workers);

  const after = await countRows(langId);
  console.log(
    `[warm-career] done in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `rows ${before} → ${after} (stored=${stored}, no_career_upstream=${empty})`,
  );
}

async function countRows(langId: number): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `select count(*)::int as n from public.cached_365_player_career where "langId" = $1`,
    langId,
  );
  return row?.n ?? 0;
}

main()
  .catch((err) => {
    console.error('[warm-career] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
