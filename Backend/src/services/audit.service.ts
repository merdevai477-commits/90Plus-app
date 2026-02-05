import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { Request } from 'express';

export enum AuditAction {
    // Authentication
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    LOGIN_FAILED = 'LOGIN_FAILED',
    TOKEN_REFRESH = 'TOKEN_REFRESH',
    PASSWORD_RESET = 'PASSWORD_RESET',
    
    // Account Management
    ACCOUNT_CREATED = 'ACCOUNT_CREATED',
    ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
    ACCOUNT_DELETION_INITIATED = 'ACCOUNT_DELETION_INITIATED',
    ACCOUNT_DELETION_CANCELLED = 'ACCOUNT_DELETION_CANCELLED',
    ACCOUNT_DELETED = 'ACCOUNT_DELETED',
    
    // Moderation
    REPORT_CREATED = 'REPORT_CREATED',
    STRIKE_CREATED = 'STRIKE_CREATED',
    CONTENT_DELETED = 'CONTENT_DELETED',
    USER_SUSPENDED = 'USER_SUSPENDED',
    USER_UNSUSPENDED = 'USER_UNSUSPENDED',
    USER_BANNED = 'USER_BANNED',
    USER_UNBANNED = 'USER_UNBANNED',
    ADMIN_REVIEW = 'ADMIN_REVIEW',
    WARNING_ISSUED = 'WARNING_ISSUED',
    
    // Security
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export enum AuditTargetType {
    USER = 'USER',
    REEL = 'REEL',
    COMMENT = 'COMMENT',
    REPORT = 'REPORT',
    ACCOUNT = 'ACCOUNT',
}

export interface CreateAuditLogParams {
    action: AuditAction;
    actorId?: string | null;
    targetId?: string | null;
    targetType?: AuditTargetType | null;
    resource: string;
    reason?: string;
    metadata?: Record<string, any>;
    ip?: string;
    userAgent?: string;
}

export class AuditService {
    /**
     * Create an audit log entry
     */
    static async log(params: CreateAuditLogParams) {
        try {
            const auditLog = await prisma.auditLog.create({
                data: {
                    action: params.action as any,
                    actorId: params.actorId || null,
                    targetId: params.targetId || null,
                    targetType: params.targetType as any || null,
                    resource: params.resource,
                    reason: params.reason || null,
                    metadata: params.metadata || null,
                    ip: params.ip || null,
                    userAgent: params.userAgent || null,
                },
            });

            logger.info('Audit log created', {
                action: params.action,
                actorId: params.actorId,
                resource: params.resource,
            });

            return auditLog;
        } catch (error) {
            logger.error('Error creating audit log:', error);
            // Don't throw - audit logging failures shouldn't break the main flow
            return null;
        }
    }

    /**
     * Helper to extract IP and User Agent from request
     */
    static extractRequestInfo(req: Request) {
        return {
            ip: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
        };
    }

    /**
     * Log authentication event
     */
    static async logAuth(params: {
        action: AuditAction.LOGIN | AuditAction.LOGOUT | AuditAction.LOGIN_FAILED;
        userId?: string;
        req?: Request;
        metadata?: Record<string, any>;
    }) {
        const requestInfo = params.req ? this.extractRequestInfo(params.req) : {};
        
        return this.log({
            action: params.action,
            actorId: params.userId || null,
            resource: 'AUTH',
            metadata: params.metadata,
            ...requestInfo,
        });
    }

    /**
     * Log account management event
     */
    static async logAccountManagement(params: {
        action: AuditAction;
        userId: string;
        req?: Request;
        reason?: string;
        metadata?: Record<string, any>;
    }) {
        const requestInfo = params.req ? this.extractRequestInfo(params.req) : {};
        
        return this.log({
            action: params.action,
            actorId: params.userId,
            targetId: params.userId,
            targetType: AuditTargetType.ACCOUNT,
            resource: 'ACCOUNT',
            reason: params.reason,
            metadata: params.metadata,
            ...requestInfo,
        });
    }

    /**
     * Log security event
     */
    static async logSecurity(params: {
        action: AuditAction;
        userId?: string;
        req?: Request;
        reason?: string;
        metadata?: Record<string, any>;
    }) {
        const requestInfo = params.req ? this.extractRequestInfo(params.req) : {};
        
        return this.log({
            action: params.action,
            actorId: params.userId || null,
            resource: 'SECURITY',
            reason: params.reason,
            metadata: params.metadata,
            ...requestInfo,
        });
    }

    /**
     * Get audit logs with filters
     */
    static async getAuditLogs(params: {
        actorId?: string;
        targetId?: string;
        targetType?: AuditTargetType;
        action?: AuditAction;
        resource?: string;
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

            if (params.resource) {
                where.resource = params.resource;
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
        return this.log({
            action: AuditAction.REPORT_CREATED,
            actorId: reporterId,
            targetId,
            targetType,
            resource: 'MODERATION',
            metadata: { reportId },
        });
    }

    /**
     * Log strike creation
     */
    static async logStrikeCreated(strikeId: string, reportId: string, userId: string) {
        return this.log({
            action: AuditAction.STRIKE_CREATED,
            actorId: null, // System-generated
            targetId: userId,
            targetType: AuditTargetType.USER,
            resource: 'MODERATION',
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
        return this.log({
            action: AuditAction.CONTENT_DELETED,
            actorId,
            targetId: contentId,
            targetType: contentType,
            resource: 'MODERATION',
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
        return this.log({
            action: AuditAction.USER_SUSPENDED,
            actorId,
            targetId: userId,
            targetType: AuditTargetType.USER,
            resource: 'MODERATION',
            reason,
        });
    }

    /**
     * Log user unsuspension
     */
    static async logUserUnsuspended(userId: string, actorId: string) {
        return this.log({
            action: AuditAction.USER_UNSUSPENDED,
            actorId,
            targetId: userId,
            targetType: AuditTargetType.USER,
            resource: 'MODERATION',
        });
    }

    /**
     * Log user ban
     */
    static async logUserBanned(userId: string, actorId: string, reason: string) {
        return this.log({
            action: AuditAction.USER_BANNED,
            actorId,
            targetId: userId,
            targetType: AuditTargetType.USER,
            resource: 'MODERATION',
            reason,
        });
    }
}

