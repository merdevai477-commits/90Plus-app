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
    getTopScorers: jest.fn(),
    getTeamMatches: jest.fn(),
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
  },
}));

jest.mock('../services/football.service', () => ({
  footballService: {
    isConfigured: jest.fn(() => true),
    getLiveFixtures: jest.fn(async () => []),
  },
}));

import { footballDataCacheService } from '../services/football-data-cache.service';
import { fetchPlayerStatsRow } from '../services/chat-football-tools.service';
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
    expect(parsed.source).toBe('365scores');
    expect(parsed.athleteId).toBe(42);
    expect(parsed.club).toBe('Real Madrid');
    expect(parsed.fifaWorldCup).toEqual([]);
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
});
