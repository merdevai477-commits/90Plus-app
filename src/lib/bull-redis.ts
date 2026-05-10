/**
 * Shared Bull/BullMQ Redis helper
 *
 * Bull requires specific connection options to work correctly with providers
 * that drop idle connections (Upstash, Railway Redis, managed Redis in general):
 *   - enableReadyCheck: false
 *   - maxRetriesPerRequest: null
 *
 * Keeping the same factory everywhere avoids silent mismatches between queues.
 */

import Redis, { type Redis as RedisClient, type RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Creates a Bull-compatible ioredis connection.
 *
 * @param redisUrl - Full Redis connection string (redis:// or rediss://).
 *                   Falls back to `process.env.REDIS_URL` if omitted.
 * @param options  - Extra `ioredis` options merged on top of the Bull defaults.
 */
export function createBullRedis(
  redisUrl?: string,
  options: Partial<RedisOptions> = {},
): RedisClient {
  const url = redisUrl ?? process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      '[bull-redis] REDIS_URL is not set — cannot create queue connection.',
    );
  }

  const client = new Redis(url, {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    ...options,
  });

  // Non-fatal connection hiccups are common on free tiers; downgrade them
  // to debug so they don't drown the logs.
  client.on('error', (err: NodeJS.ErrnoException) => {
    const transient =
      err.code === 'ECONNRESET' ||
      err.code === 'EPIPE' ||
      err.code === 'ETIMEDOUT' ||
      /MaxRetriesPerRequestError/.test(err.message ?? '');

    if (transient) {
      logger.debug(
        `[bull-redis] transient Redis error (${err.code ?? 'MaxRetries'}) — will auto-reconnect`,
      );
      return;
    }
    logger.error('[bull-redis] Redis client error:', err);
  });

  return client;
}

/**
 * Convenience factory matching Bull's `createClient` signature — use it
 * directly in `new Bull(name, { createClient })`.
 */
export function bullCreateClient(
  redisUrl?: string,
): (_type: 'client' | 'subscriber' | 'bclient') => RedisClient {
  // Bull expects a single function that may be invoked 3 times (one per role).
  return () => createBullRedis(redisUrl);
}
