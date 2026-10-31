/**
 * Device session — keeps users signed in past Clerk's fixed 7-day session
 * lifetime. A long-lived, rotating device key (SecureStore) is exchanged with
 * our backend for a one-time Clerk sign-in ticket when the Clerk session ends.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiEndpoint } from '../config/api.config';
import { logger } from '../services/logger';

const DEVICE_KEY_STORE_KEY = '90plus_device_session_v1';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};
const REQUEST_TIMEOUT_MS = 10_000;

type TicketSignIn = {
  create: (params: { strategy: 'ticket'; ticket: string }) => Promise<{
    status: string | null;
    createdSessionId: string | null;
  }>;
};
type SetActive = (params: { session: string }) => Promise<void>;

export type ResumeOutcome = 'resumed' | 'no_key' | 'rejected' | 'failed';

let cachedHasKey: boolean | null = null;
/** Single-flight: concurrent remounts must not race the same device key. */
let resumeInFlight: Promise<ResumeOutcome> | null = null;

/** Synchronous hint; `null` until SecureStore has been read once this launch. */
export function peekHasDeviceKey(): boolean | null {
  return cachedHasKey;
}

export async function getStoredDeviceKey(): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(DEVICE_KEY_STORE_KEY, SECURE_STORE_OPTIONS);
    cachedHasKey = !!key;
    return key;
  } catch {
    return null;
  }
}

async function storeDeviceKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_KEY_STORE_KEY, key, SECURE_STORE_OPTIONS);
  cachedHasKey = true;
}

async function clearStoredDeviceKey(): Promise<void> {
  cachedHasKey = false;
  try {
    await SecureStore.deleteItemAsync(DEVICE_KEY_STORE_KEY, SECURE_STORE_OPTIONS);
  } catch {
    /* best effort */
  }
}

/**
 * Clear the stored key only if it is still the one we presented. A concurrent
 * winner may have already written the rotated key — wiping that would log the
 * user out permanently.
 */
async function clearStoredDeviceKeyIfUnchanged(presentedKey: string): Promise<void> {
  const current = await getStoredDeviceKey();
  if (current === presentedKey || current == null) {
    await clearStoredDeviceKey();
  } else {
    logger.info('[DeviceSession] Skipping clear — key already rotated by peer resume');
  }
}

function deviceInfo(): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  return `${Platform.OS} ${String(Platform.Version)} app ${version}`;
}

async function postJson(path: string, body: unknown, bearer?: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(getApiEndpoint(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Issue a device key for the signed-in user if this device doesn't have one yet. */
export async function ensureDeviceSessionRegistered(
  getBearerToken: () => Promise<string | null>,
): Promise<void> {
  if (await getStoredDeviceKey()) return;

  const token = await getBearerToken();
  if (!token) return;

  const res = await postJson('auth/device-session', { deviceInfo: deviceInfo() }, token);
  if (!res.ok) {
    logger.warn('[DeviceSession] Register failed', { status: res.status });
    return;
  }
  const data = (await res.json()) as { deviceKey?: string };
  if (data.deviceKey) {
    await storeDeviceKey(data.deviceKey);
  }
}

async function resumeDeviceSessionOnce(
  signIn: TicketSignIn,
  setActive: SetActive,
): Promise<ResumeOutcome> {
  const deviceKey = await getStoredDeviceKey();
  if (!deviceKey) return 'no_key';

  let ticket: string;
  try {
    const res = await postJson('auth/device-session/resume', {
      deviceKey,
      deviceInfo: deviceInfo(),
    });

    let body: { ticket?: string; deviceKey?: string; reason?: string } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* empty / non-json */
    }

    if (res.status === 401 || res.status === 400) {
      // Peer resume already rotated this key — keep whatever is in SecureStore
      // (the winner may have written the new key).
      if (body.reason === 'already_rotated') {
        logger.info('[DeviceSession] Resume lost rotation race — keeping local key');
        return 'failed';
      }
      await clearStoredDeviceKeyIfUnchanged(deviceKey);
      return 'rejected';
    }
    if (!res.ok) return 'failed';

    if (!body.ticket || !body.deviceKey) return 'failed';
    // The old key is revoked server-side as soon as the response is sent.
    await storeDeviceKey(body.deviceKey);
    ticket = body.ticket;
  } catch (err) {
    logger.warn('[DeviceSession] Resume request failed', err);
    return 'failed';
  }

  try {
    const attempt = await signIn.create({ strategy: 'ticket', ticket });
    if (attempt.status === 'complete' && attempt.createdSessionId) {
      await setActive({ session: attempt.createdSessionId });
      logger.info('[DeviceSession] Session restored silently');
      return 'resumed';
    }
    logger.warn('[DeviceSession] Ticket sign-in incomplete', { status: attempt.status });
    return 'failed';
  } catch (err) {
    logger.warn('[DeviceSession] Ticket sign-in failed', err);
    return 'failed';
  }
}

/** Silently create a new Clerk session from the stored device key. */
export async function resumeDeviceSession(
  signIn: TicketSignIn,
  setActive: SetActive,
): Promise<ResumeOutcome> {
  if (resumeInFlight) return resumeInFlight;
  resumeInFlight = resumeDeviceSessionOnce(signIn, setActive).finally(() => {
    resumeInFlight = null;
  });
  return resumeInFlight;
}

/** Must run BEFORE Clerk signOut on explicit logout, or the session would be restored. */
export async function revokeDeviceSession(): Promise<void> {
  const deviceKey = await getStoredDeviceKey();
  await clearStoredDeviceKey();
  if (!deviceKey) return;
  postJson('auth/device-session/revoke', { deviceKey }).catch(() => {});
}
