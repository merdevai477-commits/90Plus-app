/**
 * ProfileVideoGrid
 * Extracted from profile.tsx (Fix 10).
 * Handles the Videos and Saved tabs with their own local state.
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import VideoGrid from './VideoGrid';
import { ReelsService } from '../../src/services/authService';
import { logger } from '../../utils/logger';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';

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

/**
 * ProfileVideoGrid — renders the user's own uploaded videos.
 * The saved-videos state that was previously tracked here was never
 * rendered; it has been removed. Use ProfileSavedGrid for saved videos.
 */
export const ProfileVideoGrid: React.FC<Props> = ({
  myVideos,
  isDeleteMode,
  onDeleteVideo,
  getToken,
}) => {
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

/**
 * ProfileSavedGrid — lazy-loads and renders the user's saved reels.
 */
export const ProfileSavedGrid: React.FC<{
  getToken: () => Promise<string | null>;
  onCountChange?: (count: number) => void;
}> = ({ getToken, onCountChange }) => {
  const { t } = useTranslation();
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadSavedVideos = useCallback(async () => {
    setIsLoadingSaved(true);
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await ReelsService.getSavedReels(token);
      if (result) {
        setSavedVideos(result.savedReels);
        onCountChange?.(result.totalCount ?? result.savedReels.length);
      }
    } catch (error) {
      logger.error('Error loading saved videos:', error);
      setLoadError(t.profile.savedLoadFailed);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [getToken, onCountChange, t.profile.savedLoadFailed]);

  React.useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSavedVideos();
    }
  }, []);

  if (isLoadingSaved) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ProfileTheme.colors.neonBlue} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (savedVideos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>لا توجد مقاطع محفوظة</Text>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: ProfileTheme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
  },
});
