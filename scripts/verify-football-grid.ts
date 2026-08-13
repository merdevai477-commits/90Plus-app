/**
 * VERIFY TODAY'S FOOTBALL GRID ROUND, CELL BY CELL
 * =============================================================================
 *
 * Checks the published round the app will actually be served, and then checks
 * every claim it makes back against the provider data it came from:
 *
 *   • the round exists, is PUBLISHED, and holds exactly 9 questions
 *   • the board is 3×3 with distinct row and column labels
 *   • each question names one cell, and the nine cells cover the board once
 *   • each question offers 4 real players with real portraits
 *   • THE ANSWER IS ACTUALLY CORRECT — the player it credits really did play
 *     for that row's club/national team and really did win that column's award,
 *     both re-read from `cached_365_player_career` rather than trusted
 *   • EVERY DISTRACTOR IS ACTUALLY WRONG — none of the other three options
 *     satisfies the cell, so a "wrong" placement is genuinely wrong
 *
 * That last pair is the point: a board can render perfectly and still be
 * ungradeable. This asserts the grading is right, not just the drawing.
 *
 *   npx ts-node --transpile-only scripts/verify-football-grid.ts
 *   npx ts-node --transpile-only scripts/verify-football-grid.ts --language=ar
 *   npx ts-node --transpile-only scripts/verify-football-grid.ts --date=2026-08-14
 *
 * Exit code is non-zero if anything fails, so it can gate a deploy.
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';

const LANG_ID: Record<string, number> = { en: 1, ar: 27 };

function arg(name: string, fallback: string): string {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
}

interface CareerRow {
  athleteId: number;
  name: string;
  data: {
    trophies?: Array<{ competitionId?: number }>;
    seasons?: Array<{ competitions?: Array<{ teamId?: number; teamName?: string }> }>;
  } | null;
}

/** The same two facts the board is built from, re-derived independently here. */
function factsFor(row: CareerRow): { teamIds: Set<number>; awardIds: Set<number> } {
  const teamIds = new Set<number>();
  for (const season of row.data?.seasons ?? []) {
    for (const competition of season?.competitions ?? []) {
      const teamId = Number(competition?.teamId);
      const teamName = String(competition?.teamName ?? '');
      // A season split across clubs ("Man City & Bayern") names no single team.
      if (!Number.isFinite(teamId) || teamId <= 0 || !teamName || teamName.includes('&')) continue;
      teamIds.add(teamId);
    }
  }
  const awardIds = new Set<number>();
  for (const trophy of row.data?.trophies ?? []) {
    const competitionId = Number(trophy?.competitionId);
    if (Number.isFinite(competitionId) && competitionId > 0) awardIds.add(competitionId);
  }
  return { teamIds, awardIds };
}

async function main(): Promise<void> {
  const language = arg('language', 'en');
  const date = arg('date', '');
  const failures: string[] = [];
  const check = (ok: boolean, label: string): void => {
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}`);
    if (!ok) failures.push(label);
  };

  const [round] = await prisma.$queryRawUnsafe<
    Array<{ id: string; d: string; status: string; source: string; content: any; answer: any }>
  >(
    `select id, to_char("refreshDate",'YYYY-MM-DD') as d, status::text, source, content, answer
       from public.daily_question_challenges
      where type='FOOTBALL_GRID' and language=$1
        and "refreshDate" = coalesce($2::date, current_date)`,
    language,
    date || null,
  );

  console.log(`\nFOOTBALL GRID — language=${language} date=${date || 'today'}`);
  if (!round) {
    console.log('  FAIL  no round row exists');
    process.exitCode = 1;
    return;
  }
  console.log(`  round ${round.id}  date=${round.d}  status=${round.status}  source=${round.source}\n`);

  check(round.status === 'PUBLISHED', `status is PUBLISHED (got ${round.status})`);

  const questions: any[] = Array.isArray(round.content?.questions) ? round.content.questions : [];
  check(questions.length === 9, `round holds 9 questions (got ${questions.length})`);
  if (!questions.length) {
    process.exitCode = 1;
    return;
  }

  // ── Board shape ─────────────────────────────────────────────────────────
  const rows: string[] = questions[0]?.rows ?? [];
  const columns: string[] = questions[0]?.columns ?? [];
  const rowImages: string[] = questions[0]?.rowImages ?? [];
  check(rows.length === 3, `3 rows (got ${rows.length})`);
  check(columns.length === 3, `3 columns (got ${columns.length})`);
  check(new Set(rows).size === 3, 'row labels are distinct');
  check(new Set(columns).size === 3, 'column labels are distinct');
  check(
    rowImages.length === 3 && rowImages.every((url) => /^https?:\/\//.test(url)),
    'every row carries a real remote crest',
  );
  check(
    questions.every((q) => JSON.stringify(q.rows) === JSON.stringify(rows)),
    'every question draws the same board',
  );

  const covered = new Set(questions.map((q) => `r${q.gridCell?.row}-c${q.gridCell?.column}`));
  check(covered.size === 9 && !covered.has('rundefined-cundefined'), 'the 9 questions cover the 9 cells exactly once');

  console.log(`\n  ROWS    : ${rows.join('  |  ')}`);
  console.log(`  COLUMNS : ${columns.join('  |  ')}\n`);

  // ── Options ─────────────────────────────────────────────────────────────
  const answers: Record<string, string[]> = round.answer?.questions ?? round.answer ?? {};
  const allOptionLabels = new Set<string>();
  for (const q of questions) {
    const options: any[] = q.options ?? [];
    if (options.length !== 4) {
      check(false, `${q.id}: 4 options (got ${options.length})`);
      continue;
    }
    for (const option of options) allOptionLabels.add(String(option.label));
    const portraits = options.every((option) => /^https?:\/\//.test(option.imageUrl ?? ''));
    check(portraits, `${q.id}: all 4 options carry a real portrait`);
  }

  // ── The claims, re-checked against the provider payload ────────────────
  const careerRows = await prisma.$queryRawUnsafe<CareerRow[]>(
    `select "athleteId", name, data from public.cached_365_player_career where "langId" = $1`,
    LANG_ID[language] ?? 1,
  );
  const byName = new Map<string, CareerRow[]>();
  for (const row of careerRows) {
    const key = row.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  /*
   * Row/column labels are the provider's own team and competition names, so the
   * ids behind them are recovered from the same payloads: the team id whose
   * name matches the row label, the competition id whose trophy label matches
   * the column label. If a label cannot be resolved that is itself a failure —
   * it would mean the board is showing something the data cannot name.
   */
  const teamIdByLabel = new Map<string, number>();
  const awardIdByLabel = new Map<string, number>();
  const strip = (raw: string): string =>
    raw
      .replace(/^Club\s*\((.*)\)$/, '$1')
      .replace(/^نادي\s*\((.*)\)$/, '$1')
      .replace(/^National team\s*\((.*)\)$/i, '$1')
      .replace(/^منتخب\s*\((.*)\)$/, '$1')
      .trim();

  for (const row of careerRows) {
    for (const season of row.data?.seasons ?? []) {
      for (const competition of season?.competitions ?? []) {
        const teamId = Number(competition?.teamId);
        const raw = String(competition?.teamName ?? '');
        if (!Number.isFinite(teamId) || teamId <= 0 || !raw || raw.includes('&')) continue;
        const label = strip(raw);
        if (label && !teamIdByLabel.has(label)) teamIdByLabel.set(label, teamId);
      }
    }
    for (const trophy of (row.data?.trophies ?? []) as any[]) {
      const competitionId = Number(trophy?.competitionId);
      const label = String(trophy?.displayName ?? trophy?.name ?? '').trim();
      if (!Number.isFinite(competitionId) || competitionId <= 0 || !label) continue;
      if (!awardIdByLabel.has(label)) awardIdByLabel.set(label, competitionId);
    }
  }

  console.log('  CELLS');
  for (const q of questions) {
    const rowLabel = rows[q.gridCell?.row];
    const columnLabel = columns[q.gridCell?.column];
    const teamId = teamIdByLabel.get(rowLabel ?? '');
    const awardId = awardIdByLabel.get(columnLabel ?? '');

    if (teamId == null || awardId == null) {
      check(false, `${q.id}: "${rowLabel}" × "${columnLabel}" resolves to provider ids`);
      continue;
    }

    const correctIds: string[] = (answers as any)[q.id] ?? q.answer?.correctIds ?? [];
    const options: any[] = q.options ?? [];
    const correctOption = options.find((option) => correctIds.includes(option.id));
    if (!correctOption) {
      check(false, `${q.id}: the round names one of its own options as correct`);
      continue;
    }

    const satisfies = (label: string): boolean =>
      (byName.get(label.trim().toLowerCase()) ?? []).some((row) => {
        const facts = factsFor(row);
        return facts.teamIds.has(teamId) && facts.awardIds.has(awardId);
      });

    const answerTrue = satisfies(correctOption.label);
    const wrongOnes = options.filter((option) => option !== correctOption);
    const distractorsFalse = wrongOnes.every((option) => !satisfies(option.label));

    console.log(
      `    ${q.id} r${q.gridCell.row}c${q.gridCell.column}  ${rowLabel} × ${columnLabel}` +
        `  →  ${correctOption.label}`,
    );
    check(answerTrue, `${q.id}: "${correctOption.label}" really played for ${rowLabel} and really won ${columnLabel}`);
    check(
      distractorsFalse,
      `${q.id}: none of the other 3 options satisfies the cell` +
        (distractorsFalse ? '' : ` (${wrongOnes.filter((o) => satisfies(o.label)).map((o) => o.label).join(', ')})`),
    );
  }

  console.log(
    `\n  ${failures.length ? `${failures.length} CHECK(S) FAILED` : 'ALL CHECKS PASSED'}` +
      `  —  distinct players offered across the board: ${allOptionLabels.size}\n`,
  );
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[verify-grid] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
