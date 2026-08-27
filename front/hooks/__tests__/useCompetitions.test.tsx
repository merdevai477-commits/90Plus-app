/**
 * Regression tests for the Predict & Win hub list hook.
 *
 * Each case here maps to a bug the hub actually shipped with:
 *  - `changeFilter(undefined)` could not clear the filter, because the load
 *    resolved its arguments with `opts.filter ?? filter` — `undefined` fell
 *    straight back to the previous value. Deselecting a quick-filter tile (and
 *    the filter glyph, whose only job is clearing) left the list filtered.
 *  - The first load ran once on mount, before Clerk had resolved. A signed-in
 *    user was therefore fetched as anonymous, so every card came back with
 *    `myEntry: null` and "تحدياتي" was permanently empty.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '@clerk/clerk-expo';

import { useCompetitions } from '../useCompetitions';
import { CompetitionsService } from '../../services/competitions.service';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';

jest.mock('@clerk/clerk-expo', () => ({ useAuth: jest.fn() }));

jest.mock('../../utils/clerkAuthToken', () => ({
  getClerkBearerToken: jest.fn(),
}));

jest.mock('../../services/competitions.service', () => ({
  CompetitionsService: {
    list: jest.fn(),
    getPrizeCategories: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedList = CompetitionsService.list as jest.Mock;
const mockedCategories = CompetitionsService.getPrizeCategories as jest.Mock;
const mockedBearer = getClerkBearerToken as jest.Mock;

function signedIn(token: string | null = 'tok') {
  mockedUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: token !== null,
    getToken: jest.fn().mockResolvedValue(token),
  } as any);
  mockedBearer.mockImplementation(async () => token);
}

function authPending() {
  mockedUseAuth.mockReturnValue({
    isLoaded: false,
    isSignedIn: false,
    getToken: jest.fn().mockResolvedValue(null),
  } as any);
}

const page = (ids: string[] = ['c1'], nextCursor: string | null = null) => ({
  items: ids.map((id) => ({ id })),
  nextCursor,
});

describe('useCompetitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockResolvedValue(page());
    mockedCategories.mockResolvedValue([]);
    mockedBearer.mockResolvedValue(null);
  });

  it('loads the public list while Clerk is still pending', async () => {
    authPending();
    renderHook(() => useCompetitions());
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));
    expect(mockedList).toHaveBeenLastCalledWith(null, expect.objectContaining({ tab: 'all' }));
  });

  it('waits for Clerk before the first request', async () => {
    authPending();
    const { rerender } = renderHook(() => useCompetitions());

    // The public list may load while auth is still pending — that is fine.
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    signedIn('tok');
    rerender({});

    await waitFor(() => expect(mockedList.mock.calls.some((c) => c[0] === 'tok')));
  });

  it('re-requests with the session token when the user signs in', async () => {
    signedIn(null);
    const { rerender } = renderHook(() => useCompetitions());
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));
    expect(mockedList).toHaveBeenLastCalledWith(null, expect.anything());

    signedIn('tok');
    rerender({});
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(mockedList).toHaveBeenLastCalledWith('tok', expect.anything());
  });

  it('clears the quick filter instead of resending the previous one', async () => {
    signedIn();
    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.changeFilter('popular');
    });
    expect(mockedList).toHaveBeenLastCalledWith('tok', expect.objectContaining({ filter: 'popular' }));

    await act(async () => {
      await result.current.changeFilter(undefined);
    });
    expect(mockedList).toHaveBeenLastCalledWith('tok', expect.objectContaining({ filter: undefined }));
    expect(result.current.filter).toBeUndefined();
  });

  it('clears the visible page while a tab swap is in flight', async () => {
    signedIn();
    let resolveTab: (v: unknown) => void = () => undefined;
    mockedList
      .mockResolvedValueOnce(page(['initial']))
      .mockImplementationOnce(() => new Promise((r) => { resolveTab = r; }));

    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      void result.current.changeTab('today');
      await Promise.resolve();
    });

    expect(result.current.items).toEqual([]);

    await act(async () => {
      resolveTab(page(['today']));
      await Promise.resolve();
    });

    expect(result.current.items.map((i: any) => i.id)).toEqual(['today']);
  });

  it('keeps tab and filter together when only one of them changes', async () => {
    signedIn();
    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.changeFilter('free');
    });
    await act(async () => {
      await result.current.changeTab('today');
    });

    expect(mockedList).toHaveBeenLastCalledWith(
      'tok',
      expect.objectContaining({ tab: 'today', filter: 'free' }),
    );
  });

  it('short-circuits "تحدياتي" without a session rather than calling the API', async () => {
    signedIn(null);
    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.changeTab('mine');
    });

    expect(mockedList).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('AUTH_REQUIRED');
    expect(result.current.items).toEqual([]);
  });

  it('reports a failed load as an error, never as an empty list', async () => {
    signedIn();
    mockedList.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useCompetitions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('drops a superseded response so the slower tab does not win', async () => {
    signedIn();
    let resolveSlow: (v: any) => void = () => undefined;
    mockedList
      .mockImplementationOnce(() => Promise.resolve(page(['initial'])))
      // "today" — deliberately slow
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }))
      // "sponsored" — resolves first
      .mockImplementationOnce(() => Promise.resolve(page(['sponsored'])));

    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      void result.current.changeTab('today');
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.changeTab('sponsored');
    });

    await act(async () => {
      resolveSlow(page(['stale-today']));
      await Promise.resolve();
    });

    expect(result.current.items.map((i: any) => i.id)).toEqual(['sponsored']);
  });

  it('appends the next page and stops when the cursor runs out', async () => {
    signedIn();
    mockedList
      .mockResolvedValueOnce(page(['c1'], 'cur1'))
      .mockResolvedValueOnce(page(['c2'], null));

    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockedList).toHaveBeenLastCalledWith('tok', expect.objectContaining({ cursor: 'cur1' }));
    expect(result.current.items.map((i: any) => i.id)).toEqual(['c1', 'c2']);
    expect(result.current.hasMore).toBe(false);

    // No cursor left — a trailing onEndReached must not re-fire the request.
    const callsBefore = mockedList.mock.calls.length;
    await act(async () => {
      await result.current.loadMore();
    });
    expect(mockedList).toHaveBeenCalledTimes(callsBefore);
  });

  it('does not wipe a rendered page when an append fails', async () => {
    signedIn();
    mockedList.mockResolvedValueOnce(page(['c1'], 'cur1'));
    const { result } = renderHook(() => useCompetitions());
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    mockedList.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.map((i: any) => i.id)).toEqual(['c1']);
  });
});
