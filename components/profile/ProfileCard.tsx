import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path, ClipPath, Image as SvgImage } from 'react-native-svg';

interface ProfileCardProps {
    playerImage: any;
    cardType?: 'gold' | 'icon' | 'toty';
    scale?: number;
    onImageUpload?: () => void;
    uploadedImage?: string | null;
    countryFlag?: string;
    onCountryPress?: () => void;
    position?: string;
    age?: string | number;
    height?: string | number;
    weight?: string | number;
    foot?: string;
    onPositionPress?: () => void;
    onStatsPress?: () => void;
    clubLogo?: string;
    onClubPress?: () => void;
    brandLogo?: string;
    onBrandPress?: () => void;
    // Loading states
    isAvatarUploading?: boolean;
    isCountryUpdating?: boolean;
    isClubUpdating?: boolean;
    isBrandUpdating?: boolean;
    isStatsUpdating?: boolean;
}

const WIDTH = 300;
const HEIGHT = 460;
const gradientColors = ['#a17f37', '#FFD700', '#a17f37']; // Gold Gradient

// ✅ PERFORMANCE: Memoize component to prevent unnecessary re-renders
const ProfileCard = memo(function ProfileCard({
    playerImage,
    cardType = 'gold',
    scale = 0.66,
    onImageUpload,
    uploadedImage,
    countryFlag,
    onCountryPress,
    position,
    onPositionPress,
    age,
    height,
    weight,
    foot,
    onStatsPress,
    clubLogo,
    onClubPress,
    brandLogo,
    onBrandPress,
    isAvatarUploading = false,
    isCountryUpdating = false,
    isClubUpdating = false,
    isBrandUpdating = false,
    isStatsUpdating = false,
}: ProfileCardProps) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const holoAnim = useRef(new Animated.Value(0)).current;
    // ✅ PERFORMANCE: Store animation instances in refs to properly cleanup
    const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
    const holoLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        // ✅ OPTIMIZATION: Reduce animation complexity for better performance
        // Professional shimmer with slower, more elegant timing
        shimmerLoopRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 4000, // Slightly slower for less CPU usage
                    easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                    useNativeDriver: true, // ✅ Critical for performance
                }),
                Animated.delay(2500) // Longer pause reduces CPU usage
            ])
        );

        // Subtle holographic effect
        holoLoopRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(holoAnim, {
                    toValue: 1,
                    duration: 5000, // Slower for less overhead
                    easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
                    useNativeDriver: true,
                }),
                Animated.timing(holoAnim, {
                    toValue: 0,
                    duration: 5000,
                    easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
                    useNativeDriver: true,
                })
            ])
        );

        shimmerLoopRef.current.start();
        holoLoopRef.current.start();

        // ✅ CRITICAL FIX: Proper cleanup to prevent memory leaks
        return () => {
            if (shimmerLoopRef.current) {
                shimmerLoopRef.current.stop();
                shimmerLoopRef.current = null;
            }
            if (holoLoopRef.current) {
                holoLoopRef.current.stop();
                holoLoopRef.current = null;
            }
            // Reset animated values
            shimmerAnim.setValue(0);
            holoAnim.setValue(0);
        };
    }, []); // ✅ Empty deps - only run once

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-400 * scale, 700 * scale], // Wider sweep
    });

    const shimmerOpacity = shimmerAnim.interpolate({
        inputRange: [0, 0.3, 0.7, 1],
        outputRange: [0, 0.8, 0.8, 0], // Fade in/out
    });

    const holoOpacity = holoAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.1, 0.25, 0.1], // Subtle pulsing
    });

    const cardWidth = WIDTH * scale;
    const cardHeight = HEIGHT * scale;

    return (
        <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
            {/* Stronger Glow Effect */}
            <View style={[styles.glow, { width: cardWidth, height: cardHeight }]} />

            {/* FIFA Card Shape with Gradient Border */}
            <Svg width={cardWidth} height={cardHeight} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={styles.cardSvg}>
                {/* ... existing SVG content ... */}
                <Defs>
                    <SvgLinearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="1" />
                        <Stop offset="50%" stopColor="#FFF" stopOpacity="1" />
                        <Stop offset="100%" stopColor={gradientColors[2]} stopOpacity="1" />
                    </SvgLinearGradient>
                    <ClipPath id="quadrantClip">
                        <Path d="M150 12 L286 37 L286 230 L150 230 Z" />
                    </ClipPath>
                </Defs>

                {/* FIFA Card Border Path */}
                <Path
                    d="M150 8 L290 35 L290 380 L240 420 L150 452 L60 420 L10 380 L10 35 Z"
                    fill="url(#borderGradient)"
                />

                {/* Inner Card Background */}
                <Path
                    d="M150 12 L286 37 L286 378 L238 418 L150 448 L62 418 L14 378 L14 37 Z"
                    fill="#FFB700"
                />

                {/* User Image - Rendered HERE inside the same SVG to share Defs/ClipPath */}
                {uploadedImage && (
                    <SvgImage
                        x="150"
                        y="12"
                        width="136"
                        height="218"
                        href={{ uri: uploadedImage }}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#quadrantClip)"
                    />
                )}
            </Svg>

            {/* Professional Shimmer & Holographic Overlay */}
            <View style={[styles.shimmerContainer, { width: cardWidth, height: cardHeight }]}>
                {/* Gold Shimmer - Professional sweep */}
                <Animated.View
                    style={[
                        styles.shimmer,
                        {
                            opacity: shimmerOpacity,
                            transform: [
                                { translateX: shimmerTranslate },
                                { rotate: '25deg' } // Diagonal sweep
                            ]
                        }
                    ]}
                >
                    <LinearGradient
                        colors={[
                            'transparent',
                            'rgba(255, 255, 255, 0.15)',
                            'rgba(255, 223, 0, 0.4)', // Gold highlight
                            'rgba(255, 255, 255, 0.15)',
                            'transparent'
                        ]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    />
                </Animated.View>

                {/* Subtle Holographic Rainbow Effect */}
                <Animated.View
                    style={[
                        styles.holoEffect,
                        {
                            opacity: holoOpacity,
                        }
                    ]}
                >
                    <LinearGradient
                        colors={[
                            'rgba(255, 215, 0, 0.15)',   // Gold
                            'rgba(255, 140, 0, 0.1)',    // Dark Orange
                            'rgba(255, 215, 0, 0.15)',   // Gold
                            'rgba(184, 134, 11, 0.1)',   // Dark Goldenrod
                        ]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>
            </View>

            {/* Top-Right Quadrant: Touch Area (Transparent Overlay) */}
            <TouchableOpacity
                style={[styles.quadrantContainer, {
                    top: 12 * scale,
                    left: 150 * scale,
                    width: 136 * scale,
                    height: 218 * scale,
                }]}
                onPress={onImageUpload}
                activeOpacity={0.8}
            >
                {!uploadedImage && (
                    <View style={styles.uploadPlaceholder}>
                        <View style={styles.plusHorz} />
                        <View style={styles.plusVert} />
                    </View>
                )}
            </TouchableOpacity>

            {/* Top-Left Quadrant: Info Area */}
            <View style={[styles.quadrantContainer, {
                top: 12 * scale,
                left: 14 * scale,
                width: 136 * scale,
                height: 218 * scale,
                borderTopLeftRadius: 36 * scale,
                justifyContent: 'center',
                alignItems: 'center',
            }]}>
                <TouchableOpacity onPress={onPositionPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{
                        fontSize: 28 * scale,
                        fontWeight: '900',
                        color: '#000',
                        marginBottom: 10 * scale,
                        textAlign: 'center'
                    }}>
                        {position || '--'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onCountryPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    {(() => {
                        // Try to get country code from emoji or use as-is
                        const code = countryFlag ? (
                            // Check if it's an emoji flag
                            countryFlag.length <= 4 && countryFlag.codePointAt(0)! >= 0x1F1E6
                                ? (() => {
                                    const codePoints = [...countryFlag];
                                    if (codePoints.length === 2) {
                                        const first = codePoints[0].codePointAt(0)!;
                                        const second = codePoints[1].codePointAt(0)!;
                                        if (first >= 0x1F1E6 && first <= 0x1F1FF && second >= 0x1F1E6 && second <= 0x1F1FF) {
                                            return String.fromCharCode(first - 0x1F1E6 + 65, second - 0x1F1E6 + 65).toLowerCase();
                                        }
                                    }
                                    return null;
                                })()
                                : countryFlag.toLowerCase()
                        ) : null;

                        if (code && code.length === 2) {
                            return (
                                <Image
                                    source={{ uri: `https://flagcdn.com/w80/${code}.png` }}
                                    style={{ width: 36 * scale, height: 25 * scale, borderRadius: 3 * scale }}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                    priority="high"
                                    transition={200}
                                />
                            );
                        }
                        return (
                            <Text style={{ fontSize: 40 * scale, color: '#000', fontWeight: 'bold' }}>
                                {countryFlag || '--'}
                            </Text>
                        );
                    })()}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', marginTop: 5 * scale, gap: 5 * scale }}>
                    <TouchableOpacity onPress={onClubPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {clubLogo ? (
                            <Image
                                source={{ uri: clubLogo }}
                                style={{ width: 30 * scale, height: 30 * scale }}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={200}
                            />
                        ) : (
                            <View style={[styles.miniPlaceholder, { width: 30 * scale, height: 30 * scale, backgroundColor: '#000' }]}>
                                <Text style={{ fontSize: 16 * scale, color: '#FFD700' }}>⚽</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onBrandPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {brandLogo ? (
                            <Image
                                source={{ uri: brandLogo }}
                                style={{ width: 30 * scale, height: 30 * scale }}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={200}
                            />
                        ) : (
                            <View style={[styles.miniPlaceholder, { width: 30 * scale, height: 30 * scale, backgroundColor: '#000' }]}>
                                <Text style={{ fontSize: 16 * scale, color: '#FFD700' }}>👟</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Player Image Container - Centered - REMOVED/HIDDEN as per request, image is now in top-right */}
            {/* 
            <View style={[styles.imageContainer, { ... }]}> ... </View> 
            */}

            {/* Bottom half: Premium Stats Grid */}
            {/* Position: below the horizontal line (y=230) */}
            <View style={{
                position: 'absolute',
                top: 180 * scale,
                left: 14 * scale,
                width: 272 * scale, // 286 - 14
                height: 148 * scale, // 378 - 230 (approx end of straight part)
                justifyContent: 'center',
                alignItems: 'center',
                // backgroundColor: 'rgba(0,0,0,0.1)' // Debug
            }}>
                {/* Name & Username */}
                {/* Note: Name is usually outside card in previous design, but user said "make it look premium". 
                    If stats are inside, name should be outside? 
                    Actually, user sketch shows name below card. 
                    So inside this area we put the requested: Age, Weight, Height, Foot
                */}

                <TouchableOpacity style={styles.statsContainer} onPress={onStatsPress}>
                    {/* Row 1: Age & Height */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statItem, { paddingTop: 79 }]}>
                            <Text style={styles.statLabel}>AGE</Text>
                            <Text style={styles.statValue}>{age || '--'}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={[styles.statItem, { paddingTop: 79 }]}>
                            <Text style={styles.statLabel}>HGT</Text>
                            <Text style={styles.statValue}>{height || '--'}</Text>
                        </View>
                    </View>

                    {/* Divider between rows */}
                    <View style={styles.rowDivider} />

                    {/* Row 2: Weight & Foot */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statItem, { paddingTop: 0 }]}>
                            <Text style={styles.statLabel}>WGT</Text>
                            <Text style={styles.statValue}>{weight || '--'}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={[styles.statItem, { paddingTop: 0 }]}>
                            <Text style={styles.statLabel}>FOOT</Text>
                            <Text style={styles.statValue}>{foot || '--'}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
});

// ✅ PERFORMANCE: Export memoized component as default
export default ProfileCard;

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 20,
        // Force LTR direction to prevent card layout from flipping in RTL languages
        direction: 'ltr',
    },
    cardSvg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    imageContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        backgroundColor: 'transparent',
    },
    quadrantContainer: {
        position: 'absolute',
        overflow: 'hidden',
        zIndex: 5,
    },
    uploadPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusHorz: {
        width: 12,
        height: 2,
        backgroundColor: '#000',
        position: 'absolute'
    },
    plusVert: {
        width: 2,
        height: 12,
        backgroundColor: '#000',
        position: 'absolute'
    },
    statsContainer: {
        width: '100%',
        paddingHorizontal: 20,
        flexDirection: 'column',
        justifyContent: 'center',
        paddingVertical: 10, // Added padding
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginVertical: 8, // Increased from 4
        direction: 'ltr', // Prevent RTL flip
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: 'rgba(0,0,0,0.5)',
        marginBottom: 4, // Increased from 2
        letterSpacing: 1, // Added for premium feel
        writingDirection: 'ltr',
    },
    statValue: {
        fontSize: 17, // Slight increase
        fontWeight: '900',
        color: '#000',
        lineHeight: 20, // Constrain line height
        writingDirection: 'ltr',
    },
    miniPlaceholder: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 24, // Increased from 20
        backgroundColor: 'rgba(0,0,0,0.1)',
        marginHorizontal: 10,
    },
    rowDivider: {
        height: 1,
        width: '80%',
        backgroundColor: 'rgba(0,0,0,0.1)',
        alignSelf: 'center',
        marginVertical: 6, // Increased from 4
    },
    shimmerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 2,
        overflow: 'hidden',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        pointerEvents: 'none',
    },
    shimmer: {
        width: '80%',
        height: '300%',
        position: 'absolute',
        top: '-100%',
        left: '-40%',
    },
    holoEffect: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    glow: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: 20,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 60,
        elevation: 60,
        zIndex: -1,
    }
});
