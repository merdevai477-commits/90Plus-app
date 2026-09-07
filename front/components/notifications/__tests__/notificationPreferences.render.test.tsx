/**
 * Notification preferences — toggles must appear without waiting on the API.
 *
 *   npx jest -c jest.render.config.js notificationPreferences.render
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({
    getToken: async () => 'tok',
    isLoaded: true,
    isSignedIn: true,
  }),
}));

jest.mock('../../../src/i18n', () => {
  const { en } = require('../../../locales/en');
  return {
    useTranslation: () => ({ t: en, language: 'en' }),
  };
});

jest.mock('../notificationPreferencesApi', () => {
  const actual = jest.requireActual('../notificationPreferencesApi');
  return {
    ...actual,
    fetchNotificationPreferences: jest.fn(async () => actual.DEFAULT_NOTIFICATION_PREFS),
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

import NotificationPreferencesScreen from '../NotificationPreferencesScreen';

const mockRouter = jest.requireMock('expo-router').router as {
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};

function renderPrefs() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationPreferencesScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe('Notification preferences screen', () => {
  it('shows match and social toggles without waiting for the network', () => {
    renderPrefs();

    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('Match Start')).toBeTruthy();
    expect(screen.getByText('New Followers')).toBeTruthy();
    expect(screen.getByText('Likes')).toBeTruthy();
  });

  it('goes back to Settings when there is no stack history', () => {
    mockRouter.canGoBack.mockReturnValue(false);
    renderPrefs();

    fireEvent.press(screen.getByTestId('notif-prefs-back'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/settings');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
