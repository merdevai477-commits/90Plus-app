/**
 * QuizProgressCard — Question counter, animated progress bar, and countdown timer.
 *
 * Surface: fully transparent (glass-like) — the screen background shows through.
 * Border + subtle tint give it definition without hiding the background.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { NEON_PURPLE, TRACK_BG } from './quiz.constants';

interface QuizProgressCardProps {
  current: number;
  total: number;
  /** 0–1 fraction */
  progress: number;
  seconds: number;
  questionLabel: string;
}

export function QuizProgressCard({
  current,
  total,
  progress,
  seconds,
  questionLabel,
}: QuizProgressCardProps) {
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));

  const pct = Math.round(progress * 100);

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        {/* Thin purple top accent line */}
        <View style={styles.topLine} />

        <View style={styles.inner}>
          {/* LEFT — question counter */}
          <View style={styles.leftCol}>
            <Text style={styles.questionLabel}>{questionLabel}</Text>
            <View style={styles.countRow}>
              <Text style={styles.countCurrent}>{current}</Text>
              <Text style={styles.countSep}> / </Text>
              <Text style={styles.countTotal}>{total}</Text>
            </View>
          </View>

          {/* MID — progress bar */}
          <View style={styles.midCol}>
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFillWrapper, barStyle]}>
                  <LinearGradient
                    colors={[NEON_PURPLE, '#7B2EFF']}
                    style={styles.barFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <View style={styles.barTip} />
                </Animated.View>
              </View>
              <Text style={styles.pctTxt}>{pct}%</Text>
            </View>
          </View>

          {/* DIVIDER */}
          <View style={styles.divider} />

          {/* RIGHT — timer */}
          <View style={styles.rightCol}>
            <View style={styles.timerIconGlow}>
              <MaterialCommunityIcons name="timer-outline" size={30} color={NEON_PURPLE} />
            </View>
            <Text style={styles.timerTxt}>{seconds}s</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginBottom: 14,
    marginHorizontal: -4,
    borderRadius: 26,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    overflow: 'hidden',
    // Transparent — shows the screen background through
    backgroundColor: 'rgba(10,6,18,0.0)',
  },
  topLine: {
    height: 1,
    backgroundColor: 'rgba(176,38,255,0.35)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  leftCol: { marginEnd: 18 },
  questionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  countCurrent: {
    color: '#C026FF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  countSep: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 1,
  },
  countTotal: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 1,
  },
  midCol: { flex: 1 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: TRACK_BG,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFillWrapper: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    flex: 1,
    borderRadius: 999,
  },
  barTip: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: 5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
  },
  pctTxt: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 18,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingStart: 4,
    paddingEnd: 2,
  },
  timerIconGlow: {
    shadowColor: NEON_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  timerTxt: {
    color: NEON_PURPLE,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
});
