/**
 * Backend shapes → the pick screens' own types, for the leagues listed in
 * `TSF_LIVE_LEAGUES`.
 */

import type {
  TsfApiFixture,
  TsfApiLeaderboard,
  TsfApiMyFixture,
  TsfApiPlayer,
  TsfApiSelection,
} from '../../services/topScorersFive.service';

import type { TsfFixture, TsfLeaderboardRow, TsfPlayer } from './mockData';

export function tsfPlayerFromApi(player: TsfApiPlayer): TsfPlayer {
  return {
    id: player.id,
    name: player.name,
    position: player.position ?? '',
    club: player.club,
    goals: player.seasonGoals,
    assists: player.seasonAssists,
    points: player.points,
    photo: player.photo,
    clubLogo: player.teamLogo,
    nameAr: player.nameAr,
    nameEn: player.nameEn,
    live: true,
    athleteId: player.externalPlayerId,
    teamId: player.teamId,
  };
}

/** The pick with this gameweek's figures, which its pitch card shows. */
export function tsfPickFromSelection(data: TsfApiSelection): TsfPlayer | null {
  if (!data.selection) return null;
  const { player, score, locked, confirmed } = data.selection;
  return {
    ...tsfPlayerFromApi(player),
    goals: score.goals,
    assists: score.assists,
    points: score.points,
    locked,
    confirmed,
  };
}

export function tsfFixtureFromApi(fixture: TsfApiFixture): TsfFixture {
  return {
    id: String(fixture.fixtureId),
    home: fixture.home.name,
    away: fixture.away.name,
    homeLogo: fixture.home.logo,
    awayLogo: fixture.away.logo,
    kickoffISO: fixture.kickoff,
  };
}

/** A matches-tab row for one picked player, with his line once the match is stored. */
export function tsfMyFixtureFor(fixture: TsfApiMyFixture, playerId: string): TsfFixture {
  const line = fixture.players.find((p) => p.playerId === playerId);
  return {
    ...tsfFixtureFromApi(fixture),
    result:
      fixture.processed && line
        ? {
            goals: line.goals ?? 0,
            assists: line.assists ?? 0,
            points: line.points ?? 0,
            participation: line.participation,
          }
        : undefined,
  };
}

export function tsfLeaderboardRows(board: TsfApiLeaderboard): TsfLeaderboardRow[] {
  return board.entries.map((entry) => ({
    id: entry.userId,
    rank: entry.rank,
    name: entry.displayName || entry.username || '—',
    xp: entry.xp,
    isYou: board.me?.userId === entry.userId,
    avatar: entry.avatar,
  }));
}
