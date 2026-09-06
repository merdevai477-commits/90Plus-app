/**
 * Share & Win — end-to-end verification against a real database.
 *
 * The unit suite (src/services/__tests__/share-win.service.test.ts) mocks
 * Prisma, so it cannot reach the two raw SQL statements this feature depends
 * on: the row-comparison rank query and the ROW_NUMBER() cycle close. Those are
 * exactly where the subtle bugs live — a timestamptz/timestamp mismatch here
 * silently collapsed the tie-break without erroring.
 *
 * Run against a dev or staging database — NEVER production. It creates and
 * deletes users prefixed `swe2e_`, and drops the current week's cycle:
 *
 *     npm run verify:share-win
 */

import prisma from '../src/lib/prisma';

import {
  claimReferral,
  closeCycle,
  ensureCurrentCycle,
  ensureReferralCode,
  getCycleHistory,
  getLastWinner,
  getLeaderboard,
  getShareWinOverview,
  recordShare,
} from '../src/services/share-win.service';

const TAG = 'swe2e';

/**
 * The whole run happens in a far-future week. Every service call takes an
 * injectable `now`, so verification gets a cycle of its own and never competes
 * with seeded or live standings.
 */
const NOW = new Date(Date.now() + 180 * 86_400_000);
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

async function makeUser(name: string, createdAt?: Date) {
  // Default to "just registered" relative to the simulated clock.
  return prisma.user.create({
    data: {
      email: `${TAG}-${name}@example.test`,
      username: `${TAG}_${name}`,
      displayName: name,
      createdAt: createdAt ?? new Date(NOW.getTime() - 60_000),
    },
    select: { id: true, username: true },
  });
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: `${TAG}_` } } });
  await prisma.shareWinCycle.deleteMany({ where: { weekKey: { startsWith: 'TEST-' } } });
  const { isoWeekKey } = require('../src/services/share-win.service');
  await prisma.shareWinCycle.deleteMany({ where: { weekKey: isoWeekKey(NOW) } });
  // The live cycle is deliberately left in place — dropping it would cascade
  // away seeded and real standings. ensureCurrentCycle() reopens the week if a
  // previous run closed it, so re-running this script is safe without it.
}

async function main() {
  await cleanup();

  const cycle = await ensureCurrentCycle(NOW);
  console.log(`\ncycle ${cycle.weekKey}  ${cycle.startAt.toISOString()} → ${cycle.endAt.toISOString()}\n`);

  const mohamed = await makeUser('mohamed');
  const ahmed = await makeUser('ahmed');
  const ali = await makeUser('ali');
  const veteran = await makeUser('veteran', new Date(NOW.getTime() - 30 * 86_400_000));

  // ── Referral identity ────────────────────────────────────────────────────
  const code = await ensureReferralCode(mohamed.id);
  check('code is stable across calls', await ensureReferralCode(mohamed.id), code);
  check('code shape', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code), true);

  const ahmedCode = await ensureReferralCode(ahmed.id);
  check('codes are distinct per user', ahmedCode !== code, true);

  // ── Guard rails ──────────────────────────────────────────────────────────
  check('self-referral rejected', (await claimReferral(mohamed.id, code, NOW)).reason, 'self_referral');
  check('existing user rejected', (await claimReferral(veteran.id, code, NOW)).reason, 'not_a_new_user');
  check('unknown code rejected', (await claimReferral(ali.id, 'ZZZZZZ', NOW)).reason, 'unknown_code');

  // ── Real conversions ─────────────────────────────────────────────────────
  check('ali converts', (await claimReferral(ali.id, code, NOW)).attributed, true);
  check('ali cannot convert twice', (await claimReferral(ali.id, code, NOW)).reason, 'already_attributed');
  check('ali cannot switch referrer', (await claimReferral(ali.id, ahmedCode, NOW)).reason, 'already_attributed');

  const referred: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const u = await makeUser(`ref${i}`);
    referred.push(u.id);
    await claimReferral(u.id, code, NOW); // → mohamed: 5 participants total
  }
  const ahmedRef = await makeUser('aref0');
  await claimReferral(ahmedRef.id, ahmedCode, NOW); // → ahmed: 1 participant

  // ── Shares (throttle bypassed by advancing the clock) ────────────────────
  for (let i = 0; i < 3; i += 1) {
    await recordShare(mohamed.id, 'whatsapp', new Date(NOW.getTime() + i * 5000));
  }
  const shareRes = await recordShare(mohamed.id, 'whatsapp', new Date(NOW.getTime() + 20_000));
  check('4th share counted', shareRes.counted, true);
  check('share count persisted', shareRes.shareCount, 4);
  check('throttle rejects an immediate repeat', (await recordShare(mohamed.id, 'whatsapp', new Date(NOW.getTime() + 20_100))).counted, false);

  // ── Score + rank (raw SQL path) ──────────────────────────────────────────
  const mo = await getShareWinOverview(mohamed.id, { now: NOW });
  check('mohamed participants', mo.participants, 5);
  check('mohamed shares', mo.shareCount, 4);
  check('mohamed score = participants×3 (shares do not add points)', mo.score, 15);
  check('mohamed rank', mo.rank, 1);
  check('referral link', mo.referralLink.endsWith(`/invite/${code}`), true);

  const ah = await getShareWinOverview(ahmed.id, { now: NOW });
  check('ahmed participants', ah.participants, 1);
  check('ahmed rank', ah.rank, 2);

  // A user with no activity at all still gets a valid payload + tail rank.
  const ghost = await makeUser('ghost');
  const gh = await getShareWinOverview(ghost.id, { now: NOW });
  check('zero-state participants', gh.participants, 0);
  check('zero-state score', gh.score, 0);
  check('zero-state rank is the tail, not 0/NaN', gh.rank, 3);
  check('zero-state still gets a code', /^[A-Z2-9]{6}$/.test(gh.referralCode), true);
  check('zero-state prizes present', gh.prizes.length, 4);

  const moStanding = await prisma.shareWinStanding.findFirstOrThrow({ where: { cycleId: cycle.id, userId: mohamed.id } });
  check('firstScoredAt is stamped by syncStanding', moStanding.firstScoredAt !== null, true);

  const board = await getLeaderboard(cycle.id, 10);
  check('board order by confirmed shares, not link visits', board.map((r) => r.shares), [4, 0]);
  check('visits do not outrank shares', board.map((r) => r.participants), [5, 1]);
  check('board ranks are 1..n', board.map((r) => r.rank), [1, 2]);

  // ── Tie-break: same share count, earlier confirmed share wins ─────────────
  const tieA = await makeUser('tieA');
  const tieB = await makeUser('tieB');
  await recordShare(tieA.id, 'whatsapp', new Date(NOW.getTime() + 40_000));
  await recordShare(tieB.id, 'whatsapp', new Date(NOW.getTime() + 41_200));

  const rankA = (await getShareWinOverview(tieA.id, { now: NOW })).rank;
  const rankB = (await getShareWinOverview(tieB.id, { now: NOW })).rank;
  const rankAhmed = (await getShareWinOverview(ahmed.id, { now: NOW })).rank;
  check('share count outranks a later visit-only standing', [rankA, rankB, rankAhmed], [2, 3, 4]);
  check('earlier confirmed share ranks higher on a tie', rankA < rankB, true);
  const boardRanks = (await getLeaderboard(cycle.id, 10)).map((r) => r.rank);
  check('leaderboard ranks match per-user ranks', boardRanks, [1, 2, 3, 4]);
  check('rank is stable across repeated reads', (await getShareWinOverview(tieA.id, { now: NOW })).rank, rankA);

  // ── Close the cycle → history preserved ──────────────────────────────────
  await closeCycle(cycle.id, NOW);
  const closed = await prisma.shareWinCycle.findUniqueOrThrow({ where: { id: cycle.id } });
  check('cycle marked COMPLETED', closed.status, 'COMPLETED');

  const winnerRow = await prisma.shareWinStanding.findFirst({
    where: { cycleId: cycle.id, finalRank: 1 },
    select: { userId: true, participantCount: true, score: true },
  });
  check('final rank 1 is mohamed', winnerRow?.userId, mohamed.id);
  check('winner participants archived', winnerRow?.participantCount, 5);
  check('winner score archived', winnerRow?.score, 15);

  const lastWinner = await getLastWinner();
  check('getLastWinner resolves', lastWinner?.username, mohamed.username);
  check('winner rank archived', lastWinner?.rank, 1);

  // ── Week 2 does not overwrite week 1 ─────────────────────────────────────
  const week2 = await prisma.shareWinCycle.create({
    data: {
      weekKey: 'TEST-W99',
      startAt: new Date(Date.now() + 7 * 86_400_000),
      endAt: new Date(Date.now() + 14 * 86_400_000),
      status: 'ACTIVE',
    },
  });
  await prisma.shareWinStanding.create({
    data: { cycleId: week2.id, userId: ahmed.id, participantCount: 30, score: 1500 },
  });

  const w1 = await prisma.shareWinStanding.findFirstOrThrow({
    where: { cycleId: cycle.id, userId: mohamed.id },
  });
  check('week 1 result untouched after week 2 writes', [w1.participantCount, w1.finalRank], [5, 1]);

  const w2Board = await getLeaderboard(week2.id, 5);
  check('week 2 has its own leaderboard', w2Board[0]?.participants, 30);

  const history = await getCycleHistory(10);
  check('history keeps both cycles', history.length >= 2, true);
  const archived = history.find((c) => c.id === cycle.id);
  check('history exposes week 1 winner', archived?.winner?.username, mohamed.username);
  check('history winner participants', archived?.winner?.participants, 5);

  await cleanup();
  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('E2E crashed:', err);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
