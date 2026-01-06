/**
 * Card Component
 * Material Design 3 card with elevation and glassmorphism support
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Elevation, BorderRadius, Spacing, Animation } from '../../src/designSystem/designSystem';
import * as Haptics from 'expo-haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity) as any;

export interface CardProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  elevation?: keyof typeof Elevation;
  borderRadius?: number;
  style?: ViewStyle;
  gradient?: string[];
  glass?: boolean;
  onPress?: () => void;
  haptic?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 2,
  borderRadius = BorderRadius.lg,
  style,
  gradient,
  glass = false,
  onPress,
  haptic = true,
  ...props
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, Animation.spring.standard);
      opacity.value = withTiming(0.9, { duration: Animation.duration.short });
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Animation.spring.standard);
    opacity.value = withTiming(1, { duration: Animation.duration.short });
  };

  const cardStyle = [
    styles.card,
    {
      borderRadius,
      ...Elevation[elevation],
    },
    glass && createGlassStyle(),
    style,
  ];

  const content = (
    <Animated.View style={[cardStyle, animatedStyle]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        {...props}
      >
        {content}
      </AnimatedTouchable>
    );
  }

  return content;
};

const createGlassStyle = () => ({
  backgroundColor: Colors.glass.medium,
  borderWidth: 1,
  borderColor: Colors.glass.border,
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.container,
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
