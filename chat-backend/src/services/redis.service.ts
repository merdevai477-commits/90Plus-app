import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.service.js';

class RedisService {
  private client: Redis | null = null;
  public isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  /**
   * Initialize the Redis connection.
   */
  private connect() {
    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) {
            logger.error('❌ Redis retry limit reached, giving up.');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('✅ Connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error(`❌ Redis Error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('⚠️ Redis connection closed');
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Failed to initialize Redis client', error);
    }
  }

  /**
   * Get a value from Redis by key.
   */
  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`❌ Redis GET Error for key ${key}`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with an optional TTL (Time To Live) in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`❌ Redis SET Error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete a value from Redis by key.
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`❌ Redis DEL Error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Gracefully close the Redis connection.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('🛑 Redis connection closed gracefully');
    }
  }
}

export const redisService = new RedisService();
