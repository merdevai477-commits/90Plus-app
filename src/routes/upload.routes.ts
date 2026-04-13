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
import multer from 'multer';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import path from 'path';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeOriginalName(name: string | undefined, fallback: string): string {
  const base = path.basename(name || fallback);
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function sendError(
  res: Response,
  httpStatus: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  res.status(httpStatus).json({
    status: 'ERROR',
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

/** Fix 6: Rich cooldown response */
function sendCooldownError(
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

  res.status(429).json({
    status: 'ERROR',
    code: 'COOLDOWN_ACTIVE',
    cooldownType,
    lastChangeDate: lastChangeDate.toISOString(),
    nextAllowedDate: nextAllowedDate.toISOString(),
    daysRemaining,
    hoursRemaining,
    message: `يمكنك التغيير بعد ${daysRemaining} يوم و${hoursRemaining % 24} ساعة`,
  });
}

/** Fix 7: Check storage quota WITHOUT incrementing yet. Returns false and sends 413 if exceeded. */
async function checkQuota(
  userId: string,
  fileSizeBytes: number,
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
    res.status(413).json({
      status: 'ERROR',
      code: 'QUOTA_EXCEEDED',
      message: `تجاوزت حد التخزين. مستخدم: ${usedGB} GB من ${quotaGB} GB`,
      usedGB,
      quotaGB,
    });
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

// ─── Multer configs ───────────────────────────────────────────────────────────

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    cb(null, false);
  },
});

const uploadReel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 55 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    cb(null, mt.startsWith('video/') || mt.startsWith('image/'));
  },
});

// ─── Cooldown constants ───────────────────────────────────────────────────────

const AVATAR_CHANGE_COOLDOWN_DAYS = 7;
const COVER_CHANGE_COOLDOWN_DAYS = 15;
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
const REEL_UPLOAD_LOCK_MS = 25 * 60 * 1000;

// ─── Reel upload lock helper ──────────────────────────────────────────────────

type BeginReelResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; payload: Record<string, unknown> };

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
          payload: { status: 'ERROR', code: 'USER_NOT_FOUND', message: 'User not found', timestamp: new Date().toISOString() },
        };
      }

      const now = Date.now();

      if (user.reelUploadLockedUntil && user.reelUploadLockedUntil.getTime() > now) {
        return {
          ok: false,
          status: 429,
          payload: {
            status: 'ERROR',
            code: 'REEL_UPLOAD_IN_PROGRESS',
            message: 'يتم رفع فيديو بالفعل. انتظر حتى يكتمل ثم حاول مجدداً.',
            timestamp: new Date().toISOString(),
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
            payload: {
              status: 'ERROR',
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
              message: `يمكنك رفع فيديو جديد بعد ${REEL_UPLOAD_COOLDOWN_DAYS - daysSince} يوم`,
              timestamp: new Date().toISOString(),
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
      payload: {
        status: 'ERROR',
        code: 'LOCK_ERROR',
        message: 'تعذّر بدء الرفع. حاول مرة أخرى.',
        timestamp: new Date().toISOString(),
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

    if (!clerkUserId) { sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized'); return; }

    const file = req.file;
    if (!file) { sendError(res, 400, 'NO_FILE', 'No file provided'); return; }
    if (!file.buffer || file.buffer.length === 0) { sendError(res, 400, 'EMPTY_FILE', 'File is empty'); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastAvatarChange: true, avatarStoragePath: true },
      });

      if (!user) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      // Fix 6: Rich cooldown
      if (user.lastAvatarChange) {
        const daysSince = Math.floor(
          (Date.now() - user.lastAvatarChange.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < AVATAR_CHANGE_COOLDOWN_DAYS) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'GENERAL',
              title: 'تغيير صورة البروفايل',
              message: `لا يمكنك تغيير صورة البروفايل الآن.`,
              data: { type: 'AVATAR_COOLDOWN' },
            },
          });
          sendCooldownError(res, 'avatar', user.lastAvatarChange, AVATAR_CHANGE_COOLDOWN_DAYS);
          await UploadAnalyticsService.record({
            userId: user.id, type: 'AVATAR', status: 'FAILED',
            fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
            errorCode: 'COOLDOWN_ACTIVE',
          });
          return;
        }
      }

      // Fix 7: Check quota BEFORE upload (don't increment yet)
      const quotaOk = await checkQuota(user.id, file.buffer.length, res);
      if (!quotaOk) return;

      // Delete old avatar from R2 (non-blocking)
      if (user.avatarStoragePath) {
        r2MediaStorage.deleteObject(user.avatarStoragePath).catch((err: any) =>
          logger.warn('[upload/avatar] Old avatar R2 delete failed:', err?.message),
        );
      }

      const safeName = sanitizeOriginalName(file.originalname, 'avatar');
      const result = await r2MediaStorage.uploadPublic('avatars', user.id, file.buffer, safeName, file.mimetype);

      if (!result.success || !result.url || !result.key) {
        sendError(res, 500, 'STORAGE_UPLOAD_FAILED', result.error || 'Upload failed');
        await UploadAnalyticsService.record({
          userId: user.id, type: 'AVATAR', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'STORAGE_UPLOAD_FAILED',
        });
        return;
      }

      // Fix 7: Increment quota AFTER successful upload
      await incrementQuota(user.id, file.buffer.length);

      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: result.url, avatarStoragePath: result.key, lastAvatarChange: new Date() },
      });

      invalidateUserCache(clerkUserId);

      try {
        const { ProfileCompletionService } = await import('../services/profile-completion.service');
        await ProfileCompletionService.getCompletionStatus(clerkUserId);
      } catch (err) {
        logger.error('Profile completion recalc failed:', err);
      }

      await UploadAnalyticsService.record({
        userId: user.id, type: 'AVATAR', status: 'SUCCESS',
        fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
      });

      res.json({ status: 'SUCCESS', message: 'تم رفع صورة البروفايل بنجاح', data: { url: result.url, storagePath: result.key } });
    } catch (error: any) {
      logger.error('Upload avatar error:', error);
      sendError(res, 500, 'UPLOAD_ERROR', error?.message || 'Upload failed');
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

    if (!clerkUserId) { sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized'); return; }

    const file = req.file;
    if (!file) { sendError(res, 400, 'NO_FILE', 'No file provided'); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastCoverChange: true, coverStoragePath: true },
      });

      if (!user) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      // Fix 6: Rich cooldown
      if (user.lastCoverChange) {
        const daysSince = Math.floor(
          (Date.now() - user.lastCoverChange.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < COVER_CHANGE_COOLDOWN_DAYS) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'GENERAL',
              title: 'تغيير صورة الغلاف',
              message: 'لا يمكنك تغيير صورة الغلاف الآن.',
              data: { type: 'COVER_COOLDOWN' },
            },
          });
          sendCooldownError(res, 'cover', user.lastCoverChange, COVER_CHANGE_COOLDOWN_DAYS);
          await UploadAnalyticsService.record({
            userId: user.id, type: 'COVER', status: 'FAILED',
            fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
            errorCode: 'COOLDOWN_ACTIVE',
          });
          return;
        }
      }

      // Fix 7: Check quota BEFORE upload
      const quotaOk = await checkQuota(user.id, file.buffer.length, res);
      if (!quotaOk) return;

      if (user.coverStoragePath) {
        r2MediaStorage.deleteObject(user.coverStoragePath).catch((err: any) =>
          logger.warn('[upload/cover] Old cover R2 delete failed:', err?.message),
        );
      }

      const safeName = sanitizeOriginalName(file.originalname, 'cover');
      const result = await r2MediaStorage.uploadPublic('covers', user.id, file.buffer, safeName, file.mimetype);

      if (!result.success || !result.url || !result.key) {
        sendError(res, 500, 'STORAGE_UPLOAD_FAILED', result.error || 'Upload failed');
        await UploadAnalyticsService.record({
          userId: user.id, type: 'COVER', status: 'FAILED',
          fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
          errorCode: 'STORAGE_UPLOAD_FAILED',
        });
        return;
      }

      // Fix 7: Increment quota AFTER successful upload
      await incrementQuota(user.id, file.buffer.length);

      await prisma.user.update({
        where: { id: user.id },
        data: { coverImage: result.url, coverStoragePath: result.key, lastCoverChange: new Date() },
      });

      invalidateUserCache(clerkUserId);

      await UploadAnalyticsService.record({
        userId: user.id, type: 'COVER', status: 'SUCCESS',
        fileSizeMB: file.buffer.length / 1e6, durationMs: Date.now() - startTime,
      });

      res.json({ status: 'SUCCESS', message: 'تم رفع صورة الغلاف بنجاح', data: { url: result.url, storagePath: result.key } });
    } catch (error: any) {
      logger.error('Upload cover error:', error);
      sendError(res, 500, 'UPLOAD_ERROR', error?.message || 'Upload failed');
    }
  },
);

// ─── POST /api/upload/reel ────────────────────────────────────────────────────

router.post(
  '/reel',
  requireAuth,
  uploadReel.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  validateUploadFieldsMagicBytes, // Fix 5
  validateVideoDuration,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let reelSlotHeld = false;
    let reelUploadCommitted = false;
    let heldUserId: string | null = null;

    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) { sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized'); return; }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const videoFile = files['video']?.[0];
      const thumbnailFile = files['thumbnail']?.[0];

      if (!videoFile) { sendError(res, 400, 'NO_FILE', 'No video provided'); return; }
      if (videoFile.buffer.length === 0) {
        sendError(res, 400, 'EMPTY_FILE', 'ملف الفيديو فارغ أو معطوب.');
        return;
      }
      if (videoFile.buffer.length > 50 * 1024 * 1024) {
        sendError(res, 413, 'FILE_TOO_LARGE', 'Video file is too large. Maximum size is 50MB.');
        return;
      }

      const begin = await beginReelUploadForClerkUser(clerkUserId);
      if (!begin.ok) { res.status(begin.status).json(begin.payload); return; }
      reelSlotHeld = true;
      heldUserId = begin.userId;
      const user = { id: begin.userId };

      // Fix 7: Quota check BEFORE upload
      const totalSize = videoFile.buffer.length + (thumbnailFile?.buffer.length ?? 0);
      const quotaOk = await checkQuota(user.id, totalSize, res);
      if (!quotaOk) return;

      const fileSizeMB = videoFile.buffer.length / 1e6;
      logger.info(`[upload/reel] Starting Mux upload (${fileSizeMB.toFixed(2)} MB)`);

      // ── 1. Create a Mux direct upload URL ────────────────────────────────────
      // We need the reelId for passthrough, so create the DB record first with a
      // placeholder videoUrl, then update after we have the Mux upload ID.
      // Actually: create the reel first (status PROCESSING), then upload to Mux.

      // Parse metadata early so we can create the reel record
      let hashtags: string[] = [];
      let mentions: string[] = [];
      let caption: string | null = null;
      try {
        const { caption: c, hashtags: hj, mentions: mj } = req.body;
        caption = c || null;
        hashtags = hj ? (typeof hj === 'string' ? JSON.parse(hj) : hj) : [];
        mentions = mj ? (typeof mj === 'string' ? JSON.parse(mj) : mj) : [];
      } catch { /* non-fatal */ }

      // ── 2. Upload thumbnail to R2 if provided (Mux handles video thumbnails) ─
      let thumbnailUrl: string | null = null;
      let thumbnailPath: string | null = null;

      if (thumbnailFile) {
        try {
          const thumbName = sanitizeOriginalName(thumbnailFile.originalname, 'thumb.jpg');
          const thumbResult = await r2MediaStorage.uploadPublic(
            'thumbnails', user.id, thumbnailFile.buffer, thumbName, thumbnailFile.mimetype,
          );
          if (thumbResult.success && thumbResult.url && thumbResult.key) {
            thumbnailUrl = thumbResult.url;
            thumbnailPath = thumbResult.key;
          }
        } catch (thumbErr: any) {
          logger.warn('[upload/reel] Thumbnail upload failed (non-fatal):', thumbErr?.message);
        }
      }

      // ── 3. Create Mux upload URL ──────────────────────────────────────────────
      // We need reelId for passthrough — create a temporary placeholder reel first
      const placeholderReel = await prisma.reel.create({
        data: {
          userId: user.id,
          videoUrl: '',           // will be updated by webhook
          thumbnail: thumbnailUrl,
          thumbnailStoragePath: thumbnailPath,
          caption,
          status: 'PROCESSING',
          fileSizeBytes: videoFile.buffer.length + (thumbnailFile?.buffer.length ?? 0),
        },
      });

      const { uploadId, uploadUrl } = await muxService.createUploadUrl(user.id, placeholderReel.id);

      // ── 4. PUT video buffer directly to Mux upload URL ────────────────────────
      logger.info(`[upload/reel] Uploading to Mux (uploadId: ${uploadId})`);

      const muxUploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoFile.mimetype },
        body: videoFile.buffer,
      });

      if (!muxUploadResponse.ok) {
        const errText = await muxUploadResponse.text().catch(() => '');
        throw new Error(`Mux upload failed: ${muxUploadResponse.status} ${errText}`);
      }

      logger.info(`[upload/reel] Mux upload complete for reel ${placeholderReel.id}`);

      // ── 5. Update reel with Mux upload ID + provisional thumbnail URL ─────────
      // videoUrl will be set to the HLS URL by the webhook when asset is ready.
      // For now, set it to the Mux thumbnail URL so the feed doesn't show blank.
      const provisionalVideoUrl = ''; // webhook will fill this in
      const muxThumbnailUrl = thumbnailUrl; // use R2 thumbnail if provided; Mux auto-thumb otherwise

      await prisma.reel.update({
        where: { id: placeholderReel.id },
        data: {
          muxUploadId: uploadId,
          videoUrl: provisionalVideoUrl,
        },
      });

      // ── 6. Process hashtags ───────────────────────────────────────────────────
      for (const tag of hashtags) {
        const cleanTag = tag.toLowerCase().replace(/^#/, '');
        if (cleanTag) {
          const hashtag = await prisma.hashtag.upsert({
            where: { name: cleanTag },
            create: { name: cleanTag, reelCount: 1 },
            update: { reelCount: { increment: 1 } },
          });
          await prisma.reelHashtag.create({ data: { reelId: placeholderReel.id, hashtagId: hashtag.id } });
        }
      }

      // ── 7. Process mentions ───────────────────────────────────────────────────
      for (const username of mentions) {
        const mentionedUser = await prisma.user.findUnique({
          where: { username: username.replace(/^@/, '') },
          select: { id: true },
        });
        if (mentionedUser) {
          await prisma.reelMention.create({ data: { reelId: placeholderReel.id, mentionedUserId: mentionedUser.id } });
          await prisma.notification.create({
            data: {
              userId: mentionedUser.id,
              title: 'تم الإشارة إليك',
              message: 'قام شخص بالإشارة إليك في فيديو',
              type: 'GENERAL',
              data: { reelId: placeholderReel.id },
            },
          });
        }
      }

      // ── 8. Update cooldown + release lock ─────────────────────────────────────
      await prisma.user.update({
        where: { id: user.id },
        data: { lastReelUpload: new Date(), reelUploadLockedUntil: null },
      });
      reelUploadCommitted = true;

      // Fix 7: Increment quota AFTER successful upload
      await incrementQuota(user.id, videoFile.buffer.length + (thumbnailFile?.buffer.length ?? 0));

      await UploadAnalyticsService.record({
        userId: user.id, type: 'REEL', status: 'SUCCESS',
        fileSizeMB, durationMs: Date.now() - startTime,
      });

      logger.info(`[upload/reel] Reel ${placeholderReel.id} created, Mux processing started`);

      res.json({
        status: 'SUCCESS',
        message: 'تم رفع الفيديو بنجاح وجاري المعالجة',
        data: {
          reelId: placeholderReel.id,
          muxUploadId: uploadId,
          thumbnailUrl: muxThumbnailUrl,
          status: 'PROCESSING',
        },
      });
    } catch (error: any) {
      logger.error('[upload/reel] Exception:', error?.message);

      if (!res.headersSent) {
        sendError(res, 500, 'UPLOAD_ERROR', error?.message || 'Failed to upload reel');
      }

      await UploadAnalyticsService.record({
        userId: heldUserId ?? 'unknown', type: 'REEL', status: 'FAILED',
        fileSizeMB: 0, durationMs: Date.now() - startTime, errorCode: 'UPLOAD_ERROR',
      }).catch(() => undefined);
    } finally {
      if (reelSlotHeld && !reelUploadCommitted && heldUserId) {
        prisma.user
          .update({ where: { id: heldUserId }, data: { reelUploadLockedUntil: null } })
          .catch((e: any) => logger.warn('[upload/reel] Failed to clear lock:', e?.message));
      }
    }
  },
);

// ─── GET /api/upload/reels/:id/status ────────────────────────────────────────

router.get('/reels/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const reelId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: {
        id: true,
        status: true,
        videoUrl: true,
        processedVideoUrl: true,
        thumbnail: true,
        muxPlaybackId: true,
        userId: true,
      },
    });

    if (!reel) { sendError(res, 404, 'NOT_FOUND', 'Reel not found'); return; }

    // Prefer processedVideoUrl (legacy R2) or videoUrl (Mux HLS set by webhook)
    const videoUrl = reel.processedVideoUrl || reel.videoUrl || null;

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
    sendError(res, 500, 'ERROR', error?.message);
  }
});

export default router;
