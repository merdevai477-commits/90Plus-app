import { createAdapter } from '@socket.io/redis-adapter';
import type { Server } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let attaching = false;

export async function attachRedisAdapter(io: Server): Promise<void> {
  if (pubClient || attaching) return;
  attaching = true;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    attaching = false;
    logger.warn('[match-chat] REDIS_URL unset — Socket.IO Redis adapter skipped (single-instance)');
    return;
  }

  try {
    pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      logger.warn('[match-chat] Redis adapter pub error', { message: err.message });
    });
    subClient.on('error', (err) => {
      logger.warn('[match-chat] Redis adapter sub error', { message: err.message });
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[match-chat] Socket.IO Redis adapter attached');
  } catch (err) {
    attaching = false;
    logger.warn('[match-chat] Redis adapter unavailable — continuing single-instance', {
      message: err instanceof Error ? err.message : String(err),
    });
    try {
      await pubClient?.quit();
      await subClient?.quit();
    } catch {
      // ignore
    }
    pubClient = null;
    subClient = null;
  }
}

export async function closeRedisAdapter(): Promise<void> {
  try {
    await pubClient?.quit();
    await subClient?.quit();
  } catch {
    // ignore
  }
  pubClient = null;
  subClient = null;
  attaching = false;
}
