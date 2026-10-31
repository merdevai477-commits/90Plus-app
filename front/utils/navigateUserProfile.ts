import type { Router } from 'expo-router';

import { globalState } from '../globalState';

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
 * Open a user's profile: own account → profile tab; anyone else → public /user/[username].
 */
export function navigateUserProfile(router: Pick<Router, 'push'>, username: string | null | undefined): void {
  const clean = normalizeProfileUsername(username);
  if (!clean) return;
  if (isCurrentUserUsername(clean)) {
    router.push('/(tabs)/profile' as never);
    return;
  }
  router.push({ pathname: '/user/[username]', params: { username: clean } });
}
