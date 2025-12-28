import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import { COLORS, EFFECTS } from './constants';

interface ReelHeaderProps {
    currentIndex: number;
    totalReels: number;
    fadeAnim?: Animated.Value;
    slideAnim?: Animated.Value;
}

export const ReelHeader: React.FC<ReelHeaderProps> = ({
    currentIndex,
    totalReels,
    fadeAnim,
    slideAnim,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    return (
        <Animated.View
            style={[
                styles.container,
                fadeAnim && { opacity: fadeAnim },
                slideAnim && { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <LinearGradient
                colors={['rgba(13, 13, 13, 0.8)', 'rgba(13, 13, 13, 0.4)']}
                style={styles.background}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <View style={styles.content}>
                    <Animated.View style={[styles.titleContainer, { transform: [{ scale: pulseAnim }] }]}>
                        <Trophy size={28} color={COLORS.goldenTrophy} fill={COLORS.goldenTrophy} />
                        <Text style={styles.title}>ريلز كروية</Text>
                    </Animated.View>

                    <View style={styles.counterBadge}>
                        <LinearGradient
                            colors={['rgba(255, 215, 0, 0.3)', 'rgba(57, 255, 20, 0.2)']}
                            style={styles.badgeGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.counter}>
                                {currentIndex + 1} / {totalReels}
                            </Text>
                        </LinearGradient>
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: 40,
        paddingBottom: 12,
    },
    background: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.goldenTrophy,
        letterSpacing: 0.5,
        ...EFFECTS.goldGlow,
    },
    counterBadge: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    badgeGradient: {
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    counter: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.pureWhite,
    },
});
