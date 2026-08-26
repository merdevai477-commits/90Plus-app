/**
 * Predict & Win — realistic development seed.
 *
 * The hub is wired to the real API, so "realistic data" means realistic ROWS,
 * not a mock UI layer: this fills the database and every value the app renders
 * then comes down the same `/api/competitions/*` endpoints production uses.
 * Delete the seed and the screen degrades to its genuine empty state.
 *
 * What it creates:
 *   • 3 sponsors — two verified, one not, so the "تحديات الرعاة" tab and the
 *     verified badge both have something to show
 *   • 5 PUBLISHED competitions spread across prize categories, free/paid and
 *     participant counts, so every filter chip and every sort option changes
 *     the list visibly
 *   • entries from existing users, so `participantsCount` is a real count and
 *     the "الأكثر مشاركة" sort is not ordering by a fabricated number
 *
 * Matches come from the feature's own pool (`getUpcomingPool`), which is what
 * the create wizard offers a sponsor — a seeded competition therefore points
 * at a fixture the settlement job can actually resolve. If the fixture cache
 * is empty (offline dev box) the seed stops rather than inventing match ids
 * that would never settle.
 *
 * Seeded sponsors are marked with `socialLinks.seed = "pw"` and can be removed
 * with `--clean`, which cascades to their competitions and entries.
 *
 *     npm run seed:predict-win
 *     npm run seed:predict-win -- --clean
 *
 * Dev/staging only — it refuses to run against a non-local database unless
 * SEED_ALLOW_REMOTE=1 is set.
 */

import prisma from '../src/lib/prisma';
import { getUpcomingPool, type PoolMatch } from '../src/services/competition-match-pool.service';

/** Invisible marker on `Sponsor.socialLinks`, so `--clean` never has to guess. */
const SEED_MARK = 'pw';

interface SponsorSpec {
  name: string;
  description: string;
  address: string;
  hasDelivery: boolean;
  isVerified: boolean;
  socialLinks: Record<string, string>;
}

const SPONSORS: SponsorSpec[] = [
  {
    name: 'سبورت زون',
    description: 'متجر أحذية وملابس رياضية',
    address: 'مدينة نصر، القاهرة',
    hasDelivery: true,
    isVerified: true,
    socialLinks: { instagram: 'https://instagram.com/sportzone', whatsapp: '+201000000001' },
  },
  {
    name: 'تكنو ستور',
    description: 'إلكترونيات وإكسسوارات',
    address: 'سموحة، الإسكندرية',
    hasDelivery: true,
    isVerified: true,
    socialLinks: { facebook: 'https://facebook.com/technostore' },
  },
  {
    name: 'كافيه الكورة',
    description: 'كافيه ومطعم لمتابعة المباريات',
    address: 'المعادي، القاهرة',
    hasDelivery: false,
    isVerified: false,
    socialLinks: { instagram: 'https://instagram.com/koracafe' },
  },
];

interface PrizeSpec {
  /** Index into `SPONSORS`. */
  sponsor: number;
  /** `PrizeCategory.key` — the wizard sends the same value as `prizeType`. */
  category: string;
  prizeName: string;
  prizeDescription: string;
  winnersCount: number;
  isFree: boolean;
  predictionMode: 'EXACT_SCORE' | 'WINNER';
  rules: string;
  /** How many entries to create — this becomes `participantsCount`. */
  entries: number;
}

/**
 * Deliberately varied: the point of a seed is that tapping a chip or changing
 * the sort produces a *different* list. A uniform set proves nothing.
 */
const PRIZES: PrizeSpec[] = [
  {
    sponsor: 0,
    category: 'sportswear',
    prizeName: 'حذاء كرة قدم أصلي',
    prizeDescription: 'حذاء ملاعب نجيل صناعي، المقاس حسب اختيار الفائز.',
    winnersCount: 1,
    isFree: true,
    predictionMode: 'EXACT_SCORE',
    rules: 'التوقع مرة واحدة لكل مستخدم. يُستلم الحذاء من الفرع خلال أسبوع من إعلان النتيجة.',
    entries: 42,
  },
  {
    sponsor: 1,
    category: 'electronics',
    prizeName: 'سماعة لاسلكية',
    prizeDescription: 'سماعة بلوتوث مع علبة شحن وضمان سنة.',
    winnersCount: 2,
    isFree: true,
    predictionMode: 'EXACT_SCORE',
    rules: 'يشترط أن يكون الحساب موثقاً برقم هاتف. التوصيل مجاني داخل الإسكندرية.',
    entries: 18,
  },
  {
    sponsor: 2,
    category: 'food',
    prizeName: 'وجبة عشاء لشخصين',
    prizeDescription: 'وجبة كاملة لشخصين مع المشروبات أثناء مشاهدة المباراة.',
    winnersCount: 3,
    isFree: true,
    predictionMode: 'WINNER',
    rules: 'صالحة لمدة شهر من تاريخ الفوز، ولا تشمل أيام المباريات الكبرى.',
    entries: 7,
  },
  {
    sponsor: 0,
    category: 'tickets',
    prizeName: 'تذكرتان لمباراة القمة',
    prizeDescription: 'تذكرتان في الدرجة الأولى مع تنسيق الاستلام قبل المباراة بيومين.',
    winnersCount: 1,
    isFree: false,
    predictionMode: 'EXACT_SCORE',
    rules: 'الفائز مسؤول عن الانتقال. لا يجوز إعادة بيع التذاكر.',
    entries: 96,
  },
  {
    sponsor: 1,
    category: 'vouchers',
    prizeName: 'قسيمة شراء بقيمة 1000 جنيه',
    prizeDescription: 'قسيمة تُصرف على أي منتج داخل المتجر أو أونلاين.',
    winnersCount: 5,
    isFree: true,
    predictionMode: 'WINNER',
    rules: 'تُستخدم مرة واحدة ولا تُستبدل نقداً.',
    entries: 63,
  },
];

/** Minutes before kickoff each competition closes, so "الأقرب انتهاءً" ranks. */
const CLOSES_BEFORE_KICKOFF = [180, 120, 60, 30, 5];

/**
 * Predictions must close after now and no later than kickoff — the same window
 * `buildCompetitionData` enforces on a real submission.
 */
function deadlineFor(match: PoolMatch, minutesBeforeKickoff: number, now: Date): Date {
  const kickoff = new Date(match.kickoffIso).getTime();
  const wanted = kickoff - minutesBeforeKickoff * 60_000;
  const floor = now.getTime() + 5 * 60_000;
  return new Date(Math.max(floor, Math.min(wanted, kickoff)));
}

async function clean() {
  const sponsors = await prisma.sponsor.findMany({
    where: { socialLinks: { path: ['seed'], equals: SEED_MARK } },
    select: { id: true },
  });

  if (sponsors.length === 0) {
    console.log('Nothing to clean — no seeded sponsors found.');
    return;
  }

  const ids = sponsors.map((s) => s.id);
  const competitions = await prisma.competition.count({ where: { sponsorId: { in: ids } } });
  // Competitions cascade from the sponsor, and entries cascade from those.
  await prisma.sponsor.deleteMany({ where: { id: { in: ids } } });
  console.log(`🧹 Removed ${sponsors.length} seeded sponsors and ${competitions} competitions.`);
}

async function seed() {
  const now = new Date();

  const categories = await prisma.prizeCategory.findMany({ where: { isActive: true } });
  if (categories.length === 0) {
    throw new Error(
      'No prize categories. Run: npx ts-node --project prisma/tsconfig.json prisma/seed-prize-categories.ts',
    );
  }
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));

  const pool = await getUpcomingPool(now);
  if (pool.length === 0) {
    throw new Error(
      'The match pool is empty, so there is no fixture to attach a competition to.\n' +
        'Warm the fixture cache first (start the API and let it sync), then re-run.',
    );
  }
  console.log(`⚽ ${pool.length} matches in the pool.`);

  // A previous run is replaced rather than duplicated.
  await clean();

  const sponsorIds: string[] = [];
  for (const spec of SPONSORS) {
    const sponsor = await prisma.sponsor.create({
      data: {
        name: spec.name,
        description: spec.description,
        address: spec.address,
        hasDelivery: spec.hasDelivery,
        isVerified: spec.isVerified,
        isActive: true,
        socialLinks: { ...spec.socialLinks, seed: SEED_MARK },
      },
    });
    sponsorIds.push(sponsor.id);
  }
  console.log(`🏪 Created ${sponsorIds.length} sponsors.`);

  /**
   * Entries need real users — `CompetitionEntry.userId` is a foreign key, and
   * a participant count with no rows behind it would disagree with the
   * entrants the detail screen reads back.
   */
  const users = await prisma.user.findMany({
    take: Math.max(...PRIZES.map((p) => p.entries)),
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  for (const [index, prize] of PRIZES.entries()) {
    const match = pool[index % pool.length];
    const category = categoryByKey.get(prize.category);
    if (!category) {
      console.warn(`⚠️  Skipping "${prize.prizeName}" — no active category "${prize.category}".`);
      continue;
    }

    const deadline = deadlineFor(
      match,
      CLOSES_BEFORE_KICKOFF[index % CLOSES_BEFORE_KICKOFF.length],
      now,
    );
    const entrants = users.slice(0, Math.min(prize.entries, users.length));

    const competition = await prisma.competition.create({
      data: {
        sponsorId: sponsorIds[prize.sponsor],
        categoryId: category.id,
        prizeName: prize.prizeName,
        prizeType: prize.category,
        prizeDescription: prize.prizeDescription,
        winnersCount: prize.winnersCount,
        apiMatchId: match.apiMatchId,
        homeTeam: match.home.name,
        awayTeam: match.away.name,
        homeTeamLogo: match.home.logo,
        awayTeamLogo: match.away.logo,
        matchDate: new Date(match.kickoffIso),
        matchStatus: match.status,
        leagueName: match.leagueName,
        predictionDeadline: deadline,
        predictionMode: prize.predictionMode,
        rules: prize.rules,
        isFree: prize.isFree,
        status: 'PUBLISHED',
        publishedAt: now,
        startAt: now,
        participantsCount: entrants.length,
        entries: {
          create: entrants.map((user) =>
            prize.predictionMode === 'WINNER'
              ? {
                  userId: user.id,
                  predictedWinner: (['home', 'draw', 'away'] as const)[
                    Math.floor(Math.random() * 3)
                  ],
                }
              : {
                  userId: user.id,
                  predictedHomeScore: Math.floor(Math.random() * 4),
                  predictedAwayScore: Math.floor(Math.random() * 4),
                },
          ),
        },
      },
    });

    created += 1;
    console.log(
      `  ✅ ${competition.prizeName.padEnd(28)} ${match.home.name} × ${match.away.name} · ` +
        `${entrants.length} entries · closes ${deadline.toISOString().slice(0, 16).replace('T', ' ')}`,
    );
  }

  console.log(`\n🎁 Seeded ${created} published competitions.`);
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
