import { logger } from './logger';
import {
  adsConfig,
  isConfiguredProductionAdUnit,
} from './adsConfig';
import {
  clearLoginInterstitialForegroundReservation,
  releaseFullscreen,
  reserveLoginInterstitialForeground,
  resetFullscreenAdCoordinatorForTests,
  tryAcquireFullscreen,
} from './fullscreenAdCoordinator';

const LOAD_TIMEOUT_MS = 20000;

export type LoginInterstitialShowResult = 'shown' | 'not_loaded' | 'cancelled' | 'unavailable';

type ShowLoginInterstitial = (
  adUnitId: string,
  isCancelled: () => boolean,
) => Promise<LoginInterstitialShowResult>;

type ShowableInterstitial = {
  show: () => Promise<void>;
  addAdEventListener?: (type: string, listener: () => void) => unknown;
};

let pending = false;
let inFlight = false;
let consumed = false;
let epoch = 0;
let showLoginInterstitial: ShowLoginInterstitial = showLoginInterstitialNative;
let sdkReady: Promise<void> | null = null;
let allowNativePreload = true;
let preloaded: ShowableInterstitial | null = null;
let preloadTask: Promise<void> | null = null;
let preloadGeneration = 0;

/**
 * Arm the post-auth interstitial. Safe to call more than once: a session only
 * accepts one attempt, and a second call while a load is in flight is ignored.
 * This does not load or present an ad.
 */
export function isLoginInterstitialBusy(): boolean {
  return pending || inFlight;
}

export function markLoginInterstitialPending(): void {
  if (consumed) return;
  if (!adsConfig.getServedLoginInterstitialAdUnitId()) return;
  pending = true;
  reserveLoginInterstitialForeground();
  if (!inFlight) return;
  // A previous load is still running. It will present this attempt when it finishes.
}

/**
 * Start loading the interstitial while the user is still on the auth screen,
 * so it can open as soon as sign-in finishes instead of after another network round trip.
 */
export function preloadLoginInterstitial(): void {
  if (!allowNativePreload || consumed || preloaded || preloadTask) return;

  const unitId = adsConfig.getServedLoginInterstitialAdUnitId();
  if (!unitId) return;
  if (adsConfig.shouldUseTestAds() && isConfiguredProductionAdUnit(unitId)) {
    logger.error('[ads] Refused to request a production interstitial during development');
    return;
  }

  const generation = preloadGeneration;
  logger.info('[ads] Preloading login interstitial');
  preloadTask = loadShowableInterstitial(unitId, () => generation !== preloadGeneration)
    .then((ad) => {
      if (generation !== preloadGeneration || !ad) return;
      preloaded = ad;
    })
    .catch((error) => {
      logger.warn('[ads] Login interstitial preload skipped', error);
    })
    .finally(() => {
      if (generation === preloadGeneration) preloadTask = null;
    });
}

/** Drop a pending or in-flight interstitial. Used when the user signs out. */
export function cancelPendingLoginInterstitial(): void {
  const hadWork = pending || inFlight;
  pending = false;
  if (!hadWork) return;
  epoch += 1;
  discardPreloadedInterstitial();
  clearLoginInterstitialForegroundReservation();
  releaseFullscreen('login_interstitial');
}

function discardPreloadedInterstitial(): void {
  preloadGeneration += 1;
  preloaded = null;
  preloadTask = null;
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
  let acquired = false;

  try {
    acquired = tryAcquireFullscreen('login_interstitial');
    if (!acquired) {
      logger.info('[ads] Login interstitial skipped because another ad is visible');
      return;
    }
    const result = await showLoginInterstitial(unitId, () => epoch !== token);
    if (result === 'shown') {
      consumed = true;
      pending = false;
      return;
    }
    if (epoch !== token || result === 'cancelled') return;
    logger.info('[ads] Login interstitial was not shown', result);
  } catch (error) {
    logger.warn('[ads] Login interstitial skipped', error);
  } finally {
    if (acquired) releaseFullscreen('login_interstitial');
    inFlight = false;
    if (pending && !consumed) {
      void presentPendingLoginInterstitial();
    }
  }
}

export function resetLoginInterstitialSessionForTests(): void {
  pending = false;
  inFlight = false;
  consumed = false;
  epoch = 0;
  sdkReady = null;
  showLoginInterstitial = showLoginInterstitialNative;
  allowNativePreload = true;
  discardPreloadedInterstitial();
  resetFullscreenAdCoordinatorForTests();
}

export function setLoginInterstitialPresenterForTests(presenter: ShowLoginInterstitial | null): void {
  showLoginInterstitial = presenter ?? showLoginInterstitialNative;
  allowNativePreload = presenter == null;
}

async function claimPreloadedInterstitial(
  isCancelled: () => boolean,
): Promise<ShowableInterstitial | null> {
  if (isCancelled()) return null;
  preloadLoginInterstitial();
  const generation = preloadGeneration;
  const task = preloadTask;
  if (task) await task;
  if (isCancelled() || generation !== preloadGeneration) return null;
  const ad = preloaded;
  preloaded = null;
  return ad;
}

async function showLoginInterstitialNative(
  _adUnitId: string,
  isCancelled: () => boolean,
): Promise<LoginInterstitialShowResult> {
  const ad = await claimPreloadedInterstitial(isCancelled);
  if (isCancelled()) return 'cancelled';
  if (!ad) return 'not_loaded';

  try {
    logger.info('[ads] Showing login interstitial');
    await showAndWaitForClose(ad);
    return 'shown';
  } catch (error) {
    // Navigation may still be swapping activities. One short retry keeps the
    // already-loaded ad instead of dropping it for the rest of the session.
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (isCancelled()) return 'cancelled';
    try {
      await showAndWaitForClose(ad);
      return 'shown';
    } catch (retryError) {
      logger.warn('[ads] Interstitial failed to show', retryError ?? error);
      return 'not_loaded';
    }
  }
}

/**
 * show() resolves as soon as it is requested, before the ad activity is visible.
 * Wait until it actually opens, then until it closes, and give up quickly when
 * the activity is not ready (common right after an OAuth browser returns).
 */
async function showAndWaitForClose(ad: ShowableInterstitial): Promise<void> {
  if (!ad.addAdEventListener) {
    await ad.show();
    return;
  }

  let opened = false;
  let closed = false;
  let failed = false;
  const mark = (flag: 'opened' | 'closed' | 'failed') => {
    if (flag === 'opened') opened = true;
    if (flag === 'closed') closed = true;
    if (flag === 'failed') failed = true;
  };
  ad.addAdEventListener('opened', () => mark('opened'));
  ad.addAdEventListener('closed', () => mark('closed'));
  ad.addAdEventListener('error', () => mark('failed'));

  await ad.show();

  const openedDeadline = Date.now() + 2500;
  while (!opened && !closed && !failed && Date.now() < openedDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (failed || (!opened && !closed)) {
    throw new Error('Interstitial did not open');
  }

  const closedDeadline = Date.now() + 120000;
  while (!closed && !failed && Date.now() < closedDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!closed) throw new Error('Interstitial did not close');
}

async function loadShowableInterstitial(
  adUnitId: string,
  isCancelled: () => boolean,
): Promise<ShowableInterstitial | null> {
  if (isCancelled()) return null;

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
    return null;
  }

  if (isCancelled()) return null;

  try {
    await withTimeout(ensureSdk(mobileAds), 12000, 'initialize');
  } catch (error) {
    logger.warn('[ads] Google Mobile Ads failed to initialize', error);
    return null;
  }

  if (isCancelled()) return null;

  const interstitial = InterstitialAd.createForAdRequest(adUnitId);
  const loaded = await waitForInterstitialLoad(interstitial, AdEventType, isCancelled);
  if (!loaded || isCancelled()) return null;
  return interstitial;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[ads] ${label} timed out`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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
    remember(
      interstitial.addAdEventListener(AdEventType.ERROR, () => {
        logger.warn('[ads] Interstitial failed to load');
        finish(false);
      }),
    );

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
