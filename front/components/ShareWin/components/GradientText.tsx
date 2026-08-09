/**
 * Gradient-filled text — Figma uses `bg-clip-text` in several places on the
 * Share & Win screen (hero "نقاط / XP", the stats bar numbers, the XP badge).
 *
 * Implemented with MaskedView + LinearGradient, matching the pattern already
 * used by chat/LimitReachedMessage and the Quiz chrome.
 */

import React, { memo } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

/** expo-linear-gradient requires at least two stops, as a tuple. */
export type GradientStops = readonly [string, string, ...string[]];
export type GradientLocations = readonly [number, number, ...number[]];

interface GradientTextProps {
  children: string;
  colors: GradientStops;
  style?: TextStyle | TextStyle[];
  /** Figma gradients on this screen run top→bottom unless stated otherwise. */
  horizontal?: boolean;
  locations?: GradientLocations;
  numberOfLines?: number;
}

const GradientText = memo(function GradientText({
  children,
  colors,
  style,
  horizontal = false,
  locations,
  numberOfLines,
}: GradientTextProps) {
  const start = { x: 0, y: 0 };
  const end = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };

  return (
    <MaskedView
      androidRenderingMode="software"
      maskElement={
        <View style={s.maskWrap}>
          <Text style={style} numberOfLines={numberOfLines}>
            {children}
          </Text>
        </View>
      }
    >
      <LinearGradient colors={colors} locations={locations} start={start} end={end}>
        {/* Invisible copy sizes the gradient to the glyphs. */}
        <Text style={[style, s.sizer]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
});

const s = StyleSheet.create({
  maskWrap: {
    backgroundColor: 'transparent',
    // Android's software mask needs an opaque glyph to clip against.
    ...Platform.select({ android: { backgroundColor: 'transparent' }, default: {} }),
  },
  sizer: {
    opacity: 0,
  },
});

export default GradientText;
