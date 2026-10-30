import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ isLoaded: true, userId: null }) }));

jest.mock('../../../services/predictions.service', () => {
  class PredictionApiError extends Error {
    status: number;
    constructor(message: string, code: number) {
      super(message);
      this.status = code;
    }
  }
  return {
    PredictionApiError,
    PredictionsService: { getPredictionsForMatches: jest.fn() },
  };
});

import { PredictionApiError, PredictionsService } from '../../../services/predictions.service';
import {
  isDefiniteRejection,
  settleUncertainSave,
  useKingPicksStore,
} from '../kingPicksStore';

const getPredictionsForMatches = PredictionsService.getPredictionsForMatches as jest.Mock;

const meta = {
  homeTeam: 'Home',
  awayTeam: 'Away',
  matchDate: '2026-10-18T12:00:00.000Z',
};

const homeRow = {
  prediction: { type: 'home' },
  predictedHomeScore: null,
  predictedAwayScore: null,
  isCorrect: null,
};

beforeEach(async () => {
  getPredictionsForMatches.mockReset();
  useKingPicksStore.setState({
    server: {},
    local: {},
    confirmed: 0,
    userId: null,
    fromDisk: {},
    bound: false,
    results: 0,
  });
  await AsyncStorage.clear();
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

describe('a save that failed without a definite answer (D3)', () => {
  const pick = { type: 'home' as const, home: null, away: null, correct: null };

  it('no revert when refetch shows saved', async () => {
    const seq = useKingPicksStore.getState().begin('42', pick, meta);
    getPredictionsForMatches.mockResolvedValue({ '42': homeRow });

    await expect(settleUncertainSave('tok', '42', seq)).resolves.toBe('confirmed');

    expect(useKingPicksStore.getState().server['42']?.type).toBe('home');
    expect(useKingPicksStore.getState().confirmed).toBe(1);
  });

  it('reverts when refetch shows the server does not have it', async () => {
    const seq = useKingPicksStore.getState().begin('42', pick, meta);
    getPredictionsForMatches.mockResolvedValue({});

    await expect(settleUncertainSave('tok', '42', seq)).resolves.toBe('reverted');

    expect(useKingPicksStore.getState().local['42']).toBeUndefined();
  });

  it('reverts when the server holds a different pick', async () => {
    const seq = useKingPicksStore.getState().begin('42', { ...pick, type: 'draw' }, meta);
    getPredictionsForMatches.mockResolvedValue({ '42': homeRow });

    await expect(settleUncertainSave('tok', '42', seq)).resolves.toBe('reverted');
  });

  it('leaves the pick pending when the refetch fails too', async () => {
    const seq = useKingPicksStore.getState().begin('42', pick, meta);
    getPredictionsForMatches.mockRejectedValue(new TypeError('Network request failed'));

    await expect(settleUncertainSave('tok', '42', seq)).resolves.toBe('unknown');

    expect(useKingPicksStore.getState().local['42']?.type).toBe('home');
  });

  it('treats only a 4xx as a definite rejection', () => {
    expect(isDefiniteRejection(new PredictionApiError('locked', 409))).toBe(true);
    expect(isDefiniteRejection(new PredictionApiError('limit', 429))).toBe(true);
    expect(isDefiniteRejection(new PredictionApiError('boom', 502))).toBe(false);
    expect(isDefiniteRejection(new TypeError('Network request failed'))).toBe(false);
  });
});

describe('picks across sessions (D5, D6)', () => {
  const pending = { type: 'home' as const, home: null, away: null, correct: null };

  it('a token gap does not wipe the same user\'s picks', () => {
    const store = useKingPicksStore.getState();
    store.bindUser('user_a');
    store.confirm('42', store.begin('42', pending, meta));

    useKingPicksStore.getState().bindUser('user_a');

    expect(useKingPicksStore.getState().server['42']?.type).toBe('home');
  });

  it('sign-out and a different account wipe the picks', () => {
    const store = useKingPicksStore.getState();
    store.bindUser('user_a');
    store.confirm('42', store.begin('42', pending, meta));

    useKingPicksStore.getState().bindUser('user_b');
    expect(useKingPicksStore.getState().server).toEqual({});

    useKingPicksStore.getState().bindUser('user_b');
    useKingPicksStore.setState({ server: { '7': pending } });
    useKingPicksStore.getState().bindUser(null);
    expect(useKingPicksStore.getState().server).toEqual({});
  });

  it('persists confirmed picks but not in-flight saves', async () => {
    const store = useKingPicksStore.getState();
    store.bindUser('user_a');
    store.confirm('42', store.begin('42', pending, meta));
    store.begin('7', { ...pending, type: 'draw' }, meta);

    const saved = JSON.parse((await AsyncStorage.getItem('king-picks')) ?? '{}');

    expect(saved.state.userId).toBe('user_a');
    expect(Object.keys(saved.state.server)).toEqual(['42']);
    expect(saved.state.local).toBeUndefined();
  });

  async function restoreFor(savedUser: string | null) {
    await AsyncStorage.setItem('king-picks', JSON.stringify({
      state: { userId: savedUser, server: { '42': pending } },
      version: 0,
    }));
    await useKingPicksStore.persist.rehydrate();
  }

  it('restores the same user\'s picks after a restart', async () => {
    await restoreFor('user_a');
    useKingPicksStore.getState().bindUser('user_a');

    expect(useKingPicksStore.getState().server['42']?.type).toBe('home');
  });

  it('never restores one account\'s picks into another', async () => {
    useKingPicksStore.getState().bindUser('user_b');
    await restoreFor('user_a');

    expect(useKingPicksStore.getState().server).toEqual({});
  });

  it('drops a restored pick once the read it was asked in does not return it', async () => {
    await restoreFor('user_a');
    useKingPicksStore.getState().bindUser('user_a');

    useKingPicksStore.getState().hydrate({}, ['99']);
    expect(useKingPicksStore.getState().server['42']).toBeDefined();

    useKingPicksStore.getState().hydrate({}, ['42']);
    expect(useKingPicksStore.getState().server['42']).toBeUndefined();
  });
});

describe('result pushes (D9)', () => {
  it('noteResult bumps the counter the lists refetch on', () => {
    useKingPicksStore.getState().noteResult();
    useKingPicksStore.getState().noteResult();

    expect(useKingPicksStore.getState().results).toBe(2);
  });
});
