import { logger } from './logger';
import { adsConfig, isConfiguredProductionAdUnit } from './adsConfig';
import {
  isFullscreenAdVisible,
  loginInterstitialBlocksAppOpen,
  releaseFullscreen,
  tryAcquireFullscreen,
} from './fullscreenAdCoordinator';
import { isLoginInterstitialBusy } from './loginInterstitialAd';

export const APP_OPEN_QUICK_TRANSITION_MS = 2000;

const LOAD_TIMEOUT_MS = 20000;

export type AppOpenEntry = 'cold_start' | 'foreground';

export type AppOpenSkipReason =
  | 'auth_loading'
  | 'signed_out'
  | 'logout'
  | 'startup'
  | 'auth_screen'
  | 'consent_screen'
  | 'blocked_screen'
  | 'login_interstitial'
  | 'ad_visible'
  | 'already_showing'
  | 'frequency'
  | 'interval'
  | 'quick_transition'
  | 'not_an_entry'
  | 'not_loaded'
  | 'unconfigured'
  | 'unavailable';

export type AppOpenPresentResult =
  | { status: 'shown' }
  | { status: 'skipped'; reason: AppOpenSkipReason }
  | { status: 'failed' };

export type AppOpenShowContext = {
  authLoaded: boolean;
  signedIn: boolean;
  loggingOut: boolean;
  pathname: string | null;
  entry: AppOpenEntry;
  now?: number;
};

type AppStateName = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

type LoadState = 'idle' | 'loading' | 'loaded' | 'showing';

type AppOpenDriver = {
  load: (unitId: string) => Promise<boolean>;
  show: (handlers: { onDismiss: () => void }) => Promise<void>;
};

let loadState: LoadState = 'idle';
let shownThisSession = false;
let lastShownAt: number | null = null;
let driver: AppOpenDriver | null = null;
let useNativeDriver = true;
let dismissHandled = false;
let queuedShow: AppOpenShowContext | null = null;

export function appOpenScreenBlock(pathname: string | null | undefined): AppOpenSkipReason | null {
  if (!pathname) return 'startup';
  if (pathname === '/' || pathname === '/index') return 'startup';
  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/auth-callback' ||
    pathname.startsWith('/auth-callback')
  ) {
    return 'auth_screen';
  }
  if (pathname === '/parental-consent' || pathname === '/waiting-consent') return 'consent_screen';
  if (pathname === '/blocked') return 'blocked_screen';
  return null;
}

export function decideAppOpenEntry(input: {
  previous: AppStateName;
  next: AppStateName;
  awayMs: number;
  coldStart?: boolean;
  quickTransitionMs?: number;
}): { entry: AppOpenEntry } | { skip: 'quick_transition' | 'not_an_entry' } {
  if (input.coldStart) return { entry: 'cold_start' };
  if (input.next !== 'active') return { skip: 'not_an_entry' };
  if (input.previous !== 'background' && input.previous !== 'inactive') {
    return { skip: 'not_an_entry' };
  }
  const minimumAway = input.quickTransitionMs ?? APP_OPEN_QUICK_TRANSITION_MS;
  if (input.awayMs < minimumAway) return { skip: 'quick_transition' };
  return { entry: 'foreground' };
}

function skip(reason: AppOpenSkipReason): AppOpenPresentResult {
  logger.info('APP_OPEN_AD_SKIPPED', { reason });
  return { status: 'skipped', reason };
}

function policySkip(context: AppOpenShowContext, now: number): AppOpenSkipReason | null {
  if (!context.authLoaded) return 'auth_loading';
  if (context.loggingOut) return 'logout';
  if (!context.signedIn) return 'signed_out';

  const screen = appOpenScreenBlock(context.pathname);
  if (screen) return screen;

  if (loginInterstitialBlocksAppOpen() || isLoginInterstitialBusy()) return 'login_interstitial';
  if (isFullscreenAdVisible() || loadState === 'showing') {
    return loadState === 'showing' ? 'already_showing' : 'ad_visible';
  }
  if (shownThisSession) return 'frequency';

  const intervalMs = adsConfig.appOpenMinimumIntervalMinutes * 60_000;
  if (lastShownAt != null && now - lastShownAt < intervalMs) return 'interval';
  return null;
}

export function cancelQueuedAppOpenAd(): void {
  queuedShow = null;
}

/** Load an app-open ad if one is not already loading, loaded, or visible. */
export function prepareAppOpenAd(): void {
  if (!useNativeDriver && !driver) return;
  if (loadState !== 'idle' || shownThisSession) return;

  const unitId = adsConfig.getServedAppOpenAdUnitId();
  if (!unitId) return;
  if (adsConfig.shouldUseTestAds() && isConfiguredProductionAdUnit(unitId)) {
    logger.error('APP_OPEN_AD_FAILED', { reason: 'refused_production_unit_in_development' });
    return;
  }

  loadState = 'loading';
  logger.info('APP_OPEN_AD_LOADING');
  const activeDriver = driver ?? createNativeDriver();
  void activeDriver
    .load(unitId)
    .then((loaded) => {
      if (loadState !== 'loading') return;
      if (!loaded) {
        loadState = 'idle';
        queuedShow = null;
        logger.warn('APP_OPEN_AD_FAILED', { reason: 'load_failed' });
        return;
      }
      loadState = 'loaded';
      logger.info('APP_OPEN_AD_LOADED');
      const waiting = queuedShow;
      queuedShow = null;
      if (waiting) void presentAppOpenAd(waiting);
    })
    .catch((error) => {
      if (loadState === 'loading') loadState = 'idle';
      queuedShow = null;
      logger.warn('APP_OPEN_AD_FAILED', {
        reason: error instanceof Error ? error.message : 'load_failed',
      });
    });
}

/**
 * Show the loaded app-open ad when the entry point and frequency rules allow it.
 * A failure resolves without throwing so navigation is never blocked.
 */
export async function presentAppOpenAd(context: AppOpenShowContext): Promise<AppOpenPresentResult> {
  const now = context.now ?? Date.now();
  const blocked = policySkip(context, now);
  if (blocked) return skip(blocked);

  if (loadState !== 'loaded') {
    queuedShow = context;
    prepareAppOpenAd();
    return skip('not_loaded');
  }

  queuedShow = null;

  const activeDriver = driver ?? createNativeDriver();
  if (!tryAcquireFullscreen('app_open')) return skip('ad_visible');

  const previousShownAt = lastShownAt;
  loadState = 'showing';
  shownThisSession = true;
  lastShownAt = now;
  dismissHandled = false;
  logger.info('APP_OPEN_AD_SHOWING');

  try {
    await activeDriver.show({ onDismiss: handleDismiss });
    return { status: 'shown' };
  } catch (error) {
    loadState = 'idle';
    shownThisSession = false;
    lastShownAt = previousShownAt;
    releaseFullscreen('app_open');
    logger.warn('APP_OPEN_AD_FAILED', {
      reason: error instanceof Error ? error.message : 'show_failed',
    });
    prepareAppOpenAd();
    return { status: 'failed' };
  }
}

function handleDismiss(): void {
  if (dismissHandled) return;
  dismissHandled = true;
  loadState = 'idle';
  releaseFullscreen('app_open');
  logger.info('APP_OPEN_AD_DISMISSED');
  // The next ad is requested only when this session is still allowed to show one.
  // once_per_session stops that reload after a successful display.
  prepareAppOpenAd();
}

export function resetAppOpenAdForTests(): void {
  loadState = 'idle';
  shownThisSession = false;
  lastShownAt = null;
  driver = null;
  useNativeDriver = true;
  dismissHandled = false;
  queuedShow = null;
}

export function setAppOpenDriverForTests(next: AppOpenDriver | null): void {
  driver = next;
  useNativeDriver = next == null;
}

export function setAppOpenSessionForTests(state: {
  shownThisSession?: boolean;
  lastShownAt?: number | null;
}): void {
  if (state.shownThisSession !== undefined) shownThisSession = state.shownThisSession;
  if (state.lastShownAt !== undefined) lastShownAt = state.lastShownAt;
}

export function getAppOpenLoadStateForTests(): LoadState {
  return loadState;
}

function createNativeDriver(): AppOpenDriver {
  let current: { show: () => Promise<void> } | null = null;

  return {
    async load(unitId: string): Promise<boolean> {
      let mobileAds: typeof import('react-native-google-mobile-ads').default;
      let AppOpenAd: typeof import('react-native-google-mobile-ads').AppOpenAd;
      let AdEventType: typeof import('react-native-google-mobile-ads').AdEventType;

      try {
        const ads = await import('react-native-google-mobile-ads');
        mobileAds = ads.default;
        AppOpenAd = ads.AppOpenAd;
        AdEventType = ads.AdEventType;
      } catch (error) {
        logger.warn('APP_OPEN_AD_FAILED', { reason: 'sdk_missing' });
        logger.warn('[ads] Google Mobile Ads is not in this binary', error);
        return false;
      }

      try {
        await withTimeout(ensureSdk(mobileAds), 12000, 'initialize');
      } catch (error) {
        logger.warn('APP_OPEN_AD_FAILED', { reason: 'sdk_init_failed' });
        logger.warn('[ads] Google Mobile Ads failed to initialize', error);
        return false;
      }

      const ad = AppOpenAd.createForAdRequest(unitId);
      current = ad;
      return waitForAppOpenLoad(ad, AdEventType);
    },

    async show(handlers: { onDismiss: () => void }): Promise<void> {
      if (!current) throw new Error('App open ad is not loaded');
      const ad = current as {
        show: () => Promise<void>;
        addAdEventListener: (type: string, listener: () => void) => unknown;
      };
      const ads = await import('react-native-google-mobile-ads');
      ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
        handlers.onDismiss();
      });
      await ad.show();
    },
  };
}

let sdkReady: Promise<void> | null = null;

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

function waitForAppOpenLoad(
  ad: {
    addAdEventListener: (type: string, listener: () => void) => unknown;
    load: () => void;
  },
  AdEventType: { LOADED: string; ERROR: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const unsubscribers: Array<() => void> = [];
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

    remember(ad.addAdEventListener(AdEventType.LOADED, () => finish(true)));
    remember(ad.addAdEventListener(AdEventType.ERROR, () => finish(false)));
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    try {
      ad.load();
    } catch {
      finish(false);
    }
  });
}
