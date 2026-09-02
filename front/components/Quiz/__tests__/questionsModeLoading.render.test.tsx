/**
 * THE FREEZE, REPRODUCED — a question mode whose round never arrives.
 * =============================================================================
 *
 * "Football Bingo hangs on Algerian League / Confederation" is, from the app's
 * side, one shape: `QuestionsModeScreen` swaps its ENTIRE screen for the shared
 * spinner while `useQuestionModeSession` loads, so anything that keeps that
 * promise pending keeps the player on a bare spinner. The screen had no back
 * arrow, no retry and no timeout, so a slow or stalled round was indis-
 * tinguishable from the app freezing — there was genuinely nothing to tap.
 *
 * These tests mount the real screen and the real hook, and only replace the
 * network. The pending-forever case is the reported bug; it must now be
 * escapable within a few seconds of fake time.
 *
 *   npx jest -c jest.render.config.js questionsModeLoading.render
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

/**
 * Swapped per test — the session request stays pending until this says
 * otherwise. `mock`-prefixed so jest allows the factory below to close over it.
 */
let mockCreateSession: jest.Mock;

jest.mock('../../../services/questionsModes', () => {
  const actual = jest.requireActual('../../../services/questionsModes');
  return {
    ...actual,
    QuestionsModesService: {
      ...actual.QuestionsModesService,
      createSession: (...args: unknown[]) => mockCreateSession(...args),
    },
  };
});

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'test-token', isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: { id: 'u1' }, isLoaded: true, isSignedIn: true }),
}));

jest.mock('../../../utils/clerkAuthToken', () => ({
  getClerkBearerToken: async () => 'test-token',
}));

/*
 * The hook pushes the server's authoritative coin and XP balances into these
 * two contexts after a grade. Neither is involved in loading a round, so they
 * are stubbed rather than provided — the screen under test never gets far
 * enough to grade anything.
 */
jest.mock('../../../contexts/CoinsContext', () => ({
  useCoins: () => ({ coins: 0, applyCoinsBalance: jest.fn() }),
}));

jest.mock('../../../contexts/XpContext', () => ({
  useXp: () => ({ xp: 0, level: 1, applyXpSnapshot: jest.fn() }),
}));

/*
 * Pulled in transitively by the API config; it schedules a real health-check
 * interval that outlives the test environment and tears the worker down.
 */
jest.mock('../../../utils/enhancedNetworkService', () => ({
  enhancedNetworkService: {
    checkServerHealth: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
  },
}));

/** One mutable object so the factory closes over a single `mock*` binding. */
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  useLocalSearchParams: () => ({}),
}));

import QuestionsModeScreen from '../QuestionsModeScreen';
import { REQUEST_TIMEOUT_REASON } from '../../../services/questionsModes';

/** Never settles — the exact condition the freeze report describes. */
const pendingForever = () => new Promise<never>(() => {});

beforeEach(() => {
  jest.useFakeTimers();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  mockCreateSession = jest.fn(pendingForever);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

/** Advance fake timers from inside act(), so state updates are flushed. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('Football Bingo — the round never arrives', () => {
  it('still shows a back arrow while it is loading', async () => {
    render(<QuestionsModeScreen modeId="football-bingo" />);

    // Before ANY timer fires — the arrow is there from the first frame.
    expect(screen.getByTestId('game-loading-back')).toBeTruthy();
  });

  it('leaves the screen when that arrow is tapped', async () => {
    render(<QuestionsModeScreen modeId="football-bingo" />);

    fireEvent.press(screen.getByTestId('game-loading-back'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('falls back to the Questions hub when there is nothing to pop', async () => {
    // A deep link or a notification opens the mode as the FIRST screen, so
    // router.back() has no target. A back arrow that does nothing is the same
    // dead end as no arrow at all.
    mockRouter.canGoBack.mockReturnValue(false);
    render(<QuestionsModeScreen modeId="football-bingo" />);

    fireEvent.press(screen.getByTestId('game-loading-back'));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/quiz');
  });

  it('offers a retry once the wait stops being reasonable', async () => {
    render(<QuestionsModeScreen modeId="football-bingo" />);

    expect(screen.queryByTestId('questions-mode-loading-retry')).toBeNull();

    await advance(12_000);

    expect(screen.getByTestId('questions-mode-loading-retry')).toBeTruthy();
    expect(screen.getByText(/taking longer than usual/i)).toBeTruthy();
  });

  it('re-requests the round when that retry is tapped', async () => {
    render(<QuestionsModeScreen modeId="football-bingo" />);
    await advance(12_000);

    expect(mockCreateSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId('questions-mode-loading-retry'));
    });

    expect(mockCreateSession).toHaveBeenCalledTimes(2);
  });

  it('never leaves the player with a spinner and no way out', async () => {
    render(<QuestionsModeScreen modeId="football-bingo" />);

    // Well past any timeout in the stack.
    await advance(120_000);

    // At least one escape is always on screen.
    const escapes = [
      screen.queryByTestId('game-loading-back'),
      screen.queryByTestId('questions-mode-loading-retry'),
      screen.queryByTestId('questions-mode-error-back'),
    ].filter(Boolean);

    expect(escapes.length).toBeGreaterThan(0);
  });
});

describe('the round comes back as a failure', () => {
  it('explains a timeout as a connection problem, not a missing round', async () => {
    mockCreateSession = jest.fn().mockRejectedValue(new Error(REQUEST_TIMEOUT_REASON));

    render(<QuestionsModeScreen modeId="football-bingo" />);

    await waitFor(() => {
      expect(screen.getByText(/couldn't reach the server/i)).toBeTruthy();
    });
    // Not the "no round today" copy — that would send the player away from a
    // round which is probably fine.
    expect(screen.queryByText(/isn't available for this mode/i)).toBeNull();
  });

  it('offers both a retry and a way back on a recoverable failure', async () => {
    mockCreateSession = jest.fn().mockRejectedValue(new Error(REQUEST_TIMEOUT_REASON));

    render(<QuestionsModeScreen modeId="football-bingo" />);

    await waitFor(() => {
      expect(screen.getByTestId('questions-mode-error-retry')).toBeTruthy();
    });
    expect(screen.getByTestId('questions-mode-error-back')).toBeTruthy();
  });

  it('retries the request from the error state', async () => {
    mockCreateSession = jest.fn().mockRejectedValue(new Error(REQUEST_TIMEOUT_REASON));

    render(<QuestionsModeScreen modeId="football-bingo" />);
    await waitFor(() => expect(screen.getByTestId('questions-mode-error-retry')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('questions-mode-error-retry'));
    });

    expect(mockCreateSession).toHaveBeenCalledTimes(2);
  });

  it('offers no retry when the mode genuinely has no round today', async () => {
    // Retrying cannot change this before tomorrow; back is the honest action.
    mockCreateSession = jest.fn().mockRejectedValue(new Error('QUESTIONS_CHALLENGE_EMPTY'));

    render(<QuestionsModeScreen modeId="football-bingo" />);

    await waitFor(() => {
      expect(screen.getByTestId('questions-mode-error-back')).toBeTruthy();
    });
    expect(screen.queryByTestId('questions-mode-error-retry')).toBeNull();
  });

  it('handles an empty round without hanging', async () => {
    // A 200 carrying no questions — the mapper turns this into a code, and the
    // screen must land on its error state rather than a permanent spinner.
    mockCreateSession = jest.fn().mockRejectedValue(new Error('QUESTIONS_CHALLENGE_EMPTY'));

    render(<QuestionsModeScreen modeId="football-bingo" />);

    await waitFor(() => {
      expect(screen.getByTestId('questions-mode-error-back')).toBeTruthy();
    });
    expect(screen.queryByTestId('game-loading-back')).toBeNull();
  });
});

describe('every playable mode gets the same treatment', () => {
  const MODES = [
    'football-bingo',
    'football-grid',
    'guess-player',
    'guess-club',
    'player-connections',
    'transfer-puzzle',
    'top10-challenge',
  ] as const;

  it.each(MODES)('%s can be left while it is loading', (modeId) => {
    render(<QuestionsModeScreen modeId={modeId} />);

    fireEvent.press(screen.getByTestId('game-loading-back'));

    expect(mockRouter.back).toHaveBeenCalled();
  });
});
