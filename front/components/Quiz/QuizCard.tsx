/**
 * QuizCard — Question, options, hint; green/red answer feedback.
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
import { CircleCheck, Lightbulb, Zap } from 'lucide-react-native';

import { useTranslation } from '../../src/i18n';
import {
  ACCENT,
  ACCENT_SOFT,
  QUIZ_CARD_BG,
  QUIZ_CARD_BORDER,
  QUIZ_OPTION_BG,
  QUIZ_OPTION_BORDER,
  QUIZ_RADIUS_LG,
  QUIZ_RADIUS_MD,
  QUIZ_RADIUS_SM,
  QUIZ_COIN_COST,
  type OptionKey,
  type QuizImageLayout,
  type QuizOption,
} from './quiz.constants';
import { QuizQuestionMedia } from './QuizQuestionMedia';

const CORRECT_BG = 'rgba(34, 197, 94, 0.18)';
const CORRECT_BORDER = 'rgba(34, 197, 94, 0.75)';
const WRONG_BG = 'rgba(239, 68, 68, 0.18)';
const WRONG_BORDER = 'rgba(239, 68, 68, 0.75)';
const PURPLE_BG = 'rgba(168, 85, 247, 0.18)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.75)';

interface OptionRowProps {
  opt: QuizOption;
  isSelected: boolean;
  onPress: () => void;
  answerRevealed: boolean;
  isCorrectOption: boolean;
  isWrongSelection: boolean;
  userGotItWrong: boolean;
  disabled: boolean;
}

function OptionRow({
  opt,
  isSelected,
  onPress,
  answerRevealed,
  isCorrectOption,
  isWrongSelection,
  userGotItWrong,
  disabled,
}: OptionRowProps) {
  const showCorrect = answerRevealed && isCorrectOption;
  const showWrong = answerRevealed && isWrongSelection;
  const showPurple = showCorrect && userGotItWrong;

  return (
    <TouchableOpacity
      style={[
        optStyles.row,
        isSelected && !answerRevealed && optStyles.rowSelected,
        showCorrect && !showPurple && optStyles.rowCorrect,
        showPurple && optStyles.rowPurple,
        showWrong && optStyles.rowWrong,
        disabled && !answerRevealed && { opacity: 0.65 },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={`${opt.key}: ${opt.text}`}
    >
      <View
        style={[
          optStyles.letterCircle,
          isSelected && !answerRevealed && optStyles.letterCircleSelected,
          showCorrect && !showPurple && optStyles.letterCircleCorrect,
          showPurple && optStyles.letterCirclePurple,
          showWrong && optStyles.letterCircleWrong,
        ]}
      >
        <Text
          style={[
            optStyles.letter,
            isSelected && !answerRevealed && optStyles.letterSelected,
            (showCorrect || showWrong) && optStyles.letterOnResult,
          ]}
        >
          {opt.key}
        </Text>
      </View>

      <Text
        style={[
          optStyles.answerText,
          isSelected && !answerRevealed && optStyles.answerTextSelected,
          showCorrect && optStyles.answerTextCorrect,
          showWrong && optStyles.answerTextWrong,
        ]}
      >
        {opt.text}
      </Text>

      {isSelected && !answerRevealed ? (
        <View style={optStyles.radioFilled}>
          <LinearGradient
            colors={[ACCENT_SOFT, '#7C3AED']}
            style={StyleSheet.absoluteFill}
          />
          <CircleCheck size={13} color="#FFF" strokeWidth={3} />
        </View>
      ) : showCorrect ? (
        <CircleCheck size={20} color={showPurple ? '#A855F7' : '#22C55E'} strokeWidth={2.5} />
      ) : showWrong ? (
        <Text style={optStyles.wrongMark}>✕</Text>
      ) : (
        <View style={optStyles.radioEmpty} />
      )}
    </TouchableOpacity>
  );
}

const optStyles = StyleSheet.create({
  row: {
    minHeight: 52,
    borderRadius: QUIZ_RADIUS_MD,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: QUIZ_OPTION_BG,
    borderWidth: 1,
    borderColor: QUIZ_OPTION_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowSelected: {
    borderColor: 'rgba(168, 85, 247, 0.75)',
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  rowCorrect: {
    borderColor: CORRECT_BORDER,
    backgroundColor: CORRECT_BG,
  },
  rowPurple: {
    borderColor: PURPLE_BORDER,
    backgroundColor: PURPLE_BG,
  },
  rowWrong: {
    borderColor: WRONG_BORDER,
    backgroundColor: WRONG_BG,
  },
  letterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  letterCircleSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT_SOFT,
  },
  letterCircleCorrect: {
    backgroundColor: '#22C55E',
    borderColor: '#4ADE80',
  },
  letterCirclePurple: {
    backgroundColor: '#9333EA',
    borderColor: '#A855F7',
  },
  letterCircleWrong: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
  },
  letter: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '800',
  },
  letterSelected: { color: '#FFFFFF' },
  letterOnResult: { color: '#FFFFFF' },
  answerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  answerTextSelected: { fontWeight: '700' },
  answerTextCorrect: { fontWeight: '700' },
  answerTextWrong: { fontWeight: '700' },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  radioFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrongMark: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '800',
  },
});

interface QuizCardProps {
  question: string;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  options: QuizOption[];
  selectedKey: OptionKey | null;
  onSelectOption: (key: OptionKey) => void;
  onUseHint: () => void;
  hintUsed?: boolean;
  hintText?: string | null;
  answerRevealed?: boolean;
  isCorrect?: boolean | null;
  correctKey?: OptionKey | null;
  disableOptions?: boolean;
}

export function QuizCard({
  question,
  imageUrl,
  imageLayout = 'square',
  options,
  selectedKey,
  onSelectOption,
  onUseHint,
  hintUsed = false,
  hintText = null,
  answerRevealed = false,
  isCorrect = null,
  correctKey = null,
  disableOptions = false,
}: QuizCardProps) {
  const { t } = useTranslation();
  const textAlign = I18nManager.isRTL ? 'right' : 'left';

  return (
    <View style={styles.card}>
      <View style={styles.questionBlock}>
        <Text style={[styles.questionTitle, { textAlign }]}>{question}</Text>
        <View style={styles.mediaWrap}>
          <QuizQuestionMedia imageUrl={imageUrl} layout={imageLayout} />
        </View>
      </View>

      {hintText ? (
        <View style={styles.hintBanner}>
          <Lightbulb size={16} color="#FACC15" />
          <Text style={[styles.hintBannerText, { textAlign }]}>{hintText}</Text>
        </View>
      ) : null}

      <View style={styles.optionsList}>
        {options.map((opt) => (
          <OptionRow
            key={opt.key}
            opt={opt}
            isSelected={selectedKey === opt.key}
            onPress={() => onSelectOption(opt.key)}
            answerRevealed={answerRevealed}
            isCorrectOption={answerRevealed && correctKey === opt.key}
            isWrongSelection={
              answerRevealed &&
              selectedKey === opt.key &&
              isCorrect === false
            }
            userGotItWrong={isCorrect === false}
            disabled={disableOptions}
          />
        ))}
      </View>

      <View style={[styles.hintRow, I18nManager.isRTL && styles.hintRowRTL]}>
        <Lightbulb size={20} color="#FACC15" strokeWidth={2} />
        <View style={styles.hintTexts}>
          <Text style={[styles.hintTitle, { textAlign }]}>{t.quiz.needHint}</Text>
          <Text style={[styles.hintSub, { textAlign }]}>{t.quiz.hintAvailable}</Text>
        </View>
        <TouchableOpacity
          style={[styles.hintBtn, hintUsed && styles.hintBtnDisabled]}
          activeOpacity={0.85}
          onPress={onUseHint}
          disabled={hintUsed || answerRevealed}
        >
          <Text style={styles.hintBtnLabel}>
            {hintUsed ? t.quiz.hintUsed : t.quiz.useHint}
          </Text>
          {!hintUsed ? (
            <>
              <Zap size={11} color={ACCENT_SOFT} fill={ACCENT_SOFT} />
              <Text style={styles.hintBtnCost}>{QUIZ_COIN_COST}</Text>
            </>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: QUIZ_RADIUS_LG,
    borderWidth: 1,
    borderColor: QUIZ_CARD_BORDER,
    backgroundColor: QUIZ_CARD_BG,
    padding: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  questionBlock: {
    marginBottom: 14,
  },
  questionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  mediaWrap: {
    marginTop: 14,
    width: '100%',
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    marginBottom: 10,
    borderRadius: QUIZ_RADIUS_SM,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  hintBannerText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  optionsList: {
    gap: 8,
    marginBottom: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  hintRowRTL: { flexDirection: 'row-reverse' },
  hintTexts: { flex: 1 },
  hintTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hintSub: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: QUIZ_RADIUS_SM,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: '#1A1630',
  },
  hintBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hintBtnCost: {
    color: ACCENT_SOFT,
    fontSize: 12,
    fontWeight: '800',
  },
  hintBtnDisabled: {
    opacity: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
