/**
 * Button Component
 * Material Design 3 button with variants and animations
 */

import React from 'react';
import { Text, StyleSheet, TextStyle, ViewStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, BorderRadius, Spacing, Animation, TouchTargets } from '../../src/designSystem/designSystem';

import { TouchableOpacity as RNTouchableOpacity } from 'react-native';
const AnimatedTouchable = Animated.createAnimatedComponent(RNTouchableOpacity) as any;

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

const sizeConfig = {
  small: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.label.small.fontSize,
    minHeight: TouchTargets.minimum,
  },
  medium: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.label.medium.fontSize,
    minHeight: TouchTargets.comfortable,
  },
  large: {
    paddingVertical: Spacing.md + 4,
    paddingHorizontal: Spacing.xl,
    fontSize: Typography.label.large.fontSize,
    minHeight: TouchTargets.large,
  },
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.97, Animation.spring.standard);
      opacity.value = withTiming(0.8, { duration: Animation.duration.short });
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Animation.spring.standard);
    opacity.value = withTiming(1, { duration: Animation.duration.short });
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onPress();
    }
  };

  const config = sizeConfig[size];
  const isDisabled = disabled || loading;

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      minHeight: config.minHeight,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: Spacing.sm,
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    if (variant === 'primary') {
      return baseStyle;
    }

    if (variant === 'outline') {
      return {
        ...baseStyle,
        borderWidth: 1.5,
        borderColor: Colors.primary[500],
        backgroundColor: 'transparent',
      };
    }

    if (variant === 'ghost') {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
      };
    }

    return baseStyle;
  };

  const getTextColor = (): string => {
    if (variant === 'primary') {
      return Colors.onPrimary;
    }
    if (variant === 'secondary') {
      return Colors.onSecondary;
    }
    return Colors.primary[500];
  };

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.onPrimary : Colors.primary[500]}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            color: isDisabled
              ? Colors.onSurface.disabled
              : getTextColor(),
            fontWeight: Typography.label.medium.fontWeight,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </>
  );

  if (variant === 'primary' && !isDisabled) {
    return (
      <AnimatedTouchable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[animatedStyle, style]}
      >
        <LinearGradient
          colors={[Colors.primary[500], Colors.primary[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            getButtonStyle(),
            {
              paddingVertical: config.paddingVertical,
              paddingHorizontal: config.paddingHorizontal,
            },
          ]}
        >
          {buttonContent}
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      style={[
        animatedStyle,
        getButtonStyle(),
        {
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {buttonContent}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
