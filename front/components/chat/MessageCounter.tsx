/**
 * MessageCounter.tsx — Native
 * Liquid-glass pill showing remaining messages: frosted body, violet→pink
 * brand gradient, top sheen and a soft backlight glow. Turns rose when the
 * user is running low.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MessageCircle } from 'lucide-react-native';
import {
  BlurMask,
  Canvas,
  LinearGradient as SkiaLinearGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageCounterProps {
  /**
   * Remaining message count. `null` means the real limit has not been
   * fetched yet — the pill renders a neutral placeholder instead of
   * showing a misleading number.
   */
  messagesRemaining: number | null;
  total?: number;
}

type GlassPalette = {
  fill: readonly [string, string];
  glow: readonly [string, string];
};

// ─── Palette ──────────────────────────────────────────────────────────────────

const BRAND: GlassPalette = {
  fill: ['rgba(111,36,251,0.82)', 'rgba(221,126,187,0.62)'],
  glow: ['#6F24FB', '#DD7EBB'],
};
const LOW: GlassPalette = {
  fill: ['rgba(224,121,144,0.85)', 'rgba(167,75,142,0.7)'],
  glow: ['#E07990', '#A74B8E'],
};
const LOADING: GlassPalette = {
  fill: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)'],
  glow: ['rgba(163,221,249,0.4)', 'rgba(111,36,251,0.4)'],
};

/** Below this share of the daily limit the pill switches to the rose palette. */
const LOW_RATIO = 0.3;
const GLOW_PAD = 12;

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageCounter({
  messagesRemaining,
  total = 10,
}: MessageCounterProps) {
  const isLoading = messagesRemaining === null;
  const [size, setSize] = useState({ w: 0, h: 0 });

  const palette = useMemo(() => {
    if (isLoading) return LOADING;
    const ratio = total > 0 ? messagesRemaining / total : 0;
    return ratio < LOW_RATIO ? LOW : BRAND;
  }, [isLoading, messagesRemaining, total]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const accessibilityLabel = isLoading
    ? 'Loading message limit'
    : `${messagesRemaining} of ${total} messages remaining`;
  const displayText = isLoading ? '…' : `${messagesRemaining}/${total}`;
  const radius = size.h / 2;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      {Platform.OS !== 'web' && size.w > 0 ? (
        <Canvas
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -GLOW_PAD,
            top: -GLOW_PAD,
            width: size.w + GLOW_PAD * 2,
            height: size.h + GLOW_PAD * 2,
          }}
        >
          <RoundedRect
            x={GLOW_PAD + 2}
            y={GLOW_PAD + 3}
            width={size.w - 4}
            height={size.h - 2}
            r={radius}
            opacity={0.75}
          >
            <SkiaLinearGradient
              start={vec(GLOW_PAD, 0)}
              end={vec(GLOW_PAD + size.w, 0)}
              colors={[...palette.glow]}
            />
            <BlurMask blur={9} style="normal" />
          </RoundedRect>
        </Canvas>
      ) : null}

      <View style={styles.pill}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={palette.fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
          style={styles.sheen}
        />
        <MessageCircle size={13} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={styles.text}>{displayText}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
