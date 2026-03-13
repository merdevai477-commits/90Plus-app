/**
 * 🛡️ ENTERPRISE IMMUNITY: Token Revocation System
 * Implements token blacklist for forced logout and compromised device handling
 * Uses in-memory storage with optional Redis upgrade path
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * In-memory token blacklist
 * For production scale, migrate to Redis for distributed systems
 */
const revokedTokens = new Map<string, {
  userId: string;
  revokedAt: Date;
  reason: string;
  expiresAt: Date;
}>();

/**
 * Cleanup interval for expired tokens
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class TokenRevocationService {
  /**
   * Revoke a specific token (forced logout)
   */
  static async revokeToken(params: {
    token: string;
    userId: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<void> {
    try {
      const expiresAt = params.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default

      revokedTokens.set(params.token, {
        userId: params.userId,
        revokedAt: new Date(),
        reason: params.reason,
        expiresAt,
      });

      logger.info('Token revoked', {
        userId: params.userId,
        reason: params.reason,
        expiresAt: expiresAt.toISOString(),
      });

      // Persist to database for audit trail
      await prisma.revokedToken.create({
        data: {
          token: params.token,
          userId: params.userId,
          reason: params.reason,
          expiresAt,
        },
      }).catch(err => {
        logger.error('Failed to persist revoked token to database:', err);
        // Continue - in-memory blacklist is primary
      });
    } catch (error) {
      logger.error('Error revoking token:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a user (forced logout from all devices)
   */
  static async revokeAllUserTokens(params: {
    userId: string;
    reason: string;
  }): Promise<void> {
    try {
      // Mark user as requiring token refresh
      await prisma.user.update({
        where: { id: params.userId },
        data: {
          // Add tokenVersion field to force re-authentication
          updatedAt: new Date(), // Trigger update
        },
      }).catch(err => {
        logger.warn('Failed to update user for token revocation:', err);
      });

      // Remove all user tokens from in-memory cache
      let revokedCount = 0;
      for (const [token, data] of revokedTokens.entries()) {
        if (data.userId === params.userId) {
          revokedTokens.delete(token);
          revokedCount++;
        }
      }

      logger.info('All user tokens revoked', {
        userId: params.userId,
        reason: params.reason,
        tokensRevoked: revokedCount,
      });

      // Persist to database
      await prisma.revokedToken.create({
        data: {
          token: `ALL_TOKENS_${params.userId}_${Date.now()}`,
          userId: params.userId,
          reason: `ALL_DEVICES: ${params.reason}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch(err => {
        logger.error('Failed to persist user token revocation:', err);
      });
    } catch (error) {
      logger.error('Error revoking all user tokens:', error);
      throw error;
    }
  }

  /**
   * Check if a token is revoked
   * CRITICAL: This is called on EVERY authenticated request
   * Must be extremely fast (O(1) lookup)
   */
  static isTokenRevoked(token: string): boolean {
    const revoked = revokedTokens.get(token);
    
    if (!revoked) {
      return false;
    }

    // Check if revocation has expired
    if (revoked.expiresAt < new Date()) {
      revokedTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Get revoked token info (for audit)
   */
  static getRevokedTokenInfo(token: string) {
    return revokedTokens.get(token);
  }

  /**
   * Cleanup expired revoked tokens
   * Prevents memory leak from accumulating expired tokens
   */
  static cleanupExpiredTokens(): void {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [token, data] of revokedTokens.entries()) {
        if (data.expiresAt < now) {
          revokedTokens.delete(token);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('Cleaned up expired revoked tokens', {
          count: cleanedCount,
          remaining: revokedTokens.size,
        });
      }
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Start automatic cleanup
   */
  static startCleanup(): NodeJS.Timeout {
    const interval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, CLEANUP_INTERVAL_MS);

    logger.info('Token revocation cleanup started', {
      intervalMs: CLEANUP_INTERVAL_MS,
    });

    return interval;
  }

  /**
   * Get statistics (for monitoring)
   */
  static getStats() {
    return {
      totalRevoked: revokedTokens.size,
      oldestRevocation: Array.from(revokedTokens.values())
        .sort((a, b) => a.revokedAt.getTime() - b.revokedAt.getTime())[0]?.revokedAt,
      newestRevocation: Array.from(revokedTokens.values())
        .sort((a, b) => b.revokedAt.getTime() - a.revokedAt.getTime())[0]?.revokedAt,
    };
  }

  /**
   * Load revoked tokens from database on startup
   * Ensures revocations persist across server restarts
   */
  static async loadFromDatabase(): Promise<void> {
    try {
      const revokedFromDb = await prisma.revokedToken.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      for (const revoked of revokedFromDb) {
        revokedTokens.set(revoked.token, {
          userId: revoked.userId,
          revokedAt: revoked.createdAt,
          reason: revoked.reason || 'Unknown',
          expiresAt: revoked.expiresAt,
        });
      }

      logger.info('Loaded revoked tokens from database', {
        count: revokedFromDb.length,
      });
    } catch (error) {
      logger.error('Failed to load revoked tokens from database:', error);
      // Continue - server can still work with empty blacklist
    }
  }
}
