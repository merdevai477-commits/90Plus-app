import {
  cancelPendingLoginInterstitial,
  isPostAuthDestination,
  armLoginInterstitial,
  markLoginInterstitialPending,
  preloadLoginInterstitial,
  presentPendingLoginInterstitial,
  releaseLoginInterstitialAfterOnboarding,
  resetLoginInterstitialSessionForTests,
  setLoginInterstitialPresenterForTests,
  type LoginInterstitialShowResult,
} from '../loginInterstitialAd';
import { setRemoteAdsEnabled } from '../adsConfig';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (options: Record<string, unknown>) => options.android ?? options.default,
  },
}));

describe('login interstitial session', () => {
  let result: LoginInterstitialShowResult;

  beforeEach(() => {
    setRemoteAdsEnabled(true);
    resetLoginInterstitialSessionForTests();
    result = 'shown';
    setLoginInterstitialPresenterForTests(async (_unitId, isCancelled) => {
      if (isCancelled()) return 'cancelled';
      return result;
    });
  });

  afterEach(() => {
    resetLoginInterstitialSessionForTests();
    setRemoteAdsEnabled(null);
  });

  it('shows once per session after auth is armed', async () => {
    const calls: string[] = [];
    setLoginInterstitialPresenterForTests(async (unitId) => {
      calls.push(unitId);
      return 'shown';
    });

    markLoginInterstitialPending();
    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();
    await presentPendingLoginInterstitial();
    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('9975521818019509');
  });

  it('does not loop after a failed load, and allows the next sign-in to try again', async () => {
    let calls = 0;
    setLoginInterstitialPresenterForTests(async () => {
      calls += 1;
      return 'not_loaded';
    });

    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();
    await presentPendingLoginInterstitial();
    expect(calls).toBe(1);

    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();
    expect(calls).toBe(2);
  });

  it('drops an in-flight ad on sign-out and allows the next sign-in', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstOutcome: LoginInterstitialShowResult | null = null;

    setLoginInterstitialPresenterForTests(async (_unitId, isCancelled) => {
      await gate;
      firstOutcome = isCancelled() ? 'cancelled' : 'shown';
      return firstOutcome;
    });

    markLoginInterstitialPending();
    const first = presentPendingLoginInterstitial();
    cancelPendingLoginInterstitial();
    release?.();
    await first;
    expect(firstOutcome).toBe('cancelled');

    let secondCalls = 0;
    setLoginInterstitialPresenterForTests(async () => {
      secondCalls += 1;
      return 'shown';
    });
    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();
    expect(secondCalls).toBe(1);
  });

  it('does not show while the ad is only preloading', async () => {
    let calls = 0;
    setLoginInterstitialPresenterForTests(async () => {
      calls += 1;
      return 'shown';
    });

    preloadLoginInterstitial();
    await Promise.resolve();
    expect(calls).toBe(0);

    markLoginInterstitialPending();
    await presentPendingLoginInterstitial();
    expect(calls).toBe(1);
  });

  it('holds the ad until onboarding finishes for a first registration', async () => {
    let calls = 0;
    setLoginInterstitialPresenterForTests(async () => {
      calls += 1;
      return 'shown';
    });

    armLoginInterstitial({ afterOnboarding: true });
    await presentPendingLoginInterstitial();
    expect(calls).toBe(0);

    releaseLoginInterstitialAfterOnboarding();
    await Promise.resolve();
    expect(calls).toBe(1);
  });

  it('shows a returning sign-in immediately instead of waiting for navigation', async () => {
    let calls = 0;
    setLoginInterstitialPresenterForTests(async () => {
      calls += 1;
      return 'shown';
    });

    armLoginInterstitial();
    await Promise.resolve();
    expect(calls).toBe(1);
  });

  it('treats auth screens and the index redirect as not ready', () => {
    expect(isPostAuthDestination('/auth')).toBe(false);
    expect(isPostAuthDestination('/auth/login')).toBe(false);
    expect(isPostAuthDestination('/')).toBe(false);
    expect(isPostAuthDestination('/matches')).toBe(true);
    expect(isPostAuthDestination('/onboarding')).toBe(false);
    expect(isPostAuthDestination('/parental-consent')).toBe(false);
    expect(isPostAuthDestination('/waiting-consent')).toBe(false);
  });
});
