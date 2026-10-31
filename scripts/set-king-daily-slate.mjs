/**
 * Set (or clear) the curated King of Predictions slate for a Cairo day.
 *
 * Usage:
 *   node scripts/set-king-daily-slate.mjs 2026-11-01 4742014,4732646,...
 *   node scripts/set-king-daily-slate.mjs 2026-11-01 --clear
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const date = process.argv[2];
const arg = process.argv[3] ?? '';

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node scripts/set-king-daily-slate.mjs YYYY-MM-DD <id,id,...|--clear>');
  process.exit(1);
}

const clear = arg === '--clear' || arg === '';
const matchIds = clear
  ? []
  : [...new Set(
      arg
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    )].slice(0, 10);

const day = new Date(`${date}T00:00:00.000Z`);

try {
  await prisma.$transaction(async (tx) => {
    await tx.kingDailySlate.deleteMany({ where: { cairoDay: day } });
    if (matchIds.length === 0) return;
    await tx.kingDailySlate.createMany({
      data: matchIds.map((apiMatchId, index) => ({
        cairoDay: day,
        apiMatchId,
        sortOrder: index + 1,
      })),
    });
  });

  const rows = await prisma.kingDailySlate.findMany({
    where: { cairoDay: day },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(JSON.stringify({ date, source: rows.length ? 'curated' : 'auto', matchIds: rows.map((r) => r.apiMatchId) }, null, 2));
} finally {
  await prisma.$disconnect();
}
