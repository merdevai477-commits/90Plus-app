/**
 * useReelUpload Hook  (Fix 1 + Fix 9)
 *
 * Handles reel upload with:
 * - Accurate XHR progress (10-85% upload, 85-90% saving, 90-99% processing)
 * - Polls GET /api/upload/reels/:id/status every 3s after upload
 * - Timeout polling after 5 minutes
 * - Stage labels in Arabic
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

export type ReelUploadStage =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'saving'
  | 'processing'
  | 'ready'
  | 'failed';

export interface ReelUploadState {
  stage: ReelUploadStage;
  progress: number; // 0-100
  label: string;
  reelId: string | null;
  error: string | null;
}

export interface ReelUploadOptions {
  videoUri: string;
  thumbnailUri?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  onProgress?: (state: ReelUploadState) => void;
}

export interface UseReelUploadReturn {
  upload: (options: ReelUploadOptions) => Promise<{ success: boolean; reelId?: string; error?: string }>;
  cancel: () => void;
  state: ReelUploadState;
  reset: () => void;
}

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_UPLOAD_RETRIES = 2; // إعادة المحاولة مرتين عند فشل الشبكة

const STAGE_LABELS: Record<ReelUploadStage, string> = {
  idle: '',
  preparing: 'جاري التحضير...',
  uploading: 'جاري الرفع...',
  saving: 'جاري الحفظ...',
  processing: 'جاري المعالجة...',
  ready: 'تم الرفع ✅',
  failed: 'فشل الرفع ❌',
};

const INITIAL_STATE: ReelUploadState = {
  stage: 'idle',
  progress: 0,
  label: '',
  reelId: null,
  error: null,
};

export function useReelUpload(): UseReelUploadReturn {
  const { getToken } = useAuth();
  const [state, setState] = useState<ReelUploadState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateState = useCallback(
    (patch: Partial<ReelUploadState>, onProgress?: (s: ReelUploadState) => void) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        next.label = STAGE_LABELS[next.stage] || '';
        onProgress?.(next);
        return next;
      });
    },
    [],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollTimerRef.current = null;
    pollTimeoutRef.current = null;
  }, []);

  const pollStatus = useCallback(
    (
      reelId: string,
      token: string,
      onProgress?: (s: ReelUploadState) => void,
    ): void => {
      const apiUrl = getApiUrl();

      const poll = async () => {
        try {
          const res = await fetch(`${apiUrl}/upload/reels/${reelId}/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

          const data = await res.json();
          const status: string = data?.data?.status ?? 'PROCESSING';

          if (status === 'READY') {
            stopPolling();
            updateState({ stage: 'ready', progress: 100, reelId }, onProgress);
            return;
          }

          if (status === 'FAILED') {
            stopPolling();
            updateState({ stage: 'failed', progress: 0, error: 'فشلت معالجة الفيديو' }, onProgress);
            return;
          }

          // Still PROCESSING – schedule next poll
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (err: any) {
          logger.warn('[useReelUpload] Poll error:', err?.message);
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      // Start polling
      updateState({ stage: 'processing', progress: 90, reelId }, onProgress);
      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);

      // Timeout after 5 minutes
      pollTimeoutRef.current = setTimeout(() => {
        stopPolling();
        updateState(
          { stage: 'failed', progress: 0, error: 'انتهت مهلة المعالجة. تحقق من الفيديو لاحقاً.' },
          onProgress,
        );
      }, POLL_TIMEOUT_MS);
    },
    [stopPolling, updateState],
  );

  const upload = useCallback(
    async (options: ReelUploadOptions): Promise<{ success: boolean; reelId?: string; error?: string }> => {
      const { videoUri, thumbnailUri, caption, hashtags, mentions, onProgress } = options;

      // Helper: execute one XHR upload attempt
      const attemptUpload = (token: string, attemptNum: number): Promise<{ success: boolean; reelId?: string; error?: string; retryable?: boolean }> => {
        return new Promise((resolve) => {
          const formData = new FormData();
          const videoFilename = videoUri.split('/').pop() || 'reel.mp4';
          formData.append('video', { uri: videoUri, name: videoFilename, type: 'video/mp4' } as any);

          if (thumbnailUri) {
            const thumbFilename = thumbnailUri.split('/').pop() || 'thumb.jpg';
            formData.append('thumbnail', { uri: thumbnailUri, name: thumbFilename, type: 'image/jpeg' } as any);
          }
          if (caption) formData.append('caption', caption);
          if (hashtags?.length) formData.append('hashtags', JSON.stringify(hashtags));
          if (mentions?.length) formData.append('mentions', JSON.stringify(mentions));

          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.timeout = 15 * 60 * 1000; // 15 min

          // Map XHR progress to 10-85%
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const raw = event.loaded / event.total;
              const mapped = 10 + raw * 75;
              updateState({ stage: 'uploading', progress: Math.round(mapped) }, onProgress);
            }
          });

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                updateState({ stage: 'saving', progress: 88 }, onProgress);
                const data = JSON.parse(xhr.responseText);
                if (data.status === 'SUCCESS') {
                  resolve({ success: true, reelId: data.data?.reelId });
                } else {
                  // أخطاء business logic (cooldown, quota) — لا تعيد المحاولة
                  resolve({ success: false, error: data.message || 'Upload failed', retryable: false });
                }
              } catch {
                resolve({ success: false, error: 'Invalid server response', retryable: false });
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                // 5xx = server error قابل للإعادة، 4xx = client error لا تعيد
                const retryable = xhr.status >= 500 || xhr.status === 502 || xhr.status === 503;
                resolve({ success: false, error: err.message || `Upload failed: ${xhr.status}`, retryable });
              } catch {
                resolve({ success: false, error: `Upload failed: ${xhr.status}`, retryable: xhr.status >= 500 });
              }
            }
          };

          xhr.onerror = () => resolve({ success: false, error: 'فشل الاتصال بالشبكة. تحقق من اتصالك.', retryable: true });
          xhr.ontimeout = () => resolve({ success: false, error: 'انتهت مهلة الرفع. حاول مرة أخرى.', retryable: true });
          xhr.onabort = () => resolve({ success: false, error: 'تم إلغاء الرفع', retryable: false });

          xhr.open('POST', `${getApiUrl()}/upload/reel`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);

          abortRef.current!.signal.addEventListener('abort', () => xhr.abort());
        });
      };

      try {
        updateState({ stage: 'preparing', progress: 0, error: null, reelId: null }, onProgress);

        const token = await getToken();
        if (!token) throw new Error('Authentication required');

        abortRef.current = new AbortController();

        let result: { success: boolean; reelId?: string; error?: string; retryable?: boolean } = { success: false, error: 'Unknown error' };

        for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES + 1; attempt++) {
          if (attempt > 1) {
            // إعادة المحاولة مع رسالة واضحة
            const retryLabel = `إعادة المحاولة (${attempt - 1}/${MAX_UPLOAD_RETRIES})...`;
            updateState({ stage: 'uploading', progress: 5, error: null }, onProgress);
            logger.warn(`[useReelUpload] Retry attempt ${attempt - 1}/${MAX_UPLOAD_RETRIES}`);
            await new Promise(r => setTimeout(r, 1500 * attempt)); // تأخير متزايد
          }

          result = await attemptUpload(token, attempt);

          if (result.success) break;
          if (!result.retryable) break; // لا تعيد المحاولة لأخطاء business logic
          if (attempt > MAX_UPLOAD_RETRIES) break;
        }

        if (!result.success) {
          updateState({ stage: 'failed', progress: 0, error: result.error ?? 'Upload failed' }, onProgress);
          return { success: false, error: result.error };
        }

        // Start polling for processing status
        if (result.reelId) {
          pollStatus(result.reelId, token, onProgress);
        }

        return { success: true, reelId: result.reelId };
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        updateState({ stage: 'failed', progress: 0, error: msg }, onProgress);
        return { success: false, error: msg };
      }
    },
    [getToken, updateState, pollStatus],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  return { upload, cancel, state, reset };
}
