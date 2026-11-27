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
    Send,
    Bookmark,
    MoreHorizontal,
    Play,
    BadgeCheck,
    Plus,
    Check,
} from 'lucide-react-native';

import { SafeVideoPlayer as UnifiedVideoPlayer } from '../common/SafeVideoPlayer';
import { DoubleTapLikeAnimation } from '../Matches/DoubleTapAnimation';
import { ReelData } from './types';
import BadgeIcon from '../identity/BadgeIcon';
import {
    COLORS,
    REELS_TAB_CLEARANCE,
    ACTION_GAP,
    ACTION_SLOT_H,
    FIGMA_PRIMARY,
} from './constants';
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
import { RichText } from '../community/RichText';
import { getAppFont } from '../../utils/fontSetup';

function splitCaption(caption: string): { title: string; body: string } {
    const trimmed = caption.trim();
    if (!trimmed) return { title: '', body: '' };
    const nl = trimmed.indexOf('\n');
    if (nl > 0) {
        return { title: trimmed.slice(0, nl).trim(), body: trimmed.slice(nl + 1).trim() };
    }
    const sentence = trimmed.match(/^(.{1,90}?[.!?؟])\s+(.+)/s);
    if (sentence) {
        return { title: sentence[1].trim(), body: sentence[2].trim() };
    }
    return { title: trimmed, body: '' };
}

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
    /** Active player reached readyToPlay — parent can warm the next reel. */
    onPlayerReadyToPlay?: () => void;
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
    onPlayerReadyToPlay,
}) => {
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
    const [isPaused, setIsPaused] = useState(false);
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
    const topClearance = Math.max(insets.top, 12) + 56; // below For You header
    const cellHeight = itemHeight && itemHeight > 0 ? itemHeight : FALLBACK_HEIGHT;
    // Meta sits on the left rail; keep captions flush under the avatar.
    const captionAlign = 'left' as const;
    const fontBold = getAppFont(700, language);
    const fontRegular = getAppFont(400, language);
    const { title: captionTitle, body: captionBody } = splitCaption(reel.description || '');
    const secondaryCaption =
        captionBody ||
        (reel.hashtags && reel.hashtags.length > 0
            ? reel.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
            : '');

    const haptics = {
        lightImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        mediumImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        heavyImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    };

    const scaleAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        if (!isActive) {
            setIsPaused(false);
        }
    }, [isActive]);

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
                        showProgressBar
                        isActive={isActive && !isPaused}
                        onVideoRef={onVideoRef}
                        onReadyToPlay={onPlayerReadyToPlay}
                    />
                ) : null}

                {/* Play/Pause Overlay */}
                {isPaused && (
                    <View style={styles.pauseOverlay}>
                        <View style={styles.pauseIconContainer}>
                            <Play size={36} color={COLORS.white} fill={COLORS.white} />
                        </View>
                    </View>
                )}
            </TouchableOpacity>

            {/* Double Tap Heart Animation */}
            <DoubleTapLikeAnimation
                visible={showHeartAnimation}
                position={tapPosition}
            />

            {/* Soft bottom vignette only */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
                style={[styles.bottomGradient, { pointerEvents: 'none' }]}
            />

            {/* Bottom meta: user + caption — left side; action rail stays on the right */}
            <View
                style={[
                    styles.metaBlock,
                    {
                        // Sit above the tab bar + swipe hint so the bio stays readable
                        bottom: bottomClearance + 28,
                        left: 12,
                        right: 78,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[styles.userRow, styles.userRowStart]}
                    onPress={onUserPress}
                    activeOpacity={0.85}
                >
                    <Image source={{ uri: reel.user.avatar }} style={styles.userAvatar} />
                    <View style={[styles.userTextCol, styles.userTextColLtr]}>
                        <View style={styles.userNameRow}>
                            <Text
                                style={[styles.userName, { fontFamily: fontBold }]}
                                numberOfLines={1}
                            >
                                {reel.user.name}
                            </Text>
                            {reel.user.verified ? (
                                <BadgeCheck size={14} color={FIGMA_PRIMARY} fill={FIGMA_PRIMARY} />
                            ) : null}
                            {reel.user.identity?.badge ? (
                                <BadgeIcon
                                    badgeKey={reel.user.identity.badge.key}
                                    accent={reel.user.identity.badge.accent}
                                    size={14}
                                />
                            ) : null}
                        </View>
                        <Text
                            style={[styles.userHandle, { fontFamily: fontRegular }]}
                            numberOfLines={1}
                        >
                            @{reel.user.username}
                        </Text>
                    </View>
                </TouchableOpacity>

                {captionTitle ? (
                    <Text
                        style={[
                            styles.captionTitle,
                            { fontFamily: fontBold, textAlign: captionAlign },
                        ]}
                        numberOfLines={2}
                    >
                        {captionTitle}
                    </Text>
                ) : null}

                {secondaryCaption ? (
                    <RichText
                        text={secondaryCaption}
                        style={[styles.captionBody, { fontFamily: fontRegular, textAlign: captionAlign }]}
                        align={captionAlign}
                        collapseAfterLines={2}
                        seeMoreLabel={language === 'en' ? 'Show more' : 'عرض المزيد'}
                        seeLessLabel={language === 'en' ? 'Show less' : 'عرض أقل'}
                        onHashtag={(tag) => {
                            haptics.lightImpact();
                            onHashtagPress?.(tag);
                        }}
                        onMention={(username) => {
                            haptics.lightImpact();
                            onMentionPress?.(username);
                        }}
                    />
                ) : null}
            </View>

            {/* Action rail — right edge (likes / comments / share) */}
            <View
                style={[
                    styles.actionsColumn,
                    {
                        bottom: bottomClearance + 4,
                        gap: ACTION_GAP,
                        right: 8,
                    },
                ]}
            >
                {!isOwnReel && (onFollow || onUnfollow) ? (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                            haptics.lightImpact();
                            if (reel.user.isFollowing && onUnfollow) onUnfollow();
                            else if (!reel.user.isFollowing && onFollow) onFollow();
                        }}
                        activeOpacity={0.75}
                    >
                        <View style={styles.followCircle}>
                            {reel.user.isFollowing ? (
                                <Check size={20} color={COLORS.white} strokeWidth={2.8} />
                            ) : (
                                <Plus size={22} color={COLORS.white} strokeWidth={2.8} />
                            )}
                        </View>
                        <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                            {reel.user.isFollowing
                                ? t.reels.following
                                : t.reels.follow}
                        </Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleLikePress}
                    activeOpacity={0.75}
                >
                    <Heart
                        size={27}
                        color={reel.liked ? COLORS.error : COLORS.white}
                        fill={reel.liked ? COLORS.error : 'none'}
                        strokeWidth={2.2}
                        style={styles.actionIconShadow}
                    />
                    <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                        {formatCount(reel.likes)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        onComment();
                    }}
                    activeOpacity={0.75}
                >
                    <MessageCircle
                        size={27}
                        color={COLORS.white}
                        strokeWidth={2.2}
                        style={styles.actionIconShadow}
                    />
                    <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                        {formatCount(reel.comments)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        showShareMenu();
                    }}
                    activeOpacity={0.75}
                >
                    <Send
                        size={26}
                        color={COLORS.white}
                        strokeWidth={2.2}
                        style={styles.actionIconShadow}
                    />
                    <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                        {formatCount(reel.shares)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        haptics.lightImpact();
                        onSave();
                    }}
                    activeOpacity={0.75}
                >
                    <Bookmark
                        size={27}
                        color={reel.saved ? FIGMA_PRIMARY : COLORS.white}
                        fill={reel.saved ? FIGMA_PRIMARY : 'none'}
                        strokeWidth={2.2}
                        style={styles.actionIconShadow}
                    />
                    <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                        {t.reels.save}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleMoreOptions}
                    activeOpacity={0.75}
                >
                    <MoreHorizontal
                        size={27}
                        color={COLORS.white}
                        strokeWidth={2.2}
                        style={styles.actionIconShadow}
                    />
                    <Text style={[styles.actionLabel, { fontFamily: fontBold }]}>
                        {t.reels.more}
                    </Text>
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
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 320,
        zIndex: 5,
    },
    metaBlock: {
        position: 'absolute',
        zIndex: 20,
        gap: 10,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        alignSelf: 'stretch',
    },
    userRowStart: {
        justifyContent: 'flex-start',
    },
    userTextCol: {
        flexShrink: 1,
        gap: 4,
        maxWidth: 200,
    },
    userTextColLtr: {
        alignItems: 'flex-start',
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    userName: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
        flexShrink: 1,
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    userHandle: {
        color: '#d3d0de',
        fontSize: 12,
        fontWeight: '400',
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    userAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.darkGray,
    },
    captionTitle: {
        color: COLORS.white,
        fontSize: 19,
        fontWeight: '700',
        lineHeight: 26,
        width: '100%',
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    captionBody: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '400',
        lineHeight: 20,
        width: '100%',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    actionsColumn: {
        position: 'absolute',
        zIndex: 100,
        alignItems: 'center',
        width: 58,
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: ACTION_SLOT_H,
        width: 58,
        gap: 4,
    },
    followCircle: {
        width: 37,
        height: 37,
        borderRadius: 18.5,
        backgroundColor: FIGMA_PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        width: 56,
        textShadowColor: 'rgba(0,0,0,0.42)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 2,
    },
    actionIconShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.42,
        shadowRadius: 2,
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
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
    // Ignore views — feed used to bump views while scrolling and re-render every cell.
    if (prev.reel.videoUrl !== next.reel.videoUrl) return false;
    if (prev.reel.description !== next.reel.description) return false;
    if (prev.reel.user.isFollowing !== next.reel.user.isFollowing) return false;
    if (prev.fadeAnim !== next.fadeAnim) return false;
    return true;
}

export const ReelItem = React.memo(ReelItemComponent, reelItemPropsAreEqual);
