import type { Fixture, Standing, TeamFixture } from '../services/apiFootball';
import type { StandingsGroup } from './standingsHelpers';
import { SCORES365_LEAGUE_ID_OFFSET } from '../constants/worldCup';

/** True when fixture payload came from 365Scores experiment overlay. */
export function isScores365Fixture(fixture: { _experiment?: string } | null | undefined): boolean {
  return fixture?._experiment === 'scores365';
}

/** Build 365 competitor crest URL when imageVersion is present. */
export function build365CompetitorLogo(competitorId?: number, imageVersion?: number): string {
  if (!competitorId) return '';
  const v = imageVersion ?? 1;
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v${v}/Competitors/${competitorId}`;
}

/** Build 365 competition logo URL. */
function build365CompetitionLogo(competitionId?: number, imageVersion?: number): string {
  if (!competitionId) return '';
  const v = imageVersion ?? 1;
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v${v}/Competitions/${competitionId}`;
}

type Recent365Game = {
  id?: number;
  startTime?: string;
  statusGroup?: number;
  statusId?: number;
  competitionId?: number;
  competitionDisplayName?: string;
  competitionImageVersion?: number;
  homeCompetitor?: { id?: number; name?: string; score?: number; imageVersion?: number };
  awayCompetitor?: { id?: number; name?: string; score?: number; imageVersion?: number };
};

function isFinished365Game(g: Recent365Game): boolean {
  // 365Scores: 2 = scheduled, 3 = live, 4 = finished (matches backend map365Status).
  if (g.statusGroup === 4) return true;
  const home = g.homeCompetitor?.score;
  const away = g.awayCompetitor?.score;
  return home != null && away != null && home >= 0 && away >= 0;
}

/** Map 365 h2h recentGames → TeamFixture[] for the form tab. */
export function map365RecentGamesToTeamFixtures(
  games: Recent365Game[],
  limit = 5,
): TeamFixture[] {
  return (games ?? [])
    .filter(isFinished365Game)
    .slice(0, limit)
    .map((g) => {
      const homeScore =
        g.homeCompetitor?.score != null && g.homeCompetitor.score >= 0
          ? g.homeCompetitor.score
          : 0;
      const awayScore =
        g.awayCompetitor?.score != null && g.awayCompetitor.score >= 0
          ? g.awayCompetitor.score
          : 0;
      const ts = g.startTime ? Math.floor(new Date(g.startTime).getTime() / 1000) : 0;
      const compId = g.competitionId ?? 0;
      const leagueId = compId > 0 ? SCORES365_LEAGUE_ID_OFFSET + compId : 1;
      return {
        fixture: {
          id: g.id ?? 0,
          date: g.startTime ?? '',
          timestamp: ts,
          status: { short: 'FT', long: 'Match Finished', elapsed: 90 },
          venue: { id: null, name: null, city: null },
          periods: { first: null, second: null },
          referee: null,
          timezone: 'UTC',
        },
        league: {
          id: leagueId,
          name: g.competitionDisplayName ?? 'World Cup',
          country: 'World',
          logo: build365CompetitionLogo(compId, g.competitionImageVersion),
          flag: null,
          season: 2026,
          round: '',
        },
        teams: {
          home: {
            id: g.homeCompetitor?.id ?? 0,
            name: g.homeCompetitor?.name ?? '—',
            logo: build365CompetitorLogo(g.homeCompetitor?.id, g.homeCompetitor?.imageVersion),
            winner: homeScore > awayScore ? true : homeScore < awayScore ? false : null,
          },
          away: {
            id: g.awayCompetitor?.id ?? 0,
            name: g.awayCompetitor?.name ?? '—',
            logo: build365CompetitorLogo(g.awayCompetitor?.id, g.awayCompetitor?.imageVersion),
            winner: awayScore > homeScore ? true : awayScore < homeScore ? false : null,
          },
        },
        goals: { home: homeScore, away: awayScore },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: homeScore, away: awayScore },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      } as TeamFixture;
    });
}

/** Map API / competitor Fixture rows onto the Form tab TeamFixture shape. */
export function fixturesToTeamFixtures(fixtures: Fixture[], limit = 5): TeamFixture[] {
  return (fixtures ?? []).slice(0, limit).map((f) => ({
    fixture: {
      id: f.fixture.id,
      date: f.fixture.date,
      timestamp: f.fixture.timestamp,
      status: {
        long: f.fixture.status?.long ?? '',
        short: f.fixture.status?.short ?? '',
      },
    },
    league: {
      id: f.league?.id ?? 0,
      name: f.league?.name ?? '',
      logo: f.league?.logo ?? '',
    },
    teams: f.teams,
    goals: f.goals,
  }));
}

/** Map 365 standings rows → StandingsGroup[] for the standings tab. */
export function map365StandingsToGroups(
  rows: Array<{
    groupNum: number;
    groupName: string | null;
    position: number;
    teamId: number;
    teamName: string;
    teamLogo?: string;
    gamePlayed: number;
    gamesWon: number;
    gamesEven: number;
    gamesLost: number;
    goalsFor: number;
    goalsAgainst: number;
    ratio: number;
    points: number;
  }>,
): StandingsGroup[] {
  const byGroup = new Map<string, Standing[]>();

  for (const row of rows) {
    const groupLabel =
      row.groupName?.trim() ||
      (row.groupNum != null ? `Group ${row.groupNum}` : 'Table');
    const standing: Standing = {
      rank: row.position,
      team: { id: row.teamId, name: row.teamName, logo: row.teamLogo ?? '' },
      points: row.points,
      goalsDiff: row.goalsFor - row.goalsAgainst,
      group: groupLabel,
      form: '',
      status: '',
      description: null,
      all: {
        played: row.gamePlayed,
        win: row.gamesWon,
        draw: row.gamesEven,
        lose: row.gamesLost,
        goals: { for: row.goalsFor, against: row.goalsAgainst },
      },
      home: {
        played: 0,
        win: 0,
        draw: 0,
        lose: 0,
        goals: { for: 0, against: 0 },
      },
      away: {
        played: 0,
        win: 0,
        draw: 0,
        lose: 0,
        goals: { for: 0, against: 0 },
      },
      update: '',
    };
    const list = byGroup.get(groupLabel) ?? [];
    list.push(standing);
    byGroup.set(groupLabel, list);
  }

  return [...byGroup.entries()].map(([group, standings]) => ({
    group,
    standings: standings.sort((a, b) => a.rank - b.rank),
  }));
}
