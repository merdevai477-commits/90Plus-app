const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  console.log(await p.$queryRawUnsafe(`select indexname, indexdef from pg_indexes where tablename='cached_365_player_career'`));
  console.log(await p.$queryRawUnsafe(`select "athleteId", count(*)::int c from public.cached_365_player_career group by 1 having count(*)>1 limit 5`));
  await p.$disconnect();
})();
