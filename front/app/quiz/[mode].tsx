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
 */
const UNRELEASED_MODES = {
  'top10-challenge': {
    en: 'Top 10 Challenge',
    ar: 'تحدي أفضل 10',
    artwork: require('../../assets/images/top-challenge.png'),
  },
} as const;

export default function QuizModeRouteScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { language } = useTranslation();
  const mode = typeof params.mode === 'string' ? params.mode : '';

  if (mode === 'football-quiz') {
    return <QuizHubScreen />;
  }

  const unreleased = UNRELEASED_MODES[mode as keyof typeof UNRELEASED_MODES];
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
