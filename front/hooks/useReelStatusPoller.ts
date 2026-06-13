/**
 * useReelStatusPoller
 *
 * UX Fix 4: Polls GET /api/upload/reels/:id/status every 3s after upload.
 * Returns the current processing stage and elapsed time.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

export type ReelProcessingStage = 'uploading' | 'processing' | 'ready' | 'failed' | 'idle';

export interface ReelStatusResult {
  stage: ReelProcessingStage;
  /** Elapsed seconds since polling started */
  elapsedSeconds: number;
  /** Arabic label for the current stage */
  stageLabel: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  muxPlaybackId: string | null;
}

const STAGE_LABELS: Record<ReelProcessingStage, string> = {
  uploading: 'جاري الرفع...',
  processing: 'جاري المعالجة...',
  ready: 'جاهز! ✅',
  failed: 'فشل الرفع ❌',
  idle: '',
};

function patchIfChanged<T>(prev: T, next: T): T {
  return Object.is(prev, next) ? prev : next;
}

export function useReelStatusPoller(
  reelId: string | null,
  getToken: () => Promise<string | null>,
  enabled = true,
): ReelStatusResult {
  const [stage, setStage] = useState<ReelProcessingStage>('uploading');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const reelIdRef = useRef(reelId);
  reelIdRef.current = reelId;

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (elapsedIntervalRef.current) { clearInterval(elapsedIntervalRef.current); elapsedIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    stopPolling();
    if (!reelId || !enabled) {
      setStage('idle');
      setElapsedSeconds(0);
      setVideoUrl(null);
      setThumbnailUrl(null);
      setMuxPlaybackId(null);
      return;
    }

    const pollOnce = async () => {
      const activeReelId = reelIdRef.current;
      if (!activeReelId || !isMountedRef.current) return;
      try {
        const token = await getTokenRef.current();
        if (!token || !isMountedRef.current) return;
        const res = await fetch(`${getApiUrl()}/upload/reels/${activeReelId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !isMountedRef.current) return;
        const json = await res.json();
        const data = json?.data;
        if (!data || !isMountedRef.current) return;

        const status: string = data.status ?? 'PROCESSING';
        const hasMuxPlayback = !!data.muxPlaybackId;

        let newStage: ReelProcessingStage = 'uploading';
        if (status === 'READY') newStage = 'ready';
        else if (status === 'FAILED') newStage = 'failed';
        else if (hasMuxPlayback || data.muxUploadId) newStage = 'processing';
        else newStage = 'uploading';

        if (!isMountedRef.current) return;
        setStage(prev => patchIfChanged(prev, newStage));
        setVideoUrl(prev => patchIfChanged(prev, data.videoUrl ?? null));
        setThumbnailUrl(prev => patchIfChanged(prev, data.thumbnailUrl ?? null));
        setMuxPlaybackId(prev => patchIfChanged(prev, data.muxPlaybackId ?? null));

        if (newStage === 'ready' || newStage === 'failed') {
          stopPolling();
        }
      } catch (err) {
        logger.warn('[useReelStatusPoller] Poll error:', err);
      }
    };

    startTimeRef.current = Date.now();
    setStage('uploading');
    setElapsedSeconds(0);

    pollOnce();
    pollIntervalRef.current = setInterval(pollOnce, 3000);

    elapsedIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const next = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(prev => patchIfChanged(prev, next));
    }, 1000);

    return stopPolling;
  }, [reelId, enabled, stopPolling]);

  const stageLabel = stage === 'processing' && elapsedSeconds > 0
    ? `${STAGE_LABELS.processing} (${elapsedSeconds} ثانية)`
    : STAGE_LABELS[stage];

  return { stage, elapsedSeconds, stageLabel, videoUrl, thumbnailUrl, muxPlaybackId };
}
