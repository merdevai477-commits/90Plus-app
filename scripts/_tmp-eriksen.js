const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const [r] = await p.$queryRawUnsafe(`select data from public.cached_365_player_career where "langId"=1 and "athleteId"=1661`);
  for (const s of r.data.seasons ?? []) {
    const hit = (s.competitions ?? []).filter(c => c.teamId === 339);
    if (hit.length) console.log(JSON.stringify({ seasonKey: s.seasonKey, label: s.label, comps: hit }, null, 1));
  }
  console.log('--- all season labels ---');
  console.log((r.data.seasons??[]).map(s=>`${s.seasonKey}:${s.label}`).join(', '));
  await p.$disconnect();
})();
