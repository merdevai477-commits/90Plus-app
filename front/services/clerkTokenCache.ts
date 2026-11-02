/**
 * Clerk token cache backed by SecureStore. Clerk reads the client JWT before
 * every request; a null read makes it start a new, signed-out client.
 */
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { logger } from './logger';
import { captureException } from './sentry.service';

// AFTER_FIRST_UNLOCK keeps the session readable while the phone is locked.
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const MAX_READ_ATTEMPTS = 3;

/**
 * SecureStore applies `keychainAccessible` only when it creates an item, so
 * tokens saved before AFTER_FIRST_UNLOCK (July 2026) stay WHEN_UNLOCKED and
 * can't be read while the phone is locked. A new key name creates a fresh item.
 */
const iosKey = (key: string) => `${key}.afu`;

let appActive: Promise<void> | null = null;

function waitForAppActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  if (!appActive) {
    appActive = new Promise<void>((resolve) => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        subscription.remove();
        appActive = null;
        resolve();
      });
    });
  }
  return appActive;
}

async function readToken(key: string): Promise<string | null> {
  let failures = 0;
  for (;;) {
    try {
      return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (err) {
      // A locked iOS keychain ("User interaction is not allowed") only opens
      // once the user unlocks the phone and brings the app to the foreground.
      if (Platform.OS === 'ios' && AppState.currentState !== 'active') {
        await waitForAppActive();
        continue;
      }
      failures += 1;
      if (failures >= MAX_READ_ATTEMPTS) {
        logger.warn('SecureStore getToken error (giving up):', err);
        try {
          captureException(err instanceof Error ? err : new Error(String(err)), {
            tags: { area: 'clerk_token_cache', op: 'getToken' },
          });
        } catch {
          /* Sentry optional */
        }
        return null;
      }
      await new Promise((r) => setTimeout(r, 120 * failures));
    }
  }
}

let iosQueue: Promise<unknown> = Promise.resolve();

/** A migration waiting on a locked keychain must not overwrite a token Clerk saves meanwhile. */
function serializeIos<T>(op: () => Promise<T>): Promise<T> {
  const result = iosQueue.then(op);
  iosQueue = result.catch(() => undefined);
  return result;
}

async function readIosToken(key: string): Promise<string | null> {
  const token = await readToken(iosKey(key));
  if (token != null) return token;

  const legacy = await readToken(key);
  if (legacy == null) return null;
  try {
    await SecureStore.setItemAsync(iosKey(key), legacy, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (err) {
    logger.warn('SecureStore token migration error:', err);
  }
  return legacy;
}

export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    if (Platform.OS !== 'ios') return readToken(key);
    return serializeIos(() => readIosToken(key));
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS !== 'ios') {
        await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
        return;
      }
      await serializeIos(() => SecureStore.setItemAsync(iosKey(key), value, SECURE_STORE_OPTIONS));
    } catch (err) {
      logger.warn('SecureStore saveToken error:', err);
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      if (Platform.OS !== 'ios') {
        await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
        return;
      }
      await serializeIos(async () => {
        await SecureStore.deleteItemAsync(iosKey(key), SECURE_STORE_OPTIONS);
        await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
      });
    } catch (err) {
      logger.warn('SecureStore clearToken error:', err);
    }
  },
};
