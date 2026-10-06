/**
 * Backend shapes → the pick screens' own types, for the leagues listed in
 * `TSF_LIVE_LEAGUES`.
 */

import type {
  TsfApiFixture,
  TsfApiLeaderboard,
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
    goals: player.goals,
    assists: player.assists,
    points: player.points,
    photo: player.photo,
    live: true,
  };
}

/** The pick with this gameweek's figures, which its pitch card shows. */
export function tsfPickFromSelection(data: TsfApiSelection): TsfPlayer | null {
  if (!data.selection) return null;
  const { player, score } = data.selection;
  return {
    ...tsfPlayerFromApi(player),
    goals: score.goals,
    assists: score.assists,
    points: score.points,
  };
}

export function tsfFixtureFromApi(fixture: TsfApiFixture): TsfFixture {
  return {
    id: String(fixture.fixtureId),
    home: fixture.home.name,
    away: fixture.away.name,
    kickoffISO: fixture.kickoff,
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
