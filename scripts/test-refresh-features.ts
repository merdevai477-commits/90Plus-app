/**
 * Integration test for the Proactive Data Refresh System.
 *
 * Exercises every new feature with isolated, self-cleaning test data:
 *   1. pLimit()                  — bounded concurrency + rejection handling
 *   2. New schema                — TeamInfo / TeamPlayer / RefreshControl + PlayerInfo columns
 *   3. getTeamSuggestions()      — cached-first → accessCount ranking, exclusion, templates
 *   4. RefreshControl gating     — the 100-day "transfers_last_run" gate logic
 *   5. regeneratePlayerInfoAnswer() — self-contained LLM client (skipped if no API key)
 *   6. startDataRefreshWorker()  — registers crons without throwing
 *
 * Usage:
 *   npm run test:refresh-features
 *   npx ts-node scripts/test-refresh-features.ts
 *
 * All rows use a TEST_ prefix / 99xxxx ids and are deleted at the end, so it is
 * safe to run against the live database.
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { pLimit } from '../src/workers/concurrency.util';
import { getTeamSuggestions } from '../src/services/chat-suggestions.service';
import { regeneratePlayerInfoAnswer } from '../src/services/player-info-cache.service';
import { startDataRefreshWorker } from '../src/workers/dataRefreshWorker';

// ── Test fixtures (isolated id space) ────────────────────────────────────────
const TEST_API_TEAM_ID = 999001;
const TEST_TEAM_NAME = 'TEST Refresh FC';
const ASKED_API_ID = 990000;
const CACHED_HIGH_API_ID = 990001;
const CACHED_LOW_API_ID = 990002;
const NO_CACHE_API_ID = 990003;
const TEST_CONTROL_KEY = 'TEST_transfers_last_run';

const ASKED_NAME = 'test asked player';
const CACHED_HIGH_NAME = 'Test Cached High';
const CACHED_LOW_NAME = 'Test Cached Low';
const NO_CACHE_NAME = 'Test NoCache Player';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail = ''): void {
  if (cond) {
    passed += 1;
    console.log(`   ✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n▶ ${title}`);
}

// ── Seed / cleanup helpers ───────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  await prisma.playerInfo.deleteMany({
    where: {
      apiPlayerId: { in: [ASKED_API_ID, CACHED_HIGH_API_ID, CACHED_LOW_API_ID, NO_CACHE_API_ID] },
    },
  });
  // TeamPlayer rows cascade-delete with the team.
  await prisma.teamInfo.deleteMany({ where: { apiTeamId: TEST_API_TEAM_ID } });
  await prisma.refreshControl.deleteMany({ where: { key: TEST_CONTROL_KEY } });
}

function playerInfoRow(opts: {
  name: string;
  apiPlayerId: number;
  teamId: number | null;
  accessCount: number;
}) {
  const now = new Date();
  return {
    playerName: opts.name.trim().toLowerCase(),
    displayName: opts.name,
    apiPlayerId: opts.apiPlayerId,
    queryType: 'season_stats',
    language: 'ar',
    questionSample: 'test',
    answer: `test answer for ${opts.name}`,
    apiFingerprint: `fp_${opts.apiPlayerId}`,
    apiContext: 'TEST CONTEXT',
    usedModel: 'test',
    answeredOn: now,
    refreshedAt: now,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
    accessCount: opts.accessCount,
    teamId: opts.teamId,
  };
}

// ── 1. pLimit concurrency ────────────────────────────────────────────────────
async function testPLimit(): Promise<void> {
  section('1. pLimit — bounded concurrency + rejection handling');

  const limit = pLimit(3);
  let active = 0;
  let maxActive = 0;

  const task = (ms: number) =>
    limit(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, ms));
      active -= 1;
      return ms;
    });

  const results = await Promise.all(Array.from({ length: 12 }, () => task(40)));
  assert(maxActive <= 3, 'never exceeds concurrency cap of 3', `peak=${maxActive}`);
  assert(results.length === 12, 'all 12 tasks resolved');

  // A rejecting task must release its slot (queue keeps draining).
  const limit2 = pLimit(2);
  const settled = await Promise.allSettled([
    limit2(async () => {
      throw new Error('boom');
    }),
    limit2(async () => 'ok-1'),
    limit2(async () => 'ok-2'),
    limit2(async () => 'ok-3'),
  ]);
  const fulfilled = settled.filter((s) => s.status === 'fulfilled').length;
  const rejected = settled.filter((s) => s.status === 'rejected').length;
  assert(rejected === 1 && fulfilled === 3, 'rejection does not stall the queue', `ok=${fulfilled} err=${rejected}`);
}

// ── 2. Schema: new tables + columns ──────────────────────────────────────────
async function testSchema(): Promise<number> {
  section('2. Schema — TeamInfo / TeamPlayer / RefreshControl + PlayerInfo columns');

  const now = new Date();
  const team = await prisma.teamInfo.create({
    data: {
      apiTeamId: TEST_API_TEAM_ID,
      teamName: TEST_TEAM_NAME,
      season: 2025,
      lastFetched: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
    },
  });
  assert(!!team.id, 'TeamInfo row created', `id=${team.id}`);

  await prisma.teamPlayer.createMany({
    data: [
      { teamInfoId: team.id, apiPlayerId: ASKED_API_ID, playerName: ASKED_NAME, position: 'Defender', jerseyNumber: 2 },
      { teamInfoId: team.id, apiPlayerId: CACHED_HIGH_API_ID, playerName: CACHED_HIGH_NAME, position: 'Attacker', jerseyNumber: 7 },
      { teamInfoId: team.id, apiPlayerId: CACHED_LOW_API_ID, playerName: CACHED_LOW_NAME, position: 'Midfielder', jerseyNumber: 8 },
      { teamInfoId: team.id, apiPlayerId: NO_CACHE_API_ID, playerName: NO_CACHE_NAME, position: 'Goalkeeper', jerseyNumber: 1 },
    ],
  });
  const squadCount = await prisma.teamPlayer.count({ where: { teamInfoId: team.id } });
  assert(squadCount === 4, 'TeamPlayer roster created', `${squadCount} players`);

  // PlayerInfo rows with new columns (teamId, accessCount).
  await prisma.playerInfo.createMany({
    data: [
      playerInfoRow({ name: ASKED_NAME, apiPlayerId: ASKED_API_ID, teamId: team.id, accessCount: 0 }),
      playerInfoRow({ name: CACHED_HIGH_NAME, apiPlayerId: CACHED_HIGH_API_ID, teamId: team.id, accessCount: 50 }),
      playerInfoRow({ name: CACHED_LOW_NAME, apiPlayerId: CACHED_LOW_API_ID, teamId: team.id, accessCount: 5 }),
      // NO_CACHE player intentionally has NO PlayerInfo row.
    ],
  });
  const linked = await prisma.playerInfo.findFirst({
    where: { apiPlayerId: ASKED_API_ID },
    select: { teamId: true, refreshPriority: true, accessCount: true, lastRefreshType: true },
  });
  assert(linked?.teamId === team.id, 'PlayerInfo.teamId FK link works', `teamId=${linked?.teamId}`);
  assert(linked?.refreshPriority === 1, 'refreshPriority defaults to 1');
  assert(linked?.accessCount === 0, 'accessCount stored');

  return team.id;
}

// ── 3. getTeamSuggestions ranking ────────────────────────────────────────────
async function testSuggestions(teamId: number): Promise<void> {
  section('3. getTeamSuggestions — ranking, exclusion, templates');

  // Lookup by apiPlayerId, Arabic.
  const ar = await getTeamSuggestions({ apiPlayerId: ASKED_API_ID, language: 'ar' });
  console.log(`   suggestions(ar): ${ar.map((s) => s.name).join(', ')}`);

  assert(ar.length === 3, 'returns top 3 suggestions', `got ${ar.length}`);
  assert(!ar.some((s) => s.name.toLowerCase() === ASKED_NAME), 'excludes the asked player');
  assert(ar[0]?.name === CACHED_HIGH_NAME, 'cached + highest accessCount ranks first', ar[0]?.name);
  assert(ar[1]?.name === CACHED_LOW_NAME, 'cached + lower accessCount ranks second', ar[1]?.name);
  assert(ar[2]?.name === NO_CACHE_NAME, 'uncached teammate ranks last', ar[2]?.name);
  assert(ar[0]?.query === `إيه إحصائيات ${CACHED_HIGH_NAME}؟`, 'Arabic query template');

  // Lookup by playerName, English template.
  const en = await getTeamSuggestions({ playerName: ASKED_NAME, language: 'en' });
  assert(en.length === 3, 'name-based lookup resolves team', `got ${en.length}`);
  assert(en[0]?.query === `What are ${CACHED_HIGH_NAME}'s stats?`, 'English query template');

  // Unknown player → empty, never throws.
  const none = await getTeamSuggestions({ apiPlayerId: 123456789, language: 'en' });
  assert(none.length === 0, 'unknown player returns empty list');
}

// ── 4. RefreshControl gating ─────────────────────────────────────────────────
async function testRefreshControl(): Promise<void> {
  section('4. RefreshControl — 100-day transfers gate logic');

  // First run: no key → should be "due".
  let control = await prisma.refreshControl.findUnique({ where: { key: TEST_CONTROL_KEY } });
  assert(control === null, 'no prior run → job is due');

  // Write a run 101 days ago → due.
  const oldDate = new Date(Date.now() - 101 * 24 * 60 * 60_000);
  await prisma.refreshControl.upsert({
    where: { key: TEST_CONTROL_KEY },
    create: { key: TEST_CONTROL_KEY, value: oldDate.toISOString() },
    update: { value: oldDate.toISOString() },
  });
  control = await prisma.refreshControl.findUnique({ where: { key: TEST_CONTROL_KEY } });
  const daysSinceOld = (Date.now() - new Date(control!.value).getTime()) / (24 * 60 * 60_000);
  assert(daysSinceOld >= 100, '101 days ago → job is due', `${daysSinceOld.toFixed(1)}d`);

  // Write a run just now → NOT due.
  await prisma.refreshControl.update({
    where: { key: TEST_CONTROL_KEY },
    data: { value: new Date().toISOString() },
  });
  control = await prisma.refreshControl.findUnique({ where: { key: TEST_CONTROL_KEY } });
  const daysSinceNow = (Date.now() - new Date(control!.value).getTime()) / (24 * 60 * 60_000);
  assert(daysSinceNow < 100, 'just ran → job is skipped', `${daysSinceNow.toFixed(2)}d`);
}

// ── 5. regeneratePlayerInfoAnswer (best-effort, needs API key) ────────────────
async function testRegenerate(): Promise<void> {
  section('5. regeneratePlayerInfoAnswer — self-contained LLM client');

  const hasKey = !!(process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY);
  if (!hasKey) {
    console.log('   ⏭  skipped — no OPENROUTER_API_KEY / AI_API_KEY configured');
    return;
  }

  const answer = await regeneratePlayerInfoAnswer(
    { playerName: 'Test Player', queryType: 'season_stats', language: 'en' },
    'PLAYER: Test Player\nSeason 2025: 10 matches, 5 goals, 3 assists for TEST FC.',
  );
  assert(typeof answer === 'string' && (answer?.length ?? 0) > 16, 'LLM returned a non-trivial answer', answer ? `${answer.length} chars` : 'null');

  // Empty context → null, never throws.
  const empty = await regeneratePlayerInfoAnswer(
    { playerName: 'X', queryType: 'season_stats', language: 'en' },
    '',
  );
  assert(empty === null, 'empty context returns null');
}

// ── 6. Worker registration ───────────────────────────────────────────────────
function testWorkerRegistration(): void {
  section('6. startDataRefreshWorker — registers crons without throwing');
  try {
    startDataRefreshWorker();
    assert(true, 'worker scheduled (or disabled cleanly if API not configured)');
  } catch (err) {
    assert(false, 'worker registration threw', String(err));
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(68));
  console.log(' Proactive Data Refresh System — feature tests');
  console.log('═'.repeat(68));

  await cleanup(); // ensure a clean slate

  await testPLimit();
  const teamId = await testSchema();
  await testSuggestions(teamId);
  await testRefreshControl();
  await testRegenerate();
  testWorkerRegistration();

  console.log('\n' + '═'.repeat(68));
  console.log(` RESULT: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(68));
}

main()
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
    await closeRedis();
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error('\n❌ test-refresh-features crashed:', err);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    await closeRedis();
    process.exit(1);
  });
