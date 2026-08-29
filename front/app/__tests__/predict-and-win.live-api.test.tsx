/**
 * Live end-to-end check for the Predict & Win hub.
 *
 * `predict-and-win.hub.test.tsx` mocks `CompetitionsService`, so it proves the
 * screen paints whatever the service hands it — but not that the service and
 * the running backend actually agree. This file closes that gap: it leaves the
 * service unmocked, points it at the local API, and asserts the sponsor names
 * the backend really returns end up as text in the rendered tree.
 *
 * That covers the whole path in one go — HTTP → `normalizeCompetitionListPage`
 * → `useCompetitions` state → `ScrollView` → `HubPrizeCard` — which is exactly
 * the stretch that "the API has rows but the screen is empty" lives in.
 *
 * It needs `npm run dev` up on :3000. When the backend is unreachable the suite
 * skips rather than fails, so CI without a server stays green.
 */

// Point the client at the local API. The checked-in `.env` uses the Android
// emulator alias (10.0.2.2), which is not routable from the test runner.
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api';

jest.unmock('react-native');
jest.setTimeout(60_000);

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  // Signed out on purpose: the list route is `optionalAuth`, so the public
  // tabs must work with no token at all.
  useAuth: () => ({ isLoaded: true, isSignedIn: false, getToken: async () => null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('expo-image', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return { Image: (p: any) => R.createElement(RN.View, p) };
});
jest.mock('expo-linear-gradient', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return { LinearGradient: ({ children, ...p }: any) => R.createElement(RN.View, p, children) };
});
jest.mock('@expo/vector-icons', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  const Icon = (p: any) => R.createElement(RN.View, p);
  return {
    Ionicons: Icon,
    MaterialCommunityIcons: Icon,
    AntDesign: Icon,
    Feather: Icon,
    MaterialIcons: Icon,
    FontAwesome: Icon,
  };
});
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  const S = ({ children, ...p }: any) => R.createElement(RN.View, p, children);
  return {
    __esModule: true,
    default: S,
    Svg: S,
    Path: S,
    G: S,
    Defs: S,
    LinearGradient: S,
    Stop: S,
    Circle: S,
    Rect: S,
    ClipPath: S,
    Mask: S,
    Ellipse: S,
    RadialGradient: S,
  };
});
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import PredictAndWinScreen from '../(tabs)/predict-and-win';
import { CompetitionsService } from '../../services/competitions.service';
import { useLanguageStore } from '../../src/i18n/store';

const API = 'http://localhost:3000/api';

/** Sponsor names the live API reports for a tab — what the cards must show. */
async function sponsorNamesFor(tab: string): Promise<string[]> {
  const res = await fetch(`${API}/competitions?tab=${tab}`);
  const json = await res.json();
  const items = json?.data?.items ?? [];
  return items.map((i: any) => i.sponsor.name);
}

let backendUp = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${API}/health`);
    backendUp = res.ok;
  } catch {
    backendUp = false;
  }
  if (!backendUp) {
    // eslint-disable-next-line no-console
    console.warn('[live-api] backend not reachable on :3000 — skipping live checks');
  }
});

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

describe('Predict & Win hub against the live local API', () => {
  it('the backend actually serves competitions and prize categories', async () => {
    if (!backendUp) return;

    const cats = await CompetitionsService.getPrizeCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThan(0);

    const page = await CompetitionsService.list(null, { tab: 'all' });
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeGreaterThan(0);

    // Every row the screen needs must survive parsing — a card with no sponsor
    // name renders a blank block, which is indistinguishable from "no data".
    for (const item of page.items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.sponsor?.name).toBe('string');
      expect(item.sponsor.name.length).toBeGreaterThan(0);
    }
  });

  it('paints the real sponsor names the API returns on the default tab', async () => {
    if (!backendUp) return;

    const expected = await sponsorNamesFor('all');
    expect(expected.length).toBeGreaterThan(0);

    render(<PredictAndWinScreen />);

    // The first name proves cells paint at all; the rest prove the whole page
    // made it through, not just the head of the list.
    await waitFor(() => expect(screen.getAllByText(expected[0]).length).toBeGreaterThan(0), {
      timeout: 30_000,
    });
    for (const name of new Set(expected)) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('serves every public tab without an error state', async () => {
    if (!backendUp) return;

    for (const tab of ['all', 'today', 'sponsored'] as const) {
      const page = await CompetitionsService.list(null, { tab });
      expect(Array.isArray(page.items)).toBe(true);
    }
  });

  it('applies every quick filter without an error state', async () => {
    if (!backendUp) return;

    for (const filter of ['daily', 'free', 'sponsored', 'popular'] as const) {
      const page = await CompetitionsService.list(null, { tab: 'all', filter });
      expect(Array.isArray(page.items)).toBe(true);
    }
  });
});
