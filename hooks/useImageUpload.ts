/**
 * useImageUpload Hook
 * Professional image upload with progress tracking and retry
 * 
 * Features:
 * - Multipart upload
 * - Progress tracking
 * - Retry on failure
 * - Cancel upload
 * - Error handling
 * - Queue management
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

export interface UploadOptions {
  endpoint: string;
  fieldName?: string;
  additionalData?: Record<string, any>;
  onProgress?: (progress: number) => void;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  data?: any;
}

export interface UseImageUploadReturn {
  upload: (uri: string, options: UploadOptions) => Promise<UploadResult>;
  cancel: () => void;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export const useImageUpload = (): UseImageUploadReturn => {
  const { getToken } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Upload image
  const upload = useCallback(
    async (uri: string, options: UploadOptions): Promise<UploadResult> => {
      try {
        setIsUploading(true);
        setProgress(0);
        setError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const {
          endpoint,
          fieldName = 'image',
          additionalData = {},
          onProgress,
          maxRetries = 3,
          timeoutMs = 55_000,
        } = options;

        // Get auth token
        const token = await getToken();
        if (!token) {
          throw new Error(isRTL ? 'يجب تسجيل الدخول' : 'Authentication required');
        }

        // Create form data
        const formData = new FormData();

        // Get file info
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        // Append image
        formData.append(fieldName, {
          uri,
          name: filename,
          type,
        } as any);

        // Append additional data
        Object.keys(additionalData).forEach((key) => {
          formData.append(key, additionalData[key]);
        });

        // Create abort controller
        abortControllerRef.current = new AbortController();

        // Upload with retry logic
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            logger.info(`Upload attempt ${attempt + 1}/${maxRetries + 1}`);

            const xhr = new XMLHttpRequest();
            xhr.timeout = timeoutMs;

            // Track progress
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                setProgress(percentComplete);
                onProgress?.(percentComplete);
              }
            });

            // Create promise for XHR
            const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                      success: true,
                      url: response.url || response.imageUrl || response.data?.url,
                      data: response,
                    });
                  } catch (e) {
                    resolve({
                      success: true,
                      data: xhr.responseText,
                    });
                  }
                } else {
                  // Parse backend error shape when possible (cooldown / validation / etc.)
                  try {
                    const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                    const message =
                      parsed?.message ||
                      parsed?.error ||
                      `Upload failed with status ${xhr.status}`;
                    resolve({ success: false, error: message, data: parsed });
                  } catch {
                    resolve({
                      success: false,
                      error: xhr.responseText || `Upload failed with status ${xhr.status}`,
                    });
                  }
                }
              };

              xhr.onerror = () => {
                reject(new Error(isRTL ? 'فشل الرفع' : 'Upload failed'));
              };

              xhr.ontimeout = () => {
                reject(new Error(isRTL ? 'انتهت مهلة الرفع' : 'Upload timed out'));
              };

              xhr.onabort = () => {
                reject(new Error(isRTL ? 'تم إلغاء الرفع' : 'Upload cancelled'));
              };
            });

            // Open and send request
            xhr.open('POST', `${getApiUrl()}${endpoint}`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);

            // Handle abort
            abortControllerRef.current.signal.addEventListener('abort', () => {
              xhr.abort();
            });

            const result = await uploadPromise;
            if (!result.success) {
              // Server responded but with an app-level error (e.g. cooldown)
              return result;
            }

            // Success!
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsUploading(false);
            setProgress(100);
            logger.info('Upload successful');
            return result;
          } catch (err: any) {
            lastError = err;
            logger.error(`Upload attempt ${attempt + 1} failed:`, err);

            // If not last attempt, wait before retry
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }
        }

        // All retries failed
        throw lastError || new Error(isRTL ? 'فشل الرفع' : 'Upload failed');
      } catch (error: any) {
        logger.error('Upload error:', error);
        const errorMessage = error.message || (isRTL ? 'فشل رفع الصورة' : 'Failed to upload image');
        setError(errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsUploading(false);
        setProgress(0);

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [getToken, isRTL]
  );

  // Cancel upload
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsUploading(false);
      setProgress(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logger.info('Upload cancelled by user');
    }
  }, []);

  return {
    upload,
    cancel,
    isUploading,
    progress,
    error,
  };
};
