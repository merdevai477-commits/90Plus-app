/**
 * 🛡️ ENTERPRISE IMMUNITY: Abuse Detection Engine
 * Detects and prevents abuse patterns:
 * - Request flooding
 * - Failed authorization spikes
 * - Delete spikes
 * - Suspicious behavior patterns
 */

import { logger } from '../utils/logger';

interface RequestTracker {
  count: number;
  firstRequest: Date;
  lastRequest: Date;
  failedAuthCount: number;
  deleteCount: number;
  suspiciousActions: string[];
}

/**
 * In-memory tracking (for production, migrate to Redis)
 */
const userTracking = new Map<string, RequestTracker>();
const ipTracking = new Map<string, RequestTracker>();
const blockedUsers = new Set<string>();
const blockedIPs = new Set<string>();

/**
 * Thresholds for abuse detection
 */
const THRESHOLDS = {
  // Requests per minute
  MAX_REQUESTS_PER_MINUTE_USER: 120, // 2 requests/second
  MAX_REQUESTS_PER_MINUTE_IP: 300, // 5 requests/second
  
  // Failed authorization
  MAX_FAILED_AUTH_PER_MINUTE: 10,
  
  // Delete operations
  MAX_DELETES_PER_MINUTE: 20,
  
  // Block duration
  BLOCK_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  
  // Cleanup interval
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};

export class AbuseDetectionService {
  /**
   * Track a request from a user
   */
  static trackUserRequest(userId: string, action?: string): boolean {
    const now = new Date();
    const tracker = userTracking.get(userId) || {
      count: 0,
      firstRequest: now,
      lastRequest: now,
      failedAuthCount: 0,
      deleteCount: 0,
      suspiciousActions: [],
    };

    // Reset counter if more than 1 minute has passed
    const timeSinceFirst = now.getTime() - tracker.firstRequest.getTime();
    if (timeSinceFirst > 60 * 1000) {
      tracker.count = 0;
      tracker.firstRequest = now;
      tracker.failedAuthCount = 0;
      tracker.deleteCount = 0;
      tracker.suspiciousActions = [];
    }

    tracker.count++;
    tracker.lastRequest = now;

    // Track specific actions
    if (action === 'DELETE') {
      tracker.deleteCount++;
    } else if (action === 'FAILED_AUTH') {
      tracker.failedAuthCount++;
    }

    userTracking.set(userId, tracker);

    // Check thresholds
    if (tracker.count > THRESHOLDS.MAX_REQUESTS_PER_MINUTE_USER) {
      this.blockUser(userId, 'Request flooding');
      return false;
    }

    if (tracker.failedAuthCount > THRESHOLDS.MAX_FAILED_AUTH_PER_MINUTE) {
      this.blockUser(userId, 'Failed authorization spike');
      return false;
    }

    if (tracker.deleteCount > THRESHOLDS.MAX_DELETES_PER_MINUTE) {
      this.blockUser(userId, 'Delete spike');
      return false;
    }

    return true;
  }

  /**
   * Track a request from an IP address
   */
  static trackIPRequest(ip: string, action?: string): boolean {
    const now = new Date();
    const tracker = ipTracking.get(ip) || {
      count: 0,
      firstRequest: now,
      lastRequest: now,
      failedAuthCount: 0,
      deleteCount: 0,
      suspiciousActions: [],
    };

    // Reset counter if more than 1 minute has passed
    const timeSinceFirst = now.getTime() - tracker.firstRequest.getTime();
    if (timeSinceFirst > 60 * 1000) {
      tracker.count = 0;
      tracker.firstRequest = now;
      tracker.failedAuthCount = 0;
      tracker.deleteCount = 0;
      tracker.suspiciousActions = [];
    }

    tracker.count++;
    tracker.lastRequest = now;

    // Track specific actions
    if (action === 'DELETE') {
      tracker.deleteCount++;
    } else if (action === 'FAILED_AUTH') {
      tracker.failedAuthCount++;
    }

    ipTracking.set(ip, tracker);

    // Check thresholds
    if (tracker.count > THRESHOLDS.MAX_REQUESTS_PER_MINUTE_IP) {
      this.blockIP(ip, 'Request flooding');
      return false;
    }

    if (tracker.failedAuthCount > THRESHOLDS.MAX_FAILED_AUTH_PER_MINUTE) {
      this.blockIP(ip, 'Failed authorization spike');
      return false;
    }

    if (tracker.deleteCount > THRESHOLDS.MAX_DELETES_PER_MINUTE) {
      this.blockIP(ip, 'Delete spike');
      return false;
    }

    return true;
  }

  /**
   * Check if a user is blocked
   */
  static isUserBlocked(userId: string): boolean {
    return blockedUsers.has(userId);
  }

  /**
   * Check if an IP is blocked
   */
  static isIPBlocked(ip: string): boolean {
    return blockedIPs.has(ip);
  }

  /**
   * Block a user temporarily
   */
  static blockUser(userId: string, reason: string): void {
    blockedUsers.add(userId);

    logger.warn('🚨 User blocked for abuse', {
      userId,
      reason,
      duration: `${THRESHOLDS.BLOCK_DURATION_MS / 1000}s`,
      tracker: userTracking.get(userId),
    });

    // Auto-unblock after duration
    setTimeout(() => {
      blockedUsers.delete(userId);
      logger.info('User unblocked', { userId });
    }, THRESHOLDS.BLOCK_DURATION_MS);
  }

  /**
   * Block an IP temporarily
   */
  static blockIP(ip: string, reason: string): void {
    blockedIPs.add(ip);

    logger.warn('🚨 IP blocked for abuse', {
      ip,
      reason,
      duration: `${THRESHOLDS.BLOCK_DURATION_MS / 1000}s`,
      tracker: ipTracking.get(ip),
    });

    // Auto-unblock after duration
    setTimeout(() => {
      blockedIPs.delete(ip);
      logger.info('IP unblocked', { ip });
    }, THRESHOLDS.BLOCK_DURATION_MS);
  }

  /**
   * Track failed authorization attempt
   */
  static trackFailedAuth(userId: string | null, ip: string): void {
    if (userId) {
      this.trackUserRequest(userId, 'FAILED_AUTH');
    }
    this.trackIPRequest(ip, 'FAILED_AUTH');
  }

  /**
   * Track delete operation
   */
  static trackDelete(userId: string, ip: string): void {
    this.trackUserRequest(userId, 'DELETE');
    this.trackIPRequest(ip, 'DELETE');
  }

  /**
   * Cleanup old tracking data
   */
  static cleanup(): void {
    try {
      const now = new Date();
      let cleanedUsers = 0;
      let cleanedIPs = 0;

      // Cleanup user tracking
      for (const [userId, tracker] of userTracking.entries()) {
        const timeSinceLast = now.getTime() - tracker.lastRequest.getTime();
        if (timeSinceLast > 5 * 60 * 1000) { // 5 minutes
          userTracking.delete(userId);
          cleanedUsers++;
        }
      }

      // Cleanup IP tracking
      for (const [ip, tracker] of ipTracking.entries()) {
        const timeSinceLast = now.getTime() - tracker.lastRequest.getTime();
        if (timeSinceLast > 5 * 60 * 1000) { // 5 minutes
          ipTracking.delete(ip);
          cleanedIPs++;
        }
      }

      if (cleanedUsers > 0 || cleanedIPs > 0) {
        logger.debug('Abuse detection cleanup', {
          cleanedUsers,
          cleanedIPs,
          remainingUsers: userTracking.size,
          remainingIPs: ipTracking.size,
        });
      }
    } catch (error) {
      logger.error('Error in abuse detection cleanup:', error);
    }
  }

  /**
   * Start automatic cleanup
   */
  static startCleanup(): NodeJS.Timeout {
    const interval = setInterval(() => {
      this.cleanup();
    }, THRESHOLDS.CLEANUP_INTERVAL_MS);

    logger.info('Abuse detection cleanup started', {
      intervalMs: THRESHOLDS.CLEANUP_INTERVAL_MS,
    });

    return interval;
  }

  /**
   * Get statistics (for monitoring)
   */
  static getStats() {
    return {
      trackedUsers: userTracking.size,
      trackedIPs: ipTracking.size,
      blockedUsers: blockedUsers.size,
      blockedIPs: blockedIPs.size,
      thresholds: THRESHOLDS,
      topUsers: Array.from(userTracking.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([userId, tracker]) => ({
          userId,
          requests: tracker.count,
          failedAuth: tracker.failedAuthCount,
          deletes: tracker.deleteCount,
        })),
      topIPs: Array.from(ipTracking.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([ip, tracker]) => ({
          ip,
          requests: tracker.count,
          failedAuth: tracker.failedAuthCount,
          deletes: tracker.deleteCount,
        })),
    };
  }
}
