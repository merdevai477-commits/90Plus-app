import { getApiUrl } from '../../config/api.config';
import { logger } from './logger';

const API_URL = getApiUrl();

export interface UploadResult {
    success: boolean;
    url?: string;
    storagePath?: string;
    error?: string;
}

/**
 * Storage Service for uploading files to Supabase via Backend
 */
export class StorageService {
    /**
     * Upload avatar image
     */
    static async uploadAvatar(token: string, imageUri: string): Promise<UploadResult> {
        try {
            const formData = new FormData();

            // Create file object for upload
            const filename = imageUri.split('/').pop() || 'avatar.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('file', {
                uri: imageUri,
                name: filename,
                type,
            } as any);

            // Don't set Content-Type header - let fetch API set it automatically with boundary
            const response = await fetch(`${API_URL}/upload/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Content-Type will be set automatically by fetch with boundary
                },
                body: formData,
            });

            // Check response status first
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Upload avatar failed:', response.status, errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Upload failed' };
                }
                return { success: false, error: errorData.message || `Upload failed: ${response.status}` };
            }
            
            const data = await response.json();
            
            logger.info('Upload avatar response:', JSON.stringify(data));
            
            if (data.status === 'SUCCESS') {
                // Handle both response formats: data.data.url and data.data.url
                const avatarUrl = data.data?.url || data.data?.avatarUrl || data.url;
                const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                
                if (!avatarUrl) {
                    logger.error('No URL in response:', data);
                    return { success: false, error: 'No URL returned from server' };
                }
                
                logger.info('Avatar uploaded successfully:', avatarUrl);
                
                return {
                    success: true,
                    url: avatarUrl,
                    storagePath: storagePath,
                };
            }
            
            return { success: false, error: data.message || 'Upload failed' };
        } catch (error: any) {
            logger.error('Upload avatar error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload cover image
     */
    static async uploadCover(token: string, imageUri: string): Promise<UploadResult> {
        try {
            const formData = new FormData();
            
            const filename = imageUri.split('/').pop() || 'cover.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('file', {
                uri: imageUri,
                name: filename,
                type,
            } as any);

            // Don't set Content-Type header - let fetch API set it automatically with boundary
            const response = await fetch(`${API_URL}/upload/cover`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Content-Type will be set automatically by fetch with boundary
                },
                body: formData,
            });

            // Check response status first
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Upload cover failed:', response.status, errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Upload failed' };
                }
                return { success: false, error: errorData.message || `Upload failed: ${response.status}` };
            }
            
            const data = await response.json();
            
            logger.info('Upload cover response:', JSON.stringify(data));
            
            if (data.status === 'SUCCESS') {
                // Handle both response formats: data.data.url and data.data.coverUrl
                const coverUrl = data.data?.url || data.data?.coverUrl || data.url;
                const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                
                if (!coverUrl) {
                    logger.error('No URL in response:', data);
                    return { success: false, error: 'No URL returned from server' };
                }
                
                logger.info('Cover uploaded successfully:', coverUrl);
                
                return {
                    success: true,
                    url: coverUrl,
                    storagePath: storagePath,
                };
            }
            
            return { success: false, error: data.message || 'Upload failed' };
        } catch (error: any) {
            logger.error('Upload cover error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload reel video
     */
    static async uploadReel(
        token: string, 
        videoUri: string, 
        thumbnailUri?: string,
        caption?: string,
        hashtags?: string[],
        mentions?: string[]
    ): Promise<UploadResult & { reelId?: string }> {
        try {
            const formData = new FormData();
            
            // Add video
            const videoFilename = videoUri.split('/').pop() || 'reel.mp4';
            formData.append('video', {
                uri: videoUri,
                name: videoFilename,
                type: 'video/mp4',
            } as any);

            // Add thumbnail if provided
            if (thumbnailUri) {
                const thumbFilename = thumbnailUri.split('/').pop() || 'thumb.jpg';
                formData.append('thumbnail', {
                    uri: thumbnailUri,
                    name: thumbFilename,
                    type: 'image/jpeg',
                } as any);
            }

            // Add metadata
            if (caption) formData.append('caption', caption);
            if (hashtags) formData.append('hashtags', JSON.stringify(hashtags));
            if (mentions) formData.append('mentions', JSON.stringify(mentions));

            // Get upload timeout from config (15 minutes)
            const { getAPIConfig } = require('../../config/api.config');
            const config = getAPIConfig();
            const uploadTimeout = config.uploadTimeout || 15 * 60 * 1000; // Default 15 minutes

            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);

            try {
                // Don't set Content-Type header - let fetch API set it automatically with boundary
                const response = await fetch(`${API_URL}/upload/reel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        // Content-Type will be set automatically by fetch with boundary
                    },
                    body: formData,
                    signal: controller.signal, // Add abort signal for timeout
                });

                clearTimeout(timeoutId);

            // Check response status first
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Upload reel failed:', response.status, errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Upload failed' };
                }
                return { success: false, error: errorData.message || `Upload failed: ${response.status}` };
            }
            
            const data = await response.json();
            
            logger.info('Upload reel response:', JSON.stringify(data));
            
            if (data.status === 'SUCCESS') {
                // Handle response format from upload.routes.ts
                const videoUrl = data.data?.videoUrl || data.data?.url || data.url;
                const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                const reelId = data.data?.reelId || data.reelId;
                
                if (!videoUrl) {
                    logger.error('No video URL in response:', data);
                    return { success: false, error: 'No video URL returned from server' };
                }
                
                logger.info('Reel uploaded successfully:', { videoUrl, reelId });
                
                return {
                    success: true,
                    url: videoUrl,
                    storagePath: storagePath,
                    reelId: reelId,
                };
            }
            
            return { success: false, error: data.message || 'Upload failed' };
        } catch (error: any) {
            logger.error('Upload reel error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default StorageService;
