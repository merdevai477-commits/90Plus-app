/**
 * Badge Component
 * Material Design 3 badge with variants
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Typography, Spacing } from '../../src/designSystem/designSystem';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';

export interface BadgeProps {
  label: string | number;
  variant?: BadgeVariant;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradient?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; gradient?: readonly [string, string, ...string[]] }> = {
  primary: {
    bg: Colors.primary[500],
    text: Colors.onPrimary,
    gradient: [Colors.primary[500], Colors.primary[600]],
  },
  secondary: {
    bg: Colors.secondary[500],
    text: Colors.onSecondary,
    gradient: [Colors.secondary[500], Colors.secondary[600]],
  },
  success: {
    bg: Colors.success.default,
    text: Colors.onSuccess,
  },
  error: {
    bg: Colors.error.default,
    text: Colors.onError,
  },
  warning: {
    bg: Colors.warning.default,
    text: Colors.onWarning,
  },
  info: {
    bg: Colors.info.default,
    text: Colors.onInfo,
  },
};

const sizeStyles = {
  small: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.label.small.fontSize,
    borderRadius: BorderRadius.sm,
  },
  medium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    fontSize: Typography.label.medium.fontSize,
    borderRadius: BorderRadius.md,
  },
  large: {
    paddingHorizontal: Spacing.md + 4,
    paddingVertical: Spacing.sm,
    fontSize: Typography.label.large.fontSize,
    borderRadius: BorderRadius.md,
  },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
  gradient = false,
}) => {
  const variantStyle = variantColors[variant];
  const sizeStyle = sizeStyles[size];

  const badgeContent = (
    <Text
      style={[
        styles.text,
        {
          fontSize: sizeStyle.fontSize,
          color: variantStyle.text,
          fontWeight: Typography.label.medium.fontWeight,
        },
        textStyle,
      ]}
    >
      {label}
    </Text>
  );

  if (gradient && variantStyle.gradient) {
    return (
      <LinearGradient
        colors={variantStyle.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          {
            paddingHorizontal: sizeStyle.paddingHorizontal,
            paddingVertical: sizeStyle.paddingVertical,
            borderRadius: sizeStyle.borderRadius,
          },
          style,
        ]}
      >
        {badgeContent}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyle.bg,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          borderRadius: sizeStyle.borderRadius,
        },
        style,
      ]}
    >
      {badgeContent}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

