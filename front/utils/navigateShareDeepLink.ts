/**
 * Decide where a parked share / invite URL should go.
 * Unsigned visitors never enter app content; invite codes are parked separately.
 */

import { router } from 'expo-router';

import {
  parseReelIdFromUrl,
  parseProfileUsernameFromUrl,
  parseInviteFromUrl,
  parseCommunityPostIdFromUrl,
} from '../constants/shareLinks';
import { capturePendingReferral } from './pendingReferral';

export type ShareDeepLinkRoute =
  | { kind: 'invite'; path: '/auth' | '/(tabs)/matches' }
  | { kind: 'auth_wall'; path: '/auth' }
  | { kind: 'profile'; path: '/user/[username]'; username: string }
  | { kind: 'reel'; path: '/(tabs)/reels'; reelId: string }
  | { kind: 'post'; path: '/community/post/[id]'; postId: string }
  | { kind: 'none' };

/** Pure routing decision — used by DeepLinkHandler and unit tests. */
export function resolveShareDeepLink(url: string, isSignedIn: boolean): ShareDeepLinkRoute {
  const invite = parseInviteFromUrl(url);
  if (invite) {
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

  const postId = parseCommunityPostIdFromUrl(url);
  if (postId) {
    return { kind: 'post', path: '/community/post/[id]', postId };
  }

  return { kind: 'none' };
}

/**
 * Apply a share deep link: park invite codes (+ click_id), then navigate.
 * Returns true when the URL was recognized and handled.
 * `openPostId` is the post screen currently on top, if any.
 */
export function navigateShareDeepLink(
  url: string,
  isSignedIn: boolean,
  openPostId: string | null = null,
): boolean {
  const decision = resolveShareDeepLink(url, isSignedIn);
  const invite = parseInviteFromUrl(url);

  if (decision.kind === 'invite' && invite) {
    void capturePendingReferral(invite.code, {
      clickId: invite.clickId,
      source: 'deeplink',
    }).then(() => {
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

  if (decision.kind === 'post') {
    // The share URL mirrors the app route, so Expo Router has usually opened
    // the post already — pushing again would stack the same screen twice.
    if (openPostId !== decision.postId) {
      router.push({
        pathname: '/community/post/[id]',
        params: { id: decision.postId },
      });
    }
    return true;
  }

  return false;
}
