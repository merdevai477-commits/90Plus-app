/**
 * KING OF PREDICTIONS — the History list while it reloads.
 * =============================================================================
 *
 * A reload (filter change, save, result push) or a Clerk token gap must never
 * blank the rows the user is looking at, and two end-of-list events in one
 * frame must load one page, once.
 *
 *   npx jest -c jest.render.config.js historyList.render
 */

import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

let mockToken: string | null = 'tok';
let mockSignedIn = true;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: mockSignedIn,
    userId: mockSignedIn ? 'user_a' : null,
    getToken: async () => mockToken,
  }),
}));

jest.mock('../../../services/predictions.service', () => ({
  PredictionApiError: class extends Error {},
  PredictionsService: { getKingHistory: jest.fn(), getPredictionsForMatches: jest.fn() },
}));

jest.mock('../../../src/i18n', () => {
  const { en } = require('../../../locales/en');
  return { useTranslation: () => ({ t: en, language: 'en' }) };
});

jest.mock('../../../utils/fontSetup', () => ({ useAppFont: () => 'System' }));
jest.mock('../../../utils/i18nHelpers', () => ({ getTeamDisplayName: (name: string) => name }));

jest.mock('../GlassSurface', () => {
  const { View } = require('react-native');
  return { GlassSurface: View };
});

jest.mock('../KingBoardList', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    KingEmptyState: ({ title }: { title: string }) => ReactLocal.createElement(Text, null, title),
  };
});

import { PredictionsService, type KingHistoryItem } from '../../../services/predictions.service';
import { KingHistoryList } from '../HistoryList';
import { useKingPicksStore } from '../kingPicksStore';

const getKingHistory = PredictionsService.getKingHistory as jest.Mock;

function row(id: string, homeTeam: string, extra: Partial<KingHistoryItem> = {}): KingHistoryItem {
  return {
    id,
    apiMatchId: Number(id.replace(/\D/g, '')) || 1,
    // A draw badge, so the team name appears once per card.
    predictionType: 'draw',
    predictedHomeScore: null,
    predictedAwayScore: null,
    homeTeam,
    awayTeam: 'Away FC',
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: '2026-10-30T18:00:00.000Z',
    leagueName: null,
    isCorrect: null,
    finalHomeScore: null,
    finalAwayScore: null,
    matchStatus: null,
    ...extra,
  };
}

function page(items: KingHistoryItem[], hasMore = false) {
  return {
    items,
    counts: { all: items.length, correct: 0, wrong: 0, pending: items.length },
    hasMore,
  };
}

const renderList = () =>
  render(<KingHistoryList mode="game" bottomPadding={0} onPredict={() => {}} />);

beforeEach(() => {
  mockToken = 'tok';
  mockSignedIn = true;
  getKingHistory.mockReset();
  useKingPicksStore.setState({ local: {}, server: {}, confirmed: 0, results: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('KingHistoryList', () => {
  it('history keeps rows while reloading', async () => {
    getKingHistory.mockResolvedValueOnce(page([row('p1', 'Arsenal')]));
    renderList();
    expect(await screen.findByText('Arsenal')).toBeTruthy();

    getKingHistory.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.press(screen.getByText(/^Correct/));

    await waitFor(() =>
      expect(getKingHistory).toHaveBeenLastCalledWith('tok', expect.anything(), 'correct', 0));
    expect(screen.getByText('Arsenal')).toBeTruthy();
  });

  it('a token gap keeps the rows and retries', async () => {
    jest.useFakeTimers();
    getKingHistory.mockResolvedValue(page([row('p1', 'Arsenal')]));
    renderList();
    expect(await screen.findByText('Arsenal')).toBeTruthy();
    expect(getKingHistory).toHaveBeenCalledTimes(1);

    mockToken = null;
    await act(async () => { useKingPicksStore.getState().noteResult(); });

    expect(screen.getByText('Arsenal')).toBeTruthy();
    expect(getKingHistory).toHaveBeenCalledTimes(1);

    mockToken = 'tok';
    await act(async () => { jest.advanceTimersByTime(3000); });

    expect(getKingHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Arsenal')).toBeTruthy();
  });

  it('signed out shows the sign-in prompt instead of stale rows', async () => {
    mockToken = null;
    mockSignedIn = false;
    renderList();

    expect(await screen.findByText('Sign in to see your predictions')).toBeTruthy();
    expect(getKingHistory).not.toHaveBeenCalled();
  });

  it('two end-reached events load one page, without duplicate rows', async () => {
    getKingHistory.mockResolvedValueOnce(page([row('p1', 'Arsenal')], true));
    renderList();
    expect(await screen.findByText('Arsenal')).toBeTruthy();

    let release: (value: unknown) => void = () => {};
    getKingHistory.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const list = screen.UNSAFE_getByType(FlatList);
    await act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
    });

    expect(getKingHistory).toHaveBeenCalledTimes(2);
    expect(getKingHistory).toHaveBeenLastCalledWith('tok', expect.anything(), 'all', 1);

    await act(async () => {
      release(page([row('p1', 'Arsenal'), row('p2', 'Benfica')]));
    });

    expect(screen.getAllByText('Arsenal')).toHaveLength(1);
    expect(screen.getByText('Benfica')).toBeTruthy();
  });

  it('a voided pick reads Cancelled, not pending', async () => {
    getKingHistory.mockResolvedValueOnce(page([row('p1', 'Arsenal', { voided: true })]));
    renderList();

    expect(await screen.findByText('Cancelled')).toBeTruthy();
  });
});
