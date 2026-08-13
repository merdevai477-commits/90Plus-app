const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const byLang = await p.$queryRawUnsafe(`select "langId", count(*)::int as n, count(photo)::int as with_photo from public.cached_365_player_career group by 1 order by 1`);
  console.log('BY LANG', byLang);
  const total = await p.$queryRawUnsafe(`select count(*)::int as n from public.cached_365_player_career`);
  console.log('TOTAL', total);
  const sample = await p.$queryRawUnsafe(`select "athleteId", name, "langId", photo is not null as has_photo, jsonb_array_length(coalesce(data->'trophies','[]'::jsonb)) as trophies, jsonb_array_length(coalesce(data->'seasons','[]'::jsonb)) as seasons from public.cached_365_player_career order by "updatedAt" desc limit 15`);
  console.log('SAMPLE', sample);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
