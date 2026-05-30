const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Usage: DATABASE_URL=postgresql://... node scripts/check-cached-fixtures-stats.js');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const total = await prisma.cachedFixture.count();
  const finished = await prisma.cachedFixture.count({
    where: { status: { in: ['FT', 'AET', 'PEN'] } },
  });
  const live = await prisma.cachedFixture.count({
    where: { status: { in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] } },
  });
  const oldest = await prisma.cachedFixture.aggregate({ _min: { matchDate: true } });
  const newest = await prisma.cachedFixture.aggregate({ _max: { matchDate: true } });

  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT ("matchDate"::date))::int AS distinct_days,
      COUNT(*) FILTER (WHERE "fullData"::text LIKE '%"events"%')::int AS with_events_json,
      COUNT(*) FILTER (WHERE "fullData"::text LIKE '%"lineups"%')::int AS with_lineups_json
    FROM cached_fixtures
  `;

  const byStatus = await prisma.cachedFixture.groupBy({
    by: ['status'],
    _count: { _all: true },
    orderBy: { _count: { status: 'desc' } },
  });

  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const today = new Date().toISOString().slice(0, 10);
  const oldestStr = fmt(oldest._min.matchDate);
  const daysBack =
    oldestStr && today
      ? Math.floor((new Date(today) - new Date(oldestStr)) / 86400000)
      : null;

  console.log('=== cached_fixtures (Railway PostgreSQL) ===');
  console.log('Total matches saved:     ', total);
  console.log('Finished (FT/AET/PEN):   ', finished);
  console.log('Live statuses now:       ', live);
  console.log('Oldest match date:       ', oldestStr, oldest._min.matchDate?.toISOString?.() ?? '');
  console.log('Newest match date:       ', fmt(newest._max.matchDate), newest._max.matchDate?.toISOString?.() ?? '');
  console.log('Days covered (distinct): ', rows[0]?.distinct_days ?? '?');
  console.log('Days back from today:    ', daysBack);
  console.log('Rows with events in JSON:', rows[0]?.with_events_json ?? '?');
  console.log('Rows with lineups in JSON:', rows[0]?.with_lineups_json ?? '?');
  console.log('\nBy status:');
  for (const s of byStatus) {
    console.log(`  ${s.status}: ${s._count._all}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
