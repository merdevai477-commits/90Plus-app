import React, { useState, useRef, useEffect } from 'react';
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

import { VideoPlayer } from '../Matches/VideoPlayer';
import { DoubleTapLikeAnimation } from '../Matches/DoubleTapAnimation';
import { ReelData } from './types';
import { COLORS, GRADIENTS, EFFECTS } from './constants';
import { useReelHaptics } from './useReelHaptics';
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
    onHashtagPress?: (tag: string) => void;
    onMentionPress?: (username: string) => void;
    onTogglePlayPause?: () => void;
    onVideoRef: (ref: any, id: string) => void;
    fadeAnim?: RNAnimated.Value;
    slideAnim?: RNAnimated.Value;
    pulseAnim?: RNAnimated.Value;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper function to format numbers
const formatCount = (count: number): string => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

// Modern Reel Item Component with App Colors 🎨
export const ReelItem: React.FC<ReelItemProps> = ({
    reel,
    isActive,
    onLike,
    onToggleMute,
    onComment,
    onReport,
    onShare,
    onSave,
    onUserPress,
    onHashtagPress,
    onMentionPress,
    onVideoRef,
    fadeAnim,
    slideAnim,
    pulseAnim,
}) => {
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
    const [isPaused, setIsPaused] = useState(false);
    const lastTapRef = useRef(0);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const haptics = useReelHaptics();
    const { t } = useLanguage();

    // Animations
    const glowAnim = useRef(new RNAnimated.Value(0)).current;
    const scaleAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        if (isActive) {
            RNAnimated.loop(
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
            ).start();
        } else {
            // Reset pause state when not active
            setIsPaused(false);
        }
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
        } else {
            // Single tap - wait to see if it's double
            singleTapTimer.current = setTimeout(() => {
                setIsPaused(prev => !prev);
                singleTapTimer.current = null;
            }, 300);
        }

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

    const showShareMenu = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [
                        t.reels.shareToWhatsApp,
                        t.reels.shareToFacebook,
                        t.reels.copyLink,
                        t.reels.downloadVideo,
                        t.common.cancel,
                    ],
                    cancelButtonIndex: 4,
                },
                (buttonIndex) => {
                    if (buttonIndex === 0) {
                        // WhatsApp
                        onShare();
                    } else if (buttonIndex === 1) {
                        // Facebook
                        onShare();
                    } else if (buttonIndex === 2) {
                        // Copy link
                        onShare();
                    } else if (buttonIndex === 3) {
                        // Download
                        onShare();
                    }
                }
            );
        } else {
            // Android - use Share API
            RNShare.share({
                message: reel.description || '',
            });
        }
    };

    const handleLikePress = () => {
        haptics.mediumImpact(); // Vibration on like
        onLike();
    };

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8],
    });

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
                <VideoPlayer
                    reel={reel}
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
                style={styles.topGradient}
                pointerEvents="none"
            />
            <LinearGradient
                colors={GRADIENTS.bottomFade}
                style={styles.bottomGradient}
                pointerEvents="none"
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
                            {reel.user.followers && (
                                <Text style={styles.userFollowers}>
                                    {formatCount(reel.user.followers)} {t.profile.followers}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {!reel.user.isFollowing && (
                        <TouchableOpacity
                            style={styles.followButton}
                            onPress={() => haptics.lightImpact()}
                        >
                            <LinearGradient
                                colors={GRADIENTS.greenGlow}
                                style={styles.followButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.followButtonText}>{t.reels.follow}</Text>
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
                            {formatCount(reel.views)} {t.reels.views}
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
                    onPress={() => { haptics.lightImpact(); onReport(); }}
                    activeOpacity={0.7}
                >
                    <View style={styles.buttonGlass}>
                        <MoreVertical size={26} color={COLORS.textPrimary} strokeWidth={2} />
                    </View>
                </TouchableOpacity>
            </View>
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
    followButtonGradient: {
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    followButtonText: {
        color: COLORS.deepBlack,
        fontSize: 13,
        fontWeight: '700',
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
