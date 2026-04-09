import { Mutex } from 'async-mutex';
import { redisCacheService } from '../services/redis-cache.service';

const locks = new Map<string, Mutex>();

function getMutex(key: string): Mutex {
  const existing = locks.get(key);
  if (existing) return existing;
  const created = new Mutex();
  locks.set(key, created);
  return created;
}

/**
 * Cache stampede protection for a single cache key.
 * Only one caller will execute `fetchFn` when cache is cold/expired; others wait.
 */
export async function getOrSetWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const mutex = getMutex(key);
  const release = await mutex.acquire();
  try {
    const cached = await redisCacheService.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    await redisCacheService.set(key, data, ttlMs);
    return data;
  } finally {
    release();
    // Avoid unbounded growth if keys are one-off.
    locks.delete(key);
  }
}

