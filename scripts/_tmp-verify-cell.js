const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(`
    select "athleteId", name, data from public.cached_365_player_career
     where "langId"=1 and name in ('Christian Eriksen','Felix Nmecha','Max Alleyne','Kevin De Bruyne')`);
  for (const r of rows) {
    const teams = new Map();
    for (const s of r.data.seasons ?? []) for (const c of s.competitions ?? []) {
      if (c.teamId) teams.set(c.teamId, c.teamName);
    }
    console.log(`\n=== ${r.name} (${r.athleteId}) ===`);
    console.log('teams:', [...teams].map(([id,n])=>`${id}:${n}`).join(' | '));
    console.log('trophies:', (r.data.trophies??[]).map(t=>`${t.competitionId}:${t.displayName}`).join(' | '));
  }
  await p.$disconnect();
})();
