import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Dimensions,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  FlatList,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  ViewToken,
  Platform,
  Vibration,
  AppState,
  AppStateStatus,
  Keyboard,
  KeyboardAvoidingView,
  Share,
  StatusBar,
} from 'react-native';
import {
  Heart,
  MessageCircle,
  Flag,
  Volume2,
  VolumeX,
  Eye,
  X,
  Send,
  ChevronUp,
  Share2,
  Bookmark,
  MoreVertical,
  CheckCircle
} from 'lucide-react-native';

// للفيديو
import { Video, Audio, ResizeMode, AVPlaybackStatus } from 'expo-av';

// للـ Gradient
import { LinearGradient } from 'expo-linear-gradient';

// للـ Haptic Feedback
import * as Haptics from 'expo-haptics';

// Import new components and constants
import { ReelItem } from '../../components/reels/ReelItem';
import { COLORS } from '../../components/reels/constants';
import { useLanguage } from '../../contexts/LanguageContext';
import { ReelData } from '../../components/reels/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ANIMATIONS = {
  spring: {
    friction: 4,
    tension: 40,
    useNativeDriver: true
  },
  timing: {
    duration: 200,
    useNativeDriver: true,
    easing: Easing.bezier(0.4, 0, 0.2, 1)
  }
};

// ====== TYPES ======
interface User {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  followers?: number;
  isFollowing?: boolean;
}

interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
  likes: number;
  liked: boolean;
  replies?: Comment[];
}

// ====== HOOKS ======
// Custom Hook for Haptic Feedback
const useHaptic = () => {
  const trigger = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } else {
      Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    }
  }, []);

  return { trigger };
};

// Custom Hook for App State & Audio Management
const useAppStateAudio = (videoRefs: React.MutableRefObject<Map<string, Video>>) => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // Pause all videos when app goes to background
        videoRefs.current.forEach((video) => {
          video?.pauseAsync();
        });
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Configure audio session
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        });
      } catch (error) {
        console.warn('Error configuring audio session:', error);
      }
    };

    configureAudio();

    return () => {
      subscription.remove();
    };
  }, [videoRefs]);
};

// ====== COMPONENTS ======

// Enhanced Action Button with better animations
const ActionButton: React.FC<{
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  color?: string;
  size?: number;
}> = ({ icon, count, active, onPress, accessibilityLabel, accessibilityHint, color = 'white', size = 28 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptic();

  const handlePress = () => {
    haptic.trigger('light');

    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        })
      ]),
      active ? Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.elastic(1)
      }) : Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();

    onPress();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.actionButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.8}
    >
      <Animated.View style={[
        styles.actionIconContainer,
        active && styles.actionIconActive,
        {
          transform: [
            { scale: scaleAnim },
            { rotate: active ? spin : '0deg' }
          ]
        }
      ]}>
        {icon}
      </Animated.View>
      {count !== undefined && (
        <Text style={styles.actionCount}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Enhanced Video Player with better controls
const VideoPlayer: React.FC<{
  reel: ReelData;
  isActive: boolean;
  onVideoRef: (ref: Video | null, id: string) => void;
}> = ({ reel, isActive, onVideoRef }) => {
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

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>فشل تحميل الفيديو</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(false);
            setIsLoading(true);
          }}
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

// Enhanced Double Tap Animation with Confetti
const DoubleTapLikeAnimation: React.FC<{
  visible: boolean;
  position?: { x: number; y: number };
}> = ({ visible, position = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 } }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptic();

  useEffect(() => {
    if (visible) {
      haptic.trigger('medium');

      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 2,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease)
          })
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
          })
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.elastic(1)
        })
      ]).start();
    }
  }, [visible, haptic]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.doubleTapHeart,
        {
          left: position.x - 50,
          top: position.y - 50,
          transform: [
            { scale: scaleAnim },
            { rotate: spin }
          ],
          opacity: opacityAnim
        }
      ]}
    >
      <Heart size={100} color={COLORS.primary} fill={COLORS.primary} />
    </Animated.View>
  );
};

// Enhanced Comments Modal
const CommentsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  reelId: string;
}> = ({ visible, onClose, reelId }) => {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      user: {
        id: '1',
        name: 'أحمد محمد',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop',
        verified: true
      },
      text: 'هدف رائع! مهارة عالية جداً ⚽🔥',
      timestamp: '2 د',
      likes: 24,
      liked: false
    },
    {
      id: '2',
      user: {
        id: '2',
        name: 'سارة أحمد',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b047?w=40&h=40&fit=crop'
      },
      text: 'احترافية عالية جداً 👏',
      timestamp: '5 د',
      likes: 12,
      liked: true
    }
  ]);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const haptic = useHaptic();
  const { t } = useLanguage();

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        ...ANIMATIONS.spring
      }).start();

      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        ...ANIMATIONS.timing
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleToggleCommentLike = (commentId: string) => {
    haptic.trigger('light');
    setComments(prev => prev.map(comment =>
      comment.id === commentId
        ? {
          ...comment,
          liked: !comment.liked,
          likes: comment.liked ? comment.likes - 1 : comment.likes + 1
        }
        : comment
    ));
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting) return;

    haptic.trigger('light');
    setIsSubmitting(true);
    Keyboard.dismiss();

    const comment: Comment = {
      id: Date.now().toString(),
      user: {
        id: 'current_user',
        name: 'أنت',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop'
      },
      text: newComment.trim(),
      timestamp: 'الآن',
      likes: 0,
      liked: false
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    setComments(prev => [comment, ...prev]);
    setNewComment('');
    setIsSubmitting(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.commentsContainer,
            {
              transform: [{ translateY: slideAnim }],
              marginBottom: keyboardHeight
            }
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>
              {comments.length} {t.reels.comments}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image
                  source={{ uri: item.user.avatar }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUserInfo}>
                      <Text style={styles.commentUsername}>{item.user.name}</Text>
                      {item.user.verified && (
                        <CheckCircle size={14} color={COLORS.info} />
                      )}
                    </View>
                    <Text style={styles.commentTimestamp}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.text}</Text>
                  <TouchableOpacity
                    style={styles.commentLike}
                    onPress={() => handleToggleCommentLike(item.id)}
                  >
                    <Heart
                      size={16}
                      color={item.liked ? COLORS.error : '#999'}
                      fill={item.liked ? COLORS.error : 'none'}
                    />
                    {item.likes > 0 && (
                      <Text style={[
                        styles.commentLikeCount,
                        item.liked && styles.commentLikeCountActive
                      ]}>
                        {item.likes}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.commentInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.commentTextInput}
                placeholder={t.reels.addComment}
                placeholderTextColor="#999"
                value={newComment}
                onChangeText={setNewComment}
                onSubmitEditing={handleAddComment}
                editable={!isSubmitting}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                style={[
                  styles.sendButton,
                  (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Share Sheet Component
const handleShare = async (reel: ReelData) => {
  const haptic = useHaptic();
  haptic.trigger('light');

  try {
    const message = `شاهد هذا الفيديو الرائع من ${reel.user.name}!\n${reel.description || ''}\n\n`;
    const result = await Share.share({
      message,
      url: reel.videoUrl, // في التطبيق الحقيقي، استخدم deep link
      title: 'مشاركة فيديو'
    });

    if (result.action === Share.sharedAction) {
      if (result.activityType) {
        // تم المشاركة بنجاح
        console.log('Shared with activity type:', result.activityType);
      }
    }
  } catch (error) {
    Alert.alert('خطأ', 'حدث خطأ أثناء المشاركة');
  }
};

// Report Modal Enhanced
const ReportModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  reelId: string;
  onReport: (reason: string) => void;
}> = ({ visible, onClose, reelId, onReport }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const haptic = useHaptic();
  const { t } = useLanguage();

  const reasons = [
    t.reels.reasons.inappropriate,
    t.reels.reasons.spam,
    t.reels.reasons.hateSpeech,
    t.reels.reasons.violence,
    t.reels.reasons.copyright,
    t.reels.reasons.adult,
    t.reels.reasons.misinfo,
    t.reels.reasons.other
  ];

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        ...ANIMATIONS.spring
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        ...ANIMATIONS.timing
      }).start(() => {
        setSelectedReason('');
        setCustomReason('');
        setIsSubmitted(false);
      });
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;

    haptic.trigger('medium');
    setIsSubmitting(true);

    try {
      const finalReason = selectedReason === t.reels.reasons.other ? customReason : selectedReason;

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      onReport(finalReason);
      setIsSubmitted(true);

      setTimeout(() => {
        onClose();
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      Alert.alert(t.common.error, t.common.error);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => !isSubmitting && !isSubmitted && onClose()}
        />

        <Animated.View
          style={[
            styles.reportContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {isSubmitted ? (
            <View style={styles.reportSuccess}>
              <Animated.View style={styles.successIcon}>
                <CheckCircle size={48} color={COLORS.success} />
              </Animated.View>
              <Text style={styles.successTitle}>{t.reels.reportSuccessTitle}</Text>
              <Text style={styles.successMessage}>
                {t.reels.reportSuccessMessage}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.dragHandle} />

              <Text style={styles.reportTitle}>{t.reels.reportTitle}</Text>
              <Text style={styles.reportSubtitle}>
                {t.reels.reportSubtitle}
              </Text>

              <ScrollView
                style={styles.reasonsList}
                showsVerticalScrollIndicator={false}
              >
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonItem,
                      selectedReason === reason && styles.reasonItemSelected
                    ]}
                    onPress={() => {
                      haptic.trigger('light');
                      setSelectedReason(reason);
                    }}
                    disabled={isSubmitting}
                  >
                    <View style={[
                      styles.radio,
                      selectedReason === reason && styles.radioSelected
                    ]}>
                      {selectedReason === reason && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedReason === t.reels.reasons.other && (
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder={t.reels.writeReason}
                    placeholderTextColor="#999"
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                    maxLength={200}
                  />
                )}
              </ScrollView>

              <View style={styles.reportButtons}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.reportButton, styles.cancelButton]}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>{t.reels.cancelReport}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!selectedReason || isSubmitting || (selectedReason === 'أخرى' && !customReason)}
                  style={[
                    styles.reportButton,
                    styles.submitButton,
                    (!selectedReason || isSubmitting) && styles.submitButtonDisabled
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t.reels.submitReport}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// Main Reels Feed Component
const ReelsFeed: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const videoRefs = useRef<Map<string, Video>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const haptic = useHaptic();
  const { t } = useLanguage();

  // Use App State Hook for Audio Management
  useAppStateAudio(videoRefs);

  const [reels, setReels] = useState<ReelData[]>([
    {
      id: '1',
      user: {
        id: '1',
        username: 'mosalah',
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
        username: 'cristiano',
        name: 'كريستيانو رونالدو',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
        verified: false,
        followers: 85000,
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
        username: 'leomessi',
        name: 'ليونيل ميسي',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        verified: false,
        followers: 92000,
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
  const handleVideoRef = useCallback((ref: Video | null, id: string) => {
    if (ref) {
      videoRefs.current.set(id, ref);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  // Handle Like
  const handleLike = useCallback((reelId: string) => {
    haptic.trigger('medium');
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? {
          ...reel,
          liked: !reel.liked,
          likes: reel.liked ? reel.likes - 1 : reel.likes + 1
        }
        : reel
    ));
  }, [haptic]);

  // Handle Mute Toggle
  const handleToggleMute = useCallback((reelId: string) => {
    haptic.trigger('light');
    setReels(prev => prev.map(reel =>
      reel.id === reelId
        ? { ...reel, muted: !reel.muted }
        : reel
    ));
  }, [haptic]);

  // Handle Save
  const handleSave = useCallback((reelId: string) => {
    haptic.trigger('light');
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
    Alert.alert('', saved ? t.reels.unsaved : t.reels.saved, [{ text: t.common.done }]);
  }, [haptic, reels]);

  // Handle Report
  const handleReport = useCallback((reason: string) => {
    console.log('Report submitted:', reason);
    // Alert handled in modal
  }, []);

  // Handle Share
  const handleShareReel = useCallback((reel: ReelData) => {
    handleShare(reel);
  }, []);

  // Open Comments
  const openComments = useCallback((reelId: string) => {
    haptic.trigger('light');
    setSelectedReelId(reelId);
    setShowComments(true);
  }, [haptic]);

  // Open Report
  const openReport = useCallback((reelId: string) => {
    haptic.trigger('light');
    setSelectedReelId(reelId);
    setShowReport(true);
  }, [haptic]);

  // Handle Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.trigger('light');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load new content...

    setIsRefreshing(false);
  }, [haptic]);

  // Update current index
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
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
      onUserPress={() => {/* TODO: Navigate to user profile */ }}
      onHashtagPress={(tag) => {/* TODO: Handle hashtag press */ }}
      onMentionPress={(username) => {/* TODO: Handle mention press */ }}
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

      {/* Header */}


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
        <Animated.View style={styles.swipeHint}>
          <ChevronUp size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.swipeHintText}>{t.reels.swipeUp}</Text>
        </Animated.View>
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

// Helper Functions
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

// Styles
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
  doubleTapHeart: {
    position: 'absolute',
    zIndex: 999,
    pointerEvents: 'none',
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
    top: Platform.OS === 'ios' ? 110 : 100,
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
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backdropFilter: 'blur(10px)',
  },
  actionIconActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  commentsContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLikeCount: {
    fontSize: 12,
    color: '#999',
  },
  commentLikeCountActive: {
    color: COLORS.error,
    fontWeight: '600',
  },
  commentInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
    gap: 12,
  },
  commentTextInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    fontSize: 14,
    backgroundColor: '#f8f8f8',
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  reportContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    gap: 12,
  },
  reasonItemSelected: {
    backgroundColor: '#ffebeb',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.error,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
  },
  reasonText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  reasonTextSelected: {
    color: COLORS.error,
    fontWeight: '500',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: 'white',
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  reportSuccess: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ReelsFeed;