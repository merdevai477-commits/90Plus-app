/**
 * SHARE & WIN — the way off the page the referral link lands on.
 * =============================================================================
 *
 * `/share-win` is a root Stack screen with `headerShown: false` and no tab bar,
 * and it draws all of its own chrome. It had no back control anywhere on it —
 * while its own sub-screen, the full ranking, has always had one.
 *
 * It matters most for the flow the link exists for. `handleDeepLink` in
 * app/_layout.tsx pushes a friend arriving from a shared invite straight here,
 * and on a cold start that makes Share & Win the FIRST screen in the stack:
 * `router.back()` has nothing to pop, so the fallback has to put them into the
 * app rather than leave them on a page they cannot leave.
 *
 *   npx jest -c jest.render.config.js shareWinBack.render
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

/** Swapped per test — what the Share & Win query is currently reporting. */
let mockShareWin: Record<string, unknown>;

jest.mock('../../../hooks/useShareWin', () => ({
  useShareWin: () => mockShareWin,
}));

jest.mock('../../../utils/enhancedNetworkService', () => ({
  enhancedNetworkService: {
    checkServerHealth: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
  },
}));

jest.mock('../components/LuckyWheelCard', () => {
  const ReactLocal = require('react');
  const { View: V } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(V, { testID: 'lucky-wheel' }),
  };
});

jest.mock('../../../src/i18n', () => {
  const { en } = require('../../../locales/en');
  return {
    useTranslation: () => ({ t: en, language: 'en' }),
  };
});

jest.mock('expo-router', () => {
  const instance = {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return { useRouter: () => instance, router: instance };
});

import ShareWinScreen from '../ShareWinScreen';

const mockRouter = jest.requireMock('expo-router').router as {
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};

const overview = {
  referralCode: 'AB23CD',
  referralLink: 'https://90plus.pro/invite/AB23CD',
  shareCount: 0,
  participants: 0,
  score: 0,
  rank: null,
  totalShareCount: 0,
  cycle: {
    id: 'c1',
    weekKey: '2026-W36',
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'OPEN',
    endsInMs: 86_400_000,
  },
  leaderboard: [],
  prizes: [],
  lastWinner: null,
  scoring: { perParticipant: 10, perShare: 5 },
};

const baseHook = {
  overview: null as unknown,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  copyReferralLink: jest.fn(),
  trackShare: jest.fn(),
};

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  mockShareWin = { ...baseHook, overview };
});

describe('the back control', () => {
  it('is on the loaded page', () => {
    render(<ShareWinScreen />);
    expect(screen.getByTestId('share-win-back')).toBeTruthy();
  });

  it('is on the page while it is still loading', () => {
    mockShareWin = { ...baseHook, overview: null, isLoading: true };
    render(<ShareWinScreen />);
    expect(screen.getByTestId('share-win-back')).toBeTruthy();
  });

  it('is on the error state', () => {
    mockShareWin = { ...baseHook, overview: null, isError: true };
    render(<ShareWinScreen />);
    expect(screen.getByTestId('share-win-back')).toBeTruthy();
  });

  it('is on the empty in-between frame', () => {
    mockShareWin = { ...baseHook, overview: null };
    render(<ShareWinScreen />);
    expect(screen.getByTestId('share-win-back')).toBeTruthy();
  });

  it('pops the stack when the page was pushed', () => {
    render(<ShareWinScreen />);

    fireEvent.press(screen.getByTestId('share-win-back'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('lands a deep-linked visitor on Rank instead of a dead end', () => {
    // Cold start from a shared invite: Share & Win is the first screen.
    mockRouter.canGoBack.mockReturnValue(false);
    render(<ShareWinScreen />);

    fireEvent.press(screen.getByTestId('share-win-back'));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/rank');
  });

  it('is labelled for screen readers', () => {
    render(<ShareWinScreen />);

    const back = screen.getByTestId('share-win-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBeTruthy();
  });
});

describe('the referral link the page hands out', () => {
  it('is the universal link, not a store listing', () => {
    // The whole point of Share & Earn: the friend must land in the app on the
    // referral route, with the code intact.
    render(<ShareWinScreen />);

    expect(screen.getByText(/90plus\.pro\/invite\/AB23CD|invite\/AB23CD/)).toBeTruthy();
  });
});
