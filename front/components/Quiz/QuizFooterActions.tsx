/**
 * QuizFooterActions — Skip (10 coins) + Next Question.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SkipForward, ArrowRight, Zap } from 'lucide-react-native';

import { useTranslation } from '../../src/i18n';
import {
  ACCENT,
  ACCENT_SOFT,
  NEON_PURPLE,
  QUIZ_CARD_BORDER,
  QUIZ_CHIP_BG,
  QUIZ_COIN_COST,
  QUIZ_RADIUS_MD,
} from './quiz.constants';

interface QuizFooterActionsProps {
  onSkip: () => void;
  onNext: () => void;
  skipDisabled?: boolean;
  nextDisabled?: boolean;
  answerRevealed?: boolean;
  isCorrect?: boolean | null;
}

export function QuizFooterActions({
  onSkip,
  onNext,
  skipDisabled = false,
  nextDisabled = false,
  answerRevealed = false,
  isCorrect = null,
}: QuizFooterActionsProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.row, I18nManager.isRTL && styles.rowRTL]}>
      <TouchableOpacity
        style={[styles.skipBtn, skipDisabled && styles.skipBtnDisabled]}
        activeOpacity={0.85}
        onPress={onSkip}
        disabled={skipDisabled}
        accessibilityLabel={t.quiz.skip}
      >
        <SkipForward size={17} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.skipTxt}>{t.quiz.skip}</Text>
        <Zap size={11} color={ACCENT_SOFT} fill={ACCENT_SOFT} />
        <Text style={styles.skipCost}>{QUIZ_COIN_COST}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.nextWrap, 
          (!answerRevealed || nextDisabled) && styles.nextWrapDisabled,
          answerRevealed && isCorrect === true && { shadowColor: '#22C55E' },
          answerRevealed && isCorrect === false && { shadowColor: '#EF4444' }
        ]}
        activeOpacity={(!answerRevealed || nextDisabled) ? 1 : 0.9}
        onPress={onNext}
        disabled={nextDisabled}
      >
        <LinearGradient
          colors={
            (!answerRevealed || nextDisabled)
              ? ['#3F3F50', '#2A2A38', '#1F1F2E']
              : isCorrect
                ? ['#4ADE80', '#22C55E', '#16A34A']
                : ['#F87171', '#EF4444', '#DC2626']
          }
          style={styles.nextBtn}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        >
          <Text style={[styles.nextTxt, (!answerRevealed || nextDisabled) && styles.nextTxtDisabled]}>
            {t.quiz.nextQuestion}
          </Text>
          <ArrowRight
            size={18}
            color="#fff"
            strokeWidth={2.5}
            style={I18nManager.isRTL ? styles.arrowRTL : undefined}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  skipBtn: {
    height: 50,
    minWidth: 118,
    borderRadius: QUIZ_RADIUS_MD,
    borderWidth: 1,
    borderColor: QUIZ_CARD_BORDER,
    backgroundColor: QUIZ_CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
  },
  skipBtnDisabled: {
    opacity: 0.45,
  },
  skipTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  skipCost: {
    color: ACCENT_SOFT,
    fontSize: 12,
    fontWeight: '800',
  },
  nextWrap: {
    flex: 1,
    borderRadius: QUIZ_RADIUS_MD,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  nextWrapDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  nextTxtDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  nextBtn: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  nextTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  arrowRTL: { transform: [{ scaleX: -1 }] },
});
