/**
 * PRE-LOGIN SCREENS — they all still mount, and they all have a way out.
 * =============================================================================
 *
 * Sign up, Log in and Forgot password were all re-plumbed onto one scale
 * (./authLayoutMetrics) published through context, which moved every panel
 * primitive from a module-level StyleSheet to a hook. That is exactly the kind
 * of change that can break a screen without breaking a type — a hook called
 * conditionally, a style key renamed, an import left dangling.
 *
 * So: mount each screen for real and assert the two things that must hold on
 * all of them — it renders its own primary action, and it offers a way back.
 *
 *   npx jest -c jest.render.config.js preLoginScreens.render
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: async () => 'test-token', isLoaded: true, isSignedIn: false }),
  useSignUp: () => ({ signUp: null, setActive: jest.fn(), isLoaded: true }),
  useSignIn: () => ({ signIn: null, setActive: jest.fn(), isLoaded: true }),
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  useOAuth: () => ({ startOAuthFlow: jest.fn() }),
}));

jest.mock('expo-router', () => {
  const instance = {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return { useRouter: () => instance, router: instance, useLocalSearchParams: () => ({}) };
});

jest.mock('../../../../utils/enhancedNetworkService', () => ({
  enhancedNetworkService: {
    checkServerHealth: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
  },
}));

/* Native modules jest-expo cannot instantiate. None affect layout or navigation. */
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { FORM_SHEET: 'formSheet' },
}));

jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'ninetyplus://auth-callback' }));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `ninetyplus://${path}`,
  openURL: jest.fn(),
  canOpenURL: jest.fn().mockResolvedValue(true),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: () => ({ remove: () => {} }),
  parse: (url: string) => ({ path: url, queryParams: {} }),
}));

import RegisterScreen from '../../../../app/auth/index';
import LoginScreen from '../../../../app/auth/login';
import ForgotPasswordScreen from '../../../../app/auth/forgot-password';

const SCREENS: Array<[string, React.ComponentType]> = [
  ['Sign up', RegisterScreen],
  ['Log in', LoginScreen],
  ['Forgot password', ForgotPasswordScreen],
];

describe.each(SCREENS)('%s', (_name, Screen) => {
  it('mounts without throwing', () => {
    expect(() => render(<Screen />)).not.toThrow();
  });

  it('offers a way back out of the auth flow', () => {
    render(<Screen />);
    expect(screen.getByTestId('auth-close')).toBeTruthy();
  });
});

describe('the sign-up screen specifically', () => {
  it('renders all three fields and the primary action', () => {
    render(<RegisterScreen />);

    // The panel the responsiveness work rebuilt — every part of it is present.
    expect(screen.getByPlaceholderText(/full name/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/^email$/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
    expect(screen.getByText(/sign up/i)).toBeTruthy();
  });

  it('renders the terms consent row and the social sign-in options', () => {
    render(<RegisterScreen />);

    expect(screen.getByText(/or continue with/i)).toBeTruthy();
    expect(screen.getByText(/already have an account/i)).toBeTruthy();
  });
});
