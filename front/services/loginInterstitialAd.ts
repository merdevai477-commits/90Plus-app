import { logger } from './logger';
import {
  adsConfig,
  isConfiguredProductionAdUnit,
} from './adsConfig';

const LOAD_TIMEOUT_MS = 8000;

export type LoginInterstitialShowResult = 'shown' | 'not_loaded' | 'cancelled' | 'unavailable';

type ShowLoginInterstitial = (
  adUnitId: string,
  isCancelled: () => boolean,
) => Promise<LoginInterstitialShowResult>;

let pending = false;
let inFlight = false;
let consumed = false;
let epoch = 0;
let showLoginInterstitial: ShowLoginInterstitial = showLoginInterstitialNative;
let sdkReady: Promise<void> | null = null;

/**
 * Arm the post-auth interstitial. Safe to call more than once: a session only
 * accepts one attempt, and a second call while a load is in flight is ignored.
 * This does not load or present an ad.
 */
export function markLoginInterstitialPending(): void {
  if (consumed || inFlight) return;
  if (!adsConfig.getServedLoginInterstitialAdUnitId()) return;
  pending = true;
}

/** Drop a pending or in-flight interstitial. Used when the user signs out. */
export function cancelPendingLoginInterstitial(): void {
  const hadWork = pending || inFlight;
  pending = false;
  if (!hadWork) return;
  epoch += 1;
}

export function isPostAuthDestination(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === '/' || pathname === '/index') return false;
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return false;
  // Keep the interstitial off legal consent screens. The attempt stays armed
  // until navigation reaches the actual post-auth screen.
  if (pathname === '/parental-consent' || pathname === '/waiting-consent') return false;
  return true;
}

/**
 * Load and show the armed interstitial. Navigation must already have moved on;
 * a load or show failure resolves without throwing.
 */
export async function presentPendingLoginInterstitial(): Promise<void> {
  if (consumed || inFlight || !pending) return;

  const unitId = adsConfig.getServedLoginInterstitialAdUnitId();
  if (!unitId) {
    pending = false;
    return;
  }

  if (adsConfig.shouldUseTestAds() && isConfiguredProductionAdUnit(unitId)) {
    pending = false;
    logger.error('[ads] Refused to request a production interstitial during development');
    return;
  }

  inFlight = true;
  pending = false;
  const token = epoch;

  try {
    const result = await showLoginInterstitial(unitId, () => epoch !== token);
    if (result === 'shown') {
      consumed = true;
      return;
    }
    if (epoch !== token || result === 'cancelled') return;
    consumed = true;
  } catch (error) {
    logger.warn('[ads] Login interstitial skipped', error);
    if (epoch === token) consumed = true;
  } finally {
    inFlight = false;
  }
}

export function resetLoginInterstitialSessionForTests(): void {
  pending = false;
  inFlight = false;
  consumed = false;
  epoch = 0;
  sdkReady = null;
  showLoginInterstitial = showLoginInterstitialNative;
}

export function setLoginInterstitialPresenterForTests(presenter: ShowLoginInterstitial | null): void {
  showLoginInterstitial = presenter ?? showLoginInterstitialNative;
}

async function showLoginInterstitialNative(
  adUnitId: string,
  isCancelled: () => boolean,
): Promise<LoginInterstitialShowResult> {
  if (isCancelled()) return 'cancelled';

  let mobileAds: typeof import('react-native-google-mobile-ads').default;
  let InterstitialAd: typeof import('react-native-google-mobile-ads').InterstitialAd;
  let AdEventType: typeof import('react-native-google-mobile-ads').AdEventType;

  try {
    const ads = await import('react-native-google-mobile-ads');
    mobileAds = ads.default;
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
  } catch (error) {
    logger.warn('[ads] Google Mobile Ads is not in this binary', error);
    return 'unavailable';
  }

  if (isCancelled()) return 'cancelled';

  try {
    await ensureSdk(mobileAds);
  } catch (error) {
    logger.warn('[ads] Google Mobile Ads failed to initialize', error);
    return 'unavailable';
  }

  if (isCancelled()) return 'cancelled';

  const interstitial = InterstitialAd.createForAdRequest(adUnitId);
  const loaded = await waitForInterstitialLoad(interstitial, AdEventType, isCancelled);
  if (!loaded || isCancelled()) return isCancelled() ? 'cancelled' : 'not_loaded';

  try {
    await interstitial.show();
    return 'shown';
  } catch (error) {
    logger.warn('[ads] Interstitial failed to show', error);
    return 'not_loaded';
  }
}

async function ensureSdk(
  mobileAds: typeof import('react-native-google-mobile-ads').default,
): Promise<void> {
  if (!sdkReady) {
    const pendingInit = (async () => {
      if (adsConfig.shouldUseTestAds()) {
        await mobileAds().setRequestConfiguration({
          testDeviceIdentifiers: ['EMULATOR'],
        });
      }
      await mobileAds().initialize();
    })();

    sdkReady = pendingInit.catch((error) => {
      sdkReady = null;
      throw error;
    });
  }

  await sdkReady;
}

async function waitForInterstitialLoad(
  interstitial: {
    addAdEventListener: (type: string, listener: () => void) => unknown;
    load: () => void;
  },
  AdEventType: { LOADED: string; ERROR: string },
  isCancelled: () => boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribers: (() => void)[] = [];

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      resolve(loaded);
    };

    const remember = (unsubscribe: unknown) => {
      if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe as () => void);
    };

    remember(interstitial.addAdEventListener(AdEventType.LOADED, () => finish(true)));
    remember(interstitial.addAdEventListener(AdEventType.ERROR, () => finish(false)));

    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    if (isCancelled()) {
      finish(false);
      return;
    }

    try {
      interstitial.load();
    } catch {
      finish(false);
    }
  });
}
