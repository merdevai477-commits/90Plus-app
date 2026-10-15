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
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    BadgeCheck,
    Hash,
} from 'lucide-react-native';

import { SafeVideoPlayer as UnifiedVideoPlayer } from '../common/SafeVideoPlayer';
import { DoubleTapLikeAnimation } from '../Matches/DoubleTapAnimation';
import { ReelData } from './types';
import { COLORS, GRADIENTS, EFFECTS, REELS_TAB_CLEARANCE } from './constants';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../src/i18n';
import { buildReelSharePayload } from '../../constants/shareLinks';
import {
    confirmExternalShare,
    isCopyShareActivity,
    watchShareHandoff,
} from '../../utils/confirmExternalShare';
import { toastManager } from '../../services/toastManager';
import { SURFACE_MODAL, OVERLAY_SCRIM } from '../../constants/tokens';

interface ReelItemProps {
    reel: ReelData;
    isActive: boolean;
    /** When false, show thumbnail only — single active player in the feed. */
    shouldMountPlayer?: boolean;
    /** Bumped when the reels tab regains focus — forces a fresh expo-video player. */
    playerGeneration?: number;
    /** Feed-level mute (persisted by parent). */
    feedMuted?: boolean;
    onLike: () => void;
    onToggleMute: () => void;
    onComment: () => void;
    /** Records share in backend after platform-specific share (no second native sheet) */
    onRecordShare: (platform: string) => void;
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
    /** Hide follow button on the viewer's own reels */
    isOwnReel?: boolean;
    /** Exact feed viewport height — must match FlatList snap interval */
    itemHeight?: number;
}

const { width: SCREEN_WIDTH, height: FALLBACK_HEIGHT } = Dimensions.get('window');

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
    shouldMountPlayer = true,
    playerGeneration = 0,
    feedMuted = false,
    onLike,
    onToggleMute,
    onComment,
    onReport,
    onRecordShare,
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
    isOwnReel = false,
    onDeleteReel,
    onEditReel,
    itemHeight,
}) => {
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
    const [isPaused, setIsPaused] = useState(false);
    const [bioExpanded, setBioExpanded] = useState(false);
    const lastTapRef = useRef(0);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editCaption, setEditCaption] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const { t, language } = useTranslation();
    const insets = useSafeAreaInsets();
    const bottomClearance = REELS_TAB_CLEARANCE + Math.max(insets.bottom, 12);
    const topClearance = Math.max(insets.top, 12) + 8;
    const cellHeight = itemHeight && itemHeight > 0 ? itemHeight : FALLBACK_HEIGHT;

    const haptics = {
        lightImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        mediumImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        heavyImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    };

    const scaleAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        if (!isActive) {
            setIsPaused(false);
            setBioExpanded(false);
        }
    }, [isActive]);

    useEffect(() => {
        setBioExpanded(false);
    }, [reel.id]);

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
            handleLongPressEnd();
            setIsPaused((prev) => !prev);
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

        if (heartAnimTimer.current) clearTimeout(heartAnimTimer.current);
        heartAnimTimer.current = setTimeout(() => {
            heartAnimTimer.current = null;
            setShowHeartAnimation(false);
        }, 1500);
    };

    // Long press for share menu (avoid firing while single-tap pause is pending)
    const handleLongPressStart = () => {
        if (singleTapTimer.current) return;
        longPressTimer.current = setTimeout(() => {
            if (singleTapTimer.current) return;
            haptics.heavyImpact();
            showShareMenu();
        }, 650);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    /** Native OS share sheet with real HTTPS deep link — records only on real handoff */
    const shareReelNative = useCallback(async () => {
        const lang = language === 'en' ? 'en' : 'ar';
        const payload = buildReelSharePayload({
            reelId: reel.id,
            creatorName: reel.user?.name,
            description: reel.description,
            lang,
        });

        const handoff = watchShareHandoff();
        try {
            const result = await RNShare.share(
                Platform.OS === 'ios'
                    ? { message: payload.message, url: payload.url }
                    : { message: payload.message, title: payload.title },
                { dialogTitle: t.reels.shareReelTitle || payload.title },
            );

            if (result.action !== RNShare.sharedAction) return;

            if (Platform.OS === 'ios') {
                if (!result.activityType || isCopyShareActivity(result.activityType)) return;
                const platform = result.activityType.includes('WhatsApp')
                    ? 'whatsapp'
                    : result.activityType.includes('Facebook')
                        ? 'facebook'
                        : result.activityType.split('.').pop() || 'ios_share';
                onRecordShare(platform);
            } else {
                if (!handoff.didLeave()) {
                    const left = await confirmExternalShare(800, ['background']);
                    if (!left) return;
                }
                onRecordShare('android_share');
            }

            toastManager.showShareSuccess();
        } catch {
            /* user cancelled / share unavailable */
        } finally {
            handoff.stop();
        }
    }, [
        language,
        reel.id,
        reel.user?.name,
        reel.description,
        onRecordShare,
        t.reels.shareReelTitle,
    ]);

    const showShareMenu = useCallback(() => {
        void shareReelNative();
    }, [shareReelNative]);

    const handleMoreOptions = useCallback(() => {
        haptics.lightImpact();

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
    }, [haptics, isOwnReel, reel.id, reel.description, t, onDeleteReel, onReport]);

    const handleLikePress = () => {
        haptics.mediumImpact(); // Vibration on like
        onLike();
    };

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
            if (heartAnimTimer.current) {
                clearTimeout(heartAnimTimer.current);
                heartAnimTimer.current = null;
            }
        };
    }, []);

    const reelContainerStyle = [
        styles.reelContainer,
        { height: cellHeight },
        fadeAnim && { opacity: fadeAnim },
    ];

    return (
        <RNAnimated.View
            style={reelContainerStyle}
        >
            {/* Video */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handleLongPressStart}
                onPressOut={handleLongPressEnd}
                style={styles.videoWrapper}
            >
                {/* Always paint thumbnail first so the cell never flashes black */}
                {reel.thumbnail ? (
                    <ExpoImage
                        source={{ uri: reel.thumbnail }}
                        style={styles.thumbnailFallback}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                        recyclingKey={reel.id}
                    />
                ) : (
                    <View style={styles.thumbnailFallback} />
                )}
                {shouldMountPlayer ? (
                    <UnifiedVideoPlayer
                        key={`${reel.id}-${playerGeneration}`}
                        reel={{
                            id: reel.id,
                            videoUrl: reel.videoUrl,
                            thumbnail: reel.thumbnail,
                            duration: reel.duration,
                        }}
                        muted={feedMuted}
                        showProgressBar={false}
                        isActive={isActive && !isPaused}
                        onVideoRef={onVideoRef}
                    />
                ) : null}

                {/* Play/Pause Overlay */}
                {isPaused && (
                    <View style={styles.pauseOverlay}>
                        <LinearGradient
                            colors={GRADIENTS.brandGlow}
                            style={styles.pauseIconContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Play size={36} color={COLORS.white} fill={COLORS.white} />
                        </LinearGradient>
                    </View>
                )}
            </TouchableOpacity>

            {/* Double Tap Heart Animation */}
            <DoubleTapLikeAnimation
                visible={showHeartAnimation}
                position={tapPosition}
            />

            {/* Gradients — brand vignette */}
            <LinearGradient
                colors={GRADIENTS.darkFade}
                style={[styles.topGradient, { pointerEvents: 'none' }]}
            />
            <LinearGradient
                colors={GRADIENTS.heroAccent}
                style={[styles.topAccentGradient, { pointerEvents: 'none' }]}
            />
            <LinearGradient
                colors={GRADIENTS.bottomFade}
                style={[styles.bottomGradient, { pointerEvents: 'none' }]}
            />

            {/* User Info - Glass Card */}
            <View style={[styles.userInfoContainer, { top: topClearance }]}>
                <LinearGradient
                    colors={GRADIENTS.glassCard}
                    style={styles.glassCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity style={styles.userInfo} onPress={onUserPress} activeOpacity={0.85}>
                        <View style={styles.avatarContainer}>
                            <LinearGradient
                                colors={GRADIENTS.brandGlow}
                                style={styles.avatarRing}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Image
                                    source={{ uri: reel.user.avatar }}
                                    style={styles.userAvatar}
                                />
                            </LinearGradient>
                            {isActive ? <View style={styles.avatarGlow} /> : null}
                        </View>
                        <View style={styles.userDetails}>
                            <View style={styles.userNameRow}>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {reel.user.name}
                                </Text>
                                {reel.user.verified && (
                                    <BadgeCheck size={16} color={COLORS.primary} fill={COLORS.purpleGlow} />
                                )}
                            </View>
                            {typeof reel.user.followers === 'number' && reel.user.followers > 0 && (
                                <Text style={styles.userFollowers}>
                                    {formatCount(reel.user.followers)}{' '}
                                    {t.reels?.followersLabel || t.profile?.followers || 'followers'}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {!isOwnReel && (onFollow || onUnfollow) && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                reel.user.isFollowing && styles.followingButton,
                            ]}
                            onPress={() => {
                                haptics.lightImpact();
                                if (reel.user.isFollowing && onUnfollow) {
                                    onUnfollow();
                                } else if (!reel.user.isFollowing && onFollow) {
                                    onFollow();
                                }
                            }}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={
                                    reel.user.isFollowing
                                        ? GRADIENTS.actionIdle
                                        : GRADIENTS.brandGlow
                                }
                                style={styles.followButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text
                                    style={[
                                        styles.followButtonText,
                                        reel.user.isFollowing && styles.followingButtonText,
                                    ]}
                                >
                                    {reel.user.isFollowing
                                        ? t.reels?.following || 'Following'
                                        : t.reels.follow}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </LinearGradient>
            </View>

            {/* Bio + Hashtags — premium glass panel */}
            {(Boolean(reel.description?.trim()) || (reel.hashtags && reel.hashtags.length > 0)) ? (
                <View
                    style={[
                        styles.descriptionContainer,
                        { bottom: bottomClearance + 48 },
                    ]}
                >
                    <LinearGradient
                        colors={GRADIENTS.bioPanel}
                        style={styles.bioPanel}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.bioAccent} />
                        <View style={styles.bioContent}>
                            {reel.description?.trim() ? (
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => {
                                        if ((reel.description?.length || 0) > 90) {
                                            haptics.lightImpact();
                                            setBioExpanded((v) => !v);
                                        }
                                    }}
                                >
                                    <Text
                                        style={styles.description}
                                        numberOfLines={bioExpanded ? undefined : 2}
                                    >
                                        {reel.description.trim()}
                                    </Text>
                                    {(reel.description?.length || 0) > 90 ? (
                                        <Text style={styles.bioMore}>
                                            {bioExpanded
                                                ? (language === 'en' ? 'Show less' : 'عرض أقل')
                                                : (language === 'en' ? 'Show more' : 'عرض المزيد')}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            ) : null}

                            {reel.hashtags && reel.hashtags.length > 0 ? (
                                <View
                                    style={[
                                        styles.hashtagsContainer,
                                        reel.description?.trim() ? styles.hashtagsAfterBio : null,
                                    ]}
                                >
                                    {reel.hashtags.slice(0, 8).map((tag, index) => {
                                        const clean = tag.replace(/^#/, '');
                                        return (
                                            <TouchableOpacity
                                                key={`${clean}-${index}`}
                                                onPress={() => {
                                                    haptics.lightImpact();
                                                    onHashtagPress?.(clean);
                                                }}
                                                style={styles.hashtagPill}
                                                activeOpacity={0.75}
                                            >
                                                <LinearGradient
                                                    colors={
                                                        index % 2 === 0
                                                            ? GRADIENTS.hashtagA
                                                            : GRADIENTS.hashtagB
                                                    }
                                                    style={styles.hashtagGradient}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <View style={styles.hashtagIcon}>
                                                        <Hash
                                                            size={11}
                                                            color={COLORS.white}
                                                            strokeWidth={2.6}
                                                        />
                                                    </View>
                                                    <Text style={styles.hashtag} numberOfLines={1}>
                                                        {clean}
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : null}
                        </View>
                    </LinearGradient>
                </View>
            ) : null}

            {/* Stats / Views pill */}
            <View style={[styles.statsContainer, { bottom: bottomClearance }]}>
                <LinearGradient
                    colors={['rgba(124,58,237,0.28)', 'rgba(59,130,246,0.14)', 'rgba(14,8,28,0.75)'] as const}
                    style={styles.statsBar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.statItem}>
                        <View style={styles.statIconWrap}>
                            <Eye size={13} color={COLORS.accent} strokeWidth={2.4} />
                        </View>
                        <Text style={styles.statText}>
                            {formatCount(reel.views)}
                        </Text>
                        <Text style={styles.statLabel}>
                            {t.reels?.views || t.reels?.viewsLabel || 'views'}
                        </Text>
                    </View>
                    {reel.location ? (
                        <Text style={styles.locationText} numberOfLines={1}>
                            {reel.location}
                        </Text>
                    ) : null}
                </LinearGradient>
            </View>

            {/* Action Buttons */}
            <View style={[styles.actionsColumn, { bottom: bottomClearance + 8 }]}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleLikePress}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={reel.liked ? GRADIENTS.actionActive : GRADIENTS.actionIdle}
                        style={[styles.buttonGlass, reel.liked && styles.buttonActive]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Heart
                            size={28}
                            color={reel.liked ? COLORS.error : COLORS.textPrimary}
                            fill={reel.liked ? COLORS.error : 'none'}
                            strokeWidth={2.2}
                        />
                    </LinearGradient>
                    <Text style={[styles.actionCount, reel.liked && styles.actionCountLiked]}>
                        {formatCount(reel.likes)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        onComment();
                    }}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={GRADIENTS.actionIdle}
                        style={styles.buttonGlass}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <MessageCircle size={28} color={COLORS.textPrimary} strokeWidth={2.2} />
                    </LinearGradient>
                    <Text style={styles.actionCount}>{formatCount(reel.comments)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        showShareMenu();
                    }}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={GRADIENTS.actionIdle}
                        style={styles.buttonGlass}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Share2 size={26} color={COLORS.textPrimary} strokeWidth={2.2} />
                    </LinearGradient>
                    <Text style={styles.actionCount}>{formatCount(reel.shares)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        onSave();
                    }}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={reel.saved ? GRADIENTS.actionActive : GRADIENTS.actionIdle}
                        style={[styles.buttonGlass, reel.saved && styles.buttonActive]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Bookmark
                            size={26}
                            color={reel.saved ? COLORS.primary : COLORS.textPrimary}
                            fill={reel.saved ? COLORS.primary : 'none'}
                            strokeWidth={2.2}
                        />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        onToggleMute();
                    }}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={feedMuted ? GRADIENTS.actionIdle : GRADIENTS.actionActive}
                        style={styles.buttonGlass}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {feedMuted ? (
                            <VolumeX size={26} color={COLORS.textSecondary} strokeWidth={2.2} />
                        ) : (
                            <Volume2 size={26} color={COLORS.primary} strokeWidth={2.2} />
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.moreButton}
                    onPress={handleMoreOptions}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={GRADIENTS.actionIdle}
                        style={styles.buttonGlass}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <MoreVertical size={24} color={COLORS.textPrimary} strokeWidth={2.2} />
                    </LinearGradient>
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
                        <View style={editStyles.handle} />
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
                                        const hashtagMatches = editCaption.match(/#[\w\u0600-\u06FF]+/g) || [];
                                        const hashtags = hashtagMatches.map((h) => h.replace('#', ''));
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

                        <View style={editStyles.inputWrapper}>
                            <TextInput
                                style={[editStyles.input, { textAlign: 'left' }]}
                                value={editCaption}
                                onChangeText={setEditCaption}
                                placeholder={t.reels.editModalPlaceholder}
                                placeholderTextColor={COLORS.textTertiary}
                                multiline
                                maxLength={500}
                                autoFocus
                                textAlignVertical="top"
                                selectionColor={COLORS.primary}
                            />
                            <Text style={editStyles.charCount}>{editCaption.length}/500</Text>
                        </View>

                        <Text style={editStyles.hint}>{t.reels.editModalHint}</Text>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </RNAnimated.View>
    );
};

const styles = StyleSheet.create({
    reelContainer: {
        width: SCREEN_WIDTH,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
    },
    videoWrapper: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        backgroundColor: COLORS.background,
    },
    thumbnailFallback: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.background,
        zIndex: 0,
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 170,
        zIndex: 5,
    },
    topAccentGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        zIndex: 5,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 320,
        zIndex: 5,
    },
    userInfoContainer: {
        position: 'absolute',
        left: 12,
        right: 88,
        zIndex: 10,
    },
    glassCard: {
        borderRadius: 18,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        backgroundColor: COLORS.backgroundCard,
        ...EFFECTS.softShadow,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarRing: {
        width: 50,
        height: 50,
        borderRadius: 25,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.darkGray,
    },
    avatarGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 29,
        backgroundColor: COLORS.primary,
        opacity: 0.28,
        zIndex: -1,
    },
    userDetails: {
        flex: 1,
        minWidth: 0,
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    userName: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        flexShrink: 1,
    },
    userFollowers: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    followButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginLeft: 8,
        ...EFFECTS.brandGlow,
    },
    followingButton: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        shadowOpacity: 0,
        elevation: 0,
    },
    followButtonGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    followButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
    },
    followingButtonText: {
        color: COLORS.textPrimary,
    },
    descriptionContainer: {
        position: 'absolute',
        left: 14,
        right: 88,
        zIndex: 10,
    },
    bioPanel: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.28)',
        overflow: 'hidden',
        flexDirection: 'row',
        ...EFFECTS.softShadow,
    },
    bioAccent: {
        width: 3,
        backgroundColor: COLORS.primary,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
    },
    bioContent: {
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: 12,
        minWidth: 0,
    },
    description: {
        color: COLORS.textPrimary,
        fontSize: 14.5,
        lineHeight: 21,
        fontWeight: '600',
        letterSpacing: 0.15,
        textShadowColor: 'rgba(5,1,13,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bioMore: {
        marginTop: 4,
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    hashtagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
    },
    hashtagsAfterBio: {
        marginTop: 10,
        paddingTop: 9,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(167, 139, 250, 0.22)',
    },
    hashtagPill: {
        borderRadius: 999,
        overflow: 'hidden',
        maxWidth: '100%',
    },
    hashtagGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 5,
        paddingRight: 11,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(196, 181, 253, 0.38)',
        borderRadius: 999,
    },
    hashtagIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(124, 58, 237, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    hashtag: {
        color: COLORS.white,
        fontSize: 12.5,
        fontWeight: '700',
        letterSpacing: 0.2,
        maxWidth: 140,
    },
    statsContainer: {
        position: 'absolute',
        left: 16,
        right: 88,
        zIndex: 10,
    },
    statsBar: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.35)',
        gap: 10,
        ...EFFECTS.softShadow,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(96, 165, 250, 0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statText: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    statLabel: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    locationText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontWeight: '500',
        flexShrink: 1,
        maxWidth: 120,
    },
    actionsColumn: {
        position: 'absolute',
        right: 10,
        gap: 14,
        zIndex: 100,
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    buttonGlass: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
        ...EFFECTS.softShadow,
    },
    buttonActive: {
        borderColor: 'rgba(167, 139, 250, 0.55)',
        ...EFFECTS.brandGlow,
    },
    actionCount: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: '700',
        textShadowColor: 'rgba(5,1,13,0.85)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    actionCountLiked: {
        color: COLORS.error,
    },
    moreButton: {
        marginTop: 4,
    },
    pauseOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(5, 1, 13, 0.28)',
        zIndex: 20,
    },
    pauseIconContainer: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        ...EFFECTS.brandGlow,
        paddingLeft: 4,
    },
});

const editStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: OVERLAY_SCRIM,
    },
    sheet: {
        backgroundColor: SURFACE_MODAL,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(167, 139, 250, 0.45)',
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
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    cancelBtn: {
        color: COLORS.textTertiary,
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
        backgroundColor: COLORS.glass,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        padding: 14,
        minHeight: 140,
    },
    input: {
        color: COLORS.textPrimary,
        fontSize: 15,
        lineHeight: 22,
        minHeight: 100,
    },
    charCount: {
        color: COLORS.textTertiary,
        fontSize: 11,
        textAlign: 'left',
        marginTop: 8,
    },
    hint: {
        color: COLORS.textTertiary,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 14,
        paddingHorizontal: 20,
    },
});

function reelItemPropsAreEqual(prev: ReelItemProps, next: ReelItemProps): boolean {
    if (prev.isActive !== next.isActive) return false;
    if (prev.shouldMountPlayer !== next.shouldMountPlayer) return false;
    if (prev.playerGeneration !== next.playerGeneration) return false;
    if (prev.itemHeight !== next.itemHeight) return false;
    if (prev.isOwnReel !== next.isOwnReel) return false;
    if (prev.feedMuted !== next.feedMuted) return false;
    if (prev.reel.id !== next.reel.id) return false;
    if (prev.reel.liked !== next.reel.liked) return false;
    if (prev.reel.likes !== next.reel.likes) return false;
    if (prev.reel.comments !== next.reel.comments) return false;
    if (prev.reel.saved !== next.reel.saved) return false;
    if (prev.reel.shares !== next.reel.shares) return false;
    if (prev.reel.views !== next.reel.views) return false;
    if (prev.reel.videoUrl !== next.reel.videoUrl) return false;
    if (prev.reel.description !== next.reel.description) return false;
    if (prev.reel.user.isFollowing !== next.reel.user.isFollowing) return false;
    if (prev.fadeAnim !== next.fadeAnim) return false;
    return true;
}

export const ReelItem = React.memo(ReelItemComponent, reelItemPropsAreEqual);
