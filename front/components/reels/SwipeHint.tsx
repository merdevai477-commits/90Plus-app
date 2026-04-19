import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronUp } from 'lucide-react-native';
import { COLORS } from './constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface SwipeHintProps {
    visible: boolean;
    fadeAnim?: Animated.Value;
    slideAnim?: Animated.Value;
}

export const SwipeHint: React.FC<SwipeHintProps> = ({ visible, fadeAnim, slideAnim }) => {
    const bounceAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const { t } = useLanguage();

    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(bounceAnim, {
                        toValue: -12,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(bounceAnim, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [visible, bounceAnim, glowAnim]);

    if (!visible) return null;

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                fadeAnim && { opacity: fadeAnim },
                { transform: [{ translateY: bounceAnim }] },
            ]}
        >
            <LinearGradient
                colors={['rgba(50, 205, 50, 0.25)' as const, 'rgba(57, 255, 20, 0.15)' as const]}
                style={styles.hintCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <Animated.View style={[styles.iconContainer, { opacity: glowOpacity }]}>
                    <ChevronUp size={28} color={COLORS.primary} strokeWidth={3} />
                </Animated.View>
                <Text style={styles.text}>{t.reels.swipeUp}</Text>
                <View style={styles.emoji}>
                    <Text style={styles.emojiText}>⚽</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 45,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
    },
    hintCard: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 26,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    iconContainer: {
        alignItems: 'center',
    },
    text: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    emoji: {
        marginLeft: 2,
    },
    emojiText: {
        fontSize: 18,
    },
});
