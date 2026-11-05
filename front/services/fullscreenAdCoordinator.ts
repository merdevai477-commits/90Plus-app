/**
 * Shared gate so a login interstitial and an app-open ad cannot stack,
 * and so an app-open ad does not play on the same entry that just showed
 * the login interstitial.
 */

type FullscreenOwner = 'login_interstitial' | 'app_open';

let owner: FullscreenOwner | null = null;
let loginInterstitialReserved = false;
let loginInterstitialSawRealBackground = false;

/** Sign-in owns the current foreground until the app is really backgrounded. */
export function reserveLoginInterstitialForeground(): void {
  loginInterstitialReserved = true;
  loginInterstitialSawRealBackground = false;
}

export function clearLoginInterstitialForegroundReservation(): void {
  loginInterstitialReserved = false;
  loginInterstitialSawRealBackground = false;
}

/**
 * A background that happens while a fullscreen ad is up is the ad itself.
 * Only a background with no fullscreen ad on screen releases the sign-in hold.
 */
export function noteAdsAppBackground(): void {
  if (owner !== null) return;
  if (!loginInterstitialReserved) return;
  loginInterstitialSawRealBackground = true;
}

export function loginInterstitialBlocksAppOpen(): boolean {
  return loginInterstitialReserved && !loginInterstitialSawRealBackground;
}

export function isFullscreenAdVisible(): boolean {
  return owner !== null;
}

export function tryAcquireFullscreen(next: FullscreenOwner): boolean {
  if (owner !== null) return false;
  owner = next;
  return true;
}

export function releaseFullscreen(current: FullscreenOwner): void {
  if (owner === current) owner = null;
}

export function resetFullscreenAdCoordinatorForTests(): void {
  owner = null;
  loginInterstitialReserved = false;
  loginInterstitialSawRealBackground = false;
}
