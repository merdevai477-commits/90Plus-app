import prisma from './src/lib/prisma';
import { listCompetitions } from './src/services/competitions.service';
import { calendarDayBounds, calendarTodayKey } from './src/utils/calendar-day-bounds.util';

(async () => {
  const total = await prisma.competition.count();
  const byStatus = await prisma.competition.groupBy({ by: ['status'], _count: true });
  console.log('total competitions:', total);
  console.log('byStatus:', JSON.stringify(byStatus));
  const sponsors = await prisma.sponsor.findMany({ select: { id: true, name: true, isActive: true, isVerified: true } });
  console.log('sponsors:', JSON.stringify(sponsors));
  console.log('todayKey:', calendarTodayKey(), JSON.stringify(calendarDayBounds(calendarTodayKey())));
  const rows = await prisma.competition.findMany({ select: { id: true, status: true, matchDate: true, isFree: true, prizeName: true, sponsorId: true }, orderBy: { matchDate: 'asc' }, take: 20 });
  console.log('rows:', JSON.stringify(rows, null, 1));
  for (const tab of ['all', 'today', 'mine', 'sponsored'] as const) {
    try {
      const r: any = await listCompetitions({ userId: null, tab });
      console.log(`tab=${tab} -> items=${r.items.length} nextCursor=${r.nextCursor}`);
    } catch (e: any) { console.log(`tab=${tab} -> threw ${e.message}`); }
  }
  for (const filter of ['daily', 'free', 'sponsored', 'popular'] as const) {
    const r: any = await listCompetitions({ userId: null, tab: 'all', filter });
    console.log(`filter=${filter} -> items=${r.items.length}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error('PROBE ERROR', e); process.exit(1); });
