/**
 * QuizProgressCard — Question counter, progress bar, isolated countdown timer.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTranslation } from '../../src/i18n';
import {
  ACCENT_SOFT,
  NEON_PURPLE,
  QUIZ_COUNT_PURPLE,
  QUIZ_CARD_BG,
  QUIZ_CARD_BORDER,
  QUIZ_RADIUS_LG,
  QUIZ_TRACK_BG,
} from './quiz.constants';

interface QuizProgressCardProps {
  current: number;
  total: number;
  progress: number;
  questionLabel: string;
  /** Changes when the active question changes — resets the timer. */
  timerKey: string;
  /** Bumped when a timeout submit fails so the countdown can fire again. */
  timerRetryEpoch?: number;
  timerActive: boolean;
  timeLimitSec: number;
  onTimeUp: () => void;
}

function QuizProgressCardInner({
  current,
  total,
  progress,
  questionLabel,
  timerKey,
  timerRetryEpoch = 0,
  timerActive,
  timeLimitSec,
  onTimeUp,
}: QuizProgressCardProps) {
  const { t } = useTranslation();
  const barWidth = useSharedValue(0);
  const [seconds, setSeconds] = React.useState(timeLimitSec);
  const onTimeUpRef = useRef(onTimeUp);
  const firedRef = useRef(false);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    barWidth.value = withTiming(progress, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, barWidth]);

  useEffect(() => {
    setSeconds(timeLimitSec);
    firedRef.current = false;
  }, [timerKey, timeLimitSec]);

  useEffect(() => {
    firedRef.current = false;
  }, [timerRetryEpoch]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerKey, timerActive]);

  useEffect(() => {
    if (!timerActive || seconds !== 0 || firedRef.current) return;
    firedRef.current = true;
    onTimeUpRef.current();
  }, [seconds, timerActive]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.leftCol}>
          <Text style={styles.questionLabel}>{questionLabel}</Text>
          <View style={styles.countRow}>
            <Text style={styles.countCurrent}>{current}</Text>
            <Text style={styles.countRest}>
              {' '}
              {t.quiz.of} {total}
            </Text>
          </View>
        </View>

        <View style={styles.midCol}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFillWrap, barStyle]}>
              <LinearGradient
                colors={[NEON_PURPLE, ACCENT_SOFT, '#7C3AED']}
                style={styles.barFill}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            </Animated.View>
          </View>
        </View>

        <View style={styles.rightCol}>
          <MaterialCommunityIcons name="timer-outline" size={26} color={ACCENT_SOFT} />
          <Text style={styles.timerTxt}>
            {seconds}
            {t.quiz.secondsUnit}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const QuizProgressCard = React.memo(QuizProgressCardInner);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QUIZ_CARD_BG,
    borderRadius: QUIZ_RADIUS_LG,
    borderWidth: 1,
    borderColor: QUIZ_CARD_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  leftCol: {
    minWidth: 76,
    marginEnd: 12,
  },
  questionLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: '500',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  countCurrent: {
    color: QUIZ_COUNT_PURPLE,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  countRest: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  midCol: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  barTrack: {
    height: 10,
    backgroundColor: QUIZ_TRACK_BG,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFillWrap: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    flex: 1,
    borderRadius: 999,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginStart: 14,
    paddingStart: 14,
    borderStartWidth: 1,
    borderStartColor: 'rgba(255,255,255,0.1)',
  },
  timerTxt: {
    color: ACCENT_SOFT,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
