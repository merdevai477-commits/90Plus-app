import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    withSpring,
    Easing,
    interpolate,
    runOnJS,
    type SharedValue,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface AuthLoadingScreenProps {
    message?: string;
}

export default function AuthLoadingScreen({ message = 'جاري تسجيل الدخول...' }: AuthLoadingScreenProps) {

    // --- Logo ---
    const logoScale   = useSharedValue(0.6);
    const logoOpacity = useSharedValue(0);

    // --- Progress bar ---
    const progressWidth = useSharedValue(0);

    // --- Shimmer on progress bar ---
    const shimmerX = useSharedValue(-width);

    // --- Message text ---
    const textOpacity   = useSharedValue(0);
    const textTranslateY = useSharedValue(12);

    // --- Bouncing dots ---
    const dot1Y = useSharedValue(0);
    const dot2Y = useSharedValue(0);
    const dot3Y = useSharedValue(0);

    // --- Glow pulse ---
    const glowScale   = useSharedValue(0.8);
    const glowOpacity = useSharedValue(0);

    useEffect(() => {
        // Logo entrance — spring pop
        logoOpacity.value = withTiming(1, { duration: 350 });
        logoScale.value   = withSpring(1, { damping: 12, stiffness: 140 });

        // Glow breathing
        glowOpacity.value = withDelay(200, withRepeat(
            withSequence(
                withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.18, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            ), -1, true
        ));
        glowScale.value = withDelay(200, withRepeat(
            withSequence(
                withTiming(1.18, { duration: 900 }),
                withTiming(0.92, { duration: 900 }),
            ), -1, true
        ));

        // Progress bar — fast initial burst then slows (feels snappy)
        progressWidth.value = withSequence(
            withTiming(0.55 * width, { duration: 600, easing: Easing.out(Easing.cubic) }),
            withTiming(0.75 * width, { duration: 1200, easing: Easing.out(Easing.quad) }),
            withTiming(0.88 * width, { duration: 2000, easing: Easing.out(Easing.quad) }),
        );

        // Shimmer sweep on progress bar
        shimmerX.value = withDelay(300, withRepeat(
            withTiming(width * 1.2, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            -1, false
        ));

        // Message text slide-up fade-in
        textOpacity.value    = withDelay(250, withTiming(1, { duration: 400 }));
        textTranslateY.value = withDelay(250, withSpring(0, { damping: 16, stiffness: 120 }));

        // Bouncing dots — cascade
        const dotBounce = (dot: SharedValue<number>, delay: number) => {
            dot.value = withDelay(delay, withRepeat(
                withSequence(
                    withTiming(-8, { duration: 280, easing: Easing.out(Easing.quad) }),
                    withTiming(0,  { duration: 280, easing: Easing.in(Easing.quad) }),
                    withTiming(0,  { duration: 180 }), // brief rest
                ), -1, false
            ));
        };
        dotBounce(dot1Y, 400);
        dotBounce(dot2Y, 560);
        dotBounce(dot3Y, 720);

    }, []);

    // Styles
    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [{ scale: logoScale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: glowScale.value }],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        width: progressWidth.value,
    }));

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }],
    }));

    const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1Y.value }] }));
    const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2Y.value }] }));
    const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3Y.value }] }));

    return (
        <View style={styles.container}>
            {/* Background gradient */}
            <LinearGradient
                colors={['#1a0035', '#2d0060', '#1a0035']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Soft radial glow behind logo */}
            <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

            {/* Logo */}
            <Animated.View style={[styles.logoContainer, logoStyle]}>
                <Image
                    source={require('../assets/images/90Plus.png')}
                    style={styles.logo}
                    contentFit="contain"
                    priority="high"
                    cachePolicy="memory-disk"
                />
            </Animated.View>

            {/* Message + dots */}
            <Animated.View style={[styles.messageRow, textStyle]}>
                <Text style={styles.message}>{message}</Text>
                <View style={styles.dotsRow}>
                    <Animated.View style={[styles.dot, dot1Style]} />
                    <Animated.View style={[styles.dot, dot2Style]} />
                    <Animated.View style={[styles.dot, dot3Style]} />
                </View>
            </Animated.View>

            {/* Progress bar */}
            <View style={styles.trackOuter}>
                <Animated.View style={[styles.progressFill, progressStyle]}>
                    {/* Shimmer overlay */}
                    <Animated.View style={[StyleSheet.absoluteFill, styles.shimmerWrapper, shimmerStyle]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']}
                            style={styles.shimmerGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    </Animated.View>
                </Animated.View>
            </View>

            {/* Bottom tagline */}
            <Text style={styles.tagline}>90 Plus · عالمك الكروي</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a0035',
    },
    glow: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: '#7B2FBE',
        // iOS shadow for bloom effect
        shadowColor: '#9B59F5',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 80,
        elevation: 0,
    },
    logoContainer: {
        marginBottom: 32,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
    },
    logo: {
        width: 110,
        height: 110,
    },
    messageRow: {
        alignItems: 'center',
        marginBottom: 28,
        gap: 10,
    },
    message: {
        fontSize: 17,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 16,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#C084FC',
    },
    trackOuter: {
        width: width * 0.62,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#9B59F5',
        overflow: 'hidden',
    },
    shimmerWrapper: {
        width: 80,
    },
    shimmerGradient: {
        flex: 1,
    },
    tagline: {
        position: 'absolute',
        bottom: 52,
        fontSize: 12,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1.2,
        fontWeight: '500',
    },
});
