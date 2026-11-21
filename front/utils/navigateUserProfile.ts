import type { Router } from 'expo-router';

import { globalState } from '../globalState';
import { AuthService } from '../src/services/authService';
import {
  fetchPublicProfileCached,
  fetchPublicVideosCached,
  peekPublicProfile,
  peekPublicVideos,
  setPublicProfileMemory,
} from '../services/publicProfileCache';
import type { SearchUserResult } from '../src/services/authService';

/** Strip leading @ and whitespace from a mention or route param. */
export function normalizeProfileUsername(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '');
}

/** True when `username` is the signed-in account (profile tab, not public /user). */
export function isCurrentUserUsername(username: string | null | undefined): boolean {
  const target = normalizeProfileUsername(username).toLowerCase();
  if (!target) return false;
  const fromProfile = globalState.userProfile?.username?.trim().toLowerCase() ?? '';
  const fromGlobal = globalState.username?.trim().toLowerCase() ?? '';
  return target === fromProfile || target === fromGlobal;
}

/**
 * Warm memory (+ start network) before / during navigation so the screen
 * can paint without waiting on a cold request.
 */
export function prefetchPublicUserProfile(
  username: string | null | undefined,
  seed?: SearchUserResult | null,
): void {
  const clean = normalizeProfileUsername(username);
  if (!clean || isCurrentUserUsername(clean)) return;

  if (seed?.username) {
    setPublicProfileMemory(clean, seed);
  }

  if (!peekPublicProfile(clean)) {
    void fetchPublicProfileCached(clean, () => AuthService.getUserByUsername(null, clean));
  }
  if (!peekPublicVideos(clean)) {
    void fetchPublicVideosCached(clean, () => AuthService.getUserReels(null, clean, 30, 0));
  }
}

/**
 * Open a user's profile: own account → profile tab; anyone else → public /user/[username].
 */
export function navigateUserProfile(
  router: Pick<Router, 'push'>,
  username: string | null | undefined,
  seed?: SearchUserResult | null,
): void {
  const clean = normalizeProfileUsername(username);
  if (!clean) return;
  if (isCurrentUserUsername(clean)) {
    router.push('/(tabs)/profile' as never);
    return;
  }
  prefetchPublicUserProfile(clean, seed);
  router.push({ pathname: '/user/[username]', params: { username: clean } });
}
