/**
 * End-to-end cycle + link probe against the dev DB.
 * Covers the bugs fixed in this pass plus relational integrity.
 * Creates only E2E_PROBE-tagged rows and removes them at the end.
 */
import { PrismaClient } from '@prisma/client';
import {
  submitPrediction,
  listCompetitionEntries,
  listCompetitions,
  getCompetition,
} from './src/services/competitions.service';
import { CompetitionResolverService, gradeEntries } from './src/services/competition-resolver.service';
import { calendarDayBounds, calendarTodayKey } from './src/utils/calendar-day-bounds.util';

const prisma = new PrismaClient();
const TAG = 'E2E_PROBE';
let pass = 0, fail = 0;
const check = (n: string, ok: boolean, d = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`);
};

async function cleanup() {
  const comps = await prisma.competition.findMany({
    where: { prizeName: { startsWith: TAG } }, select: { id: true },
  });
  const ids = comps.map((c) => c.id);
  if (ids.length) {
    await prisma.competitionEntry.deleteMany({ where: { competitionId: { in: ids } } });
    await prisma.competition.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.sponsor.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.notification.deleteMany({ where: { message: { contains: TAG } } });
}


/** Pages through a list so a row is not missed just because it fell off page 1. */
async function inList(opts: any, id: string): Promise<boolean> {
  let cursor: string | undefined;
  for (let page = 0; page < 25; page++) {
    const res: any = await listCompetitions({ ...opts, limit: 50, cursor });
    if (res.items.some((i: any) => i.id === id)) return true;
    if (!res.nextCursor) return false;
    cursor = res.nextCursor;
  }
  return false;
}

let matchSeq = 998000000;
async function makeCompetition(overrides: any = {}) {
  const category = await prisma.prizeCategory.findFirstOrThrow({ where: { isActive: true } });
  const sponsor = await prisma.sponsor.create({
    data: { name: TAG + '_s' + Math.random().toString(36).slice(2, 7), isVerified: true },
  });
  const apiMatchId = ++matchSeq;
  const comp = await prisma.competition.create({
    data: {
      sponsorId: sponsor.id, categoryId: category.id,
      prizeName: TAG + '_prize', prizeType: 'test', winnersCount: 2,
      apiMatchId, homeTeam: 'H', awayTeam: 'A',
      matchDate: new Date(Date.now() + 7200_000),
      predictionDeadline: new Date(Date.now() + 3600_000),
      predictionMode: 'EXACT_SCORE', status: 'PUBLISHED', publishedAt: new Date(),
      ...overrides,
    },
  });
  return { comp, sponsor, apiMatchId, categoryId: category.id };
}

async function main() {
  await cleanup();
  const users = await prisma.user.findMany({ take: 5, select: { id: true } });
  if (users.length < 4) throw new Error('need >=4 users');

  // ── regression: admin entries query used a non-existent User field ──────
  console.log('\n[R1] admin entries listing (regression: Unknown field `name`)');
  const { comp: c1 } = await makeCompetition();
  await submitPrediction(users[0].id, c1.id, { predictedHomeScore: 1, predictedAwayScore: 0 });
  try {
    const entries = await listCompetitionEntries(c1.id);
    check('listCompetitionEntries does not throw', true, `${entries.length} entry`);
    check('entry exposes a display name field', 'displayName' in (entries[0] as any).user);
    const winners = await listCompetitionEntries(c1.id, true);
    check('winners-only filter works pre-settlement', winners.length === 0);
  } catch (e: any) {
    check('listCompetitionEntries does not throw', false, e.message.split('\n')[0]);
  }

  // ── regression: WINNER mode must be winnable on a draw ─────────────────
  console.log('\n[R2] WINNER mode on a drawn match');
  const { comp: c2, apiMatchId: m2 } = await makeCompetition({
    predictionMode: 'WINNER', winnersCount: 2,
  });
  await submitPrediction(users[0].id, c2.id, { predictedWinner: 'draw' });
  await submitPrediction(users[1].id, c2.id, { predictedWinner: 'home' });
  await submitPrediction(users[2].id, c2.id, { predictedWinner: 'draw' });
  await CompetitionResolverService.resolveMatchCompetitions(m2, 1, 1);
  const e2 = await prisma.competitionEntry.findMany({
    where: { competitionId: c2.id }, select: { userId: true, isCorrect: true, isWinner: true },
  });
  check('draw predictors win a 1-1 match',
    e2.filter((e) => e.isWinner).length === 2, 'winners=' + e2.filter((e) => e.isWinner).length);
  check('home predictor loses a draw',
    e2.find((e) => e.userId === users[1].id)?.isCorrect === false);

  // ── duplicate prediction / edit semantics ──────────────────────────────
  console.log('\n[R3] duplicate + edit semantics');
  const { comp: c3 } = await makeCompetition();
  await submitPrediction(users[0].id, c3.id, { predictedHomeScore: 1, predictedAwayScore: 0 });
  await submitPrediction(users[0].id, c3.id, { predictedHomeScore: 3, predictedAwayScore: 2 });
  const rows3 = await prisma.competitionEntry.findMany({ where: { competitionId: c3.id } });
  const comp3 = await prisma.competition.findUniqueOrThrow({ where: { id: c3.id } });
  check('re-submitting edits rather than duplicating', rows3.length === 1);
  check('edit persisted', rows3[0].predictedHomeScore === 3 && rows3[0].predictedAwayScore === 2);
  check('participantsCount unchanged by edit', comp3.participantsCount === 1, String(comp3.participantsCount));

  // ── link integrity ─────────────────────────────────────────────────────
  console.log('\n[R4] link integrity (competition ↔ sponsor ↔ category ↔ entries)');
  const { comp: c4, sponsor: s4, categoryId } = await makeCompetition();
  await submitPrediction(users[0].id, c4.id, { predictedHomeScore: 0, predictedAwayScore: 0 });
  await prisma.competition.create({
    data: {
      sponsorId: s4.id, categoryId, prizeName: TAG + '_prize2', prizeType: 't', winnersCount: 1,
      apiMatchId: ++matchSeq, homeTeam: 'H', awayTeam: 'A',
      matchDate: new Date(Date.now() + 7200_000),
      predictionDeadline: new Date(Date.now() + 3600_000), status: 'DRAFT',
    },
  }).catch(() => undefined);

  await prisma.competition.create({
    data: {
      sponsorId: s4.id, categoryId: '00000000-0000-0000-0000-000000000000',
      prizeName: TAG + '_bad', prizeType: 't', winnersCount: 1,
      apiMatchId: ++matchSeq, homeTeam: 'H', awayTeam: 'A',
      matchDate: new Date(), predictionDeadline: new Date(), status: 'DRAFT',
    },
  }).then(() => check('FK rejects unknown category', false, 'INSERT SUCCEEDED'))
    .catch(() => check('FK rejects unknown category', true));

  await prisma.sponsor.delete({ where: { id: s4.id } });
  const orphanComps = await prisma.competition.count({ where: { sponsorId: s4.id } });
  const orphanEntries = await prisma.competitionEntry.count({ where: { competitionId: c4.id } });
  check('deleting a sponsor cascades its competitions', orphanComps === 0);
  check('cascade also removes their entries', orphanEntries === 0);

  // ── duplicate winner ranks are impossible ──────────────────────────────
  console.log('\n[R5] duplicate winner rank constraint');
  const { comp: c5 } = await makeCompetition({ winnersCount: 2 });
  const a = await prisma.competitionEntry.create({
    data: { competitionId: c5.id, userId: users[0].id, predictedHomeScore: 1, predictedAwayScore: 0, rank: 1, isWinner: true },
  });
  await prisma.competitionEntry.create({
    data: { competitionId: c5.id, userId: users[1].id, predictedHomeScore: 1, predictedAwayScore: 0, rank: 1, isWinner: true },
  }).then(() => check('DB rejects a duplicate winning rank', false, 'INSERT SUCCEEDED'))
    .catch((e) => check('DB rejects a duplicate winning rank', e.code === 'P2002', e.code));
  await prisma.competitionEntry.create({
    data: { competitionId: c5.id, userId: users[2].id, predictedHomeScore: 9, predictedAwayScore: 9 },
  }).then(() => check('multiple non-winners (null rank) allowed', true))
    .catch((e) => check('multiple non-winners (null rank) allowed', false, e.code));
  void a;

  // ── re-settlement notifies again ───────────────────────────────────────
  console.log('\n[R6] corrected result re-notifies');
  const { comp: c6, apiMatchId: m6 } = await makeCompetition({ winnersCount: 1 });
  await submitPrediction(users[0].id, c6.id, { predictedHomeScore: 1, predictedAwayScore: 0 });
  await submitPrediction(users[1].id, c6.id, { predictedHomeScore: 2, predictedAwayScore: 2 });
  await CompetitionResolverService.resolveMatchCompetitions(m6, 1, 0);
  const notifAfterFirst = await prisma.notification.count({ where: { message: { contains: TAG } } });
  await CompetitionResolverService.resettleCompetition(c6.id, 2, 2);
  const notifAfterResettle = await prisma.notification.count({ where: { message: { contains: TAG } } });
  check('re-settlement emits fresh notifications',
    notifAfterResettle > notifAfterFirst, `${notifAfterFirst} → ${notifAfterResettle}`);
  const e6 = await prisma.competitionEntry.findMany({ where: { competitionId: c6.id } });
  check('winner moved to the newly-correct entry',
    e6.find((e) => e.userId === users[1].id)?.isWinner === true &&
    e6.find((e) => e.userId === users[0].id)?.isWinner === false);
  check('exactly one winner after correction', e6.filter((e) => e.isWinner).length === 1);

  // ── settled competition still readable, entry blocked ──────────────────
  console.log('\n[R7] post-settlement read/write');
  const detail = await getCompetition(c6.id, users[0].id);
  check('settled competition still publicly readable', detail.status === 'SETTLED');
  check('caller sees their own entry', detail.myEntry?.userId === users[0].id);
  check('official result exposed', detail.resultHomeScore === 2 && detail.resultAwayScore === 2);
  await submitPrediction(users[3].id, c6.id, { predictedHomeScore: 0, predictedAwayScore: 0 })
    .then(() => check('entry rejected after settlement', false, 'ACCEPTED'))
    .catch((e) => check('entry rejected after settlement', e.message === 'COMPETITION_NOT_OPEN', e.message));

  // ── pagination stability ───────────────────────────────────────────────
  console.log('\n[R8] pagination');
  const page1 = await listCompetitions({ userId: null, tab: 'all', limit: 2 });
  check('respects limit', page1.items.length <= 2, 'got ' + page1.items.length);
  if (page1.nextCursor) {
    const page2 = await listCompetitions({ userId: null, tab: 'all', limit: 2, cursor: page1.nextCursor });
    const overlap = page2.items.filter((i: any) => page1.items.some((j: any) => j.id === i.id));
    check('page 2 does not repeat page 1', overlap.length === 0, overlap.length + ' overlapping');
  } else {
    check('page 2 does not repeat page 1', true, 'single page');
  }
  const over = await listCompetitions({ userId: null, tab: 'all', limit: 9999 });
  check('limit is clamped', over.items.length <= 50);

  // ── grading purity: draw in WINNER mode ────────────────────────────────
  console.log('\n[R9] grading rule spot-check');
  const g = gradeEntries(
    [{ id: 'a', userId: 'u', predictedHomeScore: null, predictedAwayScore: null, predictedWinner: 'draw', createdAt: new Date() }],
    { mode: 'WINNER', homeScore: 0, awayScore: 0, winnersCount: 1 },
  );
  check('0-0 counts as a draw', g[0].isCorrect === true && g[0].rank === 1);


  // ── deadline boundaries ────────────────────────────────────────────────
  console.log('\n[R10] deadline + kickoff boundaries');
  {
    // Comfortably open.
    const { comp: open } = await makeCompetition();
    await submitPrediction(users[0].id, open.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('accepted well before the deadline', true))
      .catch((e) => check('accepted well before the deadline', false, e.message));

    // One millisecond after the deadline.
    const { comp: past } = await makeCompetition({
      predictionDeadline: new Date(Date.now() - 1),
      matchDate: new Date(Date.now() + 3600_000),
    });
    await submitPrediction(users[0].id, past.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('rejected 1ms after the deadline', false, 'ACCEPTED'))
      .catch((e) => check('rejected 1ms after the deadline', e.message === 'DEADLINE_PASSED', e.message));

    // Exactly at the deadline — the gate is `now >= deadline`, so the instant
    // itself is closed. Pinning this stops a later refactor flipping it to `>`.
    const at = new Date(Date.now() + 250);
    const { comp: exact } = await makeCompetition({
      predictionDeadline: at,
      matchDate: new Date(Date.now() + 3600_000),
    });
    await new Promise((r) => setTimeout(r, 300));
    await submitPrediction(users[0].id, exact.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('closed at the deadline instant itself', false, 'ACCEPTED'))
      .catch((e) => check('closed at the deadline instant itself', e.message === 'DEADLINE_PASSED', e.message));

    // Deadline mistakenly set after kickoff: the kickoff gate must still hold,
    // otherwise someone predicts a match already in play.
    const { comp: started } = await makeCompetition({
      predictionDeadline: new Date(Date.now() + 3600_000),
      matchDate: new Date(Date.now() - 60_000),
    });
    await submitPrediction(users[0].id, started.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('rejected once the match has kicked off', false, 'ACCEPTED'))
      .catch((e) => check('rejected once the match has kicked off', e.message === 'MATCH_STARTED', e.message));
  }

  // ── concurrent double submit ───────────────────────────────────────────
  console.log('\n[R11] concurrent submits by the same user');
  {
    const { comp } = await makeCompetition();
    const results = await Promise.allSettled([
      submitPrediction(users[0].id, comp.id, { predictedHomeScore: 1, predictedAwayScore: 0 }),
      submitPrediction(users[0].id, comp.id, { predictedHomeScore: 2, predictedAwayScore: 0 }),
      submitPrediction(users[0].id, comp.id, { predictedHomeScore: 3, predictedAwayScore: 0 }),
    ]);
    const rows = await prisma.competitionEntry.count({ where: { competitionId: comp.id } });
    const fresh = await prisma.competition.findUniqueOrThrow({ where: { id: comp.id } });
    check('three racing submits create exactly one entry', rows === 1, String(rows));
    check('participantsCount counts the user once', fresh.participantsCount === 1, String(fresh.participantsCount));
    check('no submit failed outright', results.every((r) => r.status === 'fulfilled'),
      results.filter((r) => r.status === 'rejected').map((r: any) => r.reason?.message).join(','));
  }

  // ── concurrent settlement ──────────────────────────────────────────────
  console.log('\n[R12] concurrent settlement of the same match');
  {
    const { comp, apiMatchId } = await makeCompetition({ winnersCount: 2 });
    await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 2, predictedAwayScore: 1 });
    await submitPrediction(users[1].id, comp.id, { predictedHomeScore: 2, predictedAwayScore: 1 });
    await submitPrediction(users[2].id, comp.id, { predictedHomeScore: 2, predictedAwayScore: 1 });
    await Promise.all([
      CompetitionResolverService.resolveMatchCompetitions(apiMatchId, 2, 1, 'AET'),
      CompetitionResolverService.resolveMatchCompetitions(apiMatchId, 2, 1, 'AET'),
    ]);
    const rows = await prisma.competitionEntry.findMany({ where: { competitionId: comp.id } });
    const ranks = rows.map((r) => r.rank).filter((r): r is number => r != null).sort();
    const settled = await prisma.competition.findUniqueOrThrow({ where: { id: comp.id } });
    check('winners capped at winnersCount under a settlement race', ranks.length === 2, 'ranks=' + ranks.join(','));
    check('ranks are 1..N with no duplicates', JSON.stringify(ranks) === '[1,2]', ranks.join(','));
    check('every entry was graded', rows.every((r) => r.isCorrect !== null));
    check('the real finished status is stamped, not a hardcoded FT',
      settled.matchStatus === 'AET', String(settled.matchStatus));
  }

  // ── cancelled competitions stay reachable by their entrants ────────────
  console.log('\n[R13] cancelled competition visibility');
  {
    const { comp, apiMatchId } = await makeCompetition();
    await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 0, predictedAwayScore: 0 });
    await CompetitionResolverService.cancelForAbandonedMatch(apiMatchId, 'PST');
    const after = await prisma.competition.findUniqueOrThrow({ where: { id: comp.id } });
    check('a postponed match cancels the competition', after.status === 'CANCELLED', after.status);
    check('matchStatus records why', after.matchStatus === 'PST', String(after.matchStatus));

    await getCompetition(comp.id, users[0].id)
      .then((d: any) => check('an entrant can still open it (sees "أُلغيت المسابقة")',
        d.status === 'CANCELLED' && d.myEntry != null))
      .catch((e) => check('an entrant can still open it (sees "أُلغيت المسابقة")', false, e.message));

    await submitPrediction(users[1].id, comp.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('but entry is closed', false, 'ACCEPTED'))
      .catch((e) => check('but entry is closed', e.message === 'COMPETITION_NOT_OPEN', e.message));

    check('it is gone from the browse list', !(await inList({ tab: 'all' }, comp.id)));
    check('it survives in "تحدياتي"', await inList({ tab: 'mine', userId: users[0].id }, comp.id));
  }

  // ── admin kill-switch ──────────────────────────────────────────────────
  console.log('\n[R14] disabled sponsor');
  {
    const { comp, sponsor } = await makeCompetition();
    check('listed while the sponsor is active', await inList({ tab: 'all' }, comp.id));
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { isActive: false } });
    check('delisted once the sponsor is disabled', !(await inList({ tab: 'all' }, comp.id)));
    await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('entry blocked for a disabled sponsor', false, 'ACCEPTED'))
      .catch((e) => check('entry blocked for a disabled sponsor', e.message === 'COMPETITION_NOT_OPEN', e.message));
  }

  // ── "تحديات اليوم" is the app calendar day, not the server's ───────────
  console.log('\n[R15] Today tab day boundary');
  {
    const { start, end } = calendarDayBounds(calendarTodayKey());
    // 00:30 in the app timezone — on a UTC host this instant belongs to
    // *yesterday* by server-local reckoning, which is exactly the case the
    // old `new Date().setHours(0,0,0,0)` bounds got wrong.
    const justAfterMidnight = new Date(start.getTime() + 30 * 60_000);
    const { comp: early } = await makeCompetition({
      matchDate: justAfterMidnight,
      predictionDeadline: new Date(Math.min(justAfterMidnight.getTime() - 1000, Date.now() + 60_000)),
    });
    check('a 00:30 app-time kickoff is in Today', await inList({ tab: 'today' }, early.id));

    // 23:30 the same app day — the far edge of the window.
    const lateKickoff = new Date(end.getTime() - 30 * 60_000);
    const { comp: late } = await makeCompetition({
      matchDate: lateKickoff,
      predictionDeadline: new Date(lateKickoff.getTime() - 1000),
    });
    check('a 23:30 app-time kickoff is in Today', await inList({ tab: 'today' }, late.id));

    // One minute into tomorrow must fall out.
    const tomorrow = new Date(end.getTime() + 60_000);
    const { comp: next } = await makeCompetition({
      matchDate: tomorrow,
      predictionDeadline: new Date(tomorrow.getTime() - 1000),
    });
    check('tomorrow is not in Today', !(await inList({ tab: 'today' }, next.id)));
    check('but tomorrow is still in All', await inList({ tab: 'all' }, next.id));
  }

  // ── per-user isolation ─────────────────────────────────────────────────
  console.log('\n[R16] "تحدياتي" isolation and myEntry scoping');
  {
    const { comp } = await makeCompetition();
    await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 4, predictedAwayScore: 4 });
    check('the entrant sees it in their list', await inList({ tab: 'mine', userId: users[0].id }, comp.id));
    check('another user does not', !(await inList({ tab: 'mine', userId: users[1].id }, comp.id)));

    const mine = await getCompetition(comp.id, users[0].id);
    const theirs = await getCompetition(comp.id, users[1].id);
    const anon = await getCompetition(comp.id, null);
    check('myEntry is the caller\'s own entry', (mine as any).myEntry?.predictedHomeScore === 4);
    check('myEntry is null for a non-entrant', (theirs as any).myEntry === null);
    check('myEntry is null for an anonymous reader', (anon as any).myEntry === null);
    check('"تحدياتي" without a session is refused, not silently empty',
      await listCompetitions({ userId: null, tab: 'mine' })
        .then(() => false)
        .catch((e) => e.message === 'AUTH_REQUIRED'));
  }

  // ── locking closes entry even before the watcher settles ───────────────
  console.log('\n[R17] deadline lock');
  {
    const { comp } = await makeCompetition({
      predictionDeadline: new Date(Date.now() - 1000),
      matchDate: new Date(Date.now() + 3600_000),
    });
    await CompetitionResolverService.lockExpiredCompetitions();
    const locked = await prisma.competition.findUniqueOrThrow({ where: { id: comp.id } });
    check('an expired competition is moved to LOCKED', locked.status === 'LOCKED', locked.status);
    await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('a LOCKED competition refuses entry', false, 'ACCEPTED'))
      .catch((e) => check('a LOCKED competition refuses entry', e.message === 'COMPETITION_NOT_OPEN', e.message));
    check('but it is still readable', (await getCompetition(comp.id, users[0].id)).status === 'LOCKED');
  }

  // ── malformed / missing input ──────────────────────────────────────────
  console.log('\n[R18] malformed prediction input');
  {
    const { comp: exact } = await makeCompetition();
    const bad = [
      ['no scores at all', {}],
      ['negative score', { predictedHomeScore: -1, predictedAwayScore: 0 }],
      ['fractional score', { predictedHomeScore: 1.5, predictedAwayScore: 0 }],
      ['string score', { predictedHomeScore: '2' as any, predictedAwayScore: 0 }],
      ['NaN score', { predictedHomeScore: Number.NaN, predictedAwayScore: 0 }],
      ['winner sent in EXACT_SCORE mode', { predictedWinner: 'home' as const }],
    ] as const;
    for (const [name, input] of bad) {
      await submitPrediction(users[0].id, exact.id, input as any)
        .then(() => check(`rejects ${name}`, false, 'ACCEPTED'))
        .catch((e) => check(`rejects ${name}`, e.message === 'INVALID_PREDICTION', e.message));
    }

    const { comp: winner } = await makeCompetition({ predictionMode: 'WINNER' });
    await submitPrediction(users[0].id, winner.id, { predictedWinner: 'HOME' as any })
      .then(() => check('rejects an out-of-enum winner', false, 'ACCEPTED'))
      .catch((e) => check('rejects an out-of-enum winner', e.message === 'INVALID_PREDICTION', e.message));
    await submitPrediction(users[0].id, winner.id, { predictedHomeScore: 1, predictedAwayScore: 0 })
      .then(() => check('rejects a scoreline in WINNER mode', false, 'ACCEPTED'))
      .catch((e) => check('rejects a scoreline in WINNER mode', e.message === 'INVALID_PREDICTION', e.message));

    await getCompetition('00000000-0000-0000-0000-000000000000', users[0].id)
      .then(() => check('an unknown id is a clean 404, not a crash', false, 'RESOLVED'))
      .catch((e) => check('an unknown id is a clean 404, not a crash', e.message === 'COMPETITION_NOT_FOUND', e.message));
    await getCompetition('not-a-uuid', users[0].id)
      .then(() => check('a malformed id is a clean 404, not a crash', false, 'RESOLVED'))
      .catch((e) => check('a malformed id is a clean 404, not a crash', e.message === 'COMPETITION_NOT_FOUND', e.message));
    await submitPrediction(users[0].id, '00000000-0000-0000-0000-000000000000', { predictedHomeScore: 1, predictedAwayScore: 1 })
      .then(() => check('predicting an unknown competition 404s', false, 'ACCEPTED'))
      .catch((e) => check('predicting an unknown competition 404s', e.message === 'COMPETITION_NOT_FOUND', e.message));
  }

  // ── DRAFT / REJECTED never leak ────────────────────────────────────────
  console.log('\n[R19] unpublished competitions never leak');
  {
    for (const status of ['DRAFT', 'REJECTED'] as const) {
      const { comp } = await makeCompetition({ status });
      check(`${status} is absent from the public list`, !(await inList({ tab: 'all' }, comp.id)));
      await getCompetition(comp.id, users[0].id)
        .then(() => check(`${status} is not readable by id`, false, 'READABLE'))
        .catch((e) => check(`${status} is not readable by id`, e.message === 'COMPETITION_NOT_FOUND', e.message));
      await submitPrediction(users[0].id, comp.id, { predictedHomeScore: 1, predictedAwayScore: 1 })
        .then(() => check(`${status} refuses entry`, false, 'ACCEPTED'))
        .catch((e) => check(`${status} refuses entry`, e.message === 'COMPETITION_NOT_OPEN', e.message));
    }
  }

  console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
  await cleanup();
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('probe error:', e); process.exitCode = 1; })
  .finally(async () => { await cleanup().catch(() => {}); await prisma.$disconnect(); });
