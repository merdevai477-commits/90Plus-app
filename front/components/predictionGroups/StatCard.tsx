/**
 * StatCard — premium liquid-glass stat tile for the group hero 2×2 grid.
 */

import React, { useEffect, useId } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { AnimatedCounter } from './AnimatedCounter';
import { LiquidGlassWidget } from './LiquidGlassWidget';
import { PG, PG_GRADIENTS, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const ICON_ORB = 46;

function accentGlassFill(accent: string): string {
  const hex = accent.replace('#', '');
  if (hex.length !== 6) return PG.glassStrong;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.16)`;
}

function PremiumIconOrb({
  accentColor,
  children,
  ringId,
}: {
  accentColor: string;
  children: React.ReactNode;
  ringId: string;
}) {
  return (
    <View style={styles.iconOrbWrap}>
      <Svg width={ICON_ORB} height={ICON_ORB} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentColor} stopOpacity={0.85} />
            <Stop offset="1" stopColor={PG.text} stopOpacity={0.25} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={ICON_ORB / 2}
          cy={ICON_ORB / 2}
          r={ICON_ORB / 2 - 1}
          stroke={`url(#${ringId})`}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
      <View style={[styles.iconOrb, { backgroundColor: accentGlassFill(accentColor) }]}>
        {children}
      </View>
    </View>
  );
}

export interface StatCardProps {
  label: string;
  value?: number;
  icon?: React.ReactNode;
  accentColor?: string;
  accuracyPercent?: number;
  style?: StyleProp<ViewStyle>;
  /** Stagger index for entrance animation (0–3). */
  index?: number;
}

export function StatCard({
  label,
  value,
  icon,
  accentColor = PG.purpleSoft,
  accuracyPercent,
  style,
  index = 0,
}: StatCardProps) {
  const { medium, extra } = usePGFonts();
  const ringGradientId = useId();
  const iconRingId = useId();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (accuracyPercent == null) return;
    progress.value = withTiming(accuracyPercent / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [accuracyPercent, progress]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRC * (1 - progress.value),
  }));

  const accent = accuracyPercent != null ? PG.gold : accentColor;

  return (
    <Animated.View
      entering={FadeInDown.delay(180 + index * 70)
        .duration(520)
        .springify()
        .damping(15)}
      style={[styles.wrap, style]}
    >
      <LiquidGlassWidget accentColor={accent} radius={PG_RADII.xl}>
        <View style={styles.card}>
          {accuracyPercent != null ? (
            <View style={styles.ringWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Defs>
                  <SvgLinearGradient id={ringGradientId} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={PG_GRADIENTS.accuracyRing[0]} />
                    <Stop offset="1" stopColor={PG_GRADIENTS.accuracyRing[1]} />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={PG.borderSoft}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={`url(#${ringGradientId})`}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  animatedProps={ringProps}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <AnimatedCounter
                  value={accuracyPercent}
                  suffix="%"
                  style={[styles.ringValue, { fontFamily: extra, color: PG.gold }]}
                  duration={1200}
                />
              </View>
            </View>
          ) : (
            <>
              <PremiumIconOrb accentColor={accentColor} ringId={iconRingId}>
                {icon}
              </PremiumIconOrb>
              <AnimatedCounter
                value={value ?? 0}
                style={[styles.value, { fontFamily: extra, color: accentColor }]}
              />
            </>
          )}

          <Text style={[styles.label, { fontFamily: medium }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </LiquidGlassWidget>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    padding: PG_SPACING.md,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
    minHeight: 132,
    justifyContent: 'center',
  },
  iconOrbWrap: {
    width: ICON_ORB,
    height: ICON_ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrb: {
    width: ICON_ORB - 8,
    height: ICON_ORB - 8,
    borderRadius: (ICON_ORB - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: PG_TYPE.display,
    padding: 0,
    margin: 0,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  label: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.caption,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: PG_TYPE.body,
    padding: 0,
    margin: 0,
    textAlign: 'center',
  },
});
