import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = {
    teamInfo: await p.teamInfo.count(),
    teamPlayer: await p.teamPlayer.count(),
    playerInfo: await p.playerInfo.count(),
    playerInfoWithApiId: await p.playerInfo.count({ where: { apiPlayerId: { not: null } } }),
    cachedTeam: await p.cachedTeam.count(),
    cachedTeamWithLogo: await p.cachedTeam.count({ where: { logo: { not: null } } }),
    cachedTeamWithVenueImg: await p.cachedTeam.count({ where: { venueImage: { not: null } } }),
    cachedPlayer: await p.cachedPlayer.count(),
    cachedPlayerWithTeam: await p.cachedPlayer.count({ where: { teamId: { not: null } } }),
    cached365: await p.cached365PlayerCareer.count(),
    playerStatsCache: await p.playerStatsCache.count(),
  };
  console.log(JSON.stringify(r, null, 2));
  const sample = await p.cachedPlayer.findMany({ take: 3, select: { playerId: true, name: true, teamId: true, teamName: true, position: true, nationality: true } });
  console.log('cachedPlayer sample:', JSON.stringify(sample, null, 2));
  const teams = await p.cachedTeam.findMany({ take: 5, orderBy: { teamId: 'asc' }, select: { teamId: true, name: true } });
  console.log('cachedTeam sample:', JSON.stringify(teams));
  await p.$disconnect();
})().catch(async (e) => { console.error('ERR', e.message); process.exit(1); });
