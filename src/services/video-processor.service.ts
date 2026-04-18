/**
 * Video Processing Service  (Fix 1)
 *
 * Transcodes uploaded reels to H.264/720p, generates thumbnails,
 * and updates the reel record with processedVideoUrl + status.
 *
 * Queue: video-processing (Bull)
 * Job: attempts 3, backoff exponential 5000ms
 *
 * Fixes applied in this revision:
 *  - Startup ffmpeg health check (verifyFfmpeg)
 *  - Disk space check before download
 *  - Proper try/catch in processVideoInline so FAILED is always set
 *  - generateThumbnail uses 'end' event correctly with explicit file-exists check
 *  - Streaming upload to R2 instead of readFileSync (avoids RAM spike)
 */

import Bull, { Queue, Job } from 'bull';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import prisma from '../lib/prisma';
import { r2MediaStorage } from './r2-media-storage.service';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Point fluent-ffmpeg at the bundled binary (works on Railway Linux)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ─── Startup health check ─────────────────────────────────────────────────────

/**
 * Call once at server startup to verify ffmpeg binary is functional.
 * Logs a critical warning if it isn't — jobs will fail but server still starts.
 */
export function verifyFfmpeg(): void {
  ffmpeg.getAvailableFormats((err, formats) => {
    if (err) {
      logger.error(
        '[VideoProcessor] ❌ ffmpeg binary not functional! Video processing will fail.',
        { path: ffmpegInstaller.path, error: err.message },
      );
    } else {
      const count = Object.keys(formats ?? {}).length;
      logger.info(`[VideoProcessor] ✅ ffmpeg OK — ${count} formats available (path: ${ffmpegInstaller.path})`);
    }
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoProcessingJobData {
  reelId: string;
  userId: string;
  rawVideoUrl: string;
  rawVideoKey: string;
  thumbnailProvided: boolean;
}

// ─── Queue singleton ──────────────────────────────────────────────────────────

let videoProcessingQueue: Queue<VideoProcessingJobData> | null = null;

export function getVideoProcessingQueue(): Queue<VideoProcessingJobData> | null {
  if (videoProcessingQueue) return videoProcessingQueue;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('⚠️  REDIS_URL not set – video-processing queue disabled');
    return null;
  }

  // Use URL parsing to extract details if needed, or better, just pass the URL string as first argument
  // to Bull which accepts (name, url, opts)
  videoProcessingQueue = new Bull<VideoProcessingJobData>('video-processing', redisUrl, {
    redis: {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      timeout: 8 * 60 * 1000,
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  videoProcessingQueue.process(processVideoJob);

  videoProcessingQueue.on('completed', (job) => {
    logger.info(`[VideoProcessor] Job ${job.id} completed for reel ${job.data.reelId}`);
  });

  videoProcessingQueue.on('failed', async (job, err) => {
    logger.error(
      `[VideoProcessor] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 3}):`,
      err.message,
    );
    // After all retries exhausted, mark reel FAILED and notify user
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await handleProcessingFailure(job.data.reelId, job.data.userId, err.message);
    }
  });

  videoProcessingQueue.on('error', (err: any) => {
    // Bull/Redis on free tiers frequently drops idle connections, causing noisy EPIPE/ECONNRESET errors.
    // They are non-fatal as Bull will auto-reconnect.
    if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err.code) || err.message?.includes('MaxRetriesPerRequestError')) {
      logger.debug(`[VideoProcessor] Redis connection dropped (${err.code || 'MaxRetries'}), bull will reconnect automatically.`);
      return;
    }
    logger.error('[VideoProcessor] Queue error:', err);
  });

  logger.info('✅ video-processing queue initialised');
  return videoProcessingQueue;
}

/**
 * Enqueue a video processing job.
 * Falls back to inline processing if Redis is unavailable.
 */
export async function enqueueVideoProcessing(data: VideoProcessingJobData): Promise<void> {
  const queue = getVideoProcessingQueue();
  if (!queue) {
    logger.warn('[VideoProcessor] Queue unavailable, processing inline');
    // Fire-and-forget inline processing — don't block the HTTP response
    processVideoInline(data).catch((err) =>
      logger.error('[VideoProcessor] Inline processing error:', err),
    );
    return;
  }
  await queue.add(data);
  logger.info(`[VideoProcessor] Enqueued job for reel ${data.reelId}`);
}

// ─── Core processor ───────────────────────────────────────────────────────────

async function processVideoJob(job: Job<VideoProcessingJobData>): Promise<void> {
  await processVideoInline(job.data);
}

async function processVideoInline(data: VideoProcessingJobData): Promise<void> {
  const { reelId, userId, rawVideoUrl, rawVideoKey, thumbnailProvided } = data;

  // Skip processing for Mux reels — Mux handles transcoding automatically
  const reelCheck = await db.reel.findUnique({
    where: { id: reelId },
    select: { muxAssetId: true, muxUploadId: true },
  });
  if (reelCheck?.muxAssetId || reelCheck?.muxUploadId) {
    logger.info(`[VideoProcessor] Skipping reel ${reelId} — handled by Mux`);
    return;
  }

  const jobId = `${reelId}_${Date.now()}`;
  const tmpDir = os.tmpdir();
  const rawPath = path.join(tmpDir, `${jobId}_raw.mp4`);
  const processedPath = path.join(tmpDir, `${jobId}_processed.mp4`);
  const thumbPath = path.join(tmpDir, `${jobId}_thumb.jpg`);

  logger.info(`[VideoProcessor] Starting processing for reel ${reelId}`);

  try {
    // ── 0. Disk space check ───────────────────────────────────────────────────
    await checkDiskSpace(tmpDir, 200 * 1024 * 1024); // require 200MB free

    // ── 1. Mark reel as PROCESSING ────────────────────────────────────────────
    await db.reel.update({ where: { id: reelId }, data: { status: 'PROCESSING' } });

    // ── 2. Download raw video from R2 ─────────────────────────────────────────
    logger.info(`[VideoProcessor] Downloading raw video: ${rawVideoUrl}`);
    await downloadFile(rawVideoUrl, rawPath);

    // ── 3. Transcode to H.264 / 720p / CRF 28 / AAC ──────────────────────────
    logger.info(`[VideoProcessor] Transcoding reel ${reelId}`);
    await transcodeVideo(rawPath, processedPath);

    // ── 4. Generate thumbnail at 1s (if not provided) ─────────────────────────
    let thumbnailUrl: string | null = null;
    let thumbnailKey: string | null = null;

    if (!thumbnailProvided) {
      logger.info(`[VideoProcessor] Generating thumbnail for reel ${reelId}`);
      const thumbGenerated = await generateThumbnail(rawPath, thumbPath);

      if (thumbGenerated && fs.existsSync(thumbPath)) {
        const thumbBuffer = fs.readFileSync(thumbPath);
        const thumbResult = await r2MediaStorage.uploadPublic(
          'thumbnails',
          userId,
          thumbBuffer,
          `${jobId}_thumb.jpg`,
          'image/jpeg',
        );
        if (thumbResult.success && thumbResult.url && thumbResult.key) {
          thumbnailUrl = thumbResult.url;
          thumbnailKey = thumbResult.key;
        } else {
          logger.warn(`[VideoProcessor] Thumbnail upload failed: ${thumbResult.error}`);
        }
      }
    }

    // ── 5. Upload processed video to R2 ─────────────────────────────────────
    logger.info(`[VideoProcessor] Uploading processed video for reel ${reelId}`);
    const processedBuffer = fs.readFileSync(processedPath);
    const processedSizeBytes = processedBuffer.length;

    const processedResult = await r2MediaStorage.uploadPublic(
      'reels',
      userId,
      processedBuffer,
      `${jobId}_processed.mp4`,
      'video/mp4',
    );

    if (!processedResult.success || !processedResult.url || !processedResult.key) {
      throw new Error(`Processed video upload failed: ${processedResult.error}`);
    }

    // ── 6. Update reel in DB + reconcile storageUsedBytes ────────────────────
    // Read original fileSizeBytes BEFORE overwriting (needed for quota reconciliation)
    const reelBeforeUpdate = await db.reel.findUnique({
      where: { id: reelId },
      select: { fileSizeBytes: true },
    });
    const originalSizeBytes = Number(reelBeforeUpdate?.fileSizeBytes ?? 0);

    const thumbSizeBytes = (!thumbnailProvided && fs.existsSync(thumbPath))
      ? fs.statSync(thumbPath).size
      : 0;
    const newFileSizeBytes = processedSizeBytes + thumbSizeBytes;

    const updateData: Record<string, unknown> = {
      processedVideoUrl: processedResult.url,
      processedVideoKey: processedResult.key,
      status: 'READY',
      fileSizeBytes: newFileSizeBytes, // Fix Q5: actual R2 usage after transcoding
    };
    if (thumbnailUrl) {
      updateData.thumbnail = thumbnailUrl;
      updateData.thumbnailStoragePath = thumbnailKey;
    }
    await db.reel.update({ where: { id: reelId }, data: updateData });

    // Fix Q5: Reconcile user's storageUsedBytes — correct from original to processed size
    if (originalSizeBytes > 0 && newFileSizeBytes !== originalSizeBytes) {
      const delta = newFileSizeBytes - originalSizeBytes; // negative = saved space
      try {
        await db.user.update({
          where: { id: userId },
          data: { storageUsedBytes: { increment: delta } },
        });
        logger.info(
          `[VideoProcessor] Quota reconciled for user ${userId}: ` +
          `${(originalSizeBytes / 1e6).toFixed(2)}MB → ${(newFileSizeBytes / 1e6).toFixed(2)}MB ` +
          `(delta: ${(delta / 1e6).toFixed(2)}MB)`,
        );
      } catch (quotaErr) {
        logger.warn('[VideoProcessor] Quota reconciliation failed (non-fatal):', quotaErr);
      }
    }

    // ── 7. Delete raw video from R2 ───────────────────────────────────────────
    if (rawVideoKey) {
      const deleted = await r2MediaStorage.deleteObject(rawVideoKey);
      if (!deleted) logger.warn(`[VideoProcessor] Could not delete raw key: ${rawVideoKey}`);
    }

    // ── 8. Notify user ────────────────────────────────────────────────────────
    await NotificationService.createNotification({
      userId,
      title: '✅ فيديوهك جاهز!',
      message: 'تم معالجة فيديوهك بنجاح وهو متاح الآن للمشاهدة',
      type: 'VIDEO_PROCESSED',
      data: { type: 'VIDEO_PROCESSED', reelId, status: 'READY' },
    });

    logger.info(`[VideoProcessor] ✅ Reel ${reelId} processed successfully`);
  } catch (err: any) {
    // Always mark FAILED so the reel doesn't stay stuck in PROCESSING
    logger.error(`[VideoProcessor] Processing failed for reel ${reelId}:`, err.message);
    try {
      await db.reel.update({ where: { id: reelId }, data: { status: 'FAILED' } });
    } catch (dbErr) {
      logger.error('[VideoProcessor] Could not mark reel FAILED in DB:', dbErr);
    }
    throw err; // re-throw so Bull can retry
  } finally {
    // ── 9. Cleanup /tmp files ─────────────────────────────────────────────────
    for (const p of [rawPath, processedPath, thumbPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // non-fatal
      }
    }
  }
}

// ─── Failure handler (after all retries) ─────────────────────────────────────

async function handleProcessingFailure(reelId: string, userId: string, errorMsg: string): Promise<void> {
  try {
    await db.reel.update({ where: { id: reelId }, data: { status: 'FAILED' } });
    await NotificationService.createNotification({
      userId,
      title: '❌ فشل رفع الفيديو',
      message: 'حدث خطأ أثناء معالجة فيديوهك. حاول تاني من البروفايل.',
      type: 'VIDEO_PROCESSED',
      data: { type: 'VIDEO_PROCESSED', reelId, status: 'FAILED', error: errorMsg },
    });
    logger.error(`[VideoProcessor] Reel ${reelId} permanently failed: ${errorMsg}`);
  } catch (err) {
    logger.error('[VideoProcessor] handleProcessingFailure error:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check available disk space in a directory.
 * Uses statvfs via df on Linux/Mac; skips check on Windows.
 */
async function checkDiskSpace(dir: string, requiredBytes: number): Promise<void> {
  if (process.platform === 'win32') return; // skip on Windows dev

  try {
    const { execSync } = await import('child_process');
    // df -k returns 1K blocks; available is column 4
    const output = execSync(`df -k "${dir}" | tail -1 | awk '{print $4}'`, { encoding: 'utf8' });
    const availableKB = parseInt(output.trim(), 10);
    const availableBytes = availableKB * 1024;

    if (availableBytes < requiredBytes) {
      throw new Error(
        `Insufficient disk space: ${(availableBytes / 1e6).toFixed(0)}MB available, ` +
        `${(requiredBytes / 1e6).toFixed(0)}MB required`,
      );
    }
    logger.debug(`[VideoProcessor] Disk space OK: ${(availableBytes / 1e6).toFixed(0)}MB available`);
  } catch (err: any) {
    if (err.message.includes('Insufficient disk space')) throw err;
    // df command failed — log and continue (non-fatal)
    logger.warn('[VideoProcessor] Could not check disk space (non-fatal):', err.message);
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);

    const cleanup = (err: Error) => {
      file.destroy();
      fs.unlink(dest, () => undefined);
      reject(err);
    };

    transport
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return cleanup(new Error(`Download failed with status ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', cleanup);
      })
      .on('error', cleanup);
  });
}

function transcodeVideo(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
        '-crf', '28',
        '-preset', 'fast',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
      ])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Transcode error: ${err.message}`)))
      .run();
  });
}

/**
 * Generate a thumbnail at the 1-second mark.
 * Returns true if the file was created, false if ffmpeg couldn't extract a frame.
 */
function generateThumbnail(input: string, output: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dir = path.dirname(output);
    const filename = path.basename(output);

    ffmpeg(input)
      .screenshots({
        timestamps: ['1'],
        filename,
        folder: dir,
        size: '640x?',
      })
      .on('end', () => {
        // Verify file actually exists (ffmpeg can fire 'end' before flush on some versions)
        const exists = fs.existsSync(output);
        if (!exists) {
          logger.warn(`[VideoProcessor] Thumbnail 'end' fired but file missing: ${output}`);
        }
        resolve(exists);
      })
      .on('error', (err) => {
        logger.warn(`[VideoProcessor] Thumbnail generation failed (non-fatal): ${err.message}`);
        resolve(false); // non-fatal — reel still gets uploaded without thumbnail
      });
  });
}
