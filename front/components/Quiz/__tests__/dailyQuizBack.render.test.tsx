/**
 * DAILY QUIZ — the Go Back button, in the state it was missing from.
 * =============================================================================
 *
 * Football Quiz DOES have a back arrow: `QuizHeader` draws one on the signed-out
 * card, both error cards and the question screen itself. The one state it did
 * not draw one in was the one players sit in longest — LOADING.
 *
 * `QuizHubScreen` returns the bare shared spinner while the daily pack is being
 * fetched or generated, and generation is minutes of backend work. For all of
 * that time the screen was a spinner and nothing else: no header, no arrow, no
 * cancel. That is the reported "the Daily Quiz has no Go Back button".
 *
 * These tests hold the pack query in each of its states and assert the arrow is
 * on screen and unwinds to the Questions hub.
 *
 *   npx jest -c jest.render.config.js dailyQuizBack.render
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

/** Swapped per test — the pack query's result. */
let mockDailyQuiz: Record<string, unknown>;

jest.mock('../../../hooks/useDailyQuiz', () => ({
  useDailyQuiz: () => mockDailyQuiz,
  dailyQuizQueryKey: () => ['daily-quiz', 'en', '2026-09-02'],
  cacheDailyQuiz: jest.fn(),
  prefetchQuizImages: jest.fn(),
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'test-token', isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: { id: 'u1' }, isLoaded: true, isSignedIn: true }),
}));

jest.mock('../../../contexts/CoinsContext', () => ({
  useCoins: () => ({ coins: 0, refreshCoins: jest.fn(), applyCoinsBalance: jest.fn() }),
}));

jest.mock('../../../contexts/XpContext', () => ({
  useXp: () => ({
    xp: 0,
    level: 1,
    handleXpEvents: jest.fn(),
    applyXpSnapshot: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: jest.fn(), invalidateQueries: jest.fn() }),
}));

jest.mock('../../../utils/enhancedNetworkService', () => ({
  enhancedNetworkService: {
    checkServerHealth: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
  },
}));

/* jest-expo cannot instantiate the native font loader behind @expo/vector-icons. */
jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const { View: V } = require('react-native');
  const Icon = (props: Record<string, unknown>) => ReactLocal.createElement(V, props);
  return { Ionicons: Icon, MaterialIcons: Icon, FontAwesome: Icon, Feather: Icon };
});

/*
 * The router object is built INSIDE the factory and pulled back out with
 * `requireMock`. `quizNavigation.ts` imports the `router` singleton rather than
 * calling `useRouter()`, so the factory's `router` property is read eagerly —
 * and a `const` declared in the test body is still in its temporal dead zone
 * when the hoisted `import` first requires expo-router, which would hand that
 * module an undefined router.
 */
jest.mock('expo-router', () => {
  const instance = {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return {
    useRouter: () => instance,
    router: instance,
    useLocalSearchParams: () => ({}),
  };
});

import QuizHubScreen from '../QuizHubScreen';

const mockRouter = jest.requireMock('expo-router').router as {
  back: jest.Mock;
  replace: jest.Mock;
  push: jest.Mock;
  canGoBack: jest.Mock;
};

/** The hook's shape while the pack has not arrived. */
const loadingState = (error: Error | null = null) => ({
  data: undefined,
  isLoading: true,
  error,
  refetch: jest.fn(),
  isFetching: true,
  dateKey: '2026-09-02',
});

beforeEach(() => {
  jest.useFakeTimers();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  mockDailyQuiz = loadingState();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('while the daily pack is loading', () => {
  it('shows a Go Back arrow', () => {
    render(<QuizHubScreen />);

    expect(screen.getByTestId('game-loading-back')).toBeTruthy();
  });

  it('unwinds to the Questions hub when tapped', () => {
    render(<QuizHubScreen />);

    fireEvent.press(screen.getByTestId('game-loading-back'));

    // Popping keeps the hub's scroll position and does not grow the stack.
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('replaces with the hub when the quiz was opened directly', () => {
    // A notification or a deep link makes quiz/football-quiz the first screen.
    mockRouter.canGoBack.mockReturnValue(false);

    render(<QuizHubScreen />);
    fireEvent.press(screen.getByTestId('game-loading-back'));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/quiz');
  });

  it('labels the arrow for screen readers', () => {
    render(<QuizHubScreen />);

    const back = screen.getByTestId('game-loading-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBeTruthy();
  });
});

describe('while the pack is being GENERATED', () => {
  // The longest wait of all — the backend is writing today's questions.
  const generating = () => loadingState(new Error('PACK_GENERATING'));

  it('still shows a Go Back arrow', () => {
    mockDailyQuiz = generating();

    render(<QuizHubScreen />);

    expect(screen.getByTestId('game-loading-back')).toBeTruthy();
  });

  it('keeps the arrow alongside the long-wait retry', () => {
    mockDailyQuiz = generating();
    render(<QuizHubScreen />);

    // The existing 45s escape hatch appears; the arrow must not be replaced.
    jest.advanceTimersByTime(46_000);

    expect(screen.getByTestId('game-loading-back')).toBeTruthy();
  });

  it('leaves the screen from that state', () => {
    mockDailyQuiz = generating();
    render(<QuizHubScreen />);

    fireEvent.press(screen.getByTestId('game-loading-back'));

    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('when a round has loaded but no question is current', () => {
  it('still offers a way back while it settles', () => {
    // `!currentQuestion` while fetching — the second bare-spinner branch.
    mockDailyQuiz = {
      data: { questions: [], packDate: '2026-09-02', stats: {}, isStatic: false },
      isLoading: true,
      error: null,
      refetch: jest.fn(),
      isFetching: true,
      dateKey: '2026-09-02',
    };

    render(<QuizHubScreen />);

    expect(screen.getByTestId('game-loading-back')).toBeTruthy();
  });
});
