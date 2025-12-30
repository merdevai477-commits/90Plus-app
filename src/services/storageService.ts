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
     * Upload reel video with progress tracking
     */
    static async uploadReel(
        token: string, 
        videoUri: string, 
        thumbnailUri?: string,
        caption?: string,
        hashtags?: string[],
        mentions?: string[],
        onProgress?: (progress: number) => void
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

            // Use XMLHttpRequest for progress tracking
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                // Track upload progress
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable && onProgress) {
                        // Start from 30% (after thumbnail generation) and go to 90%
                        // Use Math.min to ensure we never exceed 90% during upload
                        const uploadProgress = 30 + Math.min(event.loaded / event.total, 1) * 60;
                        const progressValue = Math.min(Math.round(uploadProgress), 90); // Cap at 90%
                        onProgress(progressValue);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            
                            logger.info('Upload reel response:', JSON.stringify(data));
                            
                            if (data.status === 'SUCCESS') {
                                // Handle response format from upload.routes.ts
                                const videoUrl = data.data?.videoUrl || data.data?.url || data.url;
                                const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                                const reelId = data.data?.reelId || data.reelId;
                                
                                if (!videoUrl) {
                                    logger.error('No video URL in response:', data);
                                    resolve({ success: false, error: 'No video URL returned from server' });
                                    return;
                                }
                                
                                logger.info('Reel uploaded successfully:', { videoUrl, reelId });
                                
                                if (onProgress) onProgress(100);
                                
                                resolve({
                                    success: true,
                                    url: videoUrl,
                                    storagePath: storagePath,
                                    reelId: reelId,
                                });
                            } else {
                                resolve({ success: false, error: data.message || 'Upload failed' });
                            }
                        } catch (parseError) {
                            logger.error('Failed to parse upload response:', parseError);
                            resolve({ success: false, error: 'Invalid response from server' });
                        }
                    } else {
                        // Handle error response
                        let errorData;
                        try {
                            errorData = JSON.parse(xhr.responseText);
                        } catch {
                            errorData = { message: xhr.responseText || `Upload failed: ${xhr.status}` };
                        }
                        logger.error('Upload reel failed:', xhr.status, errorData);
                        resolve({ success: false, error: errorData.message || `Upload failed: ${xhr.status}` });
                    }
                });

                xhr.addEventListener('error', () => {
                    logger.error('Upload reel network error');
                    resolve({ success: false, error: 'Network error during upload' });
                });

                xhr.addEventListener('abort', () => {
                    logger.error('Upload reel aborted');
                    resolve({ success: false, error: 'Upload was cancelled' });
                });

                // Set timeout
                const timeoutId = setTimeout(() => {
                    xhr.abort();
                    logger.error('Upload reel timeout:', uploadTimeout);
                    resolve({ success: false, error: 'Upload timeout - request took too long' });
                }, uploadTimeout);

                xhr.open('POST', `${API_URL}/upload/reel`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                // Don't set Content-Type - let browser set it with boundary
                
                xhr.send(formData);
            });
        } catch (error: any) {
            logger.error('Upload reel error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default StorageService;
