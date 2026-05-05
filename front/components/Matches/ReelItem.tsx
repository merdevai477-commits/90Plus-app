import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  MoreVertical, 
  Eye, 
  CheckCircle 
} from 'lucide-react-native';

import { SafeVideoPlayer as UnifiedVideoPlayer } from '../common/SafeVideoPlayer';
import { ActionButton } from './ActionButton';
import { DoubleTapLikeAnimation } from './DoubleTapAnimation';
import { useHaptics } from '../Home/useHaptics';
import { globalState } from '../../globalState';

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

interface ReelItemProps {
  reel: ReelData;
  isActive: boolean;
  onLike: () => void;
  onToggleMute: () => void;
  onComment: () => void;
  onReport: () => void;
  onShare: () => void;
  onSave: () => void;
  onVideoRef: (ref: any, id: string) => void;
  /** Current user's ID - used to hide follow button on own reels */
  currentUserId?: string;
}

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLORS = {
  primary: '#FFD700',
  error: '#FF5252',
  info: '#2196F3',
  background: '#000000',
};

// Helper function to format numbers
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

// Main Reel Item Component
export const ReelItem: React.FC<ReelItemProps> = ({ 
  reel, 
  isActive,
  currentUserId, 
  onLike, 
  onToggleMute, 
  onComment, 
  onReport, 
  onShare,
  onSave,
  onVideoRef 
}) => {
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const haptic = useHaptics();

  const handleDoubleTap = (event: any) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      haptic.hapticFeedback();
      
      setTapPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY
      });
      
      if (!reel.liked) {
        onLike();
      }
      
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1500);
    }
    lastTapRef.current = now;
  };

  return (
    <View style={styles.reelContainer}>
      {/* Video */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={handleDoubleTap}
        style={styles.videoWrapper}
      >
        <UnifiedVideoPlayer 
          reel={{
            id: reel.id,
            videoUrl: reel.videoUrl,
            thumbnail: reel.thumbnail,
            duration: reel.duration,
            muted: reel.muted,
          }}
          isActive={isActive}
          onVideoRef={onVideoRef}
        />
      </TouchableOpacity>

      {/* Double Tap Heart Animation */}
      <DoubleTapLikeAnimation 
        visible={showHeartAnimation}
        position={tapPosition}
      />

      {/* Gradients */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={[styles.topGradient, { pointerEvents: 'none' }]}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[styles.bottomGradient, { pointerEvents: 'none' }]}
      />
      
      {/* User Info */}
      <View style={styles.userInfoContainer}>
        <TouchableOpacity style={styles.userInfo}>
          <Image
            source={{ uri: reel.user.avatar }}
            style={styles.userAvatar}
          />
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{reel.user.name}</Text>
              {reel.user.verified && (
                <CheckCircle size={16} color={COLORS.info} />
              )}
            </View>
            {reel.user.followers && (
              <Text style={styles.userFollowers}>
                {formatCount(reel.user.followers)} متابع
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        {(() => {
          // Type-safe comparison: ensure own videos NEVER show follow button
          const userId = currentUserId || globalState.userProfile?.id;
          const isOwnReel = userId && reel.user.id && 
            String(userId) === String(reel.user.id);
          return !isOwnReel && !reel.user.isFollowing;
        })() && (
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>متابعة</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Description & Hashtags */}
      {reel.description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.description} numberOfLines={2}>
            {reel.description}
          </Text>
          {reel.hashtags && (
            <View style={styles.hashtagsContainer}>
              {reel.hashtags.map((tag, index) => (
                <Text key={index} style={styles.hashtag}>#{tag}</Text>
              ))}
            </View>
          )}
        </View>
      )}
      
      {/* Bottom Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Eye size={16} color="white" />
          <Text style={styles.statText}>
            {formatCount(reel.views)} مشاهدة
          </Text>
        </View>
        {reel.location && (
          <Text style={styles.location}>📍 {reel.location}</Text>
        )}
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actionsColumn}>
        <ActionButton
          icon={
            <Heart 
              size={28} 
              color={reel.liked ? COLORS.error : 'white'}
              fill={reel.liked ? COLORS.error : 'none'}
            />
          }
          count={reel.likes}
          active={reel.liked}
          onPress={onLike}
          accessibilityLabel={`${reel.likes} إعجاب`}
        />
        
        <ActionButton
          icon={<MessageCircle size={28} color="white" />}
          count={reel.comments}
          onPress={onComment}
          accessibilityLabel={`${reel.comments} تعليق`}
        />
        
        <ActionButton
          icon={<Share2 size={28} color="white" />}
          count={reel.shares}
          onPress={onShare}
          accessibilityLabel="مشاركة"
        />
        
        <ActionButton
          icon={
            <Bookmark 
              size={28} 
              color={reel.saved ? COLORS.primary : 'white'}
              fill={reel.saved ? COLORS.primary : 'none'}
            />
          }
          onPress={onSave}
          active={reel.saved}
          accessibilityLabel={reel.saved ? "محفوظ" : "حفظ"}
        />
        
        <ActionButton
          icon={reel.muted ? 
            <VolumeX size={28} color="white" /> : 
            <Volume2 size={28} color="white" />
          }
          onPress={onToggleMute}
          accessibilityLabel={reel.muted ? "تشغيل الصوت" : "كتم الصوت"}
        />
        
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={onReport}
        >
          <MoreVertical size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: COLORS.background,
  },
  videoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 5,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 5,
  },
  userInfoContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 80,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userFollowers: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  followButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  description: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  hashtag: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  statsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    flexDirection: 'row',
    gap: 24,
    zIndex: 10,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  location: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  actionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    gap: 4,
    zIndex: 100,
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
