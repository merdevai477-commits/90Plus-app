import {
  decideAppOpenEntry,
  getAppOpenLoadStateForTests,
  prepareAppOpenAd,
  presentAppOpenAd,
  resetAppOpenAdForTests,
  setAppOpenDriverForTests,
  setAppOpenSessionForTests,
  type AppOpenShowContext,
} from '../appOpenAd';
import { noteAdsAppBackground } from '../fullscreenAdCoordinator';
import {
  markLoginInterstitialPending,
  presentPendingLoginInterstitial,
  resetLoginInterstitialSessionForTests,
  setLoginInterstitialPresenterForTests,
} from '../loginInterstitialAd';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (options: Record<string, unknown>) => options.android ?? options.default,
  },
}));

const ANDROID_TEST_APP_OPEN_ID = 'ca-app-pub-3940256099942544/9257395921';
const PRODUCTION_INTERSTITIAL_ID = 'ca-app-pub-9975521818019509/8410381515';

function signedIn(overrides: Partial<AppOpenShowContext> = {}): AppOpenShowContext {
  return {
    authLoaded: true,
    signedIn: true,
    loggingOut: false,
    pathname: '/matches',
    entry: 'foreground',
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('app open ads', () => {
  let loads: string[];
  let shows: number;
  let releaseShow: (() => void) | null;

  beforeEach(() => {
    loads = [];
    shows = 0;
    releaseShow = null;
    resetLoginInterstitialSessionForTests();
    resetAppOpenAdForTests();
    setLoginInterstitialPresenterForTests(async () => 'shown');
    setAppOpenDriverForTests({
      load: async (unitId: string) => {
        loads.push(unitId);
        return true;
      },
      show: async ({ onDismiss }) => {
        shows += 1;
        if (releaseShow) {
          await new Promise<void>((resolve) => {
            releaseShow = () => {
              onDismiss();
              resolve();
            };
          });
          return;
        }
        onDismiss();
      },
    });
  });

  afterEach(() => {
    resetAppOpenAdForTests();
    resetLoginInterstitialSessionForTests();
  });

  async function loadAd(): Promise<void> {
    prepareAppOpenAd();
    await flush();
    expect(getAppOpenLoadStateForTests()).toBe('loaded');
  }

  it('loads the Android test unit and never the interstitial unit', async () => {
    await loadAd();
    expect(loads).toEqual([ANDROID_TEST_APP_OPEN_ID]);
    expect(loads[0]).not.toBe(PRODUCTION_INTERSTITIAL_ID);
  });

  it('does not request a second load while one is already in flight or loaded', async () => {
    prepareAppOpenAd();
    prepareAppOpenAd();
    await flush();
    prepareAppOpenAd();
    expect(loads).toHaveLength(1);
  });

  it('shows once per session and then respects the frequency cap', async () => {
    await loadAd();
    const first = await presentAppOpenAd(signedIn());
    expect(first.status).toBe('shown');
    expect(shows).toBe(1);

    const second = await presentAppOpenAd(signedIn());
    expect(second).toEqual({ status: 'skipped', reason: 'frequency' });
    expect(shows).toBe(1);
  });

  it('applies the minimum interval even when the session flag is clear', async () => {
    await loadAd();
    const shownAt = 1_700_000_000_000;
    setAppOpenSessionForTests({ shownThisSession: false, lastShownAt: shownAt });

    const tooSoon = await presentAppOpenAd(signedIn({ now: shownAt + 10 * 60_000 }));
    expect(tooSoon).toEqual({ status: 'skipped', reason: 'interval' });

    setAppOpenSessionForTests({ shownThisSession: false, lastShownAt: shownAt });
    const later = await presentAppOpenAd(signedIn({ now: shownAt + 31 * 60_000 }));
    expect(later.status).toBe('shown');
  });

  it('does not show a second app-open ad while one is already visible', async () => {
    releaseShow = () => {};
    await loadAd();

    const first = presentAppOpenAd(signedIn());
    const second = await presentAppOpenAd(signedIn());
    expect(second).toEqual({ status: 'skipped', reason: 'already_showing' });
    expect(shows).toBe(1);

    releaseShow?.();
    await first;
  });

  it('does not show over auth, consent, startup, or signed-out states', async () => {
    await expect(presentAppOpenAd(signedIn({ pathname: '/auth' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'auth_screen',
    });
    await expect(presentAppOpenAd(signedIn({ pathname: '/auth/login' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'auth_screen',
    });
    await expect(presentAppOpenAd(signedIn({ pathname: '/parental-consent' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'consent_screen',
    });
    await expect(presentAppOpenAd(signedIn({ pathname: '/waiting-consent' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'consent_screen',
    });
    await expect(presentAppOpenAd(signedIn({ pathname: '/blocked' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'blocked_screen',
    });
    await expect(presentAppOpenAd(signedIn({ pathname: '/' }))).resolves.toEqual({
      status: 'skipped',
      reason: 'startup',
    });
    await expect(presentAppOpenAd(signedIn({ authLoaded: false }))).resolves.toEqual({
      status: 'skipped',
      reason: 'auth_loading',
    });
    await expect(presentAppOpenAd(signedIn({ signedIn: false }))).resolves.toEqual({
      status: 'skipped',
      reason: 'signed_out',
    });
    await expect(presentAppOpenAd(signedIn({ loggingOut: true }))).resolves.toEqual({
      status: 'skipped',
      reason: 'logout',
    });
    expect(shows).toBe(0);
  });

  it('lets the login interstitial own sign-in and shows app open only after a later return', async () => {
    await loadAd();
    markLoginInterstitialPending();

    const duringSignIn = await presentAppOpenAd(signedIn());
    expect(duringSignIn).toEqual({ status: 'skipped', reason: 'login_interstitial' });

    await presentPendingLoginInterstitial();
    const rightAfterInterstitial = await presentAppOpenAd(signedIn());
    expect(rightAfterInterstitial).toEqual({ status: 'skipped', reason: 'login_interstitial' });

    noteAdsAppBackground();
    const afterReturn = await presentAppOpenAd(signedIn());
    expect(afterReturn.status).toBe('shown');
    expect(shows).toBe(1);
  });

  it('treats a real return from background or inactive as a show opportunity, not a quick flicker', () => {
    expect(
      decideAppOpenEntry({ previous: 'background', next: 'active', awayMs: 5_000 }),
    ).toEqual({ entry: 'foreground' });
    expect(
      decideAppOpenEntry({ previous: 'inactive', next: 'active', awayMs: 4_000 }),
    ).toEqual({ entry: 'foreground' });
    expect(
      decideAppOpenEntry({ previous: 'unknown', next: 'active', awayMs: 0, coldStart: true }),
    ).toEqual({ entry: 'cold_start' });
    expect(
      decideAppOpenEntry({ previous: 'background', next: 'active', awayMs: 400 }),
    ).toEqual({ skip: 'quick_transition' });
    expect(
      decideAppOpenEntry({ previous: 'active', next: 'active', awayMs: 10_000 }),
    ).toEqual({ skip: 'not_an_entry' });
  });
});
