import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

// Types
interface ReelData {
  id: string;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  muted: boolean;
}

interface VideoPlayerProps {
  reel: ReelData;
  isActive: boolean;
  onVideoRef: (ref: Video | null, id: string) => void;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  background: '#000000',
  error: '#FF5252',
};

// Enhanced Video Player Component
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  reel, 
  isActive, 
  onVideoRef 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (videoRef.current) {
      onVideoRef(videoRef.current, reel.id);
    }
    return () => {
      onVideoRef(null, reel.id);
    };
  }, [reel.id, onVideoRef]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive]);

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  const handleRetry = () => {
    setError(false);
    setIsLoading(true);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>فشل تحميل الفيديو</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetry}
        >
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <Video
        ref={videoRef}
        source={{ uri: reel.videoUrl }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive}
        isLooping={true}
        isMuted={reel.muted}
        onLoad={() => setIsLoading(false)}
        onError={handleError}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if ('isBuffering' in status) {
            setIsBuffering(status.isBuffering || false);
          }
        }}
        progressUpdateIntervalMillis={1000}
        positionMillis={0}
      />
      
      {/* Loading/Buffering Indicator */}
      {(isLoading || isBuffering) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {isLoading ? 'جاري التحميل...' : 'جاري التخزين المؤقت...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: '600',
  },
});
