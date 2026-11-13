import {
  MASKED_TEAM_LOGO_URL,
  MASKED_TEAM_NAME,
  maskFixtureDetailsForClient,
  maskFixtureForClient,
  maskFixturesForClient,
} from '../masked-national-team';

const ISRAEL_LOGO =
  'https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/5034';

describe('masked national team', () => {
  it('masks the senior national team on an upcoming fixture and leaves the opponent', () => {
    const fixture = {
      fixture: { id: 4672294 },
      teams: {
        home: { id: 19414, name: 'Kosovo', logo: 'https://cdn.example/kosovo.png' },
        away: { id: 5034, name: 'Israel', logo: ISRAEL_LOGO },
      },
    };

    const masked = maskFixtureForClient(fixture);

    expect(masked.teams.home).toEqual(fixture.teams.home);
    expect(masked.teams.away.name).toBe(MASKED_TEAM_NAME);
    expect(masked.teams.away.logo).toBe(MASKED_TEAM_LOGO_URL);
    expect(fixture.teams.away.name).toBe('Israel');
  });

  it('does not mask youth sides or Northern Ireland', () => {
    const fixtures = maskFixturesForClient([
      {
        teams: {
          home: { name: 'Israel U21', logo: 'https://cdn.example/u21.png' },
          away: { name: 'Northern Ireland', logo: 'https://cdn.example/nir.png' },
        },
      },
    ]);

    expect(fixtures[0].teams.home.name).toBe('Israel U21');
    expect(fixtures[0].teams.away.name).toBe('Northern Ireland');
  });

  it('masks lineup and event team crests on the details bundle', () => {
    const bundle = maskFixtureDetailsForClient({
      fixture: {
        teams: {
          home: { name: 'Kosovo', logo: 'k' },
          away: { name: 'Israel', logo: ISRAEL_LOGO },
        },
      },
      lineups: [{ team: { id: 5034, name: 'Israel', logo: ISRAEL_LOGO }, formation: '4-3-3' }],
      events: [{ team: { name: 'Israel', logo: ISRAEL_LOGO }, type: 'Goal' }],
      statistics: [{ team: { name: 'Kosovo', logo: 'k' } }],
    });

    expect(bundle.fixture.teams.away.name).toBe(MASKED_TEAM_NAME);
    expect(bundle.lineups[0].team.name).toBe(MASKED_TEAM_NAME);
    expect(bundle.lineups[0].formation).toBe('4-3-3');
    expect(bundle.events[0].team.logo).toBe(MASKED_TEAM_LOGO_URL);
    expect(bundle.statistics[0].team.name).toBe('Kosovo');
  });
});
