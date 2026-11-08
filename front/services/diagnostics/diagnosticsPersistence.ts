import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIAG_LIMITS, type DiagSessionConfig } from './diagnosticsConfig';
import type { DiagEvent, QueueEntry } from './diagnosticsQueue';

/**
 * Chunked AsyncStorage buffer. AsyncStorage is asynchronous (native thread);
 * the only JS-thread work is string concatenation of already-serialized
 * events, which is measured and reported as persist overhead.
 */

const META_KEY = '@90plus_diag_meta';
const CHUNK_PREFIX = '@90plus_diag_q_';
const DEVICE_KEY = '@90plus_diag_device';

export interface PersistedMeta {
  v: 1;
  sessionId: string;
  token: string;
  /** Next session-local seq on restore; reserved ahead so ids never repeat. */
  seqFloor: number;
  expiresAtWall: number;
  uploadUntilWall: number;
  startedAtWall: number;
  recording: boolean;
  config: DiagSessionConfig;
  chunks: number;
}

let persistedChunks = 0;

const chunkKey = (index: number) => `${CHUNK_PREFIX}${index}`;

export async function savePersisted(
  meta: Omit<PersistedMeta, 'v' | 'chunks'>,
  entries: QueueEntry[],
): Promise<{ jsMs: number }> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pairs: [string, string][] = [];
  let chunks = 0;
  for (let i = 0; i < entries.length; i += DIAG_LIMITS.persistChunkEvents) {
    const slice = entries.slice(i, i + DIAG_LIMITS.persistChunkEvents);
    pairs.push([chunkKey(chunks), `[${slice.map((entry) => entry.json).join(',')}]`]);
    chunks += 1;
  }
  const full: PersistedMeta = { v: 1, ...meta, chunks };
  pairs.push([META_KEY, JSON.stringify(full)]);
  const jsMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;

  await AsyncStorage.multiSet(pairs);
  if (persistedChunks > chunks) {
    const stale: string[] = [];
    for (let i = chunks; i < persistedChunks; i += 1) stale.push(chunkKey(i));
    await AsyncStorage.multiRemove(stale);
  }
  persistedChunks = chunks;
  return { jsMs };
}

export async function loadPersisted(): Promise<{ meta: PersistedMeta; events: DiagEvent[] } | null> {
  const raw = await AsyncStorage.getItem(META_KEY);
  if (!raw) return null;
  let meta: PersistedMeta;
  try {
    meta = JSON.parse(raw) as PersistedMeta;
  } catch {
    await clearPersisted();
    return null;
  }
  if (meta?.v !== 1 || typeof meta.sessionId !== 'string' || typeof meta.token !== 'string') {
    await clearPersisted();
    return null;
  }
  persistedChunks = Math.max(0, Math.min(100, Number(meta.chunks) || 0));
  const keys: string[] = [];
  for (let i = 0; i < persistedChunks; i += 1) keys.push(chunkKey(i));
  const events: DiagEvent[] = [];
  if (keys.length) {
    for (const [, value] of await AsyncStorage.multiGet(keys)) {
      if (!value) continue;
      try {
        const parsed = JSON.parse(value) as DiagEvent[];
        if (Array.isArray(parsed)) events.push(...parsed);
      } catch {
        /* skip a corrupt chunk; the rest still uploads */
      }
    }
  }
  return { meta, events };
}

export async function clearPersisted(): Promise<void> {
  const keys = [META_KEY];
  for (let i = 0; i < Math.max(persistedChunks, 1); i += 1) keys.push(chunkKey(i));
  persistedChunks = 0;
  await AsyncStorage.multiRemove(keys);
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Non-cryptographic random id; diagnostics ids identify nothing outside a session. */
export function randomDiagId(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return out;
}

/** Random diagnostics-only device id. Unrelated to the referral install id or any account. */
export async function getOrCreateDiagDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing && /^d_[\w-]{12,40}$/.test(existing)) return existing;
  const created = `d_${randomDiagId(20)}`;
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

export function resetPersistenceForTests(): void {
  persistedChunks = 0;
}
