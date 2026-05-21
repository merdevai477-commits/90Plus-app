import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Dimensions,
    Animated as RNAnimated,
    ActionSheetIOS,
    Platform,
    Share as RNShare,
    Linking,
    Clipboard,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    ScrollView,
    ActivityIndicator,
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
    Play,
} from 'lucide-react-native';

import { SafeVideoPlayer as UnifiedVideoPlayer } from '../common/SafeVideoPlayer';
import type { UnifiedReelData } from '../common/UnifiedVideoPlayer';
import { DoubleTapLikeAnimation } from '../Matches/DoubleTapAnimation';
import { ReelData } from './types';
import { COLORS, GRADIENTS, EFFECTS } from './constants';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReelItemProps {
    reel: ReelData;
    isActive: boolean;
    onLike: () => void;
    onToggleMute: () => void;
    onComment: () => void;
    onShare: () => void;
    onSave: () => void;
    onUserPress: () => void;
    onReport: () => void;
    onDeleteReel?: (reelId: string) => void;
    onEditReel?: (reelId: string, caption: string, hashtags: string[]) => Promise<void>;
    onFollow?: () => void;
    onUnfollow?: () => void;
    onHashtagPress?: (tag: string) => void;
    onMentionPress?: (username: string) => void;
    onTogglePlayPause?: () => void;
    onVideoRef: (ref: any, id: string) => void;
    fadeAnim?: RNAnimated.Value;
    slideAnim?: RNAnimated.Value;
    pulseAnim?: RNAnimated.Value;
    /** Current user's ID - used to hide follow button on own reels (Requirement 18.1) */
    currentUserId?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper function to format numbers
const formatCount = (count?: number): string => {
    if (count === undefined || count === null || isNaN(count)) return '0';
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

// Modern Reel Item Component with App Colors 🎨
const ReelItemComponent: React.FC<ReelItemProps> = ({
    reel,
    isActive,
    onLike,
    onToggleMute,
    onComment,
    onReport,
    onShare,
    onSave,
    onUserPress,
    onFollow,
    onUnfollow,
    onHashtagPress,
    onMentionPress,
    onVideoRef,
    fadeAnim,
    slideAnim,
    pulseAnim,
    currentUserId,
    onDeleteReel,
    onEditReel,
}) => {
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
    const [isPaused, setIsPaused] = useState(false);
    const lastTapRef = useRef(0);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editCaption, setEditCaption] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const { t, isRTL } = useLanguage();

    const haptics = {
        lightImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        mediumImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        heavyImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    };

    // Animations
    const glowAnim = useRef(new RNAnimated.Value(0)).current;
    const scaleAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        let animation: RNAnimated.CompositeAnimation | null = null;
        if (isActive) {
            animation = RNAnimated.loop(
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
                ])
            );
            animation.start();
        } else {
            // Reset pause state when not active
            setIsPaused(false);
        }
        return () => {
            animation?.stop();
        };
    }, [isActive, glowAnim]);

    // Handle tap (single for pause, double for like)
    const handlePress = (event: any) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < 300) {
            // Double tap detected
            if (singleTapTimer.current) {
                clearTimeout(singleTapTimer.current);
                singleTapTimer.current = null;
            }
            handleDoubleTap(event);
            // ✅ Reset so the next tap starts a fresh single/double cycle.
            // Without this, three rapid taps fire two double-tap handlers
            // (and two like requests) because the third tap is still within
            // 300ms of the second.
            lastTapRef.current = 0;
            return;
        }

        // Single tap - wait to see if it's double
        singleTapTimer.current = setTimeout(() => {
            setIsPaused(prev => !prev);
            singleTapTimer.current = null;
        }, 300);

        lastTapRef.current = now;
    };

    const handleDoubleTap = (event: any) => {
        haptics.mediumImpact();

        setTapPosition({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY
        });

        if (!reel.liked) {
            onLike();
        }

        setShowHeartAnimation(true);

        RNAnimated.sequence([
            RNAnimated.timing(scaleAnim, {
                toValue: 1.05,
                duration: 100,
                useNativeDriver: true,
            }),
            RNAnimated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        setTimeout(() => setShowHeartAnimation(false), 1500);
    };

    // Long press for share menu
    const handleLongPressStart = () => {
        longPressTimer.current = setTimeout(() => {
            haptics.heavyImpact();
            showShareMenu();
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const REEL_BASE_URL = 'https://90plus.app/reels';

    const handleShareWhatsApp = useCallback(async () => {
        const url = `${REEL_BASE_URL}/${reel.id}`;
        const message = (t.reels.shareReelMessageWhatsApp as string).replace('{url}', url);
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        try {
            const canOpen = await Linking.canOpenURL(whatsappUrl);
            if (canOpen) {
                await Linking.openURL(whatsappUrl);
            } else {
                await RNShare.share({ message });
            }
            onShare(); // track share in backend
        } catch (e) {
            await RNShare.share({ message });
        }
    }, [reel.id, onShare]);

    const handleShareFacebook = useCallback(async () => {
        const url = `${REEL_BASE_URL}/${reel.id}`;
        const fbUrl = `fb://share?u=${encodeURIComponent(url)}`;
        try {
            const canOpen = await Linking.canOpenURL(fbUrl);
            if (canOpen) {
                await Linking.openURL(fbUrl);
            } else {
                await RNShare.share({ message: url });
            }
            onShare();
        } catch (e) {
            await RNShare.share({ message: url });
        }
    }, [reel.id, onShare]);

    const handleCopyLink = useCallback(async () => {
        const url = `${REEL_BASE_URL}/${reel.id}`;
        try {
            // Use Clipboard from @react-native-clipboard/clipboard if available, fallback to RN Clipboard
            if ((Clipboard as any).setString) {
                (Clipboard as any).setString(url);
            } else {
                await (Clipboard as any).setStringAsync(url);
            }
        } catch {
            // Clipboard not available — fall through to native share
        }
        onShare();
    }, [reel.id, onShare]);

    const showShareMenu = useCallback(() => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [
                        t.reels.shareToWhatsApp,
                        t.reels.shareToFacebook,
                        t.reels.copyLink,
                        t.common.cancel,
                    ],
                    cancelButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex === 0) handleShareWhatsApp();
                    else if (buttonIndex === 1) handleShareFacebook();
                    else if (buttonIndex === 2) handleCopyLink();
                }
            );
        } else {
            // Android — use native share sheet
            const url = `${REEL_BASE_URL}/${reel.id}`;
            RNShare.share({
                message: (t.reels.shareReelMessageWhatsApp as string).replace('{url}', url),
            }).then(() => onShare());
        }
    }, [reel.id, t, handleShareWhatsApp, handleShareFacebook, handleCopyLink, onShare]);

    const handleMoreOptions = useCallback(() => {
        haptics.lightImpact();
        const isOwnReel = currentUserId && reel?.user?.id &&
            String(currentUserId) === String(reel.user.id);

        if (Platform.OS === 'ios') {
            const options = isOwnReel
                ? [t.common.cancel, t.reels.editCaption, t.reels.deleteReelAction]
                : [t.common.cancel, t.reels.reportReelAction];
            const cancelIndex = 0;
            const destructiveIndex = isOwnReel ? 2 : 1;

            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
                (buttonIndex) => {
                    if (isOwnReel) {
                        if (buttonIndex === 1) {
                            // تعديل الوصف
                            setEditCaption(reel.description || '');
                            setShowEditModal(true);
                        } else if (buttonIndex === 2 && onDeleteReel) {
                            Alert.alert(
                                t.reels.deleteConfirmTitle,
                                t.reels.deleteConfirmMessage,
                                [
                                    { text: t.reels.deleteConfirmCancel, style: 'cancel' },
                                    { text: t.reels.deleteConfirmDelete, style: 'destructive', onPress: () => onDeleteReel(reel.id) },
                                ]
                            );
                        }
                    } else {
                        if (buttonIndex === 1) onReport();
                    }
                }
            );
        } else {
            // Android
            if (isOwnReel) {
                Alert.alert(
                    t.reels.actionsSheetTitle,
                    '',
                    [
                        {
                            text: t.reels.editCaption,
                            onPress: () => {
                                setEditCaption(reel.description || '');
                                setShowEditModal(true);
                            },
                        },
                        {
                            text: t.reels.deleteReelAction,
                            style: 'destructive',
                            onPress: () => {
                                Alert.alert(
                                    t.reels.deleteConfirmTitle,
                                    t.reels.deleteConfirmMessage,
                                    [
                                        { text: t.reels.deleteConfirmCancel, style: 'cancel' },
                                        { text: t.reels.deleteConfirmDelete, style: 'destructive', onPress: () => onDeleteReel?.(reel.id) },
                                    ]
                                );
                            },
                        },
                        { text: t.reels.deleteConfirmCancel, style: 'cancel' },
                    ]
                );
            } else {
                onReport();
            }
        }
    }, [haptics, currentUserId, reel.id, reel?.user?.id, reel.description, t, onDeleteReel, onReport]);

    const handleLikePress = () => {
        haptics.mediumImpact(); // Vibration on like
        onLike();
    };

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8],
    });

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            if (singleTapTimer.current) {
                clearTimeout(singleTapTimer.current);
                singleTapTimer.current = null;
            }
        };
    }, []);

    return (
        <RNAnimated.View
            style={[
                styles.reelContainer,
                fadeAnim && { opacity: fadeAnim },
            ]}
        >
            {/* Video */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handleLongPressStart}
                onPressOut={handleLongPressEnd}
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
                    isActive={isActive && !isPaused}
                    onVideoRef={onVideoRef}
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
            <DoubleTapLikeAnimation
                visible={showHeartAnimation}
                position={tapPosition}
            />

            {/* Gradients */}
            <LinearGradient
                colors={GRADIENTS.darkFade}
                style={[styles.topGradient, { pointerEvents: 'none' }]}
            />
            <LinearGradient
                colors={GRADIENTS.bottomFade}
                style={[styles.bottomGradient, { pointerEvents: 'none' }]}
            />

            {/* User Info - Glass Card */}
            <RNAnimated.View style={[styles.userInfoContainer, { opacity: glowOpacity }]}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.12)' as const, 'rgba(255, 255, 255, 0.05)' as const]}
                    style={styles.glassCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity style={styles.userInfo} onPress={onUserPress}>
                        <View style={styles.avatarContainer}>
                            <Image
                                source={{ uri: reel.user.avatar }}
                                style={styles.userAvatar}
                            />
                            {isActive && (
                                <RNAnimated.View style={[styles.avatarGlow, { opacity: glowOpacity }]} />
                            )}
                        </View>
                        <View style={styles.userDetails}>
                            <View style={styles.userNameRow}>
                                <Text style={styles.userName}>{reel.user.name}</Text>
                                {reel.user.verified && (
                                    <Text style={styles.verifiedBadge}>✓</Text>
                                )}
                            </View>
                            {typeof reel.user.followers === 'number' && reel.user.followers > 0 && (
                                <Text style={styles.userFollowers}>
                                    {formatCount(reel.user.followers)} {t.reels?.followersLabel || t.profile?.followers || 'followers'}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* Follow Button Logic - Requirements 18.1, 18.2, 18.4 */}
                    {/* Hide for own reels (18.1), Show for other users (18.2), Show correct state (18.4) */}
                    {(() => {
                        // Type-safe comparison: ensure own videos NEVER show follow button
                        const isOwnReel = currentUserId && reel?.user?.id && 
                            String(currentUserId) === String(reel.user.id);
                        return !isOwnReel && (onFollow || onUnfollow);
                    })() && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                reel.user.isFollowing && styles.followingButton
                            ]}
                            onPress={() => {
                                haptics.lightImpact();
                                if (reel.user.isFollowing && onUnfollow) {
                                    onUnfollow();
                                } else if (!reel.user.isFollowing && onFollow) {
                                    onFollow();
                                }
                            }}
                        >
                            <LinearGradient
                                colors={reel.user.isFollowing ? GRADIENTS.cardGradient : GRADIENTS.greenGlow}
                                style={styles.followButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={[
                                    styles.followButtonText,
                                    reel.user.isFollowing && styles.followingButtonText
                                ]}>
                                    {reel.user.isFollowing ? (t.reels?.following || 'Following') : t.reels.follow}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </LinearGradient>
            </RNAnimated.View>

            {/* Description & Hashtags */}
            {reel.description && (
                <View style={styles.descriptionContainer}>
                    <Text style={styles.description} numberOfLines={2}>
                        {reel.description}
                    </Text>
                    {reel.hashtags && (
                        <View style={styles.hashtagsContainer}>
                            {reel.hashtags.map((tag, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => onHashtagPress?.(tag)}
                                    style={styles.hashtagPill}
                                >
                                    <LinearGradient
                                        colors={GRADIENTS.cardGradient}
                                        style={styles.hashtagGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.hashtag}>#{tag}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Stats Bar */}
            <View style={styles.statsContainer}>
                <LinearGradient
                    colors={['rgba(0, 0, 0, 0.6)' as const, 'rgba(0, 0, 0, 0.3)' as const]}
                    style={styles.statsBar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.statItem}>
                        <Eye size={14} color={COLORS.accent} />
                        <Text style={styles.statText}>
                            {formatCount(reel.views)} {t.reels?.views || t.reels?.viewsLabel || 'views'}
                        </Text>
                    </View>
                    {reel.location && (
                        <Text style={styles.locationText}>📍 {reel.location}</Text>
                    )}
                </LinearGradient>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsColumn}>
                {/* Like */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleLikePress}
                    activeOpacity={0.7}
                >
                    <View style={[styles.buttonGlass, reel.liked && styles.buttonActive]}>
                        <Heart
                            size={30}
                            color={reel.liked ? COLORS.error : COLORS.textPrimary}
                            fill={reel.liked ? COLORS.error : 'none'}
                            strokeWidth={2}
                        />
                    </View>
                    <Text style={[styles.actionCount, reel.liked && styles.actionCountActive]}>
                        {formatCount(reel.likes)}
                    </Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { haptics.lightImpact(); onComment(); }}
                    activeOpacity={0.7}
                >
                    <View style={styles.buttonGlass}>
                        <MessageCircle size={30} color={COLORS.textPrimary} strokeWidth={2} />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(reel.comments)}</Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { haptics.lightImpact(); showShareMenu(); }}
                    activeOpacity={0.7}
                >
                    <View style={styles.buttonGlass}>
                        <Share2 size={28} color={COLORS.textPrimary} strokeWidth={2} />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(reel.shares)}</Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { haptics.lightImpact(); onSave(); }}
                    activeOpacity={0.7}
                >
                    <View style={[styles.buttonGlass, reel.saved && styles.buttonActive]}>
                        <Bookmark
                            size={28}
                            color={reel.saved ? COLORS.primary : COLORS.textPrimary}
                            fill={reel.saved ? COLORS.primary : 'none'}
                            strokeWidth={2}
                        />
                    </View>
                </TouchableOpacity>

                {/* Mute */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { haptics.lightImpact(); onToggleMute(); }}
                    activeOpacity={0.7}
                >
                    <View style={styles.buttonGlass}>
                        {reel.muted ? (
                            <VolumeX size={28} color={COLORS.textPrimary} strokeWidth={2} />
                        ) : (
                            <Volume2 size={28} color={COLORS.primary} strokeWidth={2} />
                        )}
                    </View>
                </TouchableOpacity>

                {/* More */}
                <TouchableOpacity
                    style={styles.moreButton}
                    onPress={handleMoreOptions}
                    activeOpacity={0.7}
                >
                    <View style={styles.buttonGlass}>
                        <MoreVertical size={26} color={COLORS.textPrimary} strokeWidth={2} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* ─── Edit Caption Modal ─────────────────────────────── */}
            <Modal
                visible={showEditModal}
                transparent
                animationType="slide"
                onRequestClose={() => !isSavingEdit && setShowEditModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={editStyles.overlay}
                >
                    <TouchableOpacity
                        style={editStyles.backdrop}
                        activeOpacity={1}
                        onPress={() => !isSavingEdit && setShowEditModal(false)}
                    />
                    <View style={editStyles.sheet}>
                        {/* Handle bar */}
                        <View style={editStyles.handle} />

                        {/* Header */}
                        <View style={editStyles.header}>
                            <TouchableOpacity
                                onPress={() => !isSavingEdit && setShowEditModal(false)}
                                disabled={isSavingEdit}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={editStyles.cancelBtn}>{t.reels.editModalCancel}</Text>
                            </TouchableOpacity>
                            <Text style={editStyles.title}>{t.reels.editModalTitle}</Text>
                            <TouchableOpacity
                                onPress={async () => {
                                    if (!onEditReel || isSavingEdit) return;
                                    haptics.mediumImpact();
                                    setIsSavingEdit(true);
                                    try {
                                        // استخراج الهاشتاجات من النص
                                        const hashtagMatches = editCaption.match(/#[\w\u0600-\u06FF]+/g) || [];
                                        const hashtags = hashtagMatches.map(h => h.replace('#', ''));
                                        await onEditReel(reel.id, editCaption.trim(), hashtags);
                                        setShowEditModal(false);
                                    } finally {
                                        setIsSavingEdit(false);
                                    }
                                }}
                                disabled={isSavingEdit}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {isSavingEdit ? (
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                ) : (
                                    <Text style={editStyles.saveBtn}>{t.reels.editModalSave}</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Input */}
                        <View style={editStyles.inputWrapper}>
                            <TextInput
                                style={[editStyles.input, { textAlign: isRTL ? 'right' : 'left' }]}
                                value={editCaption}
                                onChangeText={setEditCaption}
                                placeholder={t.reels.editModalPlaceholder}
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                multiline
                                maxLength={500}
                                autoFocus
                                textAlignVertical="top"
                                selectionColor={COLORS.primary}
                            />
                            <Text style={editStyles.charCount}>
                                {editCaption.length}/500
                            </Text>
                        </View>

                        {/* Hint */}
                        <Text style={editStyles.hint}>
                            {t.reels.editModalHint}
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </RNAnimated.View>
    );
};

const styles = StyleSheet.create({
    reelContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: COLORS.deepBlack,
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
        height: 150,
        zIndex: 5,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 250,
        zIndex: 5,
    },
    userInfoContainer: {
        position: 'absolute',
        top: 50,
        left: 12,
        right: 90,
        zIndex: 10,
    },
    glassCard: {
        borderRadius: 16,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...EFFECTS.softShadow,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
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
    userDetails: {
        flex: 1,
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    userName: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    verifiedBadge: {
        fontSize: 14,
        color: COLORS.primary,
    },
    userFollowers: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    followButton: {
        borderRadius: 18,
        overflow: 'hidden',
        ...EFFECTS.greenGlow,
    },
    followingButton: {
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    followButtonGradient: {
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    followButtonText: {
        color: COLORS.deepBlack,
        fontSize: 13,
        fontWeight: '700',
    },
    followingButtonText: {
        color: COLORS.textPrimary,
    },
    descriptionContainer: {
        position: 'absolute',
        bottom: 140,
        left: 16,
        right: 90,
        zIndex: 10,
    },
    description: {
        color: COLORS.textPrimary,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    hashtagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    hashtagPill: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    hashtagGradient: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    hashtag: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    statsContainer: {
        position: 'absolute',
        bottom: 90,
        left: 16,
        right: 90,
        zIndex: 10,
    },
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '700',
    },
    locationText: {
        color: COLORS.textSecondary,
        fontSize: 11,
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
    actionButton: {
        alignItems: 'center',
        gap: 5,
    },
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
    actionCountActive: {
        color: COLORS.primary,
    },
    moreButton: {
        marginTop: 6,
    },
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
});

// ─── Edit Modal Styles ────────────────────────────────────────────────────────
const editStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#1A1A2E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelBtn: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 15,
        fontWeight: '500',
    },
    saveBtn: {
        color: COLORS.primary,
        fontSize: 15,
        fontWeight: '700',
    },
    inputWrapper: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 14,
        minHeight: 140,
    },
    input: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 22,
        minHeight: 100,
    },
    charCount: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        textAlign: 'left',
        marginTop: 8,
    },
    hint: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 14,
        paddingHorizontal: 20,
    },
});

// ✅ PERFORMANCE: Memoize to prevent unnecessary re-renders
export const ReelItem = React.memo(ReelItemComponent);
