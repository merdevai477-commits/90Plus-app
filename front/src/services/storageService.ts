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
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Upload failed' };
                }
                
                // Handle specific error codes
                if (response.status === 429 && errorData.code === 'COOLDOWN_ACTIVE') {
                    // This is a cooldown error - return the Arabic message from backend
                    // Don't log as error since this is expected behavior
                    logger.info('Avatar upload cooldown active:', errorData.message);
                    return { success: false, error: errorData.message };
                }
                
                logger.error('Upload avatar failed:', response.status, errorText);
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
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || 'Upload failed' };
                }
                
                // Handle specific error codes
                if (response.status === 429 && errorData.code === 'COOLDOWN_ACTIVE') {
                    // This is a cooldown error - return the Arabic message from backend
                    // Don't log as error since this is expected behavior
                    logger.info('Cover upload cooldown active:', errorData.message);
                    return { success: false, error: errorData.message };
                }
                
                logger.error('Upload cover failed:', response.status, errorText);
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
        _thumbnailUri?: string,
        caption?: string,
        hashtags?: string[],
        mentions?: string[],
        onProgress?: (progress: number) => void
    ): Promise<UploadResult & { reelId?: string }> {
        try {
            // ✅ Show "Preparing..." at the start
            if (onProgress) onProgress(5);

            const formData = new FormData();
            
            // ✅ Show "Compressing video..."
            if (onProgress) onProgress(10);
            
            // Add video
            const videoFilename = videoUri.split('/').pop() || 'reel.mp4';
            formData.append('video', {
                uri: videoUri,
                name: videoFilename,
                type: 'video/mp4',
            } as any);

            // ✅ Show "Uploading..."
            if (onProgress) onProgress(20);

            // Add metadata
            if (caption) formData.append('caption', caption);
            if (hashtags) formData.append('hashtags', JSON.stringify(hashtags));
            if (mentions) formData.append('mentions', JSON.stringify(mentions));

            // Get upload timeout from config (15 minutes)
            const { getAPIConfig } = require('../../config/api.config');
            const config = getAPIConfig();
            const uploadTimeout = config.uploadTimeout || 15 * 60 * 1000; // Default 15 minutes

            // Use XMLHttpRequest for progress tracking (single retry on transport failure)
            const sendOnce = (): Promise<UploadResult & { reelId?: string }> => new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.timeout = uploadTimeout;
                
                // ✅ IMPROVED: Better progress tracking
                const progressHandler = (event: ProgressEvent) => {
                    if (event.lengthComputable && event.total > 0 && onProgress) {
                        // 20% for preparation, 70% for upload, 10% for processing
                        const uploadProgress = 20 + (event.loaded / event.total) * 70;
                        const progressValue = Math.min(Math.round(uploadProgress), 90);
                        onProgress(progressValue);
                        
                        // ✅ Log for tracking
                        logger.info(`Upload progress: ${progressValue}% (${event.loaded}/${event.total} bytes)`);
                    }
                };
                
                const loadHandler = () => {
                    cleanup();
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            // ✅ Show "Processing..."
                            if (onProgress) onProgress(95);
                            
                            const data = JSON.parse(xhr.responseText);
                            
                            logger.info('Upload reel response:', JSON.stringify(data));
                            
                            if (data.status === 'SUCCESS') {
                                const videoUrl = data.data?.videoUrl || data.data?.url || data.url;
                                const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                                const reelId = data.data?.reelId || data.reelId;
                                
                                if (!videoUrl) {
                                    logger.error('No video URL in response:', data);
                                    resolve({ success: false, error: 'No video URL returned from server' });
                                    return;
                                }
                                
                                logger.info('Reel uploaded successfully:', { videoUrl, reelId });
                                
                                // ✅ Show "Upload complete!"
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
                        let errorData;
                        try {
                            errorData = JSON.parse(xhr.responseText);
                        } catch {
                            errorData = { message: xhr.responseText || `Upload failed: ${xhr.status}` };
                        }
                        // Arabic messages for common HTTP errors
                        let userMessage = errorData.message;
                        if (xhr.status === 413) {
                            userMessage = 'حجم الفيديو كبير جداً. الحد الأقصى 50MB.';
                        } else if (xhr.status === 429) {
                            userMessage = errorData.message || 'يرجى الانتظار قبل رفع فيديو جديد.';
                        } else if (xhr.status >= 500) {
                            userMessage = errorData.message || 'خطأ في الخادم. حاول مرة أخرى.';
                        }
                        logger.error('Upload reel failed:', xhr.status, errorData);
                        resolve({ success: false, error: userMessage || `Upload failed: ${xhr.status}` });
                    }
                };
                
                const errorHandler = () => {
                    cleanup();
                    logger.error('Upload reel network error');
                    resolve({ success: false, error: 'فشل الاتصال بالشبكة. تحقق من اتصالك وحاول مرة أخرى.' });
                };
                
                const abortHandler = () => {
                    cleanup();
                    logger.error('Upload reel aborted');
                    resolve({ success: false, error: 'Upload was cancelled' });
                };
                
                const cleanup = () => {
                    xhr.upload.removeEventListener('progress', progressHandler);
                    xhr.removeEventListener('load', loadHandler);
                    xhr.removeEventListener('error', errorHandler);
                    xhr.removeEventListener('abort', abortHandler);
                };

                xhr.upload.addEventListener('progress', progressHandler);
                xhr.addEventListener('load', loadHandler);
                xhr.addEventListener('error', errorHandler);
                xhr.addEventListener('abort', abortHandler);
                xhr.ontimeout = () => {
                    cleanup();
                    logger.error('Upload reel timeout (XHR):', uploadTimeout);
                    resolve({ success: false, error: 'انتهت مهلة الرفع. الفيديو كبير جداً أو الاتصال بطيء. حاول مرة أخرى.' });
                };

                xhr.open('POST', `${API_URL}/upload/reel`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                
                xhr.send(formData);
            });

            const first = await sendOnce();
            if (
                !first.success &&
                first.error &&
                (first.error.includes('Network') ||
                    first.error.includes('timeout') ||
                    first.error.includes('Upload timeout'))
            ) {
                logger.warn('Reel upload: retrying once after transport error');
                await new Promise(r => setTimeout(r, 1500));
                return sendOnce();
            }
            return first;
        } catch (error: any) {
            logger.error('Upload reel error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default StorageService;
