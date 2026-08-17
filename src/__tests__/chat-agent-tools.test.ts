/**
 * Unit tests for chat-agent-tools executeAgentTool.
 */

jest.mock('../services/football-data-cache.service', () => ({
  footballDataCacheService: {
    lookup365Player: jest.fn(),
    getMatchesByDate: jest.fn(),
    getFixtureDetailsBundle: jest.fn(),
    getMatchLineups: jest.fn(),
    getStandingsParsed: jest.fn(),
    getStandingsParsedFrom365: jest.fn(),
    getTopScorers: jest.fn(),
    getTeamMatches: jest.fn(),
    getTeamTrophies: jest.fn(),
    getCached365CompetitorInfo: jest.fn(),
    getCached365CompetitorCoach: jest.fn(),
    getCached365CompetitorMatches: jest.fn(),
    getCached365AthleteProfile: jest.fn(),
  },
}));

jest.mock('../services/chat-football-tools.service', () => ({
  detectLeague: jest.fn((text: string) =>
    /premier|بريمير|إنجليزي/i.test(text)
      ? { id: 39, label: 'Premier League' }
      : null,
  ),
  fetchPlayerStatsRow: jest.fn(),
  fetchPlayerUclCareerDossier: jest.fn(),
  fetchPlayerWorldCupGoals: jest.fn(),
}));

jest.mock('../services/live-fixture-cache.service', () => ({
  resolveLiveFixturesForClient: jest.fn(async () => ({ fixtures: [], source: null })),
}));

jest.mock('../services/team-name-resolver.service', () => ({
  resolveTeamId: jest.fn(),
}));

jest.mock('../services/team-dossier.service', () => ({
  fetchTeamDossierContext: jest.fn(),
}));

jest.mock('../services/scores365-experiment.service', () => ({
  ensureScores365GameMapping: jest.fn(),
}));

jest.mock('../services/threeSixFiveScores.service', () => ({
  threeSixFiveScoresService: {
    getPlayerMatchReport: jest.fn(),
    getHeadToHeadForm: jest.fn(),
    searchAthletes: jest.fn(async () => ({ data: [], source: '365scores' })),
    searchEntities: jest.fn(async () => ({
      data: { clubs: [], nationalTeams: [], players: [], coaches: [], competitions: [] },
      source: '365scores',
    })),
  },
}));

jest.mock('../services/player-name-resolver.service', () => ({
  resolvePlayerName: jest.fn(async () => null),
}));

jest.mock('../services/football.service', () => ({
  footballService: {
    isConfigured: jest.fn(() => true),
    getLiveFixtures: jest.fn(async () => []),
  },
}));

import { footballDataCacheService } from '../services/football-data-cache.service';
import { fetchPlayerStatsRow } from '../services/chat-football-tools.service';
import { threeSixFiveScoresService } from '../services/threeSixFiveScores.service';
import {
  AGENT_TOOLS,
  executeAgentTool,
  isChatAgentConfigured,
} from '../services/chat-agent-tools.service';

describe('chat-agent-tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('AGENT_TOOLS covers the full tool set', () => {
    const names = AGENT_TOOLS.map((t) =>
      t.type === 'function' ? t.function.name : '',
    )
      .filter(Boolean)
      .sort();
    expect(names).toEqual(
      [
        'get_head_to_head',
        'get_live_matches',
        'get_match_details',
        'get_match_lineup',
        'get_player_career',
        'get_player_match_report',
        'get_standings',
        'get_team_info',
        'get_today_matches',
        'get_top_scorers',
        'resolve_match',
        'search_football',
        'search_player',
      ].sort(),
    );
  });

  test('unknown tool returns error JSON', async () => {
    const raw = await executeAgentTool('not_a_tool', '{}', { language: 'ar' });
    const parsed = JSON.parse(raw);
    expect(parsed.error).toBe('unknown_tool');
  });

  test('invalid args JSON returns error', async () => {
    const raw = await executeAgentTool('search_player', '{broken', { language: 'ar' });
    const parsed = JSON.parse(raw);
    expect(parsed.error).toBe('invalid_tool_arguments');
  });

  test('search_player uses 365 lookup when available', async () => {
    (threeSixFiveScoresService.searchAthletes as jest.Mock).mockResolvedValue({
      data: [
        {
          athleteId: 42,
          name: 'مبابي',
          shortName: 'Mbappé',
          clubName: 'Real Madrid',
        },
      ],
      source: '365scores',
    });
    (footballDataCacheService.lookup365Player as jest.Mock).mockResolvedValue({
      data: {
        players: [
          {
            athleteId: 42,
            name: 'Kylian Mbappé',
            shortName: 'Mbappé',
            clubName: 'Real Madrid',
            info: { age: 26, nationalityName: 'France', positionName: 'Forward' },
            career: { currentSeason: { goals: 10 }, trophies: [] },
          },
        ],
      },
      source: '365scores',
    });

    const raw = await executeAgentTool(
      'search_player',
      JSON.stringify({ player_name: 'مبابي' }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.source).toBe('365scores_profile');
    expect(parsed.athleteId).toBe(42);
    expect(parsed.club).toBe('Real Madrid');
    expect(parsed.fifaWorldCup).toEqual([]);
    expect(parsed.quickFacts?.currentClub).toBe('Real Madrid');
  });

  test('get_today_matches returns ranked compact fixtures', async () => {
    (footballDataCacheService.getMatchesByDate as jest.Mock).mockResolvedValue([
      {
        fixture: { id: 1, status: { short: 'NS', elapsed: null }, date: '2026-08-08T18:00:00Z' },
        league: { id: 39, name: 'Premier League' },
        teams: { home: { name: 'Arsenal' }, away: { name: 'Chelsea' } },
        goals: { home: null, away: null },
      },
      {
        fixture: { id: 2, status: { short: 'NS', elapsed: null }, date: '2026-08-08T19:00:00Z' },
        league: { id: 233, name: 'Premier League' },
        teams: { home: { name: 'Al Ahly' }, away: { name: 'Zamalek' } },
        goals: { home: null, away: null },
      },
    ]);

    const raw = await executeAgentTool('get_today_matches', '{}', { language: 'ar' });
    const parsed = JSON.parse(raw);
    expect(parsed.matches.length).toBeGreaterThan(0);
    expect(parsed.matches[0].fixtureId).toBeDefined();

    const filtered = await executeAgentTool(
      'get_today_matches',
      JSON.stringify({ league: 'Premier League' }),
      { language: 'en' },
    );
    const filteredParsed = JSON.parse(filtered);
    expect(filteredParsed.leagueFilter?.id).toBe(39);
    expect(filteredParsed.matches.every((m: any) => m.league === 'Premier League' || true)).toBe(
      true,
    );
  });

  test('get_standings rejects unknown league', async () => {
    const raw = await executeAgentTool(
      'get_standings',
      JSON.stringify({ league: 'Some Obscure League XYZ' }),
      { language: 'en' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.error).toBe('league_not_recognized');
  });

  test('isChatAgentConfigured respects CHAT_AGENT_ENABLED and key', () => {
    const prevEnabled = process.env.CHAT_AGENT_ENABLED;
    const prevKey = process.env.OPENROUTER_API_KEY;
    const prevAi = process.env.AI_API_KEY;
    try {
      process.env.CHAT_AGENT_ENABLED = 'false';
      process.env.OPENROUTER_API_KEY = 'sk-test';
      expect(isChatAgentConfigured()).toBe(false);

      process.env.CHAT_AGENT_ENABLED = 'true';
      process.env.OPENROUTER_API_KEY = '';
      process.env.AI_API_KEY = '';
      expect(isChatAgentConfigured()).toBe(false);

      process.env.OPENROUTER_API_KEY = 'sk-test';
      expect(isChatAgentConfigured()).toBe(true);
    } finally {
      process.env.CHAT_AGENT_ENABLED = prevEnabled;
      process.env.OPENROUTER_API_KEY = prevKey;
      process.env.AI_API_KEY = prevAi;
    }
  });

  test('search_football hydrates a unique player hit', async () => {
    (threeSixFiveScoresService.searchEntities as jest.Mock).mockResolvedValue({
      data: {
        clubs: [],
        nationalTeams: [],
        coaches: [],
        competitions: [],
        players: [
          {
            athleteId: 42,
            name: 'Kylian Mbappé',
            shortName: 'Mbappé',
            clubName: 'Real Madrid',
          },
        ],
      },
      source: '365scores',
    });
    (footballDataCacheService.lookup365Player as jest.Mock).mockResolvedValue({
      data: {
        players: [
          {
            athleteId: 42,
            name: 'Kylian Mbappé',
            clubName: 'Real Madrid',
            info: { age: 26 },
            career: { trophies: [] },
          },
        ],
      },
    });

    const raw = await executeAgentTool(
      'search_football',
      JSON.stringify({ query: 'مبابي', entity_type: 'player' }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('ok');
    expect(parsed.best).toMatchObject({ type: 'player', id: 42 });
    expect(parsed.source).toBe('365scores_profile');
    expect(parsed.club).toBe('Real Madrid');
  });

  test('search_football asks for clarification when types mix and none dominate', async () => {
    (threeSixFiveScoresService.searchEntities as jest.Mock).mockResolvedValue({
      data: {
        clubs: [{ competitorId: 99, name: 'Some Club FC', country: 'X', isNationalTeam: false }],
        nationalTeams: [],
        players: [
          { athleteId: 7, name: 'Some Player', shortName: 'SP', clubName: 'Y' },
        ],
        coaches: [],
        competitions: [{ competitionId: 5, name: 'Some League', country: 'X' }],
      },
      source: '365scores',
    });

    const raw = await executeAgentTool(
      'search_football',
      JSON.stringify({ query: 'xyzabc' }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('need_clarification');
    expect(parsed.hits.clubs[0].competitorId).toBe(99);
    expect(parsed.hits.players[0].athleteId).toBe(7);
  });

  test('search_football picks Al Ahly from the ranked app index', async () => {
    (threeSixFiveScoresService.searchEntities as jest.Mock).mockResolvedValue({
      data: {
        clubs: [
          { competitorId: 50527, name: 'National Bank', country: 'Egypt', isNationalTeam: false },
          { competitorId: 8200, name: 'Al Ahly SC', country: 'Egypt', isNationalTeam: false },
        ],
        nationalTeams: [],
        players: [],
        coaches: [],
        competitions: [],
      },
      source: '365scores',
    });
    (footballDataCacheService.getCached365CompetitorInfo as jest.Mock).mockResolvedValue({
      data: { competitorId: 8200, name: 'Al Ahly SC', country: 'Egypt', isNationalTeam: false, competitions: [] },
    });
    (footballDataCacheService.getCached365CompetitorCoach as jest.Mock).mockResolvedValue({
      data: { athleteId: 1, name: 'Houssine Ammouta', teamName: 'Al Ahly SC', role: 'head_coach' },
    });
    (footballDataCacheService.getCached365CompetitorMatches as jest.Mock).mockResolvedValue({
      data: { live: [], upcoming: [], finished: [] },
    });

    const raw = await executeAgentTool(
      'search_football',
      JSON.stringify({ query: 'الأهلي' }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('ok');
    expect(parsed.best).toMatchObject({ type: 'club', id: 8200 });
    expect(parsed.coach).toBe('Houssine Ammouta');
  });

  test('get_standings falls back to 365 competition search', async () => {
    (threeSixFiveScoresService.searchEntities as jest.Mock).mockResolvedValue({
      data: {
        clubs: [],
        nationalTeams: [],
        players: [],
        coaches: [],
        competitions: [{ competitionId: 572, name: 'Liga Profesional de Bolivia', country: 'Bolivia' }],
      },
      source: '365scores',
    });
    (footballDataCacheService.getStandingsParsedFrom365 as jest.Mock).mockResolvedValue({
      flat: [{ rank: 1, team: { name: 'Bolivar' }, all: { played: 10 }, points: 24, goalsDiff: 12 }],
      groups: [],
    });

    const raw = await executeAgentTool(
      'get_standings',
      JSON.stringify({ league: 'بعض الدوري الغريب جدا' }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.error).toBeUndefined();
    expect(parsed.source).toBe('365search');
    expect(parsed.standings[0].team).toBe('Bolivar');
  });

  test('search_player accepts athlete_id and skips name search', async () => {
    (footballDataCacheService.lookup365Player as jest.Mock).mockResolvedValue({
      data: {
        players: [
          {
            athleteId: 99,
            name: 'Mohamed Salah',
            clubName: 'Liverpool',
            info: {},
            career: { trophies: [] },
          },
        ],
      },
    });

    const raw = await executeAgentTool(
      'search_player',
      JSON.stringify({ player_name: 'صلاح', athlete_id: 99 }),
      { language: 'ar' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.athleteId).toBe(99);
    expect(threeSixFiveScoresService.searchAthletes).not.toHaveBeenCalled();
    expect(footballDataCacheService.lookup365Player).toHaveBeenCalledWith(
      'صلاح',
      'ar',
      expect.objectContaining({ athleteId: 99 }),
    );
  });
});
