import {
  displayMatchListCountry,
  displayMatchListCountryFlag,
  isViewerFromIsrael,
} from '../matchesCountryDisplay';
import { groupMatchesByCountry } from '../matchesGrouping';
import type { Match } from '../../components/Matches/matchCardUtils';

function israelMatch(id: string): Match {
  return {
    id,
    homeTeam: { name: 'H', logo: '' },
    awayTeam: { name: 'A', logo: '' },
    score: { home: 0, away: 0 },
    status: 'upcoming',
    statusShort: 'NS',
    elapsed: null,
    extra: null,
    minute: '',
    time: '18:00',
    fixtureDate: '2026-09-04T18:00:00.000Z',
    league: {
      id: 383,
      name: "Ligat ha'Al",
      logo: '',
      country: 'Israel',
      countryFlag: 'https://media.api-sports.io/flags/il.svg',
    },
  };
}

describe('matchesCountryDisplay', () => {
  it('detects Israel viewers from name, ISO, and emoji', () => {
    expect(isViewerFromIsrael('Israel', null)).toBe(true);
    expect(isViewerFromIsrael('il', null)).toBe(true);
    expect(isViewerFromIsrael('إسرائيل', null)).toBe(true);
    expect(isViewerFromIsrael(null, '🇮🇱')).toBe(true);
    expect(isViewerFromIsrael('Egypt', '🇪🇬')).toBe(false);
    expect(isViewerFromIsrael(null, null)).toBe(false);
  });

  it('remaps Israel → Palestine for non-Israel viewers', () => {
    expect(displayMatchListCountry('Israel', false)).toBe('Palestine');
    expect(displayMatchListCountry('Israel', true)).toBe('Israel');
    expect(displayMatchListCountryFlag('Israel', 'https://x/il.svg', false)).toBeNull();
    expect(displayMatchListCountryFlag('Israel', 'https://x/il.svg', true)).toBe(
      'https://x/il.svg',
    );
  });

  it('groups Israeli leagues under Palestine for non-Israel viewers', () => {
    const groups = groupMatchesByCountry([israelMatch('1')], undefined, {
      viewerIsIsrael: false,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].country).toBe('Palestine');
    expect(groups[0].countryFlag).toMatch(/\/ps\.png/);
  });

  it('keeps Israel for Israel viewers', () => {
    const groups = groupMatchesByCountry([israelMatch('1')], undefined, {
      viewerIsIsrael: true,
    });
    expect(groups[0].country).toBe('Israel');
  });
});
