/**
 * Share & Win — realistic development seed.
 *
 * The screen is wired to the real API, so "realistic data" means realistic
 * ROWS, not a mock UI layer: this fills the database and every value the app
 * renders then comes down the same `/api/share-win/*` endpoints production
 * uses. Delete the seed and the app degrades to its genuine empty states.
 *
 * What it creates:
 *   • 140 users with plausible names, avatars, XP and join dates
 *   • referral codes for all of them
 *   • a COMPLETED previous week, ranked, so "آخر فائز" has a real winner
 *   • the live week, with a power-law spread of participants and shares
 *
 * Scores are computed with the service's own `computeScore`, and standings are
 * ranked with the service's own `closeCycle`, so seeded data is internally
 * consistent with anything the app writes afterwards.
 *
 * Every seeded user is prefixed `sw_` and can be removed with `--clean`.
 *
 *     npm run seed:share-win
 *     npm run seed:share-win -- --clean
 *
 * Dev/staging only — it refuses to run against a non-local database unless
 * SEED_ALLOW_REMOTE=1 is set.
 */

import prisma from '../src/lib/prisma';
import { closeCycle, computeScore, ensureCurrentCycle } from '../src/services/share-win.service';

const PREFIX = 'sw_';

/**
 * Common given/family name pairs. Deliberately generic combinations rather
 * than recognisable public figures — this is filler, and it should not look
 * like it describes real, identifiable people.
 */
const FIRST_NAMES = [
  'محمد', 'أحمد', 'يوسف', 'عمر', 'خالد', 'سامي', 'ياسر', 'حسن', 'كريم', 'طارق',
  'مصطفى', 'إبراهيم', 'زياد', 'فهد', 'ماجد', 'رامي', 'وليد', 'نادر', 'أنس', 'بلال',
  'سلمى', 'نور', 'ليلى', 'مريم', 'هبة', 'دينا', 'رنا', 'ياسمين',
  'Lucas', 'Mateo', 'Adam', 'Noah', 'Liam', 'Rayan', 'Ilyas', 'Amir',
];

const LAST_NAMES = [
  'العتيبي', 'القحطاني', 'الشمري', 'الحربي', 'الدوسري', 'المصري', 'السيد', 'عبدالله',
  'الفهد', 'الزهراني', 'النجار', 'الخطيب', 'حمدان', 'شاهين', 'مبارك', 'صالح',
  'Ferreira', 'Bennani', 'Haddad', 'Kovacs',
];

/** Deterministic PRNG so re-seeding produces the same believable board. */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = makeRng(90_2026);

function pick<T>(list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Illustrated avatars, not photographs of real people — the data is fake, so
 * the faces should visibly be too.
 */
function avatarFor(seed: string): string {
  return `https://api.dicebear.com/7.x/notionists/png?seed=${encodeURIComponent(seed)}&backgroundColor=1a0530,2b0b4d,3a0c66`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function referralCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return out;
}

/**
 * Power-law participant counts: one clear leader, a competitive top ten, then
 * a long tail of one- and two-referral users. That is what a real referral
 * board looks like — not evenly spaced numbers.
 */
function participantsForIndex(index: number): number {
  if (index === 0) return randInt(22, 27);
  if (index < 3) return randInt(14, 20);
  if (index < 8) return randInt(7, 13);
  if (index < 20) return randInt(3, 6);
  if (index < 70) return randInt(1, 2);
  return 0; // shares only — they exist on the board but have not converted anyone
}

async function clean() {
  const users = await prisma.user.findMany({
    where: { username: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);

  // Standings/events/referrals cascade from the user rows.
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.shareWinCycle.deleteMany({ where: { weekKey: { startsWith: 'SEED-' } } });
  console.log(`Removed ${ids.length} seeded users.`);
}

async function seed() {
  await clean();

  // Large enough that the top ranks cannot exhaust the referral pool (each
  // user can only be attributed once), and enough rows to exercise paging.
  const total = 140;
  const now = new Date();

  console.log(`Seeding ${total} users…`);
  const users: Array<{ id: string; index: number }> = [];

  for (let i = 0; i < total; i += 1) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const handle = `${PREFIX}${i.toString().padStart(3, '0')}`;
    const joinedDaysAgo = randInt(2, 400);

    const user = await prisma.user.create({
      data: {
        username: handle,
        email: `${handle}@seed.90plus.test`,
        displayName: `${first} ${last}`,
        avatar: avatarFor(handle),
        referralCode: referralCode(),
        xp: randInt(120, 8600),
        level: randInt(1, 12),
        coins: randInt(30, 2400),
        createdAt: new Date(now.getTime() - joinedDaysAgo * 86_400_000),
      },
      select: { id: true },
    });
    users.push({ id: user.id, index: i });
  }

  // ── Previous week: completed and ranked, so "last winner" is real ────────
  const prevStart = new Date(now.getTime() - 14 * 86_400_000);
  const prevEnd = new Date(now.getTime() - 7 * 86_400_000);
  const previous = await prisma.shareWinCycle.create({
    data: {
      weekKey: `SEED-${prevStart.toISOString().slice(0, 10)}`,
      startAt: prevStart,
      endAt: prevEnd,
      status: 'ACTIVE',
    },
  });

  console.log('Seeding last week…');
  for (const { id, index } of users) {
    // Last week's order differs from this week's — the board should look like
    // it moved, not like a copy.
    const shifted = (index + 7) % users.length;
    const participants = participantsForIndex(shifted);
    const shares = participants > 0 ? randInt(participants, participants * 6) : randInt(0, 5);
    if (participants === 0 && shares === 0) continue;

    await prisma.shareWinStanding.create({
      data: {
        cycleId: previous.id,
        userId: id,
        participantCount: participants,
        shareCount: shares,
        score: computeScore(participants, shares),
        firstScoredAt: new Date(prevStart.getTime() + randInt(1, 6 * 24) * 3_600_000),
        lastScoredAt: prevEnd,
      },
    });
  }
  await closeCycle(previous.id, prevEnd);
  console.log('  → previous cycle closed and ranked.');

  // ── Live week ────────────────────────────────────────────────────────────
  const current = await ensureCurrentCycle(now);
  console.log(`Seeding current cycle ${current.weekKey}…`);

  /**
   * A user can only ever be attributed to one referrer, so the seed has to
   * respect that too. Tracking it here keeps the writes clean instead of
   * firing doomed inserts at the unique index.
   */
  const attributed = new Set<string>();
  let referralCursor = 0;

  for (const { id, index } of users) {
    const participants = participantsForIndex(index);
    const shares = participants > 0 ? randInt(participants, participants * 5) : randInt(0, 8);
    if (participants === 0 && shares === 0) continue;

    // Real referral rows behind the participant counts, so the aggregate is
    // backed by the same evidence the app writes at runtime.
    let created = 0;
    let guard = 0;
    while (created < participants && guard < users.length * 2) {
      guard += 1;
      referralCursor = (referralCursor + 1) % users.length;
      const referred = users[referralCursor];
      if (referred.id === id || attributed.has(referred.id)) continue;

      attributed.add(referred.id);
      created += 1;
      await prisma.shareWinReferral.create({
        data: {
          referrerId: id,
          referredUserId: referred.id,
          referralCode: referralCode(),
          cycleId: current.id,
          convertedAt: new Date(current.startAt.getTime() + randInt(1, 5 * 24) * 3_600_000),
        },
      });
    }

    // Store what was actually attributed, so the standing always matches the
    // referral rows behind it — exactly the invariant syncStanding maintains.
    await prisma.shareWinStanding.upsert({
      where: { cycleId_userId: { cycleId: current.id, userId: id } },
      create: {
        cycleId: current.id,
        userId: id,
        participantCount: created,
        shareCount: shares,
        score: computeScore(created, shares),
        firstScoredAt: new Date(current.startAt.getTime() + randInt(1, 96) * 3_600_000),
        lastScoredAt: now,
      },
      update: {
        participantCount: created,
        shareCount: shares,
        score: computeScore(created, shares),
      },
    });
  }

  const board = await prisma.shareWinStanding.findMany({
    where: { cycleId: current.id },
    orderBy: [{ participantCount: 'desc' }, { firstScoredAt: 'asc' }],
    take: 5,
    select: { participantCount: true, shareCount: true, score: true, user: { select: { displayName: true } } },
  });

  console.log('\nTop 5 this week:');
  board.forEach((row, i) => {
    console.log(
      `  ${i + 1}. ${(row.user.displayName ?? '').padEnd(22)} ` +
        `${String(row.participantCount).padStart(2)} participants · ` +
        `${String(row.shareCount).padStart(3)} shares · ${row.score} XP`,
    );
  });

  const counted = await prisma.shareWinStanding.count({ where: { cycleId: current.id } });
  console.log(`\n✅ Seeded ${users.length} users, ${counted} on this week's board.\n`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== '1') {
    console.error(
      'Refusing to seed a non-local database.\n' +
        'Set SEED_ALLOW_REMOTE=1 only if you are certain this is a dev/staging target.',
    );
    process.exit(1);
  }

  if (process.argv.includes('--clean')) {
    await clean();
  } else {
    await seed();
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
