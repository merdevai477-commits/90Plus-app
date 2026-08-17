/**
 * FOOTBALL GRID — THE REAL SCREEN, AGAINST THE REAL BACKEND
 * =============================================================================
 *
 * Everything below the network is the app's own code: `QuestionsModeScreen`,
 * `useQuestionModeSession`, `QuestionsModesService`, the round mapper and
 * `ConstraintGridBoard`. Only two things are replaced — Clerk (a token is
 * injected instead of signing in) and `getApiUrl` (pointed at the local
 * backend). The bytes the screen renders are the bytes the API actually sent.
 *
 * That is the point: unit tests over fixtures kept passing while the real app
 * showed "Today's challenge isn't available", because the fixture was never the
 * thing that was broken. This test fails if today's round is missing, if the
 * board does not render, or if a placement is not accepted.
 *
 * It needs the backend running and a token, so it is opt-in:
 *
 *   GRID_LIVE_TOKEN=<clerk jwt> npx jest footballGridScreen.live --runInBand
 *
 * Without GRID_LIVE_TOKEN the suite skips rather than failing the normal run.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const LIVE_TOKEN = process.env.GRID_LIVE_TOKEN ?? '';
const API_BASE = process.env.GRID_LIVE_API ?? 'http://localhost:3000/api';

// Point the app's API helper at the running backend.
jest.mock('../../../config/api.config', () => ({
  ...jest.requireActual('../../../config/api.config'),
  getApiUrl: () => process.env.GRID_LIVE_API ?? 'http://localhost:3000/api',
}));

// Stand in for a signed-in user — a real Clerk JWT, minted outside the test.
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({
    getToken: async () => process.env.GRID_LIVE_TOKEN ?? '',
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({ user: { id: 'live-test' }, isLoaded: true, isSignedIn: true }),
}));

jest.mock('../../../utils/clerkAuthToken', () => ({
  getClerkBearerToken: async (getToken: () => Promise<string>) => getToken(),
}));

import QuestionsModeScreen from '../QuestionsModeScreen';

const maybe = LIVE_TOKEN ? describe : describe.skip;

maybe('Football Grid — the screen a player actually opens', () => {
  jest.setTimeout(60_000);

  /** Reset this user's round so the run always starts on cell 1. */
  beforeAll(async () => {
    await fetch(`${API_BASE}/quiz/questions/modes/football-grid/session?language=en`, {
      headers: { Authorization: `Bearer ${LIVE_TOKEN}` },
    });
  });

  test('today\'s challenge loads as a playable 3x3 board', async () => {
    render(<QuestionsModeScreen modeId="football-grid" />);

    // The failure this whole task is about.
    await waitFor(
      () => {
        expect(
          screen.queryByText(/Today's challenge isn't available/i),
        ).toBeNull();
      },
      { timeout: 30_000 },
    );

    // The board's own axes, from the live round.
    await waitFor(
      () => {
        expect(screen.getByText('Manchester City')).toBeTruthy();
      },
      { timeout: 30_000 },
    );

    expect(screen.getByText('England')).toBeTruthy();
    expect(screen.getByText('Wolfsburg')).toBeTruthy();
    expect(screen.getByText(/EFL Cup/)).toBeTruthy();
    expect(screen.getByText(/Premier League/)).toBeTruthy();
    expect(screen.getByText(/FA Cup/)).toBeTruthy();

    // The cell being asked for, and the players offered for it.
    expect(
      screen.getByText(/Pick a player who played for .+ and won /i),
    ).toBeTruthy();
    expect(screen.getByText('Rodri Hernández')).toBeTruthy();

    // No confirm step: the board grades a placement the moment it is made.
    expect(screen.queryByText('Confirm Answer')).toBeNull();
  });

  test('a correct player is accepted and the cell fills', async () => {
    render(<QuestionsModeScreen modeId="football-grid" />);

    await waitFor(() => expect(screen.getByText('Rodri Hernández')).toBeTruthy(), {
      timeout: 30_000,
    });

    fireEvent.press(screen.getByText('Rodri Hernández'));

    // The server graded it; the screen says so.
    await waitFor(() => expect(screen.getByText('Correct Answer')).toBeTruthy(), {
      timeout: 30_000,
    });
  });
});
