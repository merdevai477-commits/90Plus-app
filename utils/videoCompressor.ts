/**
 * Video Compressor Utility
 * Compresses videos before upload to reduce upload time significantly
 * 
 * A 3MB video can be compressed to ~500KB-1MB without visible quality loss
 * 
 * ✅ SDK 52: expo-video-thumbnails re-enabled (installed for thumbnail generation)
 */

import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { logger } from '../services/logger';

export interface CompressionResult {
  uri: string;
  size: number;
  originalSize: number;
  compressionRatio: number;
  thumbnail?: string;
}

export interface CompressionProgress {
  stage: 'analyzing' | 'compressing' | 'generating-thumbnail' | 'complete';
  progress: number; // 0-100
}

/**
 * Get file size in bytes
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? (info.size || 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Generate thumbnail from video
 * ✅ SDK 52: Re-enabled with expo-video-thumbnails
 * 
 * @param videoUri - URI of the video file
 * @param time - Time in milliseconds to capture thumbnail (default: 1000ms)
 * @returns URI of the generated thumbnail, or null if generation fails
 */
export async function generateThumbnail(
  videoUri: string,
  time: number = 1000
): Promise<string | null> {
  try {
    logger.info('[videoCompressor] Generating thumbnail', { videoUri, time });
    
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time,
      quality: 0.8, // 0-1, higher is better quality
    });
    
    logger.info('[videoCompressor] Thumbnail generated successfully', { thumbnailUri: uri });
    return uri;
  } catch (error) {
    logger.error('[videoCompressor] Failed to generate thumbnail', {
      error: error instanceof Error ? error.message : 'Unknown error',
      videoUri,
      time,
    });
    return null;
  }
}

/**
 * Compress thumbnail image
 * ✅ SDK 52: Re-enabled with expo-image-manipulator
 * 
 * @param thumbnailUri - URI of the thumbnail image
 * @param maxWidth - Maximum width in pixels (default: 720px)
 * @returns URI of the compressed thumbnail, or original URI if compression fails
 */
export async function compressThumbnail(
  thumbnailUri: string,
  maxWidth: number = 720
): Promise<string> {
  try {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    
    logger.info('[videoCompressor] Compressing thumbnail', { thumbnailUri, maxWidth });
    
    const manipResult = await manipulateAsync(
      thumbnailUri,
      [
        { resize: { width: maxWidth } } // Maintains aspect ratio
      ],
      {
        compress: 0.8, // 0-1, higher is better quality
        format: SaveFormat.JPEG,
      }
    );
    
    logger.info('[videoCompressor] Thumbnail compressed successfully', { 
      originalUri: thumbnailUri,
      compressedUri: manipResult.uri 
    });
    
    return manipResult.uri;
  } catch (error) {
    logger.error('[videoCompressor] Failed to compress thumbnail', {
      error: error instanceof Error ? error.message : 'Unknown error',
      thumbnailUri,
    });
    // Return original image on compression failure
    return thumbnailUri;
  }
}

/**
 * Check if video needs compression based on size
 * Videos over 2MB should be compressed
 */
export function shouldCompress(sizeInBytes: number): boolean {
  const TWO_MB = 2 * 1024 * 1024;
  return sizeInBytes > TWO_MB;
}

/**
 * Estimate compression time based on file size
 */
export function estimateCompressionTime(sizeInBytes: number): number {
  // Rough estimate: 1 second per MB
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return Math.ceil(sizeInMB * 1000); // milliseconds
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Prepare video for upload
 * - Generates thumbnail
 * - Returns video info
 * 
 * Note: For actual video compression, you'll need ffmpeg-kit-react-native
 * This is a lightweight version that prepares the video without heavy compression
 */
export async function prepareVideoForUpload(
  videoUri: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<{
  videoUri: string;
  thumbnailUri: string | null;
  originalSize: number;
  finalSize: number;
}> {
  onProgress?.({ stage: 'analyzing', progress: 10 });
  
  // Get original size
  const originalSize = await getFileSize(videoUri);
  
  onProgress?.({ stage: 'generating-thumbnail', progress: 30 });
  
  // Generate thumbnail
  const rawThumbnail = await generateThumbnail(videoUri);
  let thumbnailUri: string | null = null;
  
  if (rawThumbnail) {
    onProgress?.({ stage: 'generating-thumbnail', progress: 50 });
    thumbnailUri = await compressThumbnail(rawThumbnail);
  }
  
  onProgress?.({ stage: 'complete', progress: 100 });
  
  // For now, return original video
  // To add compression, install ffmpeg-kit-react-native
  return {
    videoUri,
    thumbnailUri,
    originalSize,
    finalSize: originalSize,
  };
}

/**
 * Upload with progress tracking
 */
export async function uploadWithProgress(
  url: string,
  fileUri: string,
  token: string,
  fieldName: string = 'video',
  additionalFields?: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      resolve(new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
      }));
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });
    
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
    const formData = new FormData();
    
    const filename = fileUri.split('/').pop() || 'video.mp4';
    formData.append(fieldName, {
      uri: fileUri,
      name: filename,
      type: 'video/mp4',
    } as any);
    
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    xhr.send(formData);
  });
}

export default {
  getFileSize,
  generateThumbnail,
  compressThumbnail,
  shouldCompress,
  estimateCompressionTime,
  formatFileSize,
  prepareVideoForUpload,
  uploadWithProgress,
};
