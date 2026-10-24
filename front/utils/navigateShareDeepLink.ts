/**
 * Decide where a parked share / invite URL should go.
 * Unsigned visitors never enter app content; invite codes are parked separately.
 */

import { router } from 'expo-router';

import {
  parseReelIdFromUrl,
  parseProfileUsernameFromUrl,
  parseReferralCodeFromUrl,
} from '../constants/shareLinks';
import { capturePendingReferral } from './pendingReferral';

export type ShareDeepLinkRoute =
  | { kind: 'invite'; path: '/auth' | '/(tabs)/matches' }
  | { kind: 'auth_wall'; path: '/auth' }
  | { kind: 'profile'; path: '/user/[username]'; username: string }
  | { kind: 'reel'; path: '/(tabs)/reels'; reelId: string }
  | { kind: 'none' };

/** Pure routing decision — used by DeepLinkHandler and unit tests. */
export function resolveShareDeepLink(url: string, isSignedIn: boolean): ShareDeepLinkRoute {
  const referralCode = parseReferralCodeFromUrl(url);
  if (referralCode) {
    return {
      kind: 'invite',
      path: isSignedIn ? '/(tabs)/matches' : '/auth',
    };
  }

  if (!isSignedIn) {
    return { kind: 'auth_wall', path: '/auth' };
  }

  const profileUsername = parseProfileUsernameFromUrl(url);
  if (profileUsername) {
    return { kind: 'profile', path: '/user/[username]', username: profileUsername };
  }

  const reelId = parseReelIdFromUrl(url);
  if (reelId) {
    return { kind: 'reel', path: '/(tabs)/reels', reelId };
  }

  return { kind: 'none' };
}

/**
 * Apply a share deep link: park invite codes, then navigate.
 * Returns true when the URL was recognized and handled.
 */
export function navigateShareDeepLink(url: string, isSignedIn: boolean): boolean {
  const decision = resolveShareDeepLink(url, isSignedIn);
  const referralCode = parseReferralCodeFromUrl(url);

  if (decision.kind === 'invite' && referralCode) {
    void capturePendingReferral(referralCode).then(() => {
      router.replace(decision.path);
    });
    return true;
  }

  if (decision.kind === 'auth_wall') {
    router.replace('/auth');
    return true;
  }

  if (decision.kind === 'profile') {
    router.push({
      pathname: '/user/[username]',
      params: { username: decision.username },
    });
    return true;
  }

  if (decision.kind === 'reel') {
    router.push({
      pathname: '/(tabs)/reels',
      params: { reelId: decision.reelId },
    });
    return true;
  }

  return false;
}
