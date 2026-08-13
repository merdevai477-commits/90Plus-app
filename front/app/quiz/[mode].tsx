import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import QuizHubScreen from '../../components/Quiz/QuizHubScreen';
import QuestionsModeScreen from '../../components/Quiz/QuestionsModeScreen';
import ComingSoonScreen from '../../components/Quiz/ComingSoonScreen';
import { isPlayableQuestionMode } from '../../hooks/useQuestionModeSession';
import { useTranslation } from '../../src/i18n';

/**
 * Modes that are routed but not finished yet. They keep their card on the hub
 * and their navigation, and land on the shared Coming Soon screen instead of a
 * half-built board. Delete a key here the moment its mode ships.
 *
 * Empty right now: Top 10 was the last one, and it ships with its ten typed
 * inputs, its server-side name matching and its own daily round.
 */
const UNRELEASED_MODES: Record<string, { en: string; ar: string; artwork: number }> = {};

export default function QuizModeRouteScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { language } = useTranslation();
  const mode = typeof params.mode === 'string' ? params.mode : '';

  if (mode === 'football-quiz') {
    return <QuizHubScreen />;
  }

  const unreleased = UNRELEASED_MODES[mode];
  if (unreleased) {
    return (
      <ComingSoonScreen
        headerTitle={language === 'ar' ? unreleased.ar : unreleased.en}
        artwork={unreleased.artwork}
      />
    );
  }

  if (isPlayableQuestionMode(mode)) {
    return <QuestionsModeScreen modeId={mode} />;
  }

  return <QuizHubScreen />;
}
