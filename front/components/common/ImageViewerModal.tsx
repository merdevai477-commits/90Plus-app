import React, { useEffect } from 'react';
import { Modal, StyleSheet, TouchableOpacity, Dimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerModalProps {
    visible: boolean;
    imageUrl: string;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function ImageViewerModal({ visible, imageUrl, onClose }: ImageViewerModalProps) {
    const insets = useSafeAreaInsets();
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const resetTransform = () => {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    useEffect(() => {
        if (!visible) resetTransform();
    }, [visible, imageUrl]);

    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            const next = savedScale.value * e.scale;
            scale.value = Math.min(Math.max(next, 1), 4);
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value < 1.05) {
                scale.value = withTiming(1);
                savedScale.value = 1;
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            }
        });

    const pan = Gesture.Pan()
        .activeOffsetY([-16, 16])
        .activeOffsetX([-16, 16])
        .onUpdate((e) => {
            if (scale.value > 1.05) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            } else {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (scale.value <= 1.05 && e.translationY > 140) {
                runOnJS(onClose)();
                return;
            }
            if (scale.value <= 1.05) {
                translateY.value = withTiming(0);
                savedTranslateY.value = 0;
                savedTranslateX.value = 0;
            } else {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            }
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1.2) {
                scale.value = withTiming(1);
                savedScale.value = 1;
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withTiming(2.2);
                savedScale.value = 2.2;
            }
        });

    const composed = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

    const translateStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));
    const translateYStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));
    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Modal
            visible={visible && !!imageUrl}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <GestureHandlerRootView style={styles.container}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                <TouchableOpacity
                    style={[styles.closeButton, { top: Math.max(insets.top, 16) + 8 }]}
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                >
                    <Ionicons name="close-circle" size={40} color="#FFF" />
                </TouchableOpacity>

                <GestureDetector gesture={composed}>
                    <Animated.View style={translateStyle}>
                        <Animated.View style={translateYStyle}>
                            <Animated.View style={scaleStyle}>
                                <View style={styles.imageContainer}>
                                    {!!imageUrl && (
                                        <Image
                                            source={{ uri: imageUrl }}
                                            style={styles.image}
                                            contentFit="contain"
                                        />
                                    )}
                                </View>
                            </Animated.View>
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
    },
    imageContainer: {
        width,
        height: height * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});
