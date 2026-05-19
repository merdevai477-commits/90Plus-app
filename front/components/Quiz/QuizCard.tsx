/**
 * QuizCard — Question card: category chip, question box, answer options, hint.
 *
 * Surface: fully transparent — the screen background shows through.
 * Solid border + subtle rgba tint give definition without hiding the background.
 * No BlurView / LiquidGlass — works identically on iOS and Android.
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { CircleCheck, BrainCircuit, Swords } from 'lucide-react-native';

import { useTranslation } from '../../src/i18n';
import { TEXT_MUTED, TEXT_SECONDARY, GOLD_PRIMARY } from '../../constants/tokens';
import {
  ACCENT,
  ACCENT_SOFT,
  CARD_BORDER,
  type OptionKey,
  type QuizOption,
} from './quiz.constants';

// ─── Transparent GlassCard primitive ─────────────────────────────────────────

function GlassCard({
  children,
  style,
  borderColor = CARD_BORDER,
}: {
  children: React.ReactNode;
  style?: object;
  borderColor?: string;
}) {
  return (
    <View style={[gcStyles.card, { borderColor }, style]}>
      {/* Top sheen line */}
      <View style={gcStyles.topHighlight} />
      {children}
    </View>
  );
}

const gcStyles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    // Transparent — screen background shows through
    backgroundColor: 'rgba(10,6,18,0.0)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
});

// ─── OptionRow ────────────────────────────────────────────────────────────────

interface OptionRowProps {
  opt: QuizOption;
  isSelected: boolean;
  onPress: () => void;
}

function OptionRow({ opt, isSelected, onPress }: OptionRowProps) {
  const scale  = useSharedValue(1);
  const glowOp = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    glowOp.value = withTiming(isSelected ? 1 : 0, { duration: 250 });
  }, [isSelected, glowOp]);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.965, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );
    onPress();
  }, [scale, onPress]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOp.value }));

  return (
    <Animated.View style={[optStyles.wrapper, animStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, optStyles.glowBorder, glowStyle]} />
      <TouchableOpacity
        style={[optStyles.row, isSelected && optStyles.rowActive]}
        activeOpacity={1}
        onPress={handlePress}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${opt.key}: ${opt.text}`}
      >
        <LinearGradient
          colors={
            isSelected
              ? [ACCENT, '#7B2EFF']
              : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']
          }
          style={optStyles.letterBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={optStyles.letter}>{opt.key}</Text>
        </LinearGradient>

        <Text style={[optStyles.text, isSelected && optStyles.textActive]}>
          {opt.text}
        </Text>

        {isSelected ? (
          <CircleCheck size={22} color={ACCENT_SOFT} strokeWidth={2.2} />
        ) : (
          <View style={optStyles.radioEmpty} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const optStyles = StyleSheet.create({
  wrapper: { borderRadius: 18, position: 'relative' },
  glowBorder: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#B026FF',
    shadowColor: '#C026FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  row: {
    minHeight: 60,
    borderRadius: 18,
    paddingHorizontal: 14,
    // Transparent with very subtle tint
    backgroundColor: 'rgba(10,6,18,0.0)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderColor: 'transparent',
  },
  letterBadge: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  letter: { color: '#fff', fontSize: 15, fontWeight: '900' },
  text: {
    color: TEXT_SECONDARY,
    fontSize: 14, fontWeight: '600',
    flex: 1, lineHeight: 20,
  },
  textActive: { color: '#fff', fontWeight: '700' },
  radioEmpty: {
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

// ─── QuizCard ─────────────────────────────────────────────────────────────────

interface QuizCardProps {
  question: string;
  imageUri?: string;
  category: string;
  difficulty: string;
  options: QuizOption[];
  selectedKey: OptionKey | null;
  onSelectOption: (key: OptionKey) => void;
  onUseHint: () => void;
}

export function QuizCard({
  question,
  imageUri,
  category,
  difficulty,
  options,
  selectedKey,
  onSelectOption,
  onUseHint,
}: QuizCardProps) {
  const { t } = useTranslation();
  const textAlign = I18nManager.isRTL ? 'right' : 'left';

  return (
    <View style={styles.quizCard}>
      {/* Thin purple top accent */}
      <View style={styles.cardTopLine} />

      <View style={styles.inner}>
        {/* ── Category + difficulty ── */}
        <View style={[styles.head, I18nManager.isRTL && styles.headRTL]}>
          <View style={styles.categoryChip}>
            <Swords size={13} color={ACCENT_SOFT} strokeWidth={2} />
            <Text style={styles.categoryTxt}>{category}</Text>
          </View>
          <LinearGradient
            colors={['rgba(234,179,8,0.22)', 'rgba(202,138,4,0.12)']}
            style={styles.levelPill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.levelTxt}>{difficulty}</Text>
          </LinearGradient>
        </View>

        {/* ── Question box ── */}
        <View style={styles.questionBox}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.questionImage,
                I18nManager.isRTL ? { left: 0 } : { right: 0 },
              ]}
              resizeMode="cover"
              accessibilityLabel={t.quiz.imageUnavailable}
            />
          ) : null}

          {/* Cinematic image fades */}
          <LinearGradient
            colors={['rgba(10,6,18,0.05)', 'rgba(10,6,18,0.5)', 'rgba(10,6,18,0.95)', 'rgba(10,6,18,1.0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: I18nManager.isRTL ? 0 : 1, y: 0 }}
            end={{ x: I18nManager.isRTL ? 1 : 0, y: 1 }}
          />
          <LinearGradient
            colors={['rgba(10,6,18,0.95)', 'rgba(10,6,18,0.5)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: I18nManager.isRTL ? 1 : 0, y: 0 }}
            end={{ x: I18nManager.isRTL ? 0 : 1, y: 0 }}
          />
          {/* Purple ambient tint */}
          <LinearGradient
            colors={['rgba(124,58,237,0.10)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View
            style={[
              styles.questionTextWrap,
              I18nManager.isRTL
                ? { paddingRight: 18, paddingLeft: '42%' }
                : { paddingLeft: 18, paddingRight: '42%' },
            ]}
          >
            <Text style={[styles.questionTitle, { textAlign }]}>{question}</Text>
          </View>
        </View>

        {/* ── Answer options ── */}
        <View style={styles.optionsContainer}>
          {options.map((opt) => (
            <OptionRow
              key={opt.key}
              opt={opt}
              isSelected={selectedKey === opt.key}
              onPress={() => onSelectOption(opt.key)}
            />
          ))}
        </View>

        {/* ── Hint card ── */}
        <GlassCard
          style={[styles.hintCard, I18nManager.isRTL && styles.hintCardRTL]}
          borderColor="rgba(234,179,8,0.20)"
        >
          <View style={styles.hintIconWrap}>
            <BrainCircuit size={20} color={GOLD_PRIMARY} strokeWidth={2} />
          </View>
          <View style={styles.hintBody}>
            <Text style={[styles.hintTitle, { textAlign }]}>{t.quiz.hintCost}</Text>
            <Text style={[styles.hintSub, { textAlign }]}>
              {t.quiz.hintAvailable} · {t.quiz.coins} 10
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.8} style={styles.hintBtnWrap} onPress={onUseHint}>
            <LinearGradient
              colors={[ACCENT, '#7B2EFF']}
              style={styles.hintBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.hintBtnText}>{t.quiz.useHint}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quizCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    overflow: 'hidden',
    marginBottom: 14,
    // Transparent — screen background shows through
    backgroundColor: 'rgba(10,6,18,0.0)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTopLine: {
    height: 1,
    backgroundColor: 'rgba(176,38,255,0.35)',
  },
  inner: { padding: 16 },

  // Head
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headRTL: { flexDirection: 'row-reverse' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.28)',
  },
  categoryTxt: {
    color: ACCENT_SOFT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  levelPill: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.30)',
  },
  levelTxt: { color: '#fde68a', fontSize: 12, fontWeight: '700' },

  // Question box
  questionBox: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 170,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    backgroundColor: 'rgba(10,6,18,0.0)',
  },
  questionImage: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: '65%',
    opacity: 0.80,
  },
  questionTextWrap: {
    padding: 18,
    justifyContent: 'flex-end',
    minHeight: 170,
  },
  questionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Options
  optionsContainer: { gap: 9, marginBottom: 14 },

  // Hint
  hintCard: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hintCardRTL: { flexDirection: 'row-reverse' },
  hintIconWrap: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,197,24,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  hintBody: { flex: 1 },
  hintTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hintSub: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  hintBtnWrap: { borderRadius: 13, overflow: 'hidden' },
  hintBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  hintBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});
