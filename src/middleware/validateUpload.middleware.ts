/**
 * validateUpload Middleware  (Fix 5)
 *
 * Reads magic bytes from the uploaded file buffer and verifies they match
 * the declared MIME type. Rejects with 400 if they don't match.
 *
 * Supported formats:
 *   JPEG  – FF D8 FF
 *   PNG   – 89 50 4E 47
 *   WebP  – RIFF....WEBP
 *   HEIC  – ftyp box with brand heic/heix/hevc/mif1 (iPhone default)
 *   MP4   – ftyp box at offset 4
 *   MOV   – ftyp box at offset 4 (QuickTime)
 *   WebM  – 1A 45 DF A3
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface MagicRule {
  mime: string | string[];
  check: (buf: Buffer) => boolean;
}

// HEIC/HEIF brands that iOS cameras produce
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // ftyp box: bytes 4-7 = 'ftyp', bytes 8-11 = brand
  if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
  const brand = buf.slice(8, 12).toString('ascii').toLowerCase().trim();
  return HEIC_BRANDS.includes(brand);
}

const MAGIC_RULES: MagicRule[] = [
  {
    mime: ['image/jpeg', 'image/jpg'],
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // HEIC / HEIF — iPhone default camera format
    mime: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
    check: isHeicBuffer,
  },
  {
    // MP4 / MOV — both use ftyp box at offset 4
    // Accept HEIC brand here too so iOS videos (which are MOV) pass
    mime: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
    check: (b) =>
      b.length >= 8 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
  {
    mime: 'video/webm',
    check: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
];

function mimeMatches(declared: string, buf: Buffer): boolean {
  const norm = declared.toLowerCase().split(';')[0].trim();

  // Special case: iOS sometimes sends HEIC with mime 'application/octet-stream'
  // or 'image/jpeg' — check actual bytes first
  if (isHeicBuffer(buf)) {
    // Accept if declared is any image type (iOS quirk)
    return norm.startsWith('image/') || norm === 'application/octet-stream';
  }

  for (const rule of MAGIC_RULES) {
    const mimes = Array.isArray(rule.mime) ? rule.mime : [rule.mime];
    if (mimes.includes(norm) && rule.check(buf)) return true;
  }
  return false;
}

// ─── Single-file middleware ───────────────────────────────────────────────────

export const validateUploadMagicBytes = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const file = req.file;
  if (!file) { next(); return; }

  if (!file.buffer || file.buffer.length < 12) {
    res.status(400).json({ status: 'ERROR', code: 'INVALID_FILE', message: 'File is too small or empty' });
    return;
  }

  if (!mimeMatches(file.mimetype, file.buffer)) {
    logger.warn('[MagicBytes] Mismatch', {
      declared: file.mimetype,
      userId: req.auth?.userId,
      filename: file.originalname,
      firstBytes: file.buffer.slice(0, 12).toString('hex'),
    });
    res.status(400).json({
      status: 'ERROR',
      code: 'INVALID_FILE_TYPE',
      message: 'File content does not match declared MIME type',
    });
    return;
  }

  next();
};

// ─── Multi-field middleware ───────────────────────────────────────────────────

export const validateUploadFieldsMagicBytes = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  if (!files) { next(); return; }

  const toCheck: Express.Multer.File[] = [
    ...(files['video'] ?? []),
    ...(files['thumbnail'] ?? []),
    ...(files['file'] ?? []),
  ];

  for (const file of toCheck) {
    if (!file.buffer || file.buffer.length < 12) {
      res.status(400).json({
        status: 'ERROR',
        code: 'INVALID_FILE',
        message: `File "${file.fieldname}" is too small or empty`,
      });
      return;
    }

    if (!mimeMatches(file.mimetype, file.buffer)) {
      logger.warn('[MagicBytes] Mismatch in fields', {
        field: file.fieldname,
        declared: file.mimetype,
        userId: req.auth?.userId,
        firstBytes: file.buffer.slice(0, 12).toString('hex'),
      });
      res.status(400).json({
        status: 'ERROR',
        code: 'INVALID_FILE_TYPE',
        message: `File "${file.fieldname}" content does not match declared MIME type`,
      });
      return;
    }
  }

  next();
};
