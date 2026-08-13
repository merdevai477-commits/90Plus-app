import 'dotenv/config';
import { threeSixFiveScoresService } from '../src/services/threeSixFiveScores.service';
import prisma from '../src/lib/prisma';

(async () => {
  const t = Date.now();
  const r = await threeSixFiveScoresService.getPlayerCareer(1439, 'en'); // Salah
  console.log('elapsed(ms)=', Date.now() - t, 'ok=', !!r.data);
  if (r.data) {
    console.log('name=', r.data.profile.name);
    console.log('photo=', r.data.profile.imageUrl);
    console.log('trophies=', r.data.trophies?.slice(0, 5));
    console.log('seasons=', r.data.seasons?.length, JSON.stringify(r.data.seasons?.[0]?.competitions?.slice(0,2)));
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
