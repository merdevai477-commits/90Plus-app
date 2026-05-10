/**
 * VideoPlayerModal
 *
 * Full-screen modal wrapper for playing a single reel. Used from the profile
 * video grid and the public user profile page. Internally driven by
 * `UnifiedVideoPlayer` so playback behavior stays consistent with the main
 * reels feed.
 *
 * SDK 55 migration: this used to render `<Video>` directly with
 * imperative refs (expo-av). It now delegates to `UnifiedVideoPlayer`
 * which handles `expo-video` under the hood and exposes the player via
 * the `onVideoRef` callback for mute/play/pause control.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Animated as RNAnimated,
  Dimensions,
  Modal,
  Platform,
  Share as RNShare,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  Play,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { COLORS, EFFECTS, GRADIENTS } from '../reels/constants';
import { DoubleTapLikeAnimation } from '../Matches/DoubleTapAnimation';
import { useLanguage } from '../../contexts/LanguageContext';
import CommentsModal from './CommentsModal';
import type { Comment } from '../../contexts/VideosContext';
import { toastManager } from '../../services/toastManager';
import { UnifiedVideoPlayer } from './UnifiedVideoPlayer';

interface VideoPlayerModalProps {
  visible: boolean;
  videoUrl: string | null;
  onClose: () => void;
  userImage?: string | null;
  username?: string;
  reelId?: string | null;
  comments?: Comment[];
  onAddComment?: (comment: Comment) => void;
  onToggleLike?: (commentId: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export default function VideoPlayerModal({
  visible,
  videoUrl,
  onClose,
  userImage,
  username = 'user',
  reelId,
  comments = [],
  onAddComment,
  onToggleLike,
}: VideoPlayerModalProps) {
  const { t } = useLanguage();

  // ── Player handle (published from UnifiedVideoPlayer via onVideoRef) ──
  const playerRef = useRef<any>(null);
  const handlePlayerRef = useCallback((player: any | null, _id: string) => {
    playerRef.current = player;
  }, []);

  // ── Local UI state ──
  const [isMuted, setIsMuted] = useState(false); // Audio ON by default
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likes, setLikes] = useState(0);
  const [shares, setShares] = useState(0);
  const [views] = useState(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [isCommentsVisible, setIsCommentsVisible] = useState(false);

  // ── Animation refs ──
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Glow animation when modal opens
  useEffect(() => {
    if (!visible) return;
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [visible, glowAnim]);

  // ── Haptics helpers ──
  const lightImpact = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };
  const mediumImpact = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };
  const heavyImpact = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  };

  // ── Tap handlers ──
  const handlePress = (event: any) => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta < 300) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      handleDoubleTap(event);
    } else {
      singleTapTimer.current = setTimeout(() => {
        setIsPaused((prev) => {
          const next = !prev;
          // Drive the player imperatively through the shared ref.
          try {
            if (next) playerRef.current?.pause?.();
            else playerRef.current?.play?.();
          } catch {
            /* ignore */
          }
          return next;
        });
        singleTapTimer.current = null;
      }, 300);
    }
    lastTapRef.current = now;
  };

  const handleDoubleTap = (event: any) => {
    mediumImpact();
    setTapPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    if (!isLiked) handleLike();
    setShowHeartAnimation(true);

    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      RNAnimated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    setTimeout(() => setShowHeartAnimation(false), 1500);
  };

  // ── Action handlers ──
  const handleLike = () => {
    mediumImpact();
    setIsLiked((prev) => !prev);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleMute = () => {
    lightImpact();
    setIsMuted((prev) => {
      const next = !prev;
      try {
        if (playerRef.current) playerRef.current.muted = next;
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSave = () => {
    lightImpact();
    setIsSaved((prev) => !prev);
  };

  const handleShare = () => {
    lightImpact();
    setShares((prev) => prev + 1);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t.reels?.shareToWhatsApp || 'WhatsApp',
            t.reels?.shareToFacebook || 'Facebook',
            t.reels?.copyLink || 'Copy Link',
            t.common?.cancel || 'Cancel',
          ],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex < 3) {
            RNShare.share({ message: `Check out this video from @${username}!` });
          }
        },
      );
    } else {
      RNShare.share({ message: `Check out this video from @${username}!` });
    }
  };

  const handleComment = () => {
    lightImpact();
    setIsCommentsVisible(true);
  };

  const handleReport = () => {
    lightImpact();
  };

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      heavyImpact();
      handleShare();
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  if (!visible || !videoUrl || !reelId) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Video */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handlePress}
          onPressIn={handleLongPressStart}
          onPressOut={handleLongPressEnd}
          style={styles.videoWrapper}
        >
          <UnifiedVideoPlayer
            reel={{ id: reelId, videoUrl, muted: isMuted }}
            isActive={visible && !isPaused}
            onVideoRef={handlePlayerRef}
            showProgressBar
          />

          {/* Play/Pause Overlay */}
          {isPaused && (
            <View style={styles.pauseOverlay}>
              <View style={styles.pauseIconContainer}>
                <Play size={40} color="rgba(255, 255, 255, 0.8)" fill="rgba(255, 255, 255, 0.8)" />
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Double Tap Heart Animation */}
        <DoubleTapLikeAnimation visible={showHeartAnimation} position={tapPosition} />

        {/* Gradients */}
        <LinearGradient
          colors={GRADIENTS.darkFade}
          style={styles.topGradient}
          pointerEvents="none"
        />
        <LinearGradient
          colors={GRADIENTS.bottomFade}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <View style={styles.buttonGlass}>
            <X size={28} color={COLORS.textPrimary} strokeWidth={2} />
          </View>
        </TouchableOpacity>

        {/* User Info */}
        <RNAnimated.View style={[styles.userInfoContainer, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.12)' as const, 'rgba(255, 255, 255, 0.05)' as const]}
            style={styles.glassCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                {userImage ? (
                  <Image source={{ uri: userImage }} style={styles.userAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.userAvatarPlaceholder}>
                    <Text style={styles.avatarText}>{username?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <RNAnimated.View style={[styles.avatarGlow, { opacity: glowOpacity }]} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>@{username}</Text>
                <Text style={styles.userFollowers}>
                  {formatCount(views)} {t.reels?.views || 'views'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </RNAnimated.View>

        {/* Action Buttons */}
        <View style={styles.actionsColumn}>
          {/* Like */}
          <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
            <View style={[styles.buttonGlass, isLiked && styles.buttonActive]}>
              <Heart
                size={30}
                color={isLiked ? COLORS.error : COLORS.textPrimary}
                fill={isLiked ? COLORS.error : 'none'}
                strokeWidth={2}
              />
            </View>
            <Text style={[styles.actionCount, isLiked && styles.actionCountActive]}>
              {formatCount(likes)}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.actionButton} onPress={handleComment} activeOpacity={0.7}>
            <View style={styles.buttonGlass}>
              <MessageCircle size={30} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <Text style={styles.actionCount}>{formatCount(comments ? comments.length : 0)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
            <View style={styles.buttonGlass}>
              <Share2 size={28} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <Text style={styles.actionCount}>{formatCount(shares)}</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity style={styles.actionButton} onPress={handleSave} activeOpacity={0.7}>
            <View style={[styles.buttonGlass, isSaved && styles.buttonActive]}>
              <Bookmark
                size={28}
                color={isSaved ? COLORS.primary : COLORS.textPrimary}
                fill={isSaved ? COLORS.primary : 'none'}
                strokeWidth={2}
              />
            </View>
          </TouchableOpacity>

          {/* Mute */}
          <TouchableOpacity style={styles.actionButton} onPress={handleMute} activeOpacity={0.7}>
            <View style={styles.buttonGlass}>
              {isMuted ? (
                <VolumeX size={28} color={COLORS.textPrimary} strokeWidth={2} />
              ) : (
                <Volume2 size={28} color={COLORS.primary} strokeWidth={2} />
              )}
            </View>
          </TouchableOpacity>

          {/* More */}
          <TouchableOpacity style={styles.moreButton} onPress={handleReport} activeOpacity={0.7}>
            <View style={styles.buttonGlass}>
              <MoreVertical size={26} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <CommentsModal
        visible={isCommentsVisible}
        onClose={() => setIsCommentsVisible(false)}
        reelId={reelId}
        comments={comments || []}
        onAddComment={onAddComment}
        onToggleLike={onToggleLike}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.deepBlack },
  videoWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 20,
  },
  pauseIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    ...EFFECTS.softShadow,
  },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, zIndex: 5 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 250, zIndex: 5 },
  closeButton: { position: 'absolute', top: 50, left: 16, zIndex: 100 },
  userInfoContainer: {
    position: 'absolute',
    top: 50,
    left: 70,
    right: 90,
    zIndex: 10,
  },
  glassCard: {
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    ...EFFECTS.softShadow,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarContainer: { position: 'relative' },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.deepBlack, fontSize: 20, fontWeight: 'bold' },
  avatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    opacity: 0.3,
    zIndex: -1,
  },
  userDetails: { flex: 1 },
  userName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  userFollowers: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  actionsColumn: {
    position: 'absolute',
    right: 10,
    bottom: 140,
    gap: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  actionButton: { alignItems: 'center', gap: 5 },
  buttonGlass: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    ...EFFECTS.softShadow,
  },
  buttonActive: {
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    borderColor: COLORS.primary,
    ...EFFECTS.greenGlow,
  },
  actionCount: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionCountActive: { color: COLORS.primary },
  moreButton: { marginTop: 6 },
});
