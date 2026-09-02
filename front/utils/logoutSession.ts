import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGOUT_SIGN_OUT_TIMEOUT_MS = 8_000;

const LOGOUT_STORAGE_KEYS = [
  '@username_setup_complete',
  '@user_profile',
  '@90plus_age_verified',
] as const;

export async function signOutWithTimeout(
  signOut: () => Promise<void>,
  timeoutMs = LOGOUT_SIGN_OUT_TIMEOUT_MS,
): Promise<void> {
  await Promise.race([
    signOut().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Heavy AsyncStorage/cache sweeps — run after navigation, never block the UI. */
export function runLogoutCleanup(clearVideos?: () => Promise<void>): void {
  void (async () => {
    try {
      if (clearVideos) {
        await clearVideos().catch(() => {});
      }

      const { globalState } = await import('../globalState');
      const { CoinsService } = await import('../services/coins.service');
      const { AuthService } = await import('../src/services/authService');
      const { rankingsService } = await import('../services/rankingsService');
      const { cacheService } = await import('../services/cacheService');

      AuthService.clearMemoryCache();
      CoinsService.clearCurrentUser();
      rankingsService.clearMemoryCache();

      await Promise.allSettled([
        globalState.logout(),
        cacheService.clearAll(),
        AsyncStorage.multiRemove([...LOGOUT_STORAGE_KEYS]),
      ]);
    } catch {
      /* Best-effort background cleanup */
    }
  })();
}

export async function performFastLogout(options: {
  signOut: () => Promise<void>;
  clearVideos?: () => Promise<void>;
  disconnectWebSocket?: () => void;
}): Promise<void> {
  options.disconnectWebSocket?.();

  try {
    const { AuthService } = await import('../src/services/authService');
    const { CoinsService } = await import('../services/coins.service');
    const { rankingsService } = await import('../services/rankingsService');
    AuthService.clearMemoryCache();
    CoinsService.clearCurrentUser();
    rankingsService.clearMemoryCache();
  } catch {
    /* noop */
  }

  await signOutWithTimeout(options.signOut);
  runLogoutCleanup(options.clearVideos);
}
