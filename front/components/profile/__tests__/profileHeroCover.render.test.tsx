/**
 * Profile hero no longer has a cover photo (user-uploaded or stadium default).
 *
 *   npx jest -c jest.render.config.js profileHeroCover.render
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../../../src/i18n', () => {
  const { en } = require('../../../locales/en');
  return {
    useTranslation: () => ({ t: en, language: 'en', isRTL: false }),
  };
});

import ProfileHero from '../ProfileHero';

describe('ProfileHero cover photo', () => {
  it('renders identity without a cover photo control', () => {
    render(
      <ProfileHero
        topInset={0}
        name="Alex"
        username="alex"
        level={3}
        xp={250}
        nextLevelXp={400}
        progressPct={0.4}
        chooseCountryLabel="Country"
        addClubLabel="Club"
        energyLabel="Energy"
      />,
    );

    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('@alex')).toBeTruthy();
    expect(screen.getByTestId('profile-hero')).toBeTruthy();
    expect(screen.queryByTestId('profile-cover')).toBeNull();
  });
});
