const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  // How many athletes are cached in AR but NOT in EN (the backfill target)
  const r = await p.$queryRawUnsafe(`
    select count(*) filter (where "langId"=27)::int ar,
           count(*) filter (where "langId"=1)::int en,
           count(distinct "athleteId")::int distinct_athletes
      from public.cached_365_player_career`);
  console.log(r);
  const withTrophies = await p.$queryRawUnsafe(`
    select "langId", count(*)::int total,
           count(*) filter (where jsonb_array_length(coalesce(data->'trophies','[]'::jsonb))>0)::int with_trophies
      from public.cached_365_player_career group by 1`);
  console.log(withTrophies);
  await p.$disconnect();
})();
