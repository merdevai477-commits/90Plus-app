/**
 * Flexible liquid-glass surface — same depth as header back/share buttons.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';

const FALLBACK_BLUR = {
  intensity: Platform.OS === 'ios' ? 42 : 72,
  tint: 'dark' as const,
};

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

type CornerRadii = {
  topLeft?: number;
  topRight?: number;
  bottomLeft?: number;
  bottomRight?: number;
};

type Props = {
  children: React.ReactNode;
  borderRadius?: number;
  /** Per-corner radius — overrides `borderRadius` where set. */
  corners?: CornerRadii;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Stretch to fill a flex parent (grid cells, etc.). */
  fill?: boolean;
  /** Omit border on specific edges (twin-segment join). */
  borderEdges?: { hideLeft?: boolean; hideRight?: boolean };
  /** Softer shadow for nested / paired surfaces. */
  subtleShadow?: boolean;
};

function resolveRadii(borderRadius: number, corners?: CornerRadii): Required<CornerRadii> {
  return {
    topLeft: corners?.topLeft ?? borderRadius,
    topRight: corners?.topRight ?? borderRadius,
    bottomLeft: corners?.bottomLeft ?? borderRadius,
    bottomRight: corners?.bottomRight ?? borderRadius,
  };
}

function radiiStyle(r: Required<CornerRadii>): ViewStyle {
  return {
    borderTopLeftRadius: r.topLeft,
    borderTopRightRadius: r.topRight,
    borderBottomLeftRadius: r.bottomLeft,
    borderBottomRightRadius: r.bottomRight,
  };
}

export function LiquidGlassSurface({
  children,
  borderRadius = 22,
  corners,
  style,
  onPress,
  accessibilityLabel,
  fill = false,
  borderEdges,
  subtleShadow = false,
}: Props) {
  const r = resolveRadii(borderRadius, corners);
  const radiusStyle = radiiStyle(r);
  const innerR = {
    topLeft: Math.max(r.topLeft - 1, 0),
    topRight: Math.max(r.topRight - 1, 0),
    bottomLeft: Math.max(r.bottomLeft - 1, 0),
    bottomRight: Math.max(r.bottomRight - 1, 0),
  };
  const rimBorder: ViewStyle = {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: borderEdges?.hideLeft ? 0 : 1,
    borderRightWidth: borderEdges?.hideRight ? 0 : 1,
    borderColor: 'rgba(255,255,255,0.22)',
  };

  const shell = (
    <View
      style={[
        styles.shell,
        subtleShadow ? styles.shellShadowSoft : shellGlow,
        fill && styles.fill,
        radiusStyle,
        style,
      ]}
    >
      <View style={[styles.clip, fill && styles.fill, radiusStyle]}>
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            effect="regular"
            interactive={!!onPress}
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

        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.specular, radiiStyle({ ...r, bottomLeft: 0, bottomRight: 0 })]}
          pointerEvents="none"
        />

        <View
          style={[styles.outerRim, radiusStyle, rimBorder]}
          pointerEvents="none"
        />
        <View
          style={[
            styles.innerRim,
            radiiStyle(innerR),
            { borderColor: 'rgba(255,255,255,0.06)' },
          ]}
          pointerEvents="none"
        />

        <View style={[styles.content, fill && styles.fill]}>{children}</View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {shell}
      </Pressable>
    );
  }

  return shell;
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    flexDirection: 'column',
  },
  shellShadowSoft: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    default: {},
  }),
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  clip: {
    flex: 1,
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
    zIndex: 1,
  },
  outerRim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  innerRim: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  content: {
    zIndex: 3,
    alignSelf: 'stretch',
  },
});
