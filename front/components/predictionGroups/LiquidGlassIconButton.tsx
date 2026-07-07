/**
 * Circular liquid-glass icon button — challenge-detail style (frosted disc +
 * white icon). Used for header back / share actions.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';

const DEFAULT_SIZE = 44;

const FALLBACK_BLUR = {
  intensity: Platform.OS === 'ios' ? 42 : 72,
  tint: 'dark' as const,
};

export function LiquidGlassIconButton({
  onPress,
  children,
  accessibilityLabel,
  size = DEFAULT_SIZE,
}: {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  size?: number;
}) {
  const radius = size / 2;

  const shellGlow = Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.38,
      shadowRadius: 10,
    },
    android: { elevation: 6 },
    default: {},
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.shell,
        { width: size, height: size, borderRadius: radius },
        shellGlow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.clip, { width: size, height: size, borderRadius: radius }]}>
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            effect="regular"
            interactive
            tintColor="rgba(28,18,42,0.52)"
            colorScheme="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            <BlurView {...FALLBACK_BLUR} style={StyleSheet.absoluteFill} />
            <View style={styles.darkTint} pointerEvents="none" />
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.16)',
                'rgba(255,255,255,0.05)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        )}

        {/* Specular top arc — glass edge catch */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.specular, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
          pointerEvents="none"
        />

        <View
          style={[styles.outerRim, { borderRadius: radius, borderColor: 'rgba(255,255,255,0.22)' }]}
          pointerEvents="none"
        />
        <View
          style={[styles.innerRim, { borderRadius: radius - 1, borderColor: 'rgba(255,255,255,0.06)' }]}
          pointerEvents="none"
        />

        <View style={styles.content}>{children}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'visible',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(12,8,20,0.55)' : 'transparent',
  },
  darkTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    opacity: 0.85,
  },
  outerRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  innerRim: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
