import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from './constants';

interface LoadingBallProps {
    visible: boolean;
}

export const LoadingBall: React.FC<LoadingBallProps> = ({ visible }) => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(bounceAnim, {
                        toValue: -35,
                        duration: 600,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(bounceAnim, {
                        toValue: 0,
                        duration: 600,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [visible, spinAnim, scaleAnim, bounceAnim]);

    if (!visible) return null;

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            <View style={styles.shadow} />
            <Animated.View
                style={[
                    styles.ball,
                    {
                        transform: [
                            { translateY: bounceAnim },
                            { rotate: spin },
                            { scale: scaleAnim },
                        ],
                    },
                ]}
            >
                <View style={styles.pentagon} />
                <View style={[styles.pentagon, styles.pentagon2]} />
                <View style={[styles.pentagon, styles.pentagon3]} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
    },
    ball: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: COLORS.textPrimary,
        borderWidth: 2,
        borderColor: COLORS.textSecondary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 18,
        elevation: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shadow: {
        position: 'absolute',
        bottom: '46%',
        width: 50,
        height: 8,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    pentagon: {
        position: 'absolute',
        width: 16,
        height: 16,
        backgroundColor: COLORS.deepBlack,
        transform: [{ rotate: '0deg' }],
    },
    pentagon2: {
        transform: [{ rotate: '72deg' }],
        top: -4,
        left: 8,
    },
    pentagon3: {
        transform: [{ rotate: '144deg' }],
        bottom: -4,
        right: 8,
    },
});
