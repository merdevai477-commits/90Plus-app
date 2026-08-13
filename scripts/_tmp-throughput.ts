import 'dotenv/config';
import { threeSixFiveScoresService } from '../src/services/threeSixFiveScores.service';
import prisma from '../src/lib/prisma';

(async () => {
  const rows: Array<{ athleteId: number }> = await prisma.$queryRawUnsafe(
    `select "athleteId" from public.cached_365_player_career where "langId"=27
       and jsonb_array_length(coalesce(data->'trophies','[]'::jsonb)) > 0 limit 8`);
  console.log('sample ids', rows.map(r => r.athleteId));
  const t = Date.now();
  const out = await Promise.all(rows.map(r => threeSixFiveScoresService.getPlayerCareer(r.athleteId, 'en')));
  console.log('8 concurrent fetch ms =', Date.now() - t);
  out.forEach((r, i) => console.log(rows[i]!.athleteId, r.data?.profile.name, 'seasons', r.data?.seasons?.length, 'trophies', r.data?.trophies?.length));
  await prisma.$disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
