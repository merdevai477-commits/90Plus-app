import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export enum AuditAction {
    REPORT_CREATED = 'REPORT_CREATED',
    STRIKE_CREATED = 'STRIKE_CREATED',
    CONTENT_DELETED = 'CONTENT_DELETED',
    USER_SUSPENDED = 'USER_SUSPENDED',
    USER_UNSUSPENDED = 'USER_UNSUSPENDED',
    USER_BANNED = 'USER_BANNED',
    ADMIN_REVIEW = 'ADMIN_REVIEW',
    WARNING_ISSUED = 'WARNING_ISSUED',
}

export enum AuditTargetType {
    USER = 'USER',
    REEL = 'REEL',
    COMMENT = 'COMMENT',
    REPORT = 'REPORT',
}

export interface CreateAuditLogParams {
    action: AuditAction;
    actorId: string;
    targetId: string;
    targetType: AuditTargetType;
    reason?: string;
    metadata?: Record<string, any>;
}

export class AuditService {
    /**
     * Create an audit log entry
     */
    static async createAuditLog(params: CreateAuditLogParams) {
        try {
            const auditLog = await prisma.auditLog.create({
                data: {
                    action: params.action as any,
                    actorId: params.actorId,
                    targetId: params.targetId,
                    targetType: params.targetType as any,
                    reason: params.reason || null,
                    metadata: params.metadata || null,
                },
            });

            return auditLog;
        } catch (error) {
            logger.error('Error creating audit log:', error);
            // Don't throw - audit logging failures shouldn't break the main flow
            return null;
        }
    }

    /**
     * Get audit logs with filters
     */
    static async getAuditLogs(params: {
        actorId?: string;
        targetId?: string;
        targetType?: AuditTargetType;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }) {
        try {
            const where: any = {};

            if (params.actorId) {
                where.actorId = params.actorId;
            }

            if (params.targetId) {
                where.targetId = params.targetId;
            }

            if (params.targetType) {
                where.targetType = params.targetType as any;
            }

            if (params.action) {
                where.action = params.action as any;
            }

            if (params.startDate || params.endDate) {
                where.createdAt = {};
                if (params.startDate) {
                    where.createdAt.gte = params.startDate;
                }
                if (params.endDate) {
                    where.createdAt.lte = params.endDate;
                }
            }

            const auditLogs = await prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: params.limit || 50,
                skip: params.offset || 0,
            });

            return auditLogs;
        } catch (error) {
            logger.error('Error getting audit logs:', error);
            throw error;
        }
    }

    /**
     * Log report creation
     */
    static async logReportCreated(reportId: string, reporterId: string, targetId: string, targetType: AuditTargetType) {
        return this.createAuditLog({
            action: AuditAction.REPORT_CREATED,
            actorId: reporterId,
            targetId,
            targetType,
            metadata: { reportId },
        });
    }

    /**
     * Log strike creation
     */
    static async logStrikeCreated(strikeId: string, reportId: string, userId: string) {
        return this.createAuditLog({
            action: AuditAction.STRIKE_CREATED,
            actorId: 'SYSTEM', // System-generated
            targetId: userId,
            targetType: AuditTargetType.USER,
            metadata: { strikeId, reportId },
        });
    }

    /**
     * Log content deletion
     */
    static async logContentDeleted(
        contentId: string,
        contentType: AuditTargetType,
        actorId: string,
        reason: string
    ) {
        return this.createAuditLog({
            action: AuditAction.CONTENT_DELETED,
            actorId,
            targetId: contentId,
            targetType: contentType,
            reason,
            metadata: {
                deletedAt: new Date().toISOString(),
            },
        });
    }

    /**
     * Log user suspension
     */
    static async logUserSuspended(userId: string, actorId: string, reason: string) {
        return this.createAuditLog({
            action: AuditAction.USER_SUSPENDED,
            actorId,
            targetId: userId,
            targetType: AuditTargetType.USER,
            reason,
        });
    }
}

