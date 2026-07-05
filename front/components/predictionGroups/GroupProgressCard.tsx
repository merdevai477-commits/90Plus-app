/**
 * GroupProgressCard — the "أنت بالمركز X" summary card.
 *
 * Draws a gradient progress bar showing how close the current user is to the
 * points of the member directly above them. The spec asks for a Skia canvas +
 * LinearGradient shader; since Skia isn't installed (would require a native
 * rebuild), this uses the react-native-svg equivalent: a `<Rect>` filled by an
 * SVG `<LinearGradient>`, with its width animated on the UI thread via
 * `useAnimatedProps` (Reanimated). Fully RTL-aware (fills from the right).
 */

import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GlassCard } from './atoms';
import { PG, PG_SPACING, usePGFonts } from './theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface GroupProgressCardProps {
  rank: number;
  myPoints: number;
  /** Points of the member directly above (used to compute the gap + fill). */
  abovePoints: number;
  isRTL: boolean;
}

const BAR_HEIGHT = 12;

const ORDINAL: Record<number, string> = {
  1: 'الأول',
  2: 'الثاني',
  3: 'الثالث',
  4: 'الرابع',
  5: 'الخامس',
};

export function GroupProgressCard({ rank, myPoints, abovePoints, isRTL }: GroupProgressCardProps) {
  const { medium, bold, extra } = usePGFonts();
  const [trackW, setTrackW] = useState(0);
  const fill = useSharedValue(0);

  const gap = Math.max(0, abovePoints - myPoints);
  const ratio = abovePoints > 0 ? Math.min(1, myPoints / abovePoints) : 0;

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 950, easing: Easing.out(Easing.cubic) });
  }, [ratio, fill, trackW]);

  const animatedProps = useAnimatedProps(() => {
    const w = fill.value * trackW;
    return {
      width: w,
      // In RTL, grow from the right edge.
      x: isRTL ? trackW - w : 0,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  return (
    <GlassCard style={styles.card}>
      <View style={[styles.head, row]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: bold, textAlign: align }]}>
            أنت في المركز {ORDINAL[rank] ?? rank}
          </Text>
          <Text style={[styles.sub, { fontFamily: medium, textAlign: align }]}>
            {gap > 0
              ? `تفصلك ${gap} نقاط عن المركز ${ORDINAL[rank - 1] ?? rank - 1}`
              : 'أنت في الصدارة! حافظ على مركزك'}
          </Text>
        </View>
        <View style={styles.pointsPill}>
          <Text style={[styles.pointsPillTxt, { fontFamily: extra }]}>{myPoints}</Text>
          <Text style={[styles.pointsPillLabel, { fontFamily: medium }]}>نقطة</Text>
        </View>
      </View>

      <View style={styles.track} onLayout={onLayout}>
        {trackW > 0 && (
          <Svg width={trackW} height={BAR_HEIGHT}>
            <Defs>
              <LinearGradient id="pgProgress" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={PG.purpleLight} />
                <Stop offset="1" stopColor={PG.purple} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={trackW}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill="rgba(255,255,255,0.07)"
            />
            <AnimatedRect
              y={0}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill="url(#pgProgress)"
              animatedProps={animatedProps}
            />
          </Svg>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: PG_SPACING.lg, gap: PG_SPACING.md },
  head: { alignItems: 'center', gap: PG_SPACING.md },
  title: { color: PG.text, fontSize: 15 },
  sub: { color: PG.textSecondary, fontSize: 12, marginTop: 3 },
  pointsPill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.4)',
  },
  pointsPillTxt: { color: PG.text, fontSize: 18 },
  pointsPillLabel: { color: PG.textMuted, fontSize: 10, marginTop: -2 },
  track: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' },
});
