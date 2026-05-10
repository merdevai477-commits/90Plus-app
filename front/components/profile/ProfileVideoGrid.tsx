/**
 * ProfileVideoGrid
 * Extracted from profile.tsx (Fix 10).
 * Handles the Videos and Saved tabs with their own local state.
 */
import React, { useState, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import VideoGrid from './VideoGrid';
import { ReelsService } from '../../src/services/authService';
import { logger } from '../../utils/logger';

interface VideoItem {
  id: string;
  thumbnail: string | null;
  views: string;
  duration: string;
  isUploading?: boolean;
  uploadProgress?: number;
}

interface Props {
  myVideos: VideoItem[];
  isDeleteMode: boolean;
  onDeleteVideo: (videoId: string) => void;
  getToken: () => Promise<string | null>;
}

export const ProfileVideoGrid: React.FC<Props> = ({
  myVideos,
  isDeleteMode,
  onDeleteVideo,
  getToken,
}) => {
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savedVideosCursor, setSavedVideosCursor] = useState<string | null>(null);
  const [hasMoreSaved, setHasMoreSaved] = useState(true);
  const hasLoadedSavedRef = useRef(false);

  const loadSavedVideos = useCallback(async (cursor?: string) => {
    setIsLoadingSaved(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await ReelsService.getSavedReels(token, cursor);
      if (result) {
        if (cursor) {
          setSavedVideos(prev => [...prev, ...result.savedReels]);
        } else {
          setSavedVideos(result.savedReels);
        }
        setSavedVideosCursor(result.nextCursor);
        setHasMoreSaved(result.hasMore);
      }
    } catch (error) {
      logger.error('Error loading saved videos:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [getToken]);

  // Lazy-load saved videos on first render of this component
  React.useEffect(() => {
    if (!hasLoadedSavedRef.current && !isLoadingSaved) {
      hasLoadedSavedRef.current = true;
      loadSavedVideos();
    }
  }, []);

  return (
    <VideoGrid
      videos={myVideos}
      onVideoPress={(video) => {
        router.push({
          pathname: '/(tabs)/reels',
          params: { reelId: video.id },
        });
      }}
      onVideoLongPress={() => {}}
      onDeleteVideo={onDeleteVideo}
      isDeleteMode={isDeleteMode}
    />
  );
};

export const ProfileSavedGrid: React.FC<{ getToken: () => Promise<string | null> }> = ({ getToken }) => {
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadSavedVideos = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await ReelsService.getSavedReels(token);
      if (result) setSavedVideos(result.savedReels);
    } catch (error) {
      logger.error('Error loading saved videos:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [getToken]);

  React.useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSavedVideos();
    }
  }, []);

  return (
    <VideoGrid
      videos={savedVideos.map((video: any) => ({
        id: video.id,
        thumbnail: video.thumbnail || '',
        views: video.views?.toString() || '0',
        duration: '',
      }))}
      onVideoPress={(video) => {
        router.push({
          pathname: '/(tabs)/reels',
          params: { reelId: video.id },
        });
      }}
      onVideoLongPress={() => {}}
      onDeleteVideo={() => {}}
      isDeleteMode={false}
    />
  );
};
