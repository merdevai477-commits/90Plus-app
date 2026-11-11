import { matchRowPropsEqual, type MatchRowCompareProps } from '../matchRowPropsEqual';

const onPredict = () => undefined;
const onToggle = () => undefined;
const onOpen = () => undefined;

function props(overrides: Partial<MatchRowCompareProps> = {}): MatchRowCompareProps {
  return {
    fixture: {
      id: '10',
      status: 'LIVE',
      statusShort: '1H',
      elapsed: 23,
      extra: null,
      homeScore: 1,
      awayScore: 0,
      live: true,
      minute: "23'",
      home: 'Home',
      away: 'Away',
      homeLogo: 'h',
      awayLogo: 'a',
    },
    showPreds: false,
    onPredict,
    submittingId: null,
    predictedMatches: {},
    isSubscribed: false,
    isSubscribing: false,
    onToggleSubscription: onToggle,
    onOpenDetails: onOpen,
    ...overrides,
  };
}

describe('matchRowPropsEqual', () => {
  it('skips a row when another fixture prediction changes', () => {
    const prev = props();
    const next = props({
      predictedMatches: { '99': { type: 'home', isCorrect: null } },
    });
    expect(matchRowPropsEqual(prev, next)).toBe(true);
  });

  it('rerenders when this fixture score or minute changes', () => {
    const prev = props();
    expect(
      matchRowPropsEqual(prev, props({ fixture: { ...prev.fixture, homeScore: 2 } })),
    ).toBe(false);
    expect(
      matchRowPropsEqual(prev, props({ fixture: { ...prev.fixture, elapsed: 24, minute: "24'" } })),
    ).toBe(false);
  });

  it('rerenders only the row whose prediction changed', () => {
    const prev = props({ predictedMatches: { '10': { type: 'draw', isCorrect: null } } });
    const next = props({ predictedMatches: { '10': { type: 'home', isCorrect: null } } });
    expect(matchRowPropsEqual(prev, next)).toBe(false);
    expect(matchRowPropsEqual(prev, props({ nameRevision: 2 }))).toBe(false);
  });
});
