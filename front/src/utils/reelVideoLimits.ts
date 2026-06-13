import * as FileSystem from 'expo-file-system/legacy';

/** Must match backend POST /api/upload/reel (50MB). */
export const MAX_REEL_VIDEO_MB = 50;
export const MAX_REEL_VIDEO_BYTES = MAX_REEL_VIDEO_MB * 1024 * 1024;

const STAGED_URI_MARKER = 'reel-upload-';

export function formatVideoSizeMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.0';
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** Safe i18n replace — never throws if template is missing placeholders. */
export function formatReelTooLargeMessage(template: string, sizeBytes: number): string {
  const safeTemplate =
    template?.trim() ||
    'حجم الفيديو {size} ميجا — الحد الأقصى {max} ميجا. اختر فيديو أقصر أو بجودة أقل.';
  return safeTemplate
    .replace('{size}', formatVideoSizeMb(sizeBytes))
    .replace('{max}', String(MAX_REEL_VIDEO_MB));
}

/**
 * True when pickVideo already copied the file into app cache — skip re-copy on publish/upload.
 */
export function isStagedReelUploadUri(uri: string | null | undefined): boolean {
  if (!uri?.trim()) return false;
  return uri.includes(STAGED_URI_MARKER);
}

/**
 * Resolve video size in bytes. ImagePicker.fileSize is often missing on iOS —
 * fall back to FileSystem.getInfoAsync (metadata only — no full file read).
 */
export async function getVideoFileSizeBytes(
  uri: string,
  pickerFileSize?: number | null,
): Promise<number | null> {
  if (typeof pickerFileSize === 'number' && pickerFileSize > 0) {
    return pickerFileSize;
  }
  const trimmed = uri?.trim();
  if (!trimmed) return null;
  try {
    const info = await FileSystem.getInfoAsync(trimmed);
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
      return info.size;
    }
  } catch {
    // non-fatal
  }
  return null;
}

export function isReelVideoOverSizeLimit(sizeBytes: number): boolean {
  return sizeBytes > MAX_REEL_VIDEO_BYTES;
}

export type ReelSizeCheckResult =
  | { ok: true; sizeBytes: number | null }
  | { ok: false; sizeBytes: number };

/** Fast pre-staging check — rejects oversized files before any cache copy. */
export async function checkReelVideoSizeLimit(
  uri: string,
  pickerFileSize?: number | null,
): Promise<ReelSizeCheckResult> {
  const sizeBytes = await getVideoFileSizeBytes(uri, pickerFileSize);
  if (sizeBytes != null && isReelVideoOverSizeLimit(sizeBytes)) {
    return { ok: false, sizeBytes };
  }
  return { ok: true, sizeBytes };
}
