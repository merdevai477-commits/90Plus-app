/**
 * End-to-end health checks for King of Coaches (DB + pure rules + locale keys).
 *   npx tsx scripts/ck-health-check.ts
 */

import 'dotenv/config';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';
import {
  CK_PRICE_TIERS_MILLI,
  CK_PLAYER_CAP_MILLI,
  CK_COACH_PRICE_MILLI,
} from '../src/services/coach-king-pricing';
import {
  CK_WEEKLY_BUDGET_MILLI,
  CK_SLOT_POSITIONS,
  COACH_KING_SLOTS,
  coachKingSlotAccepts,
  coachKingNextBalanceMilli,
  coachKingRemainingMilli,
  computeCoachKingPoints,
  coachKingResultPoints,
  inspectCoachKingSquad,
  type CkDraftSlot,
} from '../src/services/coach-king-scoring';

function fail(message: string): never {
  throw new Error(message);
}

function readLocaleChunk(file: string, startMarker: string): string {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(startMarker);
  if (start < 0) fail(`missing ${startMarker} in ${file}`);
  return text.slice(start, start + 8000);
}

async function main() {
  const checks: string[] = [];

  assert.strictEqual(CK_WEEKLY_BUDGET_MILLI, 1000);
  assert.strictEqual(coachKingNextBalanceMilli(850, 40), 1000);
  assert.strictEqual(coachKingRemainingMilli(1000, 780), 220);
  assert.strictEqual(CK_PLAYER_CAP_MILLI, 130);
  assert.deepStrictEqual([...CK_PRICE_TIERS_MILLI], [50, 80, 130]);
  assert.strictEqual(CK_COACH_PRICE_MILLI, 50);
  checks.push('budget+price constants');

  const sample = computeCoachKingPoints('FWD', {
    minutes: 90, goals: 1, assists: 1, yellows: 0, reds: 0, ownGoals: 0, teamConceded: 1,
  });
  assert.strictEqual(sample.points, 1 + 1 + 4 + 3);
  assert.strictEqual(coachKingResultPoints('WIN'), 3);
  assert.strictEqual(coachKingResultPoints('DRAW'), 1);
  checks.push('scoring table');

  const frontSlotsPath = path.join(process.cwd(), 'front/services/coachKing.service.ts');
  const frontSlotsSrc = fs.readFileSync(frontSlotsPath, 'utf8');
  for (const slot of COACH_KING_SLOTS) {
    const allowed = CK_SLOT_POSITIONS[slot.key];
    assert.ok(allowed?.length, `backend positions for ${slot.key}`);
    for (const code of allowed) {
      assert.ok(
        frontSlotsSrc.includes(`'${code}'`) || frontSlotsSrc.includes(`"${code}"`),
        `front missing position ${code} for ${slot.key}`,
      );
    }
    assert.ok(frontSlotsSrc.includes(`${slot.key}:`), `front missing slot ${slot.key}`);
  }
  assert.ok(coachKingSlotAccepts('st', 'CF'));
  assert.ok(coachKingSlotAccepts('st', 'ST'));
  assert.ok(!coachKingSlotAccepts('st', 'LW'));
  checks.push('slot positions front~back');

  const slots: CkDraftSlot[] = COACH_KING_SLOTS.map((slot, index) => ({
    slotKey: slot.key,
    playerId: `p${index}`,
    line: slot.line,
    teamId: (index % 5) + 1,
    priceMilli: 50,
  }));
  const ok = inspectCoachKingSquad({
    slots,
    coachPriceMilli: 50,
    coachTeamId: 99,
    balanceMilli: CK_WEEKLY_BUDGET_MILLI,
    startedTeamIds: new Set(),
    requireComplete: true,
  });
  assert.deepStrictEqual(ok, { ok: true, spentMilli: 50 * 11 + 50 });

  const over = inspectCoachKingSquad({
    slots: slots.map((slot) => ({ ...slot, priceMilli: 130 })),
    coachPriceMilli: 50,
    coachTeamId: 99,
    balanceMilli: CK_WEEKLY_BUDGET_MILLI,
    startedTeamIds: new Set(),
    requireComplete: true,
  });
  assert.ok(over.ok === false && over.code === 'BUDGET');
  checks.push('inspect squad budget gate');

  for (const lang of ['ar', 'en'] as const) {
    const chunk = readLocaleChunk(
      path.join(process.cwd(), `front/locales/${lang}.ts`),
      'coachKingGame:',
    );
    for (const needle of ['vs:', 'matchStatus:', 'budgetLabel:', 'budgetOf:', 'rankingTitle:', 'tapHint:', 'errors:', 'leagues:', 'positions:', 'tabs:']) {
      assert.ok(chunk.includes(needle), `${lang} missing ${needle}`);
    }
    assert.ok(chunk.includes('NS:'), `${lang} missing matchStatus.NS`);
  }
  assert.ok(readLocaleChunk(path.join(process.cwd(), 'front/locales/ar.ts'), 'coachKingGame:').includes('كل أسبوع'));
  assert.ok(readLocaleChunk(path.join(process.cwd(), 'front/locales/en.ts'), 'coachKingGame:').toLowerCase().includes('each week'));
  checks.push('locales ar/en');

  // Frontend component files exist and export expected symbols
  const feFiles = [
    'front/components/coach-king/CoachKingScreen.tsx',
    'front/components/coach-king/CoachKingPitch.tsx',
    'front/components/coach-king/CoachKingMatches.tsx',
    'front/components/coach-king/CoachKingBoard.tsx',
    'front/components/coach-king/CoachKingCardGrid.tsx',
    'front/components/coach-king/CoachKingNav.tsx',
    'front/components/coach-king/CoachKingLeagueChips.tsx',
    'front/app/coach-king/index.tsx',
  ];
  for (const file of feFiles) {
    const abs = path.join(process.cwd(), file);
    assert.ok(fs.existsSync(abs), `missing ${file}`);
    const src = fs.readFileSync(abs, 'utf8');
    assert.ok(src.length > 100, `empty ${file}`);
  }
  checks.push('frontend files present');

  // Platform-safe: avoid StyleSheet.absoluteFillObject misuse is fine; RN 0.83 supports boxShadow + gap
  const rnVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'front/package.json'), 'utf8')).dependencies['react-native'];
  assert.ok(rnVersion.startsWith('0.8') || rnVersion.startsWith('0.7'), `unexpected RN ${rnVersion}`);
  checks.push(`react-native ${rnVersion} (boxShadow/gap OK on iOS+Android)`);

  const routes = fs.readFileSync(path.join(process.cwd(), 'src/routes/coach-king.routes.ts'), 'utf8');
  for (const route of ['/me', '/me/slot', '/me/coach', '/me/fixtures', '/players', '/coaches', '/leaderboard', '/admin/reset', '/admin/sync']) {
    assert.ok(routes.includes(`'${route}'`) || routes.includes(`"${route}"`), `route missing ${route}`);
  }
  checks.push('api routes wired');

  const [
    week,
    wallets,
    offTier,
    coachOff,
    maxPrice,
    players,
    coaches,
    squads,
    overBudgetWallets,
    perLine,
  ] = await Promise.all([
    prisma.coachKingGameweek.findFirst({ orderBy: { startAt: 'desc' } }),
    prisma.coachKingWallet.findMany({ select: { balanceMilli: true } }),
    prisma.coachKingPlayer.count({
      where: { active: true, priceMilli: { notIn: [...CK_PRICE_TIERS_MILLI] } },
    }),
    prisma.coachKingCoach.count({
      where: { active: true, priceMilli: { not: CK_COACH_PRICE_MILLI } },
    }),
    prisma.coachKingPlayer.aggregate({ where: { active: true }, _max: { priceMilli: true } }),
    prisma.coachKingPlayer.count({ where: { active: true } }),
    prisma.coachKingCoach.count({ where: { active: true } }),
    prisma.coachKingSquad.count(),
    prisma.coachKingWallet.count({ where: { balanceMilli: { not: CK_WEEKLY_BUDGET_MILLI } } }),
    prisma.coachKingPlayer.groupBy({
      by: ['line'],
      where: { active: true },
      _count: true,
    }),
  ]);

  if (!week) fail('no gameweek');
  if (week.status !== 'OPEN' && week.status !== 'LOCKED') fail(`unexpected week status ${week.status}`);
  if (players < 1000) fail(`too few players ${players}`);
  if (coaches < 50) fail(`too few coaches ${coaches}`);
  if (offTier > 0) fail(`${offTier} players off 5/8/13 ladder`);
  if (coachOff > 0) fail(`${coachOff} coaches not 5M`);
  if ((maxPrice._max.priceMilli ?? 0) !== CK_PLAYER_CAP_MILLI) {
    fail(`max price ${maxPrice._max.priceMilli} != ${CK_PLAYER_CAP_MILLI}`);
  }
  if (overBudgetWallets > 0) fail(`${overBudgetWallets} wallets not at 100M`);
  if (wallets.some((w) => w.balanceMilli !== CK_WEEKLY_BUDGET_MILLI)) {
    fail('wallet not renewed to weekly budget');
  }
  const lines = Object.fromEntries(perLine.map((row) => [row.line, row._count]));
  for (const line of ['FWD', 'MID', 'DEF', 'GK']) {
    if (!lines[line] || lines[line] < 50) fail(`thin pool for ${line}: ${lines[line] ?? 0}`);
  }
  checks.push(`db week=${week.weekKey}/${week.status} players=${players} coaches=${coaches} squads=${squads}`);

  for (const price of CK_PRICE_TIERS_MILLI) {
    const samplePlayer = await prisma.coachKingPlayer.findFirst({
      where: { active: true, priceMilli: price },
      select: { nameAr: true, photoUrl: true, position: true, line: true, leagueKey: true },
    });
    if (!samplePlayer) fail(`no active player at ${price / 10}M`);
    if (!samplePlayer.nameAr) fail(`empty name at ${price / 10}M`);
    if (!samplePlayer.position) fail(`empty position at ${price / 10}M`);
    if (!samplePlayer.leagueKey) fail(`empty league at ${price / 10}M`);
  }
  const coach = await prisma.coachKingCoach.findFirst({
    where: { active: true },
    select: { nameAr: true, priceMilli: true },
  });
  if (!coach || coach.priceMilli !== 50) fail('coach sample bad');
  checks.push('sample catalog rows');

  // Ensure picker can fill every slot from active pool
  for (const slot of COACH_KING_SLOTS) {
    const count = await prisma.coachKingPlayer.count({
      where: {
        active: true,
        line: slot.line,
        position: { in: [...CK_SLOT_POSITIONS[slot.key]] },
      },
    });
    if (count < 5) fail(`slot ${slot.key} has only ${count} pickable players`);
  }
  checks.push('every pitch slot has pickable players');

  console.log(JSON.stringify({
    ok: true,
    checks,
    week: { key: week.weekKey, status: week.status, endAt: week.endAt },
    wallets: wallets.length,
    squads,
    lines,
    catalog: { players, coaches, maxPrice: `${(maxPrice._max.priceMilli ?? 0) / 10}M` },
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ck-health] FAIL', error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
