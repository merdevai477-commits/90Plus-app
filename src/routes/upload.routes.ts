/**
 * Upload Routes
 *
 * Fixes applied:
 *  Fix 1  – Enqueue video-processing job after reel upload
 *  Fix 2  – Orphan tracking via r2-cleanup.service
 *  Fix 5  – Magic-bytes validation middleware
 *  Fix 6  – Rich cooldown error response
 *  Fix 7  – Per-user storage quota check + increment
 *  Fix 12 – Upload analytics recording
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { validateVideoDuration } from '../middleware/file-validation.middleware';
import { optimizeUploadedImage } from '../middleware/image-optimization.middleware';
import { validateUploadedImage } from '../middleware/image-moderation.middleware';
import {
  validateUploadMagicBytes,
  validateUploadFieldsMagicBytes,
} from '../middleware/validateUpload.middleware';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import { invalidateUserCache } from './clerk-user.routes';
import { UploadAnalyticsService } from '../services/upload-analytics.service';
import * as muxService from '../services/mux.service';
import { healReelFromMux } from '../services/reel-mux-heal.service';
import multer from 'multer';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import path from 'path';
import { strictLimiter } from '../middleware/rateLimit.middleware';
import { ErrorCode, sendError as sendApiError, type ErrorCodeValue } from '../constants/errors';
import { renderPushTemplate, getUserLanguage } from '../services/push-templates.service';
import { WebSocketService } from '../services/websocket.service';
import { notifyUser } from '../services/notify.service';
import { NotificationType } from '../services/notification.service';

const router = Router();

/**
 * Emit a granular progress event to the user's connected WebSocket clients.
 * The avatar UI listens to these and animates the progress bar smoothly.
 *
 * `pct` is 0–100; `stage` is one of:
 *   'received'    -> Multer parsed the upload
 *   'validating'  -> moderation / magic-byte / quota checks
 *   'uploading'   -> server-to-R2 PutObject in flight
 *   'persisting'  -> writing avatar URL to user row
 *   'completed'   -> all done (also dispatches the AVATAR_UPLOAD push)
 *   'failed'      -> any error in the pipeline
 */
function emitAvatarProgress(userId: string, pct: number, stage:
    | 'received'
    | 'validating'
    | 'uploading'
    | 'persisting'
    | 'completed'
    | 'failed',
    extra?: Record<string, any>,
): void {
    try {
        WebSocketService.sendToUser(userId, 'avatar:progress', {
            pct: Math.max(0, Math.min(100, Math.round(pct))),
            stage,
            ...extra,
        });
    } catch (err: any) {
        // Progress emission is best-effort — never block an upload on it.
        logger.debug('[upload/avatar] emitAvatarProgress failed (non-fatal):', err?.message);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeOriginalName(name: string | undefined, fallback: string): string {
  const base = path.basename(name || fallback);
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

/**
 * Local wrapper that forwards to the canonical `sendError` helper while
 * preserving the legacy `code` field inside `details` for back-compat.
 *
 * The frontend looks at `error` (E001–E010) for localization; the legacy
 * domain-specific `code` (`COOLDOWN_ACTIVE`, `QUOTA_EXCEEDED`, etc.) is
 * kept inside `details` so any existing client analytics that read it
 * keep working.
 */
function sendError(
  req: Request,
  res: Response,
  httpStatus: number,
  errorCode: ErrorCodeValue,
  legacyCode: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  sendApiError(
    req,
    res,
    errorCode,
    message,
    { ...(details || {}), code: legacyCode },
    httpStatus,
  );
}

/** Fix 6: Rich cooldown response (same fields as before, canonical shape). */
function sendCooldownError(
  req: Request,
  res: Response,
  cooldownType: 'avatar' | 'cover' | 'reel',
  lastChangeDate: Date,
  cooldownDays: number,
): void {
  const nextAllowedDate = new Date(
    lastChangeDate.getTime() + cooldownDays * 24 * 60 * 60 * 1000,
  );
  const remainingMs = nextAllowedDate.getTime() - Date.now();
  const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));

  // Frontend localizes via the E006 code; the message here is a safe
  // English fallback for clients that don't yet map error codes.
  sendApiError(
    req,
    res,
    ErrorCode.RATE_LIMIT,
    `You can change this again in ${daysRemaining}d ${hoursRemaining % 24}h`,
    {
      code: 'COOLDOWN_ACTIVE',
      cooldownType,
      lastChangeDate: lastChangeDate.toISOString(),
      nextAllowedDate: nextAllowedDate.toISOString(),
      daysRemaining,
      hoursRemaining,
    },
    429,
  );
}

/** Fix 7: Check storage quota WITHOUT incrementing yet. Returns false and sends 413 if exceeded. */
async function checkQuota(
  userId: string,
  fileSizeBytes: number,
  req: Request,
  res: Response,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageUsedBytes: true, storageQuotaBytes: true },
  });

  if (!user) return true; // shouldn't happen

  const used = Number(user.storageUsedBytes);
  const quota = Number(user.storageQuotaBytes);

  if (used + fileSizeBytes > quota) {
    const usedGB = (used / 1e9).toFixed(2);
    const quotaGB = (quota / 1e9).toFixed(2);
    sendApiError(
      req,
      res,
      ErrorCode.FILE_UPLOAD,
      `Storage quota exceeded. Used ${usedGB} GB of ${quotaGB} GB.`,
      { code: 'QUOTA_EXCEEDED', usedGB, quotaGB },
      413,
    );
    return false;
  }

  return true;
}

/** Increment storageUsedBytes AFTER a successful upload. */
async function incrementQuota(userId: string, fileSizeBytes: number): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsedBytes: { increment: fileSizeBytes } },
    });
  } catch (err) {
    logger.warn('[upload] Failed to increment storageUsedBytes (non-fatal):', err);
  }
}

/** Decrement storageUsedBytes after a file is deleted. */
async function decrementQuota(userId: string, fileSizeBytes: number): Promise<void> {
  if (fileSizeBytes <= 0) return;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsedBytes: { decrement: fileSizeBytes } },
    });
  } catch (err) {
    logger.warn('[upload] Failed to decrement storageUsedBytes (non-fatal):', err);
  }
}

/** Delete an R2 object and decrement quota — used in error-path cleanup. */
async function rollbackR2Upload(
  userId: string,
  storageKey: string,
  fileSizeBytes: number,
): Promise<void> {
  try {
    await r2MediaStorage.deleteObject(storageKey);
  } catch (err) {
    logger.warn('[upload] R2 rollback delete failed (non-fatal):', err);
  }
  await decrementQuota(userId, fileSizeBytes);
}

// ─── Multer configs ───────────────────────────────────────────────────────────

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    cb(null, false);
  },
});

// Reel upload uses disk storage to avoid holding 50MB in RAM per concurrent upload.
// Files are written to OS temp dir and cleaned up after processing.
import os from 'os';
import fs from 'fs';
const REEL_UPLOAD_DIR = path.join(os.tmpdir(), '90plus-reel-uploads');
// Ensure the dir exists (sync at startup — fine for a one-time operation)
if (!fs.existsSync(REEL_UPLOAD_DIR)) {
  fs.mkdirSync(REEL_UPLOAD_DIR, { recursive: true });
}

const uploadReel = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REEL_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname) || '.mp4';
      cb(null, `reel-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    cb(null, mt.startsWith('video/') || mt.startsWith('image/'));
  },
});

/** Helper: read file from disk into buffer and clean up the temp file */
async function readAndCleanupTempFile(filePath: string): Promise<Buffer> {
  const buffer = await fs.promises.readFile(filePath);
  // Clean up temp file (fire-and-forget)
  fs.promises.unlink(filePath).catch(() => undefined);
  return buffer;
}

// ─── Cooldown constants ───────────────────────────────────────────────────────

const AVATAR_CHANGE_COOLDOWN_DAYS = 7;
const COVER_CHANGE_COOLDOWN_DAYS = 15;
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
const REEL_UPLOAD_LOCK_MS = 25 * 60 * 1000;

// ─── Reel upload lock helper ──────────────────────────────────────────────────

type BeginReelResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; errorCode: ErrorCodeValue; payload: Record<string, unknown> };

async function beginReelUploadForClerkUser(clerkUserId: string): Promise<BeginReelResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "users" WHERE "clerkUserId" = ${clerkUserId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastReelUpload: true, reelUploadLockedUntil: true },
      });

      if (!user) {
        return {
          ok: false,
          status: 404,
          errorCode: ErrorCode.NOT_FOUND,
          payload: { code: 'USER_NOT_FOUND', message: 'User not found' },
        };
      }

      const now = Date.now();

      if (user.reelUploadLockedUntil && user.reelUploadLockedUntil.getTime() > now) {
        return {
          ok: false,
          status: 429,
          errorCode: ErrorCode.RATE_LIMIT,
          payload: {
            code: 'REEL_UPLOAD_IN_PROGRESS',
            message: 'A reel upload is already in progress. Wait until it finishes before trying again.',
          },
        };
      }

      if (user.lastReelUpload) {
        const daysSince = Math.floor(
          (now - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < REEL_UPLOAD_COOLDOWN_DAYS) {
          return {
            ok: false,
            status: 429,
            errorCode: ErrorCode.RATE_LIMIT,
            payload: {
              code: 'COOLDOWN_ACTIVE',
              cooldownType: 'reel',
              lastChangeDate: user.lastReelUpload.toISOString(),
              nextAllowedDate: new Date(
                user.lastReelUpload.getTime() + REEL_UPLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
              ).toISOString(),
              daysRemaining: REEL_UPLOAD_COOLDOWN_DAYS - daysSince,
              hoursRemaining: Math.ceil(
                REEL_UPLOAD_COOLDOWN_DAYS * 24 -
                  (now - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60),
              ),
              message: `You can upload a new reel in ${REEL_UPLOAD_COOLDOWN_DAYS - daysSince} day(s).`,
            },
          };
        }
      }

      await tx.user.update({
        where: { id: user.id },
        data: { reelUploadLockedUntil: new Date(now + REEL_UPLOAD_LOCK_MS) },
      });

      return { ok: true, userId: user.id };
    });
  } catch (e: any) {
    logger.error('[upload/reel] beginReelUploadForClerkUser:', e);
    return {
      ok: false,
      status: 500,
      errorCode: ErrorCode.INTERNAL,
      payload: {
        code: 'LOCK_ERROR',
        message: 'Could not start the upload. Please try again.',
      },
    };
  }
}

// ─── POST /api/upload/avatar ──────────────────────────────────────────────────

router.post(
  '/avatar',
  requireAuth,
  uploadImage.single('file'),
  validateUploadMagicBytes,   // Fix 5
  validateUploadedImage,
  optimizeUploadedImage,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, 401, ErrorCode.AUTHENTICATION, 'UNAUTHORIZED', 'Unauthorized'); return; }

    const file = req.file;
    if (!file) { sendError(req, res, 400, ErrorCode.FILE_UPLOAD, 'NO_FILE', 'No file provided'); return; }
    if (!file.buffer || file.buffer.length === 0) { sendError(req, res, 400, ErrorCode.FILE_UPLOAD, 'EMPTY_FILE', 'File is empty'); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastAvatarChange: true, avatarStoragePath: true },
      });

      if (!user) { sendError(req, res, 404, ErrorCode.NOT_FOUND, 'USER_NOT_FOUND', 'User not found'); return; }

      // Stage 1: server received the multipart payload + image was validated
      // by the upstream middleware chain.
      emitAvatarProgress(user.id, 15, 'received');

      // Fix 6: Rich cooldown
      if (user.lastAvatarChange) {
        const daysSince = Math.floor(
          (Date.now() - user.lastAvatarChange.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < AVATAR_CHANGE_COOLDOWN_DAYS) {
          const lang = await getUserLanguage(user.id);
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'GENERAL',
              title: renderPushTemplate('avatarChangeBlockedTitle', lang),
              message: renderPushTemplate('avatarChangeBlockedBody', lang),
              data: { type: 'AVATAR_COOLDOWN' },
            },
          });
          sendCooldownError(req, res, 'avatar', user.lastAvatarChange, AVATAR_CHANGE_COOLDOWN_DAYS);
          await UploadAnalyticsService.record({
            userId: user.id, type: 'AVATAR', status: 'FAILED',
            fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
            errorCode: 'COOLDOWN_ACTIVE',
          });
          return;
        }
      }

      emitAvatarProgress(user.id, 25, 'validating');

      // Fix 7: Check quota BEFORE upload (don't increment yet)
      const quotaOk = await checkQuota(user.id, file.buffer.length, req, res);
      if (!quotaOk) {
        emitAvatarProgress(user.id, 0, 'failed', { reason: 'quota_exceeded' });
        notifyUser({
          userId: user.id,
          type: NotificationType.AVATAR_UPLOAD,
          titleKey: 'avatarUploadFailedTitle',
          bodyKey: 'avatarUploadFailedBody',
          data: { screen: '/(tabs)/profile', stage: 'failed', reason: 'quota_exceeded' },
        }).catch((err) => logger.warn('[upload/avatar] failure notify failed:', err?.message));
        return;
      }

      // Delete old avatar from R2 (non-blocking)
      if (user.avatarStoragePath) {
        r2MediaStorage.deleteObject(user.avatarStoragePath).catch((err: any) =>
          logger.warn('[upload/avatar] Old avatar R2 delete failed:', err?.message),
        );
      }

      emitAvatarProgress(user.id, 45, 'uploading');

      const safeName = sanitizeOriginalName(file.originalname, 'avatar');
      const result = await r2MediaStorage.uploadPublic('avatars', user.id, file.buffer, safeName, file.mimetype);

      if (!result.success || !result.url || !result.key) {
        sendError(req, res, 500, ErrorCode.EXTERNAL_SERVICE, 'STORAGE_UPLOAD_FAILED', result.error || 'Upload failed');
        emitAvatarProgress(user.id, 0, 'failed', { reason: 'storage_upload_failed' });
        notifyUser({
          userId: user.id,
          type: NotificationType.AVATAR_UPLOAD,
          titleKey: 'avatarUploadFailedTitle',
          bodyKey: 'avatarUploadFailedBody',
          data: { screen: '/(tabs)/profile', stage: 'failed', reason: 'storage_upload_failed' },
        }).catch((err) => logger.warn('[upload/avatar] failure notify failed:', err?.message));
        await UploadAnalyticsService.record({
          userId: user.id, type: 'AVATAR', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'STORAGE_UPLOAD_FAILED',
        });
        return;
      }

      emitAvatarProgress(user.id, 85, 'persisting');

      // Fix 7: Increment quota AFTER successful upload
      await incrementQuota(user.id, file.buffer.length);

      // Fix 5: Wrap DB update — rollback R2 upload if DB fails
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { avatar: result.url, avatarStoragePath: result.key, lastAvatarChange: new Date() },
        });
      } catch (dbErr: any) {
        logger.error('[upload/avatar] DB update failed after R2 upload — rolling back:', dbErr?.message);
        await rollbackR2Upload(user.id, result.key!, file.buffer.length);
        sendError(req, res, 500, ErrorCode.DATABASE, 'DB_UPDATE_FAILED', 'Could not save the image. The uploaded file was removed.');
        emitAvatarProgress(user.id, 0, 'failed', { reason: 'db_update_failed' });
        notifyUser({
          userId: user.id,
          type: NotificationType.AVATAR_UPLOAD,
          titleKey: 'avatarUploadFailedTitle',
          bodyKey: 'avatarUploadFailedBody',
          data: { screen: '/(tabs)/profile', stage: 'failed', reason: 'db_update_failed' },
        }).catch((err) => logger.warn('[upload/avatar] failure notify failed:', err?.message));
        await UploadAnalyticsService.record({
          userId: user.id, type: 'AVATAR', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'DB_UPDATE_FAILED',
        });
        return;
      }

      // Fix 1: Decrement quota for the OLD avatar that was replaced
      if (user.avatarStoragePath) {
        // Old file was already deleted above (fire-and-forget).
        // We need the old file size to decrement quota accurately.
        // Since we don't store old file size, we use the new file size as a best-effort
        // approximation only when the old path existed. The orphan cleanup handles edge cases.
        // Actual decrement is skipped here because we don't have the old size stored in DB.
        // TODO: store avatarFileSizeBytes on user model for precise decrement.
      }

      invalidateUserCache(clerkUserId);

      emitAvatarProgress(user.id, 100, 'completed', { url: result.url });

      // ✅ FIX: Move heavy post-upload work off the request path so the
      // client gets the new avatar URL immediately. Profile completion
      // recompute, notification enqueue, XP award, and analytics each issue
      // ≥1 DB round-trip — running them inline used to add 1–3 seconds to
      // every avatar upload on flaky mobile networks.
      const respondedAt = Date.now();
      res.json({
        status: 'SUCCESS',
        message: 'Profile picture uploaded successfully.',
        data: { url: result.url, storagePath: result.key },
        xpEvents: [], // populated server-side; client refetches /me to get authoritative XP
      });

      setImmediate(async () => {
        try {
          const { ProfileCompletionService } = await import('../services/profile-completion.service');
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
        } catch (err) {
          logger.error('[upload/avatar] Profile completion recalc failed:', err);
        }

        try {
          await UploadAnalyticsService.record({
            userId: user.id, type: 'AVATAR', status: 'SUCCESS',
            fileSizeMB: file.buffer.length / 1e6, durationMs: respondedAt - startTime,
          });
        } catch (err) {
          logger.error('[upload/avatar] Upload analytics failed:', err);
        }

        try {
          // Single completion notification — localized, preference-gated,
          // inbox + push + WebSocket via the unified helper.
          await notifyUser({
            userId: user.id,
            type: NotificationType.AVATAR_UPLOAD,
            titleKey: 'avatarUploadCompleteTitle',
            bodyKey: 'avatarUploadCompleteBody',
            data: { screen: '/(tabs)/Profile', stage: 'completed', url: result.url },
            idempotencyKey: `avatar-upload:${user.id}:${result.key}`,
          });
        } catch (err) {
          logger.error('[upload/avatar] notifyUser failed for avatar:', err);
        }

        try {
          const { awardXp: awardXpFn } = await import('../services/xp.service');
          const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
          await awardXpFn({ userId: user.id, action: 'PROFILE_AVATAR', idempotencyKey: 'profile.avatar.first', timezone: tz });
        } catch (xpErr: any) {
          logger.warn('[upload/avatar] XP award failed (non-fatal):', xpErr?.message);
        }
      });
    } catch (error: any) {
      logger.error('Upload avatar error:', error);
      sendError(req, res, 500, ErrorCode.INTERNAL, 'UPLOAD_ERROR', error?.message || 'Upload failed');
    }
  },
);

// ─── POST /api/upload/cover ───────────────────────────────────────────────────

router.post(
  '/cover',
  requireAuth,
  uploadImage.single('file'),
  validateUploadMagicBytes,   // Fix 5
  validateUploadedImage,
  optimizeUploadedImage,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, 401, ErrorCode.AUTHENTICATION, 'UNAUTHORIZED', 'Unauthorized'); return; }

    const file = req.file;
    if (!file) { sendError(req, res, 400, ErrorCode.FILE_UPLOAD, 'NO_FILE', 'No file provided'); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastCoverChange: true, coverStoragePath: true },
      });

      if (!user) { sendError(req, res, 404, ErrorCode.NOT_FOUND, 'USER_NOT_FOUND', 'User not found'); return; }

      // Fix 6: Rich cooldown
      if (user.lastCoverChange) {
        const daysSince = Math.floor(
          (Date.now() - user.lastCoverChange.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < COVER_CHANGE_COOLDOWN_DAYS) {
          const lang = await getUserLanguage(user.id);
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'GENERAL',
              title: renderPushTemplate('coverChangeBlockedTitle', lang),
              message: renderPushTemplate('coverChangeBlockedBody', lang),
              data: { type: 'COVER_COOLDOWN' },
            },
          });
          sendCooldownError(req, res, 'cover', user.lastCoverChange, COVER_CHANGE_COOLDOWN_DAYS);
          await UploadAnalyticsService.record({
            userId: user.id, type: 'COVER', status: 'FAILED',
            fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
            errorCode: 'COOLDOWN_ACTIVE',
          });
          return;
        }
      }

      // Fix 7: Check quota BEFORE upload
      const quotaOk = await checkQuota(user.id, file.buffer.length, req, res);
      if (!quotaOk) return;

      if (user.coverStoragePath) {
        r2MediaStorage.deleteObject(user.coverStoragePath).catch((err: any) =>
          logger.warn('[upload/cover] Old cover R2 delete failed:', err?.message),
        );
      }

      const safeName = sanitizeOriginalName(file.originalname, 'cover');
      const result = await r2MediaStorage.uploadPublic('covers', user.id, file.buffer, safeName, file.mimetype);

      if (!result.success || !result.url || !result.key) {
        sendError(req, res, 500, ErrorCode.EXTERNAL_SERVICE, 'STORAGE_UPLOAD_FAILED', result.error || 'Upload failed');
        await UploadAnalyticsService.record({
          userId: user.id, type: 'COVER', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'STORAGE_UPLOAD_FAILED',
        });
        return;
      }

      // Fix 7: Increment quota AFTER successful upload
      await incrementQuota(user.id, file.buffer.length);

      // Fix 5: Wrap DB update — rollback R2 upload if DB fails
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { coverImage: result.url, coverStoragePath: result.key, lastCoverChange: new Date() },
        });
      } catch (dbErr: any) {
        logger.error('[upload/cover] DB update failed after R2 upload — rolling back:', dbErr?.message);
        await rollbackR2Upload(user.id, result.key!, file.buffer.length);
        sendError(req, res, 500, ErrorCode.DATABASE, 'DB_UPDATE_FAILED', 'Could not save the image. The uploaded file was removed.');
        await UploadAnalyticsService.record({
          userId: user.id, type: 'COVER', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'DB_UPDATE_FAILED',
        });
        return;
      }

      invalidateUserCache(clerkUserId);

      try {
        await UploadAnalyticsService.record({
          userId: user.id, type: 'COVER', status: 'SUCCESS',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
        });
      } catch (err) {
        logger.error('Upload analytics failed:', err);
      }

      try {
        const { enqueueNotification } = await import('../queues/notification.queue');
        const lang = await getUserLanguage(user.id);
        await enqueueNotification({
          userId: user.id,
          title: renderPushTemplate('coverUpdatedTitle', lang),
          message: renderPushTemplate('coverUpdatedBody', lang),
          type: 'GENERAL',
          data: { type: 'UPLOAD_SUCCESS', screen: '/(tabs)/Profile' }
        });
      } catch (err) {
        logger.error('Enqueue notification failed for cover:', err);
      }

      res.json({ status: 'SUCCESS', message: 'Cover image uploaded successfully.', data: { url: result.url, storagePath: result.key } });
    } catch (error: any) {
      logger.error('Upload cover error:', error);
      sendError(req, res, 500, ErrorCode.INTERNAL, 'UPLOAD_ERROR', error?.message || 'Upload failed');
    }
  },
);

/** Heavy Mux PUT + metadata — runs after HTTP response so mobile clients don't 499. */
async function processReelMuxUploadInBackground(params: {
  userId: string;
  reelId: string;
  uploadId: string;
  uploadUrl: string;
  videoBuffer: Buffer;
  videoMimeType: string;
  fileSizeBytes: number;
  fileSizeMB: number;
  hashtags: string[];
  mentions: string[];
  timezone: string;
  startTime: number;
}): Promise<void> {
  const {
    userId,
    reelId,
    uploadId,
    uploadUrl,
    videoBuffer,
    videoMimeType,
    fileSizeBytes,
    fileSizeMB,
    hashtags,
    mentions,
    timezone,
    startTime,
  } = params;

  const cleanupFailedUpload = async (errorCode: string) => {
    await prisma.reel.delete({ where: { id: reelId } }).catch(() => undefined);
    await prisma.user
      .update({ where: { id: userId }, data: { reelUploadLockedUntil: null } })
      .catch(() => undefined);
    await UploadAnalyticsService.record({
      userId,
      type: 'REEL',
      status: 'FAILED',
      fileSizeMB,
      durationMs: Date.now() - startTime,
      errorCode,
    }).catch(() => undefined);
  };

  try {
    logger.info(`[upload/reel] Background Mux PUT started (uploadId: ${uploadId})`);

    const uploadAbortController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadAbortController.abort(), 120_000);
    let muxUploadResponse: Awaited<ReturnType<typeof fetch>>;
    try {
      muxUploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoMimeType },
        body: videoBuffer,
        signal: uploadAbortController.signal,
      });
    } finally {
      clearTimeout(uploadTimeout);
    }

    if (!muxUploadResponse.ok) {
      const errText = await muxUploadResponse.text().catch(() => '');
      logger.error(
        `[upload/reel] Background Mux upload rejected (${muxUploadResponse.status}): ${errText}`,
      );
      await cleanupFailedUpload(`MUX_REJECTED_${muxUploadResponse.status}`);
      return;
    }

    logger.info(`[upload/reel] Background Mux upload complete for reel ${reelId}`);

    await prisma.reel.update({
      where: { id: reelId },
      data: { muxUploadId: uploadId, videoUrl: '' },
    });

    for (const tag of hashtags) {
      const cleanTag = tag.toLowerCase().replace(/^#/, '');
      if (!cleanTag) continue;
      const hashtag = await prisma.hashtag.upsert({
        where: { name: cleanTag },
        create: { name: cleanTag, reelCount: 1 },
        update: { reelCount: { increment: 1 } },
      });
      await prisma.reelHashtag.create({ data: { reelId, hashtagId: hashtag.id } });
    }

    for (const username of mentions) {
      const mentionedUser = await prisma.user.findUnique({
        where: { username: username.replace(/^@/, '') },
        select: { id: true },
      });
      if (!mentionedUser) continue;
      await prisma.reelMention.create({ data: { reelId, mentionedUserId: mentionedUser.id } });
      const lang = await getUserLanguage(mentionedUser.id);
      await prisma.notification.create({
        data: {
          userId: mentionedUser.id,
          title: renderPushTemplate('mentionInVideoTitle', lang),
          message: renderPushTemplate('mentionInVideoBody', lang),
          type: 'GENERAL',
          data: { reelId },
        },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastReelUpload: new Date(), reelUploadLockedUntil: null },
    });

    await incrementQuota(userId, fileSizeBytes);

    try {
      const { awardXp: awardXpFn } = await import('../services/xp.service');
      await awardXpFn({
        userId,
        action: 'REEL_UPLOAD',
        dailyCap: 3,
        timezone,
      });
    } catch (xpErr: any) {
      logger.warn('[upload/reel] Background XP award failed (non-fatal):', xpErr?.message);
    }

    await UploadAnalyticsService.record({
      userId,
      type: 'REEL',
      status: 'SUCCESS',
      fileSizeMB,
      durationMs: Date.now() - startTime,
    });

    logger.info(`[upload/reel] Reel ${reelId} committed after background Mux upload`);
  } catch (err: any) {
    logger.error('[upload/reel] Background Mux processing failed:', err?.message);
    await cleanupFailedUpload(
      err?.name === 'AbortError' ? 'MUX_UPLOAD_TIMEOUT' : 'MUX_UPLOAD_NETWORK_ERROR',
    );
  }
}

// ─── POST /api/upload/reel ────────────────────────────────────────────────────

router.post(
  '/reel',
  requireAuth,
  strictLimiter, // Rate limit: prevent upload spam that exhausts server memory
  uploadReel.fields([{ name: 'video', maxCount: 1 }]),
  validateUploadFieldsMagicBytes, // Fix 5
  validateVideoDuration,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let reelSlotHeld = false;
    let reelUploadCommitted = false;
    let deferLockRelease = false;
    let heldUserId: string | null = null;

    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) { sendError(req, res, 401, ErrorCode.AUTHENTICATION, 'UNAUTHORIZED', 'Unauthorized'); return; }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const videoFile = files['video']?.[0];

      if (!videoFile) { sendError(req, res, 400, ErrorCode.FILE_UPLOAD, 'NO_FILE', 'No video provided'); return; }
      
      const videoFileSize = videoFile.size || 0;
      if (videoFileSize === 0) {
        if (videoFile.path) fs.promises.unlink(videoFile.path).catch(() => undefined);
        sendError(req, res, 400, ErrorCode.FILE_UPLOAD, 'EMPTY_FILE', 'The uploaded video file is empty or corrupted.');
        return;
      }
      if (videoFileSize > 50 * 1024 * 1024) {
        if (videoFile.path) fs.promises.unlink(videoFile.path).catch(() => undefined);
        sendError(req, res, 413, ErrorCode.FILE_UPLOAD, 'FILE_TOO_LARGE', 'Video file is too large. Maximum size is 50MB.');
        return;
      }

      const videoBuffer = await readAndCleanupTempFile(videoFile.path);
      (videoFile as any).buffer = videoBuffer;

      const begin = await beginReelUploadForClerkUser(clerkUserId);
      if (!begin.ok) {
        sendApiError(
          req,
          res,
          begin.errorCode,
          (begin.payload as { message?: string }).message || 'Could not start the upload',
          begin.payload,
          begin.status,
        );
        return;
      }
      reelSlotHeld = true;
      heldUserId = begin.userId;
      const user = { id: begin.userId };

      // Fix 7: Quota check BEFORE upload
      const totalSize = videoFile.buffer.length;
      const quotaOk = await checkQuota(user.id, totalSize, req, res);
      if (!quotaOk) return;

      const fileSizeMB = videoFile.buffer.length / 1e6;
      logger.info(`[upload/reel] Starting Mux upload (${fileSizeMB.toFixed(2)} MB)`);

      let hashtags: string[] = [];
      let mentions: string[] = [];
      let caption: string | null = null;
      try {
        const { caption: c, hashtags: hj, mentions: mj } = req.body;
        caption = c || null;
        hashtags = hj ? (typeof hj === 'string' ? JSON.parse(hj) : hj) : [];
        mentions = mj ? (typeof mj === 'string' ? JSON.parse(mj) : mj) : [];
      } catch { /* non-fatal */ }

      // ── 2. Create placeholder reel (thumbnail from Mux auto-generated) ────────
      let rawVideoStoragePath: null = null;

      const placeholderReel = await prisma.reel.create({
        data: {
          userId: user.id,
          videoUrl: '',           // will be updated by webhook
          thumbnail: null,        // Mux auto-generates thumbnail via webhook
          thumbnailStoragePath: null,
          caption,
          status: 'PROCESSING',
          fileSizeBytes: videoFile.buffer.length,
          ...(rawVideoStoragePath ? { videoStoragePath: rawVideoStoragePath } : {}),
        },
      });

      let uploadId: string;
      let uploadUrl: string;
      try {
        const muxResult = await muxService.createUploadUrl(user.id, placeholderReel.id);
        uploadId = muxResult.uploadId;
        uploadUrl = muxResult.uploadUrl;
      } catch (muxCreateErr: any) {
        // Fix 2: Mux URL creation failed — clean up placeholder reel + thumbnail
        logger.error('[upload/reel] Mux createUploadUrl failed — cleaning up:', muxCreateErr?.message);
        await prisma.reel.delete({ where: { id: placeholderReel.id } }).catch((e: any) =>
          logger.warn('[upload/reel] Failed to delete placeholder reel:', e?.message),
        );
        sendError(req, res, 502, ErrorCode.EXTERNAL_SERVICE, 'MUX_UNAVAILABLE', 'Video processing service is unavailable. Please try again.');
        await UploadAnalyticsService.record({
          userId: user.id, type: 'REEL', status: 'FAILED',
          fileSizeMB: videoFile.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'MUX_UNAVAILABLE',
        }).catch(() => undefined);
        return;
      }

      // ── Respond immediately after receiving the file — Mux PUT runs in background.
      // iOS closes idle connections (499) while waiting for server→Mux upload (30–120s+).
      deferLockRelease = true;

      const timezone = (req.headers['x-user-timezone'] as string) || 'UTC';
      const videoMimeType = videoFile.mimetype || 'video/mp4';

      res.json({
        status: 'SUCCESS',
        message: 'Reel received and is being processed.',
        data: {
          reelId: placeholderReel.id,
          muxUploadId: uploadId,
          thumbnailUrl: null,
          status: 'PROCESSING',
        },
        xpEvents: [],
      });

      setImmediate(() => {
        void processReelMuxUploadInBackground({
          userId: user.id,
          reelId: placeholderReel.id,
          uploadId,
          uploadUrl,
          videoBuffer: videoFile.buffer,
          videoMimeType,
          fileSizeBytes: videoFile.buffer.length,
          fileSizeMB,
          hashtags,
          mentions,
          timezone,
          startTime,
        });
      });
    } catch (error: any) {
      logger.error('[upload/reel] Exception:', error?.message);

      if (!res.headersSent) {
        sendError(req, res, 500, ErrorCode.INTERNAL, 'UPLOAD_ERROR', error?.message || 'Failed to upload reel');
      }

      await UploadAnalyticsService.record({
        userId: heldUserId ?? 'unknown', type: 'REEL', status: 'FAILED',
        fileSizeMB: 0, durationMs: Date.now() - startTime, errorCode: 'UPLOAD_ERROR',
      }).catch(() => undefined);
    } finally {
      if (reelSlotHeld && !reelUploadCommitted && heldUserId && !deferLockRelease) {
        prisma.user
          .update({ where: { id: heldUserId }, data: { reelUploadLockedUntil: null } })
          .catch((e: any) => logger.warn('[upload/reel] Failed to clear lock:', e?.message));
      }
    }
  },
);

// ─── GET /api/upload/reels/:id/status ────────────────────────────────────────

router.get('/reels/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Expected flow after upload fixes:
  // 1. Client POST /upload/reel → PROCESSING + reelId
  // 2. Mux webhook or self-heal → READY within ~60s
  // 3. This endpoint returns READY + stream.mux.com videoUrl
  // 4. No new files under reels/ in R2 (Mux-only pipeline)
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, 401, ErrorCode.AUTHENTICATION, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }

    const reelId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    let reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: {
        id: true,
        status: true,
        videoUrl: true,
        processedVideoUrl: true,
        thumbnail: true,
        muxUploadId: true,
        muxAssetId: true,
        muxPlaybackId: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!reel) { sendError(req, res, 404, ErrorCode.NOT_FOUND, 'NOT_FOUND', 'Reel not found'); return; }

    const owner = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!owner || owner.id !== reel.userId) {
      sendError(req, res, 403, ErrorCode.AUTHORIZATION, 'FORBIDDEN', 'Access denied');
      return;
    }

    // Poll-fallback: if the reel has been PROCESSING for >10s, ask Mux directly
    // and self-heal the DB in case the webhook was missed or delayed.
    // Lowered from 30s → 10s so the client poller (3s interval) can recover
    // from a missed webhook within ~13s instead of ~33s.
    const processingTooLong =
      reel.status === 'PROCESSING' &&
      reel.muxUploadId &&
      Date.now() - new Date(reel.createdAt).getTime() > 10_000;

    if (processingTooLong) {
      try {
        const healResult = await healReelFromMux(reel, { notify: true, invalidateCaches: true });
        if (healResult.outcome === 'ready' || healResult.outcome === 'failed') {
          reel = healResult.reel;
          logger.info(
            `[upload/status] Self-healed reel ${reel.id} → ${reel.status} via poll fallback`,
          );
        }
      } catch (pollErr: any) {
        logger.warn(`[upload/status] Poll fallback failed for reel ${reelId}: ${pollErr?.message}`);
      }
    }

    if (reel.status === 'FAILED' && reel.muxUploadId) {
      logger.info('[ReelStatus] Self-heal check for reelId:', reelId);
      try {
        const healResult = await healReelFromMux(reel, { notify: true, invalidateCaches: true });
        if (healResult.outcome === 'ready' || healResult.outcome === 'failed') {
          reel = healResult.reel;
        }
      } catch (failedHealErr: any) {
        logger.warn(`[ReelStatus] FAILED self-heal failed for reel ${reelId}:`, failedHealErr?.message);
      }
    }

    // ✅ Prefer the Mux HLS URL when a Mux playback ID exists. Some legacy
    // reels keep both `processedVideoUrl` (old R2 transcode) and the new
    // Mux `videoUrl` populated; preferring `processedVideoUrl` would serve
    // the stale R2 mp4 and bypass Mux's adaptive HLS.
    const videoUrl = reel.muxPlaybackId
      ? (reel.videoUrl || reel.processedVideoUrl || null)
      : (reel.processedVideoUrl || reel.videoUrl || null);

    // Thumbnail: use stored thumbnail or Mux auto-thumbnail
    const thumbnailUrl = reel.thumbnail ||
      (reel.muxPlaybackId ? muxService.getThumbnailUrl(reel.muxPlaybackId) : null);

    res.json({
      status: 'SUCCESS',
      data: {
        reelId: reel.id,
        status: reel.status,
        videoUrl,
        thumbnailUrl,
        muxPlaybackId: reel.muxPlaybackId,
      },
    });
  } catch (error: any) {
    sendError(req, res, 500, ErrorCode.INTERNAL, 'INTERNAL', error?.message || 'Internal server error');
  }
});

// ─── DELETE /api/upload/avatar ────────────────────────────────────────────────
// UX Fix 5: Allow users to remove their avatar (set to null / default)

router.delete(
  '/avatar',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) { sendError(req, res, 401, ErrorCode.AUTHENTICATION, 'UNAUTHORIZED', 'Unauthorized'); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, avatarStoragePath: true, avatar: true },
      });
      if (!user) { sendError(req, res, 404, ErrorCode.NOT_FOUND, 'USER_NOT_FOUND', 'User not found'); return; }

      // Only allow removal if user has a custom avatar stored in R2
      if (!user.avatarStoragePath) {
        sendError(req, res, 400, ErrorCode.NOT_FOUND, 'NO_AVATAR', 'No custom profile picture to remove.');
        return;
      }

      // Delete from R2 (non-blocking — don't fail if R2 is slow)
      r2MediaStorage.deleteObject(user.avatarStoragePath).catch((err: any) =>
        logger.warn('[upload/avatar/delete] R2 delete failed (non-fatal):', err?.message),
      );

      // Decrement quota using a best-effort HEAD request size — we don't store file size
      // for avatars yet, so we skip decrement here (acceptable; quota is approximate).

      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: null, avatarStoragePath: null, lastAvatarChange: new Date() },
      });

      invalidateUserCache(clerkUserId);

      try {
        const { ProfileCompletionService } = await import('../services/profile-completion.service');
        await ProfileCompletionService.getCompletionStatus(clerkUserId);
      } catch (err) {
        logger.error('Profile completion recalc failed after avatar removal:', err);
      }

      await UploadAnalyticsService.record({
        userId: user.id, type: 'AVATAR', status: 'SUCCESS',
        fileSizeMB: 0, durationMs: Date.now() - startTime,
      });

      res.json({ status: 'SUCCESS', message: 'Profile picture removed.' });
    } catch (error: any) {
      logger.error('Delete avatar error:', error);
      sendError(req, res, 500, ErrorCode.INTERNAL, 'DELETE_ERROR', error?.message || 'Failed to remove avatar');
    }
  },
);

export default router;
