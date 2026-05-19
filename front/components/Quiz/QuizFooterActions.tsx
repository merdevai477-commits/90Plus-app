/**
 * QuizFooterActions — Skip button + animated Next Question button.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SkipForward, ArrowRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTranslation } from '../../src/i18n';
import { TEXT_PRIMARY } from '../../constants/tokens';
import { ACCENT, NEON_PURPLE, BLUR_INTENSITY } from './quiz.constants';

interface QuizFooterActionsProps {
  onSkip: () => void;
  onNext: () => void;
}

export function QuizFooterActions({ onSkip, onNext }: QuizFooterActionsProps) {
  const { t } = useTranslation();

  const nextArrow = useSharedValue(0);
  useEffect(() => {
    nextArrow.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [nextArrow]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nextArrow.value }],
  }));

  return (
    <View style={[styles.row, I18nManager.isRTL && styles.rowRTL]}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} activeOpacity={0.85} onPress={onSkip}>
        <BlurView intensity={BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.skipTopLine} />
        <SkipForward size={18} color={TEXT_PRIMARY} strokeWidth={2} />
        <Text style={styles.skipTxt}>{t.quiz.skip}</Text>
      </TouchableOpacity>

      {/* Next Question */}
      <TouchableOpacity style={styles.nextBtnWrap} activeOpacity={0.9} onPress={onNext}>
        <LinearGradient
          colors={[ACCENT, NEON_PURPLE, '#7B2EFF']}
          style={styles.nextBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.nextBtnTopLine} />
          <Text style={styles.nextTxt}>{t.quiz.nextQuestion}</Text>
          <Animated.View style={[arrowStyle, I18nManager.isRTL && styles.arrowRTL]}>
            <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  rowRTL: { flexDirection: 'row-reverse' },

  // Skip
  skipBtn: {
    width: 110, height: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A45',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 7,
    overflow: 'hidden',
  },
  skipTopLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skipTxt: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },

  // Next
  nextBtnWrap: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#B026FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  nextBtn: {
    height: 56, paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 10, position: 'relative',
  },
  nextBtnTopLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  nextTxt: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  arrowRTL: { transform: [{ scaleX: -1 }] },
});
