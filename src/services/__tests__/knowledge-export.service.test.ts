import {
  buildCompetitionExportFromCareers,
  CareerExportRow,
  listCompetitionsFromCareers,
  listSeasonsFromCareers,
} from '../knowledge-export.service';

function sampleCareers(): CareerExportRow[] {
  return [
    {
      athleteId: 47349,
      name: 'Hakimi',
      position: 'Defender',
      nationality: 'Morocco',
      seasons: [
        {
          seasonKey: '2026',
          label: '2025/2026',
          competitions: [
            {
              competitionId: 35,
              competitionName: 'Ligue 1',
              teamId: 100,
              teamName: 'PSG',
              appearances: 20,
              goals: 2,
              assists: 5,
              minutes: 1800,
              yellowCards: 3,
              redCards: 0,
              rating: 7.2,
            },
            {
              competitionId: 572,
              competitionName: 'UCL',
              teamId: 100,
              teamName: 'PSG',
              appearances: 8,
              goals: 1,
              assists: 2,
              minutes: null,
              yellowCards: 1,
              redCards: null,
              rating: null,
            },
          ],
        },
        {
          seasonKey: '2025',
          label: '2024/2025',
          competitions: [
            {
              competitionId: 35,
              competitionName: 'Ligue 1',
              teamId: 100,
              teamName: 'PSG',
              appearances: 30,
              goals: 4,
              assists: 8,
              minutes: 2500,
              yellowCards: 4,
              redCards: 0,
              rating: 7.4,
            },
          ],
        },
      ],
    },
    {
      athleteId: 999,
      name: 'Other',
      position: 'Midfielder',
      nationality: null,
      seasons: [
        {
          seasonKey: '2026',
          label: '2025/2026',
          competitions: [
            {
              competitionId: 35,
              competitionName: 'Ligue 1',
              teamId: 200,
              teamName: 'OM',
              appearances: 10,
              goals: 0,
              assists: 1,
              minutes: 900,
              yellowCards: 2,
              redCards: 0,
              rating: 6.5,
            },
          ],
        },
      ],
    },
    {
      athleteId: 47349,
      name: 'Hakimi duplicate id should not appear twice on same team',
      position: 'Defender',
      nationality: 'Morocco',
      seasons: [
        {
          seasonKey: '2026',
          label: '2025/2026',
          competitions: [
            {
              competitionId: 35,
              competitionName: 'Ligue 1',
              teamId: 100,
              teamName: 'PSG',
              appearances: 99,
              goals: 99,
              assists: 99,
              minutes: 99,
              yellowCards: 99,
              redCards: 99,
              rating: 9.9,
            },
          ],
        },
      ],
    },
  ];
}

describe('knowledge-export.service builders', () => {
  it('exports season-specific competition membership with 2025/2026 label', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 35);
    expect(result.dataset.seasonKey).toBe('2026');
    expect(result.dataset.seasonLabel).toBe('2025/2026');
    expect(result.coverage.status).toBe('PARTIAL');
    expect(result.coverage.membershipSource).toBe('production_365_career');
    expect(result.coverage.seasonSpecific).toBe(true);
    expect(result.standings).toBeNull();
    expect(result.standingsAvailability).toBe('not_season_proven');
    expect(result.fixtures).toBeNull();
    expect(result.teamStatistics).toBeNull();
    expect(result.metrics.teamCount).toBe(2);
    expect(result.metrics.playerCount).toBe(2);

    const psg = result.teams.find((t) => t.teamId === 100);
    expect(psg?.players).toHaveLength(1);
    expect(psg?.players[0].athleteId).toBe(47349);
    expect(psg?.players[0].playerId).toBeNull();
    expect(psg?.players[0].statistics.goals).toBe(2);
    expect(psg?.players[0].statistics.appearances).toBe(20);
    // Wrong-season stats (2025 row) must not leak into 2026 export
    expect(psg?.players[0].statistics.goals).not.toBe(4);
  });

  it('does not include players from wrong competition', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 572);
    expect(result.metrics.playerCount).toBe(1);
    expect(result.teams[0].teamId).toBe(100);
    expect(result.teams[0].players[0].statistics.goals).toBe(1);
  });

  it('filters by teamId when requested', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 35, {
      teamId: 200,
    });
    expect(result.metrics.teamCount).toBe(1);
    expect(result.teams[0].teamId).toBe(200);
    expect(result.teams[0].players[0].athleteId).toBe(999);
  });

  it('throws on invalid seasonKey', () => {
    expect(() => buildCompetitionExportFromCareers(sampleCareers(), 'abc', 35)).toThrow(
      'INVALID_SEASON_KEY',
    );
  });

  it('throws on invalid competitionId', () => {
    expect(() => buildCompetitionExportFromCareers(sampleCareers(), 2026, 0)).toThrow(
      'INVALID_COMPETITION_ID',
    );
  });

  it('lists competitions for season without fabricating IDs', () => {
    const listed = listCompetitionsFromCareers(sampleCareers(), '2026');
    expect(listed.season.seasonLabel).toBe('2025/2026');
    expect(listed.competitions.map((c) => c.competitionId).sort()).toEqual([35, 572]);
    expect(listed.competitions.find((c) => c.competitionId === 35)?.leagueId).toBe(7_000_000 + 35);
    expect(listed.coverage.status).toBe('PARTIAL');
  });

  it('lists seasons from careers', () => {
    const seasons = listSeasonsFromCareers(sampleCareers());
    expect(seasons.some((s) => s.seasonKey === '2026' && s.seasonLabel === '2025/2026')).toBe(
      true,
    );
  });

  it('returns empty teams for season/competition mismatch', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 99999);
    expect(result.metrics.playerCount).toBe(0);
    expect(result.teams).toEqual([]);
    expect(result.coverage.status).toBe('PARTIAL');
  });

  it('deduplicates players within a team', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 35);
    const psg = result.teams.find((t) => t.teamId === 100)!;
    expect(psg.players.filter((p) => p.athleteId === 47349)).toHaveLength(1);
  });

  it('requires athleteId and never fabricates playerId', () => {
    const result = buildCompetitionExportFromCareers(sampleCareers(), 2026, 35);
    for (const team of result.teams) {
      for (const player of team.players) {
        expect(typeof player.athleteId).toBe('number');
        expect(player.athleteId).toBeGreaterThan(0);
        expect(player.playerId).toBeNull();
      }
    }
  });
});
