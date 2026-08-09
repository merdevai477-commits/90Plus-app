/**
 * QuizHeader — the Football Quiz screen's top bar (Figma node 238:374).
 *
 * It is the SAME header every other game mode uses, so the chrome itself lives
 * in ./gameChrome.tsx and this file only positions it and wires up the screen's
 * own actions. Anything visual (title type, XP badge, back arrow) is changed
 * there, once, for all seven modes.
 *
 * OFFSET: Figma places the bar at y 95 on an artboard whose first 62pt are the
 * status bar, so on device it sits `insets.top + 33` down — NOT `insets.top +
 * 95`, which double-counts the status bar and pushed the whole screen down.
 *
 * JUDGMENT CALL: Figma's top bar has no language-toggle affordance, but the
 * screen has real, ongoing quiz-language-switch functionality
 * (`toggleQuizLanguage` — separate from the one-time QuizLanguagePopup). It is
 * exposed as a small pill inside the header's trailing slot so the feature
 * isn't lost, without altering the Figma back/title/XP row itself.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { goBackToQuestionsHub } from './quizNavigation';
import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useDesignScale } from '../../utils/responsive';
import type { QuizApiLanguage } from '../../services/quizApi.service';
import { GAME_COLOR, GAME_LAYOUT, GameScreenHeader } from './gameChrome';

interface QuizHeaderProps {
  topInset: number;
  quizLang?: QuizApiLanguage;
  onToggleLanguage?: () => void;
  /**
   * `true` (default) floats the bar over the screen — what the terminal states
   * (sign-in, error, "finished for today") want, since they centre a single
   * block of copy underneath it.
   *
   * `false` renders it IN FLOW with no positioning and no gutters of its own,
   * so it can sit as the first child inside a screen's ScrollView and scroll
   * with the content — exactly how every other question mode places its header
   * (see QuestionsModeScreen). The scroll container supplies the top inset and
   * the 22pt column, the same way it does there.
   */
  pinned?: boolean;
}

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);

  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: s(GAME_LAYOUT.gutter),
      right: s(GAME_LAYOUT.gutter),
      zIndex: 22,
    },
    langPill: {
      marginRight: s(8),
      paddingHorizontal: s(8),
      paddingVertical: s(4),
      borderRadius: s(8),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
    },
    langPillText: {
      fontFamily: getAppFont(700, language),
      fontSize: f(11),
      color: GAME_COLOR.accent,
    },
  });
}

function QuizHeaderInner({ topInset, quizLang, onToggleLanguage, pinned = true }: QuizHeaderProps) {
  const { coins, loading } = useCoins();
  const { t, language } = useTranslation();
  const { scale, fontScale, s } = useDesignScale();

  const styles = useMemo(
    () => createStyles(scale, fontScale, language),
    [scale, fontScale, language],
  );

  return (
    <View style={pinned ? [styles.wrap, { top: topInset + s(GAME_LAYOUT.contentTop) }] : undefined}>
      <GameScreenHeader
        title={t.quiz.footballQuiz}
        onBack={goBackToQuestionsHub}
        xp={loading ? '—' : coins}
        backAccessibilityLabel={t.quiz.backToQuestions}
        trailing={
          onToggleLanguage ? (
            <TouchableOpacity
              onPress={onToggleLanguage}
              activeOpacity={0.7}
              style={styles.langPill}
              accessibilityRole="button"
              accessibilityLabel={quizLang === 'ar' ? t.quiz.langArabic : t.quiz.langEnglish}
            >
              <Text style={styles.langPillText}>
                {quizLang === 'ar' ? t.quiz.langArabic : t.quiz.langEnglish}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

export const QuizHeader = React.memo(QuizHeaderInner);
