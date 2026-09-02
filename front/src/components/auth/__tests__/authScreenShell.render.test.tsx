/**
 * THE PRE-LOGIN SHELL — the way out, and the safe areas.
 * =============================================================================
 *
 * `/auth` is PUSHED from half a dozen places inside the signed-in app (the chat
 * tab's sign-in prompt, a prediction, someone's profile, the quiz hub). The auth
 * stack sets `headerShown: false` and the shell drew no back or close control of
 * its own, so a visitor who tapped "Sign in" had no way back — the reported
 * "another screen where the Go Back button does not exist".
 *
 * The button must NOT appear when `/auth` is the first screen of the session
 * (a signed-out cold start redirects straight here), because there is nothing
 * behind it to go back to.
 *
 *   npx jest -c jest.render.config.js authScreenShell.render
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
}));

/** Per-test insets — the global render setup pins them all to 0. */
const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import { AuthScreenShell } from '../AuthScreenShell';

const setInsets = (next: Partial<typeof mockInsets>) => Object.assign(mockInsets, next);

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  setInsets({ top: 0, bottom: 0, left: 0, right: 0 });
});

const Child = () => <Text>panel body</Text>;

describe('the way out of the sign-up screen', () => {
  it('offers a close button when the screen was pushed', () => {
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    expect(screen.getByTestId('auth-close')).toBeTruthy();
  });

  it('goes back when it is tapped', () => {
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    fireEvent.press(screen.getByTestId('auth-close'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('hides it when auth is the first screen of the session', () => {
    // A signed-out cold start redirects to /auth, so there is nothing to pop —
    // a button that does nothing is worse than no button.
    mockRouter.canGoBack.mockReturnValue(false);

    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    expect(screen.queryByTestId('auth-close')).toBeNull();
  });

  it('can be suppressed deliberately', () => {
    render(
      <AuthScreenShell hideClose>
        <Child />
      </AuthScreenShell>,
    );

    expect(screen.queryByTestId('auth-close')).toBeNull();
  });

  it('is labelled for screen readers', () => {
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    const close = screen.getByTestId('auth-close');
    expect(close.props.accessibilityRole).toBe('button');
    expect(close.props.accessibilityLabel).toBeTruthy();
  });

  it('still renders the screen it wraps', () => {
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    expect(screen.getByText('panel body')).toBeTruthy();
  });
});

describe('safe areas', () => {
  /** RN flattens style arrays into an array — resolve it to one object. */
  const flatten = (style: unknown): Record<string, number> =>
    Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

  it('clears the notch / Dynamic Island', () => {
    setInsets({ top: 59 }); // iPhone 16 Pro
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    const style = flatten(screen.getByTestId('auth-close').props.style);
    expect(style.top).toBeGreaterThanOrEqual(59);
  });

  it('sits at a sensible offset on a phone with no top inset', () => {
    setInsets({ top: 0 });
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    const style = flatten(screen.getByTestId('auth-close').props.style);
    // Not flush against the very top edge.
    expect(style.top).toBeGreaterThan(0);
  });

  it('keeps a touch target at or above the accessibility minimum', () => {
    render(
      <AuthScreenShell>
        <Child />
      </AuthScreenShell>,
    );

    const style = flatten(screen.getByTestId('auth-close').props.style);
    // 44 × 0.8 (minimum scale) = 35, plus 12pt of hitSlop on every side.
    expect(style.width + 24).toBeGreaterThanOrEqual(44);
    expect(style.height + 24).toBeGreaterThanOrEqual(44);
  });
});
