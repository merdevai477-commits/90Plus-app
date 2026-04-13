/**
 * Image Optimization Middleware  (Fix 11)
 *
 * Converts JPEG/PNG/HEIC to WebP before upload.
 * Quality: 85 for avatars, 80 for covers.
 * Falls back to JPEG optimize if WebP is larger.
 *
 * If sharp throws on a corrupted image → returns 400 (not 500).
 * HEIC input is handled via sharp's built-in libheif support.
 */

import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SUPPORTED_INPUT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
];

export const optimizeUploadedImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.file) { next(); return; }

    const mime = req.file.mimetype.toLowerCase();
    if (!SUPPORTED_INPUT_TYPES.some((t) => mime.startsWith(t.split('/')[0]) && mime.includes('image'))) {
      next();
      return;
    }

    // Skip if already very small (< 100KB) and already WebP
    if (req.file.size < 100 * 1024 && mime === 'image/webp') {
      next();
      return;
    }

    const originalSize = req.file.size;

    // Determine quality + dimensions based on upload type
    // req.originalUrl is reliable; req.path inside a sub-router is '/'
    const isCover = (req.originalUrl || '').includes('cover');
    const quality = isCover ? 80 : 85;
    const maxWidth = isCover ? 1920 : 500;

    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(req.file.buffer)
        .rotate() // auto-rotate based on EXIF (important for HEIC)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
    } catch (sharpErr: any) {
      // Corrupted or unsupported image — return 400, don't proceed
      logger.warn('[Sharp] Failed to process image:', {
        error: sharpErr.message,
        mimetype: req.file.mimetype,
        size: req.file.size,
        userId: req.auth?.userId,
      });
      res.status(400).json({
        status: 'ERROR',
        code: 'INVALID_IMAGE',
        message: 'الصورة تالفة أو غير مدعومة. يرجى اختيار صورة أخرى.',
      });
      return;
    }

    if (webpBuffer.length < originalSize) {
      req.file.buffer = webpBuffer;
      req.file.size = webpBuffer.length;
      req.file.mimetype = 'image/webp';
      req.file.originalname = req.file.originalname.replace(/\.(jpe?g|png|heic|heif)$/i, '.webp');

      const savedPct = ((1 - webpBuffer.length / originalSize) * 100).toFixed(0);
      logger.info(`[Sharp/WebP] ${(originalSize / 1024).toFixed(0)}KB → ${(webpBuffer.length / 1024).toFixed(0)}KB (${savedPct}% saved)`);
    } else {
      // WebP is larger — fallback to JPEG optimize
      try {
        const jpegBuffer = await sharp(req.file.buffer)
          .rotate()
          .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75, progressive: true, mozjpeg: true })
          .toBuffer();

        if (jpegBuffer.length < originalSize) {
          req.file.buffer = jpegBuffer;
          req.file.size = jpegBuffer.length;
          req.file.mimetype = 'image/jpeg';
          req.file.originalname = req.file.originalname.replace(/\.(png|heic|heif)$/i, '.jpg');
        }
      } catch (jpegErr: any) {
        logger.warn('[Sharp] JPEG fallback failed (using original):', jpegErr.message);
      }
    }

    next();
  } catch (error: any) {
    // Unexpected error — log and return 400 (don't pass corrupted data through)
    logger.error('[Sharp] Unexpected optimization error:', error);
    res.status(400).json({
      status: 'ERROR',
      code: 'IMAGE_PROCESSING_ERROR',
      message: 'فشل معالجة الصورة. يرجى المحاولة مرة أخرى.',
    });
  }
};

export const generateServerThumbnail = async (
  buffer: Buffer,
  size = 200,
): Promise<Buffer> => {
  return sharp(buffer)
    .rotate()
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 60 })
    .toBuffer();
};
