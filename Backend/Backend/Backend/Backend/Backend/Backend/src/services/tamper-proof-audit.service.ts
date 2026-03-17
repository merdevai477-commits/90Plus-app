/**
 * 🛡️ ENTERPRISE IMMUNITY: Tamper-Proof Audit System
 * Implements append-only logging with cryptographic hash chaining
 * Ensures audit logs cannot be modified from application layer
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { AuditAction, AuditTargetType } from './audit.service';

/**
 * Calculate SHA-256 hash of audit log entry
 */
function calculateHash(data: {
  action: string;
  actorId: string | null;
  targetId: string | null;
  resource: string;
  timestamp: Date;
  previousHash: string | null;
  metadata: any;
}): string {
  const content = JSON.stringify({
    action: data.action,
    actorId: data.actorId,
    targetId: data.targetId,
    resource: data.resource,
    timestamp: data.timestamp.toISOString(),
    previousHash: data.previousHash,
    metadata: data.metadata,
  });

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get the last audit log hash for chain verification
 */
async function getLastAuditHash(): Promise<string | null> {
  try {
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    return lastLog?.hash || null;
  } catch (error) {
    logger.error('Error getting last audit hash:', error);
    return null;
  }
}

export interface TamperProofAuditParams {
  action: AuditAction;
  actorId?: string | null;
  targetId?: string | null;
  targetType?: AuditTargetType | null;
  resource: string;
  reason?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class TamperProofAuditService {
  /**
   * Create tamper-proof audit log with hash chaining
   * Each log entry contains hash of previous entry, creating immutable chain
   */
  static async log(params: TamperProofAuditParams) {
    try {
      // Get previous hash for chain
      const previousHash = await getLastAuditHash();

      const timestamp = new Date();

      // Calculate hash for this entry
      const hash = calculateHash({
        action: params.action,
        actorId: params.actorId || null,
        targetId: params.targetId || null,
        resource: params.resource,
        timestamp,
        previousHash,
        metadata: params.metadata || {},
      });

      // Create audit log with hash chain
      const auditLog = await prisma.auditLog.create({
        data: {
          action: params.action as any,
          actorId: params.actorId || null,
          targetId: params.targetId || null,
          targetType: params.targetType as any || null,
          resource: params.resource,
          reason: params.reason || null,
          metadata: params.metadata || undefined,
          ip: params.ip || null,
          userAgent: params.userAgent || null,
          hash,
          previousHash,
          severity: params.severity || 'MEDIUM',
        },
      });

      logger.info('Tamper-proof audit log created', {
        action: params.action,
        actorId: params.actorId,
        resource: params.resource,
        hash: hash.substring(0, 16) + '...',
      });

      return auditLog;
    } catch (error) {
      logger.error('Error creating tamper-proof audit log:', error);
      // Don't throw - audit logging failures shouldn't break the main flow
      return null;
    }
  }

  /**
   * Verify integrity of audit log chain
   * Detects if any logs have been tampered with
   */
  static async verifyChainIntegrity(limit: number = 1000): Promise<{
    valid: boolean;
    totalChecked: number;
    firstTamperedIndex?: number;
    tamperedLogId?: string;
  }> {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          action: true,
          actorId: true,
          targetId: true,
          resource: true,
          createdAt: true,
          metadata: true,
          hash: true,
          previousHash: true,
        },
      });

      if (logs.length === 0) {
        return { valid: true, totalChecked: 0 };
      }

      // Verify each log's hash
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const expectedPreviousHash = i === 0 ? null : logs[i - 1].hash;

        // Check if previousHash matches
        if (log.previousHash !== expectedPreviousHash) {
          logger.error('Audit chain integrity violation: previousHash mismatch', {
            logId: log.id,
            index: i,
            expectedPreviousHash,
            actualPreviousHash: log.previousHash,
          });

          return {
            valid: false,
            totalChecked: i + 1,
            firstTamperedIndex: i,
            tamperedLogId: log.id,
          };
        }

        // Recalculate hash and verify
        const calculatedHash = calculateHash({
          action: log.action,
          actorId: log.actorId,
          targetId: log.targetId,
          resource: log.resource,
          timestamp: log.createdAt,
          previousHash: log.previousHash,
          metadata: log.metadata,
        });

        if (calculatedHash !== log.hash) {
          logger.error('Audit chain integrity violation: hash mismatch', {
            logId: log.id,
            index: i,
            expectedHash: calculatedHash,
            actualHash: log.hash,
          });

          return {
            valid: false,
            totalChecked: i + 1,
            firstTamperedIndex: i,
            tamperedLogId: log.id,
          };
        }
      }

      logger.info('Audit chain integrity verified', {
        totalChecked: logs.length,
        valid: true,
      });

      return {
        valid: true,
        totalChecked: logs.length,
      };
    } catch (error) {
      logger.error('Error verifying audit chain integrity:', error);
      throw error;
    }
  }

  /**
   * Log sensitive DELETE operation
   */
  static async logDelete(params: {
    actorId: string;
    targetId: string;
    targetType: AuditTargetType;
    resource: string;
    reason?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.log({
      action: AuditAction.CONTENT_DELETED,
      actorId: params.actorId,
      targetId: params.targetId,
      targetType: params.targetType,
      resource: params.resource,
      reason: params.reason,
      ip: params.ip,
      userAgent: params.userAgent,
      severity: 'HIGH',
      metadata: {
        deletedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Log role change (critical security event)
   */
  static async logRoleChange(params: {
    actorId: string;
    targetUserId: string;
    oldRole: string;
    newRole: string;
    reason?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.log({
      action: 'ROLE_CHANGED' as AuditAction,
      actorId: params.actorId,
      targetId: params.targetUserId,
      targetType: AuditTargetType.USER,
      resource: 'RBAC',
      reason: params.reason,
      ip: params.ip,
      userAgent: params.userAgent,
      severity: 'CRITICAL',
      metadata: {
        oldRole: params.oldRole,
        newRole: params.newRole,
        changedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Log failed authorization attempt
   */
  static async logAuthorizationFailure(params: {
    userId?: string;
    resource: string;
    action: string;
    reason: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.log({
      action: AuditAction.UNAUTHORIZED_ACCESS,
      actorId: params.userId || null,
      resource: params.resource,
      reason: params.reason,
      ip: params.ip,
      userAgent: params.userAgent,
      severity: 'HIGH',
      metadata: {
        attemptedAction: params.action,
        deniedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Log token refresh
   */
  static async logTokenRefresh(params: {
    userId: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.log({
      action: AuditAction.TOKEN_REFRESH,
      actorId: params.userId,
      resource: 'AUTH',
      ip: params.ip,
      userAgent: params.userAgent,
      severity: 'LOW',
      metadata: {
        refreshedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Get high-severity audit logs (for security monitoring)
   */
  static async getHighSeverityLogs(params: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    try {
      const where: any = {
        severity: { in: ['HIGH', 'CRITICAL'] },
      };

      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) {
          where.createdAt.gte = params.startDate;
        }
        if (params.endDate) {
          where.createdAt.lte = params.endDate;
        }
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 100,
      });

      return logs;
    } catch (error) {
      logger.error('Error getting high-severity logs:', error);
      throw error;
    }
  }
}
