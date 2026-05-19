/**
 * QuizHubScreen — Premium Cinematic AAA Football Quiz UI
 *
 * Composed from focused sub-components:
 *   QuizBackground      — 8-layer solid-depth background
 *   QuizHeader          — fixed top bar (back, logo, coins)
 *   QuizProgressCard    — question counter + animated bar + timer
 *   QuizCard            — question, image, options, hint
 *   QuizFooterActions   — skip + next buttons
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { SCREEN_PADDING_H } from '../../constants/tokens';
import { APP_BG } from '../../constants/ui';
import { type OptionKey } from './quiz.constants';

import { QuizBackground }    from './QuizBackground';
import { QuizHeader }        from './QuizHeader';
import { QuizProgressCard }  from './QuizProgressCard';
import { QuizCard }          from './QuizCard';
import { QuizFooterActions } from './QuizFooterActions';

// ─── Placeholder data (replace with real API data later) ─────────────────────

const QUIZ_OPTIONS = [
  { key: 'A' as OptionKey, text: 'Cristiano Ronaldo' },
  { key: 'B' as OptionKey, text: 'Lionel Messi' },
  { key: 'C' as OptionKey, text: 'Michel Platini' },
  { key: 'D' as OptionKey, text: 'Zinedine Zidane' },
];

const QUESTION_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/800px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuizHubScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [selected, setSelected] = useState<OptionKey | null>('B');

  const HEADER_H = insets.top + 12 + 40 + 16;

  const handleSkip = () => { /* TODO: skip logic */ };
  const handleNext = () => { /* TODO: next question logic */ };
  const handleHint = () => { /* TODO: hint logic */ };

  return (
    <View style={styles.root}>

      {/* ── Background ── */}
      <QuizBackground />

      {/* ── Fixed header ── */}
      <QuizHeader topInset={insets.top} />

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: HEADER_H + 14,
          paddingHorizontal: SCREEN_PADDING_H,
          paddingBottom: Math.max(insets.bottom, 16) + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <QuizProgressCard
          current={3}
          total={10}
          progress={0.3}
          seconds={15}
          questionLabel={t.quiz.questionNumber}
        />

        <QuizCard
          question="Which player has won the most Ballon d'Or awards?"
          imageUri={QUESTION_IMAGE}
          category={t.quiz.imageQuiz}
          difficulty={t.quiz.difficultyMedium}
          options={QUIZ_OPTIONS}
          selectedKey={selected}
          onSelectOption={setSelected}
          onUseHint={handleHint}
        />

        <QuizFooterActions onSkip={handleSkip} onNext={handleNext} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  scroll: { flex: 1 },
});
