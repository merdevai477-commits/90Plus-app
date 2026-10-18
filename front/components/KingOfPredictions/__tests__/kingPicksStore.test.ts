import { useKingPicksStore } from '../kingPicksStore';

const meta = {
  homeTeam: 'Home',
  awayTeam: 'Away',
  matchDate: '2026-10-18T12:00:00.000Z',
};

beforeEach(() => {
  useKingPicksStore.getState().clear();
});

describe('useKingPicksStore hydrate', () => {
  it('keeps a confirmed pending pick when a later empty hydrate arrives', () => {
    const store = useKingPicksStore.getState();
    const seq = store.begin(
      '42',
      { type: 'home', home: null, away: null, correct: null },
      meta,
    );
    store.confirm('42', seq);

    expect(useKingPicksStore.getState().server['42']?.type).toBe('home');

    // Simulate a stale/empty GET after a successful POST (iOS focus reload).
    store.hydrate({});

    const pick = useKingPicksStore.getState().server['42'];
    expect(pick?.type).toBe('home');
    expect(pick?.correct).toBeNull();
  });

  it('keeps an in-flight local pick when hydrate omits it', () => {
    const store = useKingPicksStore.getState();
    store.begin('7', { type: 'draw', home: null, away: null, correct: null }, meta);

    store.hydrate({});

    expect(useKingPicksStore.getState().local['7']?.type).toBe('draw');
    expect(useKingPicksStore.getState().server['7']?.type).toBe('draw');
  });

  it('drops local once the server echoes the same pick', () => {
    const store = useKingPicksStore.getState();
    const seq = store.begin(
      '9',
      { type: 'away', home: null, away: null, correct: null },
      meta,
    );
    store.confirm('9', seq);

    store.hydrate({
      '9': {
        prediction: { type: 'away' },
        predictedHomeScore: null,
        predictedAwayScore: null,
        isCorrect: null,
      },
    });

    expect(useKingPicksStore.getState().local['9']).toBeUndefined();
    expect(useKingPicksStore.getState().server['9']?.type).toBe('away');
  });
});
