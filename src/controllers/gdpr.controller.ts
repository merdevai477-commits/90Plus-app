/**
 * GDPR Compliance Controller
 * 
 * Handles GDPR compliance features:
 * - Data export (Article 20: Right to data portability)
 * - Account deletion (Article 17: Right to erasure)
 * - Consent management (Article 7: Conditions for consent)
 * - Data access (Article 15: Right of access)
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { Request, Response } from 'express';
import { getPrisma } from '../lib/prisma-lazy';
import { logger } from '../utils/logger';

const prisma = getPrisma();

// ============================================================================
// HELPER: Resolve Clerk auth ID → internal User.id (FK target for GDPR tables)
// ============================================================================

async function resolveDbUserId(req: Request, res: Response): Promise<string | null> {
  const clerkUserId = req.auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({
      status: 'ERROR',
      code: 'E002',
      message: 'Authentication required',
    });
    return null;
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) {
    try {
      const { ClerkUserService } = await import('../services/clerk-user.service');
      const created = await ClerkUserService.findOrCreateUser(clerkUserId);
      user = created ? { id: created.id } : null;
    } catch (err: any) {
      logger.error('[GDPR] Failed to sync user from Clerk:', err?.message);
    }
  }

  if (!user) {
    res.status(404).json({
      status: 'ERROR',
      code: 'E004',
      message: 'User not found',
    });
    return null;
  }

  return user.id;
}

// ============================================================================
// TYPES
// ============================================================================

enum ExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

enum DeletionStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

enum ConsentType {
  ANALYTICS = 'ANALYTICS',
  PUSH_NOTIFICATIONS = 'PUSH_NOTIFICATIONS',
  EMAIL_COMMUNICATIONS = 'EMAIL_COMMUNICATIONS',
  DATA_SHARING = 'DATA_SHARING',
}

enum GDPRAction {
  DATA_EXPORT = 'DATA_EXPORT',
  ACCOUNT_DELETION = 'ACCOUNT_DELETION',
  CONSENT_CHANGE = 'CONSENT_CHANGE',
  DATA_ACCESS = 'DATA_ACCESS',
}

// ============================================================================
// HELPER: Log GDPR Action
// ============================================================================

async function logGDPRAction(
  userId: string,
  action: GDPRAction,
  details: string,
  req: Request
) {
  try {
    await prisma.gDPRAuditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  } catch (error) {
    logger.error('[GDPR] Failed to log action:', error);
  }
}

// ============================================================================
// POST /api/gdpr/export-data
// Request data export
// ============================================================================

export const requestDataExport = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;

    // Check for existing pending/processing requests
    const existingRequest = await prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: {
          in: [ExportStatus.PENDING, ExportStatus.PROCESSING],
        },
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E005',
        message: 'Data export already in progress',
        requestId: existingRequest.id,
      });
    }

    // Create export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        userId,
        status: ExportStatus.PENDING,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Log GDPR action
    await logGDPRAction(
      userId,
      GDPRAction.DATA_EXPORT,
      `Data export requested: ${exportRequest.id}`,
      req
    );

    // Start export process asynchronously
    processDataExport(exportRequest.id).catch((err) => {
      logger.error('[GDPR] Data export processing failed:', err);
    });

    logger.info(`[GDPR] Data export requested for user ${userId}`);

    return res.status(200).json({
      status: 'SUCCESS',
      requestId: exportRequest.id,
      message: 'Data export request created. You will receive an email when ready.',
      estimatedTime: '5-10 minutes',
    });
  } catch (error: any) {
    logger.error('[GDPR] Data export request error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to request data export',
      error: error.message,
    });
  }
};

// ============================================================================
// HELPER: Process Data Export
// ============================================================================

async function processDataExport(requestId: string) {
  try {
    // Update status to processing
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: { status: ExportStatus.PROCESSING },
    });

    const request = await prisma.dataExportRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new Error('Export request not found');

    const userId = request.userId;

    // Collect all user data
    const userData = {
      exportDate: new Date().toISOString(),
      exportRequestId: requestId,
      
      // User profile
      profile: await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          avatar: true,
          coverImage: true,
          age: true,
          country: true,
          favoriteTeam: true,
          createdAt: true,
          updatedAt: true,
          // Exclude sensitive fields
          // password, tokens, etc.
        },
      }),

      // Reels
      reels: await prisma.reel.findMany({
        where: { userId },
        select: {
          id: true,
          videoUrl: true,
          thumbnail: true,
          caption: true,
          views: true,
          sharesCount: true,
          createdAt: true,
        },
      }),

      // Comments
      comments: await prisma.comment.findMany({
        where: { userId },
        select: {
          id: true,
          content: true,
          createdAt: true,
          reelId: true,
        },
      }),

      // Likes
      likes: await prisma.like.findMany({
        where: { userId },
        select: {
          id: true,
          reelId: true,
          createdAt: true,
        },
      }),

      // Predictions
      predictions: await prisma.prediction.findMany({
        where: { userId },
        select: {
          id: true,
          apiMatchId: true,
          predictionType: true,
          coinsSpent: true,
          coinsWon: true,
          isCorrect: true,
          createdAt: true,
        },
      }),

      // Quiz attempts
      quizAttempts: await prisma.quizAttempt.findMany({
        where: { userId },
        select: {
          id: true,
          categoryId: true,
          score: true,
          correctAnswers: true,
          coinsEarned: true,
          completedAt: true,
        },
      }),

      // Coin transactions
      coinTransactions: await prisma.coinTransaction.findMany({
        where: { userId },
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
        },
      }),

      // Achievements
      achievements: await prisma.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: {
            select: {
              name: true,
              description: true,
              icon: true,
            },
          },
        },
      }),

      // Follows
      following: await prisma.follow.findMany({
        where: { followerId: userId },
        select: {
          followingId: true,
          createdAt: true,
        },
      }),

      followers: await prisma.follow.findMany({
        where: { followingId: userId },
        select: {
          followerId: true,
          createdAt: true,
        },
      }),

      // Notifications
      notifications: await prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      }),

      // Consent logs
      consentLogs: await prisma.consentLog.findMany({
        where: { userId },
        select: {
          consentType: true,
          granted: true,
          timestamp: true,
          version: true,
        },
      }),

      // GDPR audit logs
      gdprAuditLogs: await prisma.gDPRAuditLog.findMany({
        where: { userId },
        select: {
          action: true,
          details: true,
          timestamp: true,
        },
      }),
    };

    // Convert to JSON
    const jsonData = JSON.stringify(userData, null, 2);

    // Upload to Cloudflare R2
    const { uploadDataExport } = await import('../services/r2-storage.service');
    const { url: fileUrl, size: fileSize } = await uploadDataExport(requestId, jsonData);

    // Set expiration (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update request
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: ExportStatus.COMPLETED,
        fileUrl,
        fileSize,
        expiresAt,
        completedAt: new Date(),
      },
    });

    // Send email notification
    // TODO: Implement email service
    logger.info(`[GDPR] Data export completed for request ${requestId}`);

    // In development, log the data
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[GDPR] Export data:', jsonData);
    }

  } catch (error: any) {
    logger.error('[GDPR] Data export processing error:', error);
    
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: ExportStatus.FAILED,
        failedReason: error.message,
      },
    });
  }
}

// ============================================================================
// GET /api/gdpr/export-status/:requestId
// Check export status
// ============================================================================

export const getExportStatus = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;

    const exportRequest = await prisma.dataExportRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
    });

    if (!exportRequest) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'Export request not found',
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      exportRequest: {
        id: exportRequest.id,
        status: exportRequest.status,
        fileUrl: exportRequest.fileUrl,
        fileSize: exportRequest.fileSize,
        expiresAt: exportRequest.expiresAt,
        requestedAt: exportRequest.requestedAt,
        completedAt: exportRequest.completedAt,
        failedReason: exportRequest.failedReason,
      },
    });
  } catch (error: any) {
    logger.error('[GDPR] Get export status error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to get export status',
      error: error.message,
    });
  }
};

// ============================================================================
// POST /api/gdpr/delete-account
// Request account deletion
// ============================================================================

export const requestAccountDeletion = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;
    const { reason } = req.body;

    // Check for existing pending/scheduled requests
    const existingRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: [DeletionStatus.PENDING, DeletionStatus.SCHEDULED],
        },
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E005',
        message: 'Account deletion already requested',
        requestId: existingRequest.id,
        scheduledAt: existingRequest.scheduledAt,
      });
    }

    // Calculate scheduled deletion date (30 days grace period)
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 30);

    // Create deletion request
    const deletionRequest = await prisma.accountDeletionRequest.create({
      data: {
        userId,
        status: DeletionStatus.SCHEDULED,
        reason,
        scheduledAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: new Date(),
        scheduledDeletionAt: scheduledAt,
      },
    });

    // Log GDPR action
    await logGDPRAction(
      userId,
      GDPRAction.ACCOUNT_DELETION,
      `Account deletion requested: ${deletionRequest.id}`,
      req
    );

    logger.info(`[GDPR] Account deletion requested for user ${userId}`);

    // Send confirmation email
    // TODO: Implement email service

    return res.status(200).json({
      status: 'SUCCESS',
      requestId: deletionRequest.id,
      scheduledAt,
      gracePeriodDays: 30,
      message: 'Account deletion scheduled. You have 30 days to cancel.',
    });
  } catch (error: any) {
    logger.error('[GDPR] Account deletion request error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to request account deletion',
      error: error.message,
    });
  }
};

// ============================================================================
// POST /api/gdpr/cancel-deletion
// Cancel account deletion
// ============================================================================

export const cancelAccountDeletion = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;
    const { cancellationReason } = req.body;

    // Find pending/scheduled deletion request
    const deletionRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: [DeletionStatus.PENDING, DeletionStatus.SCHEDULED],
        },
      },
    });

    if (!deletionRequest) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'No pending deletion request found',
      });
    }

    // Cancel deletion request
    await prisma.accountDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: {
        status: DeletionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason,
      },
    });

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: null,
        scheduledDeletionAt: null,
      },
    });

    // Log GDPR action
    await logGDPRAction(
      userId,
      GDPRAction.ACCOUNT_DELETION,
      `Account deletion cancelled: ${deletionRequest.id}`,
      req
    );

    logger.info(`[GDPR] Account deletion cancelled for user ${userId}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Account deletion cancelled successfully',
    });
  } catch (error: any) {
    logger.error('[GDPR] Cancel deletion error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to cancel account deletion',
      error: error.message,
    });
  }
};

// ============================================================================
// GET /api/gdpr/deletion-status
// Get deletion status
// ============================================================================

export const getDeletionStatus = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;

    const deletionRequest = await prisma.accountDeletionRequest.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });

    if (!deletionRequest) {
      return res.status(200).json({
        status: 'SUCCESS',
        hasDeletionRequest: false,
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      hasDeletionRequest: true,
      deletionRequest: {
        id: deletionRequest.id,
        status: deletionRequest.status,
        reason: deletionRequest.reason,
        requestedAt: deletionRequest.requestedAt,
        scheduledAt: deletionRequest.scheduledAt,
        completedAt: deletionRequest.completedAt,
        cancelledAt: deletionRequest.cancelledAt,
      },
    });
  } catch (error: any) {
    logger.error('[GDPR] Get deletion status error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to get deletion status',
      error: error.message,
    });
  }
};

// ============================================================================
// POST /api/gdpr/consent
// Update consent preferences
// ============================================================================

export const updateConsent = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;
    const { consentType, granted } = req.body;

    // Validate consent type
    if (!Object.values(ConsentType).includes(consentType)) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Invalid consent type',
      });
    }

    // Log consent change
    await prisma.consentLog.create({
      data: {
        userId,
        consentType,
        granted,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        version: '1.0', // Privacy policy version
      },
    });

    // Update user consent
    const updateData: any = {};
    switch (consentType) {
      case ConsentType.ANALYTICS:
        updateData.analyticsConsent = granted;
        break;
      case ConsentType.PUSH_NOTIFICATIONS:
        updateData.pushNotificationsConsent = granted;
        break;
      case ConsentType.EMAIL_COMMUNICATIONS:
        updateData.emailCommunicationsConsent = granted;
        break;
      case ConsentType.DATA_SHARING:
        updateData.dataSharingConsent = granted;
        break;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Log GDPR action
    await logGDPRAction(
      userId,
      GDPRAction.CONSENT_CHANGE,
      `Consent ${consentType}: ${granted}`,
      req
    );

    logger.info(`[GDPR] Consent updated for user ${userId}: ${consentType} = ${granted}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Consent updated successfully',
    });
  } catch (error: any) {
    logger.error('[GDPR] Update consent error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to update consent',
      error: error.message,
    });
  }
};

// ============================================================================
// GET /api/gdpr/consent
// Get consent preferences
// ============================================================================

export const getConsent = async (req: Request, res: Response) => {
  try {
    const userId = await resolveDbUserId(req, res);
    if (!userId) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        analyticsConsent: true,
        pushNotificationsConsent: true,
        emailCommunicationsConsent: true,
        dataSharingConsent: true,
        privacyPolicyVersion: true,
        privacyPolicyAcceptedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      consent: {
        analytics: user.analyticsConsent,
        pushNotifications: user.pushNotificationsConsent,
        emailCommunications: user.emailCommunicationsConsent,
        dataSharing: user.dataSharingConsent,
      },
      privacyPolicy: {
        version: user.privacyPolicyVersion,
        acceptedAt: user.privacyPolicyAcceptedAt,
      },
    });
  } catch (error: any) {
    logger.error('[GDPR] Get consent error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to get consent',
      error: error.message,
    });
  }
};
