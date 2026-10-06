/**
 * Visual pieces of the liquid-glass capsule nav, shared so sheets, rows and
 * buttons around the app read as the same material.
 */

import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const GLASS_BAR_BG = 'rgba(16,12,28,0.8)';
/** Opaque version of the bar, for surfaces that must hide what is behind them (Android has no blur). */
export const GLASS_SURFACE_BG = '#100C1C';
export const GLASS_BUBBLE_COLORS = ['#A47BFF', '#7B4DF0', '#5B30C6'] as const;
export const GLASS_ACCENT = '#A47BFF';

const SHEEN_COLORS = ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)'] as const;
const SHEEN_LOCATIONS = [0, 0.45, 0.7, 1] as const;

type Rounded = { radius: number };

/** Soft top-lit gradient laid over a glass surface. */
export function GlassSheen({ radius, intensity = 1 }: Rounded & { intensity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', opacity: intensity }]}>
      <LinearGradient colors={SHEEN_COLORS} locations={SHEEN_LOCATIONS} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Hairline edge, brighter along the top like light catching glass. */
export function GlassRim({ radius, tint }: Rounded & { tint?: string }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.rim, { borderRadius: radius }, tint ? { borderColor: tint } : null]}
    />
  );
}

/** The lit purple fill of the nav's selected bubble. */
export function GlassBubbleFill({ radius, height }: Rounded & { height: number }) {
  return (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        <LinearGradient colors={GLASS_BUBBLE_COLORS} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
          style={[styles.bubbleSheen, { height: height * 0.55 }]}
        />
      </View>
      <View pointerEvents="none" style={[styles.bubbleRim, { borderRadius: radius }]} />
    </>
  );
}

const styles = StyleSheet.create({
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(190,160,255,0.18)',
    borderTopColor: 'rgba(255,255,255,0.32)',
  },
  bubbleSheen: { position: 'absolute', top: 0, left: 0, right: 0 },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
});
