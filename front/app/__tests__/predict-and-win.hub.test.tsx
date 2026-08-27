/**
 * Regression tests for the Predict & Win hub screen.
 *
 * The bug these lock down: the hub rendered its header block (tabs, quick
 * filter tiles, sort row) with an empty void underneath — no cards, and not
 * the empty/error placeholder either — while `GET /competitions` was returning
 * rows for every tab. Those two symptoms together are the tell, because
 * `ListEmptyComponent` is always *something* visible here: a spinner while a
 * load is in flight, copy once it has landed. "Nothing at all" therefore meant
 * the list held data and was not painting it, which is what FlashList v2 does
 * when its measurement pre-pass comes back zero — cells stay in the tree, held
 * at `opacity: 0` until layout commits, or forced to a `boundedSize` of 0.
 *
 * What these can and cannot prove: a test renderer has no layout engine, so it
 * cannot reproduce a native measurement returning zero. What it does pin down
 * is everything on the path either side of it — that each tab requests the tab
 * it names and puts the returned rows in the tree, that the data-less states
 * render their copy instead of nothing, and that the header controls survive a
 * load. That is the half of the failure that is testable here; the paint half
 * is addressed by not depending on a measurement pre-pass at all.
 *
 * `react-native` is unmocked deliberately: the repo-wide
 * `__mocks__/react-native.ts` is an i18n stub with no components in it, and
 * this screen has to render for real to be worth testing.
 */

jest.unmock('react-native');

// Rendering the whole screen pulls in the real react-native, expo-font and the
// i18n store; that first mount costs well over jest's 5s default on a cold
// module registry, while every later one lands in a few hundred ms.
jest.setTimeout(60_000);

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'tok' }),
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

const mockList = jest.fn();
const mockCategories = jest.fn();

jest.mock('../../services/competitions.service', () => ({
  ...jest.requireActual('../../services/competitions.service'),
  CompetitionsService: {
    list: (...args: unknown[]) => mockList(...args),
    getPrizeCategories: (...args: unknown[]) => mockCategories(...args),
  },
}));

import PredictAndWinScreen from '../(tabs)/predict-and-win';
import { AddPrizeFab } from '../../components/predictAndWin/AddPrizeFab';
import { useLanguageStore } from '../../src/i18n/store';

/** A row shaped like `GET /competitions` actually answers. */
function competition(id: string, sponsorName: string) {
  return {
    id,
    prizeName: `prize-${id}`,
    prizeImageUrl: null,
    prizeType: 'vouchers',
    prizeDescription: null,
    winnersCount: 5,
    apiMatchId: 4732032,
    homeTeam: 'Boyaca Chico',
    awayTeam: 'Fortaleza FC',
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: new Date(Date.now() + 3_600_000).toISOString(),
    leagueName: 'Liga BetPlay',
    matchStatus: 'NS',
    resultHomeScore: null,
    resultAwayScore: null,
    predictionDeadline: new Date(Date.now() + 1_800_000).toISOString(),
    predictionMode: 'WINNER' as const,
    status: 'PUBLISHED' as const,
    rules: null,
    startAt: null,
    endAt: null,
    isFree: true,
    participantsCount: 63,
    myEntry: null,
    sponsor: {
      id: `s-${id}`,
      name: sponsorName,
      description: 'Electronics and accessories',
      logoUrl: null,
      address: 'Smouha, Alexandria',
      hasDelivery: true,
      socialLinks: null,
      isVerified: true,
      isActive: true,
    },
    category: {
      id: `k-${id}`,
      key: 'vouchers',
      nameAr: 'قسائم شراء',
      nameEn: 'Gift vouchers',
      description: null,
      descriptionEn: null,
      icon: null,
      sortOrder: 5,
      isActive: true,
    },
  };
}

const TWO_ROWS = {
  items: [competition('c1', 'SPONSOR_ONE'), competition('c2', 'SPONSOR_TWO')],
  nextCursor: null,
};

/** Tab bar labels, in `locales/en.ts` order. */
const TAB_LABELS = {
  all: 'All Challenges',
  today: "Today's Challenges",
  mine: 'My Challenges',
  sponsored: 'Sponsor Challenges',
} as const;

/** The last `tab` the screen asked the API for. */
function lastRequestedTab(): string | undefined {
  const call = mockList.mock.calls[mockList.mock.calls.length - 1];
  return (call?.[1] as { tab?: string } | undefined)?.tab;
}

describe('Predict & Win hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCategories.mockResolvedValue([]);
    useLanguageStore.setState({ language: 'en' });
  });

  it('paints the cards the API returns on the default tab', async () => {
    mockList.mockResolvedValue(TWO_ROWS);

    render(<PredictAndWinScreen />);

    await waitFor(() => expect(screen.getByText('SPONSOR_ONE')).toBeTruthy());
    expect(screen.getByText('SPONSOR_TWO')).toBeTruthy();
    expect(lastRequestedTab()).toBe('all');
  });

  it.each(['today', 'mine', 'sponsored'] as const)(
    'paints the cards after switching to the "%s" tab',
    async (tab) => {
      mockList.mockResolvedValue(TWO_ROWS);

      render(<PredictAndWinScreen />);
      await waitFor(() => expect(screen.getByText('SPONSOR_ONE')).toBeTruthy());

      fireEvent.press(screen.getByText(TAB_LABELS[tab]));

      await waitFor(() => expect(lastRequestedTab()).toBe(tab));
      // The rows must be on screen again after the swap, not just refetched.
      await waitFor(() => expect(screen.getByText('SPONSOR_ONE')).toBeTruthy());
      expect(screen.getByText('SPONSOR_TWO')).toBeTruthy();
    },
  );

  it('shows the empty placeholder — not a blank void — when there are no rows', async () => {
    mockList.mockResolvedValue({ items: [], nextCursor: null });

    render(<PredictAndWinScreen />);

    await waitFor(() => expect(screen.getByText('No challenges right now')).toBeTruthy());
  });

  it('shows the retryable error state when the request fails', async () => {
    mockList.mockRejectedValue(new Error('NETWORK'));

    render(<PredictAndWinScreen />);

    await waitFor(() => expect(screen.getByText("Couldn't load challenges")).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('keeps the tab bar mounted while a load is in flight', async () => {
    let resolveList: (value: unknown) => void = () => undefined;
    mockList.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    render(<PredictAndWinScreen />);

    // Swapping the whole list for a full-screen spinner used to unmount these,
    // so a second tab tap did nothing until the first request landed.
    expect(screen.getByText(TAB_LABELS.all)).toBeTruthy();
    expect(screen.getByText(TAB_LABELS.today)).toBeTruthy();

    resolveList(TWO_ROWS);
    await waitFor(() => expect(screen.getByText('SPONSOR_ONE')).toBeTruthy());
  });

  it('pins the add-prize FAB to the physical right edge in Arabic', () => {
    useLanguageStore.setState({ language: 'ar' });
    const { getByRole, getByTestId } = render(<AddPrizeFab onPress={() => undefined} />);
    const strip = getByTestId('pw-add-prize-fab-strip');
    expect(strip.props.style.alignItems).toBe('flex-end');
    expect(strip.props.style.direction).toBe('ltr');
    expect(strip.props.style.paddingRight).toBeGreaterThan(0);
    expect(getByRole('button')).toBeTruthy();
  });
});
