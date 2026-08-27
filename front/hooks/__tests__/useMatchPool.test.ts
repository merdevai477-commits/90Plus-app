/**
 * Regression tests for "Choose Match calls the endpoint continuously".
 *
 * Root cause: `@clerk/clerk-expo`'s `useAuth` builds `getToken` as a plain
 * `const getToken = (opts) => …` inside the hook body — a new function
 * reference on every render, never memoised
 * (`@clerk/clerk-expo/dist/hooks/useAuth.js`). The wizard's step-2 effect
 * listed it as a dependency *and* ended in `setMatches(pool)`, which is always
 * a fresh array, so the effect re-armed itself without end:
 *
 *     effect → GET /match-pool → setMatches → render → new getToken → effect …
 *
 * `useAuth` is mocked here the way Clerk really behaves — a new closure per
 * call — so a regression reintroduces the loop instead of hiding behind a
 * conveniently stable `jest.fn()`.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '@clerk/clerk-expo';

import { useMatchPool } from '../useMatchPool';
import { CompetitionsService } from '../../services/competitions.service';

jest.mock('@clerk/clerk-expo', () => ({ useAuth: jest.fn() }));

jest.mock('../../services/competitions.service', () => ({
  CompetitionsService: { getMatchPool: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const getMatchPool = CompetitionsService.getMatchPool as jest.Mock;

/** Mirrors Clerk: a brand-new `getToken` closure on every render. */
function clerkWith(token: string | null) {
  mockedUseAuth.mockImplementation(
    () => ({ getToken: () => Promise.resolve(token) }) as never,
  );
}

/** Lets queued promise jobs settle without advancing wall-clock time. */
async function flush(times = 8) {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useMatchPool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clerkWith('tok');
    // A fresh array per call, exactly like a real HTTP response — the identity
    // change is half of what drove the loop.
    getMatchPool.mockImplementation(async () => [{ apiMatchId: 1 }]);
  });

  it('issues exactly one request when the step opens', async () => {
    const { result } = renderHook(() => useMatchPool(true));
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    await flush();

    expect(getMatchPool).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('does not re-request when the parent re-renders', async () => {
    const { result, rerender } = renderHook(() => useMatchPool(true));
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(1));

    // Each re-render hands the hook a brand-new `getToken`, which is precisely
    // what used to re-fire the request.
    for (let i = 0; i < 8; i += 1) rerender({});
    await flush();

    expect(getMatchPool).toHaveBeenCalledTimes(1);
    expect(result.current.matches).toHaveLength(1);
  });

  it('does not request while the step is not on screen', async () => {
    renderHook(() => useMatchPool(false));
    await flush();
    expect(getMatchPool).not.toHaveBeenCalled();
  });

  it('re-requests once per re-entry of the step', async () => {
    const { rerender } = renderHook(({ on }) => useMatchPool(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(1));

    rerender({ on: false });
    await flush();
    expect(getMatchPool).toHaveBeenCalledTimes(1);

    rerender({ on: true });
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(2));
    await flush();
    expect(getMatchPool).toHaveBeenCalledTimes(2);
  });

  it('retry issues exactly one more request', async () => {
    const { result } = renderHook(() => useMatchPool(true));
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(2));
    await flush();

    expect(getMatchPool).toHaveBeenCalledTimes(2);
  });

  it('reports a failed request as an error, not as an empty pool', async () => {
    getMatchPool.mockRejectedValue(new Error('NETWORK'));
    const { result } = renderHook(() => useMatchPool(true));

    await waitFor(() => expect(result.current.error).toBe(true));
    await flush();

    expect(result.current.matches).toEqual([]);
    expect(result.current.loading).toBe(false);
    // A failure must not retry itself — that was the loop in another costume.
    expect(getMatchPool).toHaveBeenCalledTimes(1);
  });

  it('treats a missing session as an error rather than an empty pool', async () => {
    clerkWith(null);
    const { result } = renderHook(() => useMatchPool(true));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(getMatchPool).not.toHaveBeenCalled();
  });

  it('drops a response that arrives after the step closed', async () => {
    let release: (value: unknown[]) => void = () => undefined;
    getMatchPool.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve as (value: unknown[]) => void;
        }),
    );

    const { result, rerender } = renderHook(({ on }) => useMatchPool(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(getMatchPool).toHaveBeenCalledTimes(1));

    rerender({ on: false });
    await act(async () => {
      release([{ apiMatchId: 99 }]);
      await Promise.resolve();
    });
    await flush();

    // The slow response belongs to a step the user has left.
    expect(result.current.matches).toEqual([]);
  });
});
