import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../../utils/logger';

export type ResolvedVideoUpload = {
  uri: string;
  name: string;
  type: string;
};

function inferMimeAndName(
  sourceUri: string,
  mimeType?: string | null,
  fileName?: string | null,
): { name: string; type: string } {
  const nameFromUri = sourceUri.split('/').pop()?.split('?')[0] || '';
  const name = (fileName || nameFromUri || 'reel.mp4').trim();
  const ext = (name.includes('.') ? name.split('.').pop() : '')?.toLowerCase() || '';

  if (mimeType?.trim()) {
    return { name, type: mimeType.trim() };
  }
  if (ext === 'mov') return { name, type: 'video/quicktime' };
  if (ext === 'm4v') return { name, type: 'video/x-m4v' };
  if (ext === 'webm') return { name, type: 'video/webm' };
  return { name, type: 'video/mp4' };
}

/**
 * Normalize a picked video URI for multipart upload (especially iOS).
 * Copies into cache so temp/editor URIs are not deleted before XHR finishes.
 */
export async function resolveVideoUploadSource(
  sourceUri: string,
  options?: { mimeType?: string | null; fileName?: string | null },
): Promise<ResolvedVideoUpload> {
  const trimmed = sourceUri?.trim();
  if (!trimmed) {
    throw new Error('Missing video URI');
  }

  const { name, type } = inferMimeAndName(trimmed, options?.mimeType, options?.fileName);
  const ext = name.includes('.') ? name.split('.').pop()! : type.includes('quicktime') ? 'mov' : 'mp4';
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    return { uri: trimmed, name, type };
  }

  const destPath = `${cacheDir}reel-upload-${Date.now()}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: trimmed, to: destPath });
    const info = await FileSystem.getInfoAsync(destPath);
    if (!info.exists || !('size' in info) || !info.size) {
      throw new Error('Staged video file is empty');
    }
    const uri = destPath.startsWith('file://') ? destPath : `file://${destPath}`;
    logger.info('[videoUpload] Copied video to cache for upload', {
      platform: Platform.OS,
      type,
      name,
    });
    return { uri, name, type };
  } catch (err) {
    logger.warn('[videoUpload] copyAsync failed, using original URI', err);
    return { uri: trimmed, name, type };
  }
}
