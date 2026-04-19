import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withDelay,
    runOnJS,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, AlertCircle, Info } from 'lucide-react-native';
import { COLORS } from '../reels/constants';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CustomToastProps {
    visible: boolean;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    onHide: () => void;
}

const TOAST_CONFIG = {
    success: {
        icon: Check,
        colors: [COLORS.neonGreen, '#15803d'] as [string, string],
        iconBg: 'rgba(50, 205, 50, 0.2)',
    },
    error: {
        icon: X,
        colors: ['#ef4444', '#dc2626'] as [string, string],
        iconBg: 'rgba(239, 68, 68, 0.2)',
    },
    warning: {
        icon: AlertCircle,
        colors: ['#f59e0b', '#d97706'] as [string, string],
        iconBg: 'rgba(245, 158, 11, 0.2)',
    },
    info: {
        icon: Info,
        colors: ['#3b82f6', '#2563eb'] as [string, string],
        iconBg: 'rgba(59, 130, 246, 0.2)',
    },
};

export default function CustomToast({
    visible,
    type,
    title,
    message,
    duration = 3000,
    onHide,
}: CustomToastProps) {
    const translateY = useSharedValue(-100);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);

    const config = TOAST_CONFIG[type];
    const IconComponent = config.icon;

    useEffect(() => {
        if (visible) {
            // Animate in
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.5)) });
            opacity.value = withTiming(1, { duration: 200 });
            scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.5)) });

            // Auto hide after duration
            translateY.value = withDelay(
                duration,
                withTiming(-100, { duration: 300 }, (finished) => {
                    if (finished) {
                        runOnJS(onHide)();
                    }
                })
            );
            opacity.value = withDelay(duration, withTiming(0, { duration: 300 }));
            scale.value = withDelay(duration, withTiming(0.8, { duration: 300 }));
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle<ViewStyle>(() => {
        // Reanimated's Transform type is very strict and TS sometimes infers a union for arrays of transforms.
        // Casting to ViewStyle['transform'] keeps it typed correctly without affecting runtime.
        const transform = [
            { translateY: translateY.value },
            { scale: scale.value },
        ] as unknown as ViewStyle['transform'];

        return {
            transform,
            opacity: opacity.value,
        };
    });

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <LinearGradient
                colors={['rgba(30, 30, 30, 0.95)', 'rgba(20, 20, 20, 0.98)']}
                style={styles.gradient}
            >
                {/* Accent Line */}
                <LinearGradient
                    colors={config.colors}
                    style={styles.accentLine}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />

                <View style={styles.content}>
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
                        <IconComponent size={24} color={config.colors[0]} />
                    </View>

                    {/* Text */}
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>{title}</Text>
                        {message && <Text style={styles.message}>{message}</Text>}
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
}

// Toast Manager for easy usage
let toastRef: {
    show: (type: ToastType, title: string, message?: string) => void;
} | null = null;

export const setToastRef = (ref: typeof toastRef) => {
    toastRef = ref;
};

export const showToast = (type: ToastType, title: string, message?: string) => {
    toastRef?.show(type, title, message);
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    gradient: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    accentLine: {
        height: 3,
        width: '100%',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 2,
    },
    message: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});
