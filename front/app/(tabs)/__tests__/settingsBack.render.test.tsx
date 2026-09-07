/**
 * SETTINGS — back control that opens Profile.
 * =============================================================================
 *
 * Settings is a hidden tab opened from the profile gear. Without a back
 * control the only way off is the tab bar. The button always `replace`s
 * Profile — `router.back()` can land on Matches from tab history.
 *
 *   npx jest -c jest.render.config.js settingsBack.render
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

let mockSettingsLoading = false;

jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    loading: mockSettingsLoading,
    clearCache: jest.fn(),
  }),
}));

jest.mock('../../../contexts/VideosContext', () => ({
  useVideos: () => ({ clearVideos: jest.fn() }),
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ signOut: jest.fn(), getToken: async () => 'tok' }),
}));

jest.mock('../../../components/common/LanguagePickerModal', () => {
  const ReactLocal = require('react');
  const { View: V } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(V, { testID: 'language-picker' }),
  };
});

jest.mock('../../../components/common/ImprovedAccountDeletionModal', () => {
  const ReactLocal = require('react');
  const { View: V } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(V, { testID: 'delete-modal' }),
  };
});

jest.mock('../../../hooks/useAppShareReward', () => ({
  useAppShareReward: () => ({ shareAppAndClaim: jest.fn() }),
}));

jest.mock('../../../utils/fontSetup', () => ({
  useScreenFont: () => undefined,
}));

jest.mock('../../../services/toastManager', () => ({
  toastManager: {
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showInfo: jest.fn(),
    showLanguageChangeSuccess: jest.fn(),
  },
}));

jest.mock('@/components/navigation/BottomNav', () => {
  const ReactLocal = require('react');
  const { View: V } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(V, { testID: 'bottom-nav' }),
  };
});

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
  return { useRouter: () => instance, router: instance, usePathname: () => '/settings' };
});

import SettingsScreen from '../settings';

const mockRouter = jest.requireMock('expo-router').router as {
  back: jest.Mock;
  replace: jest.Mock;
};

beforeEach(() => {
  mockSettingsLoading = false;
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
});

describe('the Settings back control', () => {
  it('is on the loaded page', () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-back')).toBeTruthy();
  });

  it('is on the page while settings are still loading', () => {
    mockSettingsLoading = true;
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-back')).toBeTruthy();
  });

  it('opens Profile and does not pop tab history', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-back'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('is labelled for screen readers', () => {
    render(<SettingsScreen />);

    const back = screen.getByTestId('settings-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBeTruthy();
  });
});
