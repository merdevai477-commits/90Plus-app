import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { ChevronUp } from 'lucide-react-native';
import { toastManager } from '../../services/toastManager';
// Safe import for expo-av
let Video: any = null;
try {
  const ExpoAV = require('expo-av');
  Video = ExpoAV.Video;
} catch (e) {
  console.warn('[ReelsFeed] expo-av not available');
}

import { ReelItem } from './ReelItem';
import { CommentsModal } from './CommentsModal';
import { ReportModal } from './ReportModal';
import { useHaptics } from '../Home/useHaptics';

// Types
interface User {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  followers?: number;
  isFollowing?: boolean;
}

interface ReelData {
  id: string;
  user: User;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  likes: number;
  views: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  muted: boolean;
  description?: string;
  hashtags?: string[];
  location?: string;
  createdAt: Date;
}

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLORS = {
  primary: '#FFD700',
  background: '#000000',
};

// Main Reels Feed Component
export const ReelsFeed: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const videoRefs = useRef<Map<string, any>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const haptic = useHaptics();

  const [reels, setReels] = useState<ReelData[]>([
    {
      id: '1',
      user: {
        id: '1',
        name: 'محمد صلاح',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        verified: true,
        followers: 125000,
        isFollowing: false
      },
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=800&fit=crop',
      duration: 30,
      likes: 12400,
      views: 124000,
      comments: 892,
      shares: 234,
      liked: false,
      saved: false,
      muted: true,
      description: 'هدف رائع في المباراة النهائية! 🔥⚽',
      hashtags: ['كرة_القدم', 'أهداف', 'رياضة'],
      location: 'ستاد القاهرة',
      createdAt: new Date()
    },
    {
      id: '2',
      user: {
        id: '2',
        name: 'سارة أحمد',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b047?w=100&h=100&fit=crop',
        verified: false,
        followers: 8900,
        isFollowing: true
      },
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=800&fit=crop',
      duration: 25,
      likes: 8900,
      views: 89000,
      comments: 456,
      shares: 123,
      liked: true,
      saved: false,
      muted: false,
      description: 'تمرين اليوم كان قوي! 💪',
      hashtags: ['لياقة', 'صحة', 'تمارين'],
      location: 'نادي الجزيرة',
      createdAt: new Date()
    },
    {
      id: '3',
      user: {
        id: '3',
        name: 'أحمد حسن',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        verified: false,
        followers: 45600,
        isFollowing: false
      },
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=800&fit=crop',
      duration: 28,
      likes: 15600,
      views: 156000,
      comments: 1200,
      shares: 567,
      liked: false,
      saved: true,
      muted: true,
      description: 'لحظات لا تُنسى من البطولة',
      hashtags: ['بطولة', 'فوز', 'احتفال'],
      createdAt: new Date()
    }
  ]);

  // Video Ref Management
  const handleVideoRef = useCallback((ref: any, id: string) => {
    if (ref) {
      videoRefs.current.set(id, ref);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  // Handle Like
  const handleLike = useCallback((reelId: string) => {
    haptic.hapticFeedback();
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { 
            ...reel, 
            liked: !reel.liked, 
            likes: reel.liked ? reel.likes - 1 : reel.likes + 1 
          }
        : reel
    ));
    
    // Show success toast
    const reel = reels.find(r => r.id === reelId);
    if (reel && !reel.liked) {
      toastManager.showLikeSuccess();
    }
  }, [haptic, reels]);

  // Handle Mute Toggle
  const handleToggleMute = useCallback((reelId: string) => {
    haptic.hapticFeedback();
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { ...reel, muted: !reel.muted }
        : reel
    ));
  }, [haptic]);

  // Handle Save
  const handleSave = useCallback((reelId: string) => {
    haptic.hapticFeedback();
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { 
            ...reel, 
            saved: !reel.saved 
          }
        : reel
    ));
    
    // Show toast
    const saved = reels.find(r => r.id === reelId)?.saved;
    if (!saved) {
      toastManager.showSaveSuccess();
    }
  }, [haptic, reels]);

  // Handle Report
  const handleReport = useCallback((reason: string) => {
    console.log('Report submitted:', reason);
    toastManager.showReportSuccess();
  }, []);

  // Handle Share
  const handleShareReel = useCallback(async (reel: ReelData) => {
    haptic.hapticFeedback();
    
    try {
      const message = `شاهد هذا الفيديو الرائع من ${reel.user.name}!\n${reel.description || ''}\n\n`;
      const result = await Share.share({
        message,
        url: reel.videoUrl,
        title: 'مشاركة فيديو'
      });

      if (result.action === Share.sharedAction) {
        toastManager.showShareSuccess();
      }
    } catch (error) {
      toastManager.showError('خطأ', 'حدث خطأ أثناء المشاركة');
    }
  }, [haptic]);

  // Open Comments
  const openComments = useCallback((reelId: string) => {
    haptic.hapticFeedback();
    setSelectedReelId(reelId);
    setShowComments(true);
  }, [haptic]);

  // Open Report
  const openReport = useCallback((reelId: string) => {
    haptic.hapticFeedback();
    setSelectedReelId(reelId);
    setShowReport(true);
  }, [haptic]);

  // Handle Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.hapticFeedback();
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Load new content...
    
    setIsRefreshing(false);
  }, [haptic]);

  // Update current index
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const renderItem = useCallback(({ item, index }: { item: ReelData; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex}
      onLike={() => handleLike(item.id)}
      onToggleMute={() => handleToggleMute(item.id)}
      onComment={() => openComments(item.id)}
      onReport={() => openReport(item.id)}
      onShare={() => handleShareReel(item)}
      onSave={() => handleSave(item.id)}
      onVideoRef={handleVideoRef}
    />
  ), [currentIndex, handleLike, handleToggleMute, openComments, openReport, handleShareReel, handleSave, handleVideoRef]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: ReelData) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Progress Indicators */}
      <View style={styles.progressContainer}>
        {reels.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressBar,
              index === currentIndex && styles.progressBarActive,
              index < currentIndex && styles.progressBarCompleted
            ]}
          />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reels</Text>
      </View>

      {/* Reels List */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === 'android'}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
      />

      {/* Swipe Hint */}
      {currentIndex === 0 && (
        <View style={styles.swipeHint}>
          <ChevronUp size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.swipeHintText}>اسحب للأعلى</Text>
        </View>
      )}

      {/* Comments Modal */}
      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        reelId={selectedReelId}
      />

      {/* Report Modal */}
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        reelId={selectedReelId}
        onReport={handleReport}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressContainer: {
    position: 'absolute',
    top: 95,
    right: 16,
    zIndex: 100,
    gap: 4,
  },
  progressBar: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  progressBarActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  progressBarCompleted: {
    backgroundColor: 'rgba(255,215,0,0.6)',
  },
  swipeHint: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
});
