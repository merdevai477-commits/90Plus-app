import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from './reels/constants';

const { width, height } = Dimensions.get('window');

interface AuthLoadingScreenProps {
    message?: string;
}

// Golden Football Icon Component
const GoldenFootball = ({ size = 80 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Main ball */}
        <Circle cx="50" cy="50" r="45" fill="#FFD700" />
        {/* Pentagon patterns */}
        <Path
            d="M50 15 L65 35 L58 55 L42 55 L35 35 Z"
            fill="#1a1a1a"
        />
        <Path
            d="M80 40 L85 60 L70 75 L55 65 L65 45 Z"
            fill="#1a1a1a"
        />
        <Path
            d="M20 40 L35 45 L45 65 L30 75 L15 60 Z"
            fill="#1a1a1a"
        />
        <Path
            d="M35 80 L45 70 L55 70 L65 80 L50 90 Z"
            fill="#1a1a1a"
        />
        {/* Highlight */}
        <Circle cx="35" cy="30" r="8" fill="rgba(255,255,255,0.4)" />
    </Svg>
);

export default function AuthLoadingScreen({ message = 'جاري تسجيل الدخول...' }: AuthLoadingScreenProps) {
    // Animation values
    const logoScale = useSharedValue(0);
    const logoRotate = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const dotsOpacity1 = useSharedValue(0);
    const dotsOpacity2 = useSharedValue(0);
    const dotsOpacity3 = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.3);

    useEffect(() => {
        // Logo entrance animation
        logoScale.value = withSequence(
            withTiming(1.2, { duration: 400, easing: Easing.out(Easing.back) }),
            withTiming(1, { duration: 200 })
        );

        // Continuous spinning rotation
        logoRotate.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        // Text fade in
        textOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));

        // Dots animation (loading indicator)
        dotsOpacity1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0.3, { duration: 300 })
            ),
            -1,
            true
        );
        dotsOpacity2.value = withDelay(
            150,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 300 }),
                    withTiming(0.3, { duration: 300 })
                ),
                -1,
                true
            )
        );
        dotsOpacity3.value = withDelay(
            300,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 300 }),
                    withTiming(0.3, { duration: 300 })
                ),
                -1,
                true
            )
        );

        // Pulse animation
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );

        // Glow animation
        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 1500 }),
                withTiming(0.3, { duration: 1500 })
            ),
            -1,
            true
        );
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: logoScale.value },
            { rotate: `${logoRotate.value}deg` },
        ],
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
    }));

    const dot1Style = useAnimatedStyle(() => ({
        opacity: dotsOpacity1.value,
    }));

    const dot2Style = useAnimatedStyle(() => ({
        opacity: dotsOpacity2.value,
    }));

    const dot3Style = useAnimatedStyle(() => ({
        opacity: dotsOpacity3.value,
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: interpolate(pulseScale.value, [1, 1.5], [0.5, 0]),
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[COLORS.deepBlack, '#0a1a0a', COLORS.deepBlack]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Background Glow */}
            <Animated.View style={[styles.backgroundGlow, glowStyle]}>
                <LinearGradient
                    colors={['transparent', COLORS.neonGreen, 'transparent']}
                    style={styles.glowGradient}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                />
            </Animated.View>

            {/* Pulse Ring */}
            <Animated.View style={[styles.pulseRing, pulseStyle]} />

            {/* Logo Container - Golden Spinning Football */}
            <Animated.View style={[styles.logoContainer, logoStyle]}>
                <View style={styles.ballWrapper}>
                    <GoldenFootball size={90} />
                </View>
            </Animated.View>

            {/* App Name */}
            <Animated.Text style={[styles.appName, textStyle]}>
                90Plus
            </Animated.Text>

            {/* Loading Message */}
            <Animated.View style={[styles.messageContainer, textStyle]}>
                <Text style={styles.message}>{message}</Text>
                <View style={styles.dotsContainer}>
                    <Animated.View style={[styles.dot, dot1Style]} />
                    <Animated.View style={[styles.dot, dot2Style]} />
                    <Animated.View style={[styles.dot, dot3Style]} />
                </View>
            </Animated.View>

            {/* Bottom Decoration */}
            <View style={styles.bottomDecoration}>
                <View style={styles.line} />
                <Text style={styles.tagline}>Your Football Universe</Text>
                <View style={styles.line} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.deepBlack,
    },
    backgroundGlow: {
        position: 'absolute',
        width: width * 2,
        height: 200,
        top: height * 0.3,
    },
    glowGradient: {
        flex: 1,
        opacity: 0.1,
    },
    pulseRing: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    logoContainer: {
        marginBottom: 30,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 20,
    },
    ballWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFD700',
    },
    logoGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appName: {
        fontSize: 42,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 20,
        letterSpacing: 2,
    },
    messageContainer: {
        alignItems: 'center',
    },
    message: {
        fontSize: 18,
        color: COLORS.textSecondary,
        marginBottom: 15,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFD700',
    },
    bottomDecoration: {
        position: 'absolute',
        bottom: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    line: {
        width: 40,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    tagline: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1,
    },
});
