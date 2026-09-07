/**
 * QUESTIONS HUB — back control that opens Rank.
 * =============================================================================
 *
 * The hub is the quiz tab. Rank opens it from the competitions grid, and there
 * is no native header, so without this control the only way off the page is
 * the tab bar. The button always `replace`s Rank — `router.back()` can land
 * on Matches from tab history.
 *
 *   npx jest -c jest.render.config.js questionsHubBack.render
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../../../hooks/useQuestionsModes', () => ({
  useQuestionsModes: () => ({
    data: { modes: [], summary: { answeredCount: 0, xpEarnedTotal: 0 } },
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'tok', isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: { id: 'u1' }, isLoaded: true, isSignedIn: true }),
}));

jest.mock('../../../contexts/CoinsContext', () => ({
  useCoins: () => ({ coins: 55, refreshCoins: jest.fn(), applyCoinsBalance: jest.fn() }),
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

jest.mock('../../../utils/enhancedNetworkService', () => ({
  enhancedNetworkService: {
    checkServerHealth: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
  },
}));

jest.mock('expo-router', () => {
  const instance = {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return { useRouter: () => instance, router: instance };
});

import QuestionsHubScreen from '../QuestionsHubScreen';

const mockRouter = jest.requireMock('expo-router').router as {
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe('the Questions hub back control', () => {
  it('is on the hub', () => {
    render(<QuestionsHubScreen />);
    expect(screen.getByTestId('questions-hub-back')).toBeTruthy();
  });

  it('opens Rank and does not pop tab history', () => {
    render(<QuestionsHubScreen />);

    fireEvent.press(screen.getByTestId('questions-hub-back'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/rank');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('is labelled for screen readers', () => {
    render(<QuestionsHubScreen />);

    const back = screen.getByTestId('questions-hub-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBeTruthy();
  });
});
