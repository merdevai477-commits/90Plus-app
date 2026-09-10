/**
 * AGENT CHAT — match nav cards share the club/player CTA layout.
 *
 *   npx jest -c jest.render.config.js chatNavLinks.render
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

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

import { ChatNavLinks } from '../ChatNavLinks';

const mockRouter = jest.requireMock('expo-router').router as {
  push: jest.Mock;
};

beforeEach(() => {
  mockRouter.push.mockClear();
});

describe('ChatNavLinks match cards', () => {
  it('renders today\'s matches with the same profile-card CTA as a club', () => {
    const { rerender } = render(
      <ChatNavLinks
        links={[{ type: 'club', id: 8200, label: 'Al Ahly' }]}
      />,
    );

    expect(screen.getByText('Follow club profile')).toBeTruthy();
    expect(screen.getByText('View profile')).toBeTruthy();
    expect(screen.getByLabelText('View club profile')).toBeTruthy();

    rerender(
      <ChatNavLinks
        links={[{ type: 'matches', label: "Today's matches" }]}
      />,
    );

    expect(screen.getByText("Follow today's matches")).toBeTruthy();
    expect(screen.getByText('View matches')).toBeTruthy();
    expect(screen.getByLabelText("View today's matches")).toBeTruthy();
  });

  it('opens the matches tab from the today\'s matches CTA', () => {
    render(
      <ChatNavLinks
        links={[{ type: 'matches', label: "Today's matches" }]}
      />,
    );

    fireEvent.press(screen.getByLabelText("View today's matches"));
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/matches');
  });
});
