import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

import QuizHubScreen from '../../components/Quiz/QuizHubScreen';
import { prefetchDailyQuiz, dailyQuizQueryKey } from '../../hooks/useDailyQuiz';
import { todayQuizDateKey } from '../../utils/quizDateKey';
import { useLanguageStore } from '../../src/i18n/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QuizTabScreen() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const appLanguage = useLanguageStore((s) => s.language);

  useFocusEffect(
    useCallback(() => {
      const warm = async () => {
        try {
          const stored = await AsyncStorage.getItem('quiz_language');
          const lang =
            stored === 'en' || stored === 'ar'
              ? stored
              : appLanguage === 'en'
                ? 'en'
                : 'ar';
          const dateKey = todayQuizDateKey();
          await queryClient.refetchQueries({
            queryKey: dailyQuizQueryKey(lang, dateKey),
            type: 'active',
          });
          await prefetchDailyQuiz(queryClient, getToken, lang);
        } catch {
          // ignore prefetch failures on focus
        }
      };
      void warm();
    }, [queryClient, getToken, appLanguage]),
  );

  return <QuizHubScreen />;
}
