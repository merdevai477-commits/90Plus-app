/**
 * Throwaway verifier for the 365Scores → API-Football status mapping.
 *
 * Usage:
 *   npx tsx scripts/verify-365-statuses.ts
 *
 * Prints the mapped { short, long, elapsed } for a table of representative
 * 365Scores game payloads covering every special match state (ET, AET,
 * penalty shootout live/finished, cancelled, postponed, suspended,
 * interrupted, abandoned/walkover) plus the normal NS/1H/HT/2H/FT states.
 *
 * Network/env are NOT required — this only exercises the pure classifier.
 */

import { classifyScores365MatchStatus } from '../src/services/scores365-experiment.service';

type SampleGame = Parameters<typeof classifyScores365MatchStatus>[0];

function makeGame(partial: Record<string, unknown>): SampleGame {
  return {
    id: 1,
    sportId: 1,
    competitionId: 572,
    statusId: 0,
    statusGroup: 3,
    homeCompetitor: { id: 1, name: 'Home', score: 1 },
    awayCompetitor: { id: 2, name: 'Away', score: 1 },
    ...partial,
  } as SampleGame;
}

interface Case {
  label: string;
  expected: string;
  game: SampleGame;
}

const noScore = {
  homeCompetitor: { id: 1, name: 'Home', score: -1 },
  awayCompetitor: { id: 2, name: 'Away', score: -1 },
};

const cases: Case[] = [
  { label: 'Scheduled', expected: 'NS', game: makeGame({ statusGroup: 2, statusText: 'Scheduled', ...noScore }) },
  { label: '1st Half', expected: '1H', game: makeGame({ statusGroup: 3, statusText: '1st Half', shortStatusText: '1st Half', gameTime: 22 }) },
  { label: 'Half Time', expected: 'HT', game: makeGame({ statusGroup: 3, statusText: 'Half Time', shortStatusText: 'HT', gameTime: 45 }) },
  { label: '2nd Half', expected: '2H', game: makeGame({ statusGroup: 3, statusText: '2nd Half', shortStatusText: '2nd Half', gameTime: 67 }) },
  { label: 'Ended', expected: 'FT', game: makeGame({ statusGroup: 4, statusText: 'Ended', shortStatusText: 'Ended', gameTime: 90 }) },
  { label: 'Extra Time (live)', expected: 'ET', game: makeGame({ statusGroup: 3, statusText: 'Extra Time', shortStatusText: 'ET', gameTime: 98 }) },
  { label: 'ET Break', expected: 'BT', game: makeGame({ statusGroup: 3, statusText: 'Extra Time - Break', shortStatusText: 'ET', gameTime: 105 }) },
  { label: 'After Extra Time', expected: 'AET', game: makeGame({ statusGroup: 4, statusText: 'After Extra Time', shortStatusText: 'AET', gameTime: 120 }) },
  { label: 'Penalties (live)', expected: 'P', game: makeGame({ statusGroup: 3, statusText: 'Penalties', shortStatusText: 'Pen.', gameTime: 120 }) },
  { label: 'After Penalties', expected: 'PEN', game: makeGame({ statusGroup: 4, statusText: 'After Penalties', shortStatusText: 'Pen.', gameTime: 120 }) },
  { label: 'Cancelled', expected: 'CANC', game: makeGame({ statusGroup: 2, statusText: 'Cancelled', shortStatusText: 'Canc.', ...noScore }) },
  { label: 'Postponed', expected: 'PST', game: makeGame({ statusGroup: 2, statusText: 'Postponed', shortStatusText: 'Postp.', ...noScore }) },
  { label: 'Suspended', expected: 'SUSP', game: makeGame({ statusGroup: 3, statusText: 'Suspended', shortStatusText: 'Susp.', gameTime: 63 }) },
  { label: 'Interrupted', expected: 'INT', game: makeGame({ statusGroup: 3, statusText: 'Interrupted', shortStatusText: 'Int.', gameTime: 71 }) },
  { label: 'Abandoned', expected: 'ABD', game: makeGame({ statusGroup: 4, statusText: 'Abandoned', shortStatusText: 'Aband.', gameTime: 55 }) },
  { label: 'Walkover', expected: 'WO', game: makeGame({ statusGroup: 4, statusText: 'Awarded (Walkover)', shortStatusText: 'WO', ...noScore }) },
];

function main(): void {
  let pass = 0;
  let fail = 0;
  console.log('365Scores status mapping verification\n');
  console.log(
    `${'CASE'.padEnd(22)}${'EXPECTED'.padEnd(10)}${'GOT'.padEnd(10)}${'ELAPSED'.padEnd(9)}RESULT`,
  );
  console.log('-'.repeat(64));
  for (const c of cases) {
    const res = classifyScores365MatchStatus(c.game);
    const ok = res.short === c.expected;
    if (ok) pass += 1;
    else fail += 1;
    console.log(
      `${c.label.padEnd(22)}${c.expected.padEnd(10)}${res.short.padEnd(10)}${String(res.elapsed ?? '—').padEnd(9)}${ok ? 'OK' : 'MISMATCH'} (${res.long})`,
    );
  }
  console.log('-'.repeat(64));
  console.log(`${pass} passed, ${fail} mismatched\n`);
  if (fail > 0) process.exitCode = 1;
}

main();
