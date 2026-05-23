/**
 * QuizHubScreen — Daily AI quiz (OpenRouter), API images, XP & coins via backend.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '../../src/i18n';
import { useLanguageStore } from '../../src/i18n/store';
import { useCoins } from '../../contexts/CoinsContext';
import { useXp } from '../../contexts/XpContext';
import { toastManager } from '../../services/toastManager';
import {
  QuizApiService,
  type QuizApiLanguage,
  type QuizApiQuestion,
  type QuizApiOptionKey,
} from '../../services/quizApi.service';
import { SCREEN_PADDING_H } from '../../constants/tokens';
import {
  type OptionKey,
  QUIZ_SESSION_TOTAL,
  QUIZ_SCREEN_BG,
  QUIZ_CARD_BORDER,
  QUIZ_CHIP_BG,
  QUIZ_RADIUS_SM,
  QUIZ_COIN_COST,
  QUIZ_TIME_LIMIT_SEC,
  ACCENT_SOFT,
} from './quiz.constants';

import { QuizBackground } from './QuizBackground';
import { QuizHeader } from './QuizHeader';
import { QuizProgressCard } from './QuizProgressCard';
import { QuizCard } from './QuizCard';
import { QuizFooterActions } from './QuizFooterActions';
import { QuizLanguagePopup } from './QuizLanguagePopup';
import { QuizScorePopup } from './QuizScorePopup';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AnswerPhase = 'idle' | 'submitting' | 'revealed';

function mapDifficulty(d: string): 'Easy' | 'Medium' | 'Hard' {
  if (d === 'EASY') return 'Easy';
  if (d === 'HARD') return 'Hard';
  return 'Medium';
}

export default function QuizHubScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((s) => s.language);
  const { getToken } = useAuth();
  const { refreshCoins, coins, loading: coinsLoading } = useCoins();
  const { handleXpEvents, refresh: refreshXp } = useXp();

  const [quizLang, setQuizLang] = useState<QuizApiLanguage>(
    appLanguage === 'en' ? 'en' : 'ar',
  );
  
  const queryClient = useQueryClient();

  const { data: dailyData, isLoading: loadingQuestions, error } = useQuery({
    queryKey: ['dailyQuiz', quizLang],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const data = await QuizApiService.fetchDaily(token, quizLang);
      if (!data?.questions?.length) throw new Error('empty pack');
      return data;
    },
    enabled: !!quizLang,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, err) => {
      if (err.message === 'RATE_LIMIT') return false;
      return failureCount < 2;
    }
  });

  const questions = dailyData?.questions ?? [];
  const safeCurrentIndex = dailyData?.currentIndex >= questions.length ? 0 : (dailyData?.currentIndex ?? 0);
  const currentIndex = safeCurrentIndex;
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctKey, setCorrectKey] = useState<OptionKey | null>(null);
  const [seconds, setSeconds] = useState(QUIZ_TIME_LIMIT_SEC);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  
  // Score popup states
  const [scorePopupVisible, setScorePopupVisible] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalXp, setFinalXp] = useState(0);

  const nextIndexRef = useRef<number | null>(null);
  const questionStartedAt = useRef(Date.now());

  // Load language from AsyncStorage -> App State -> en
  useEffect(() => {
    const loadQuizLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem('quiz_language');
        if (storedLang === 'ar' || storedLang === 'en') {
          setQuizLang(storedLang);
        } else {
          setQuizLang(appLanguage === 'en' ? 'en' : 'ar');
        }
      } catch {
        setQuizLang(appLanguage === 'en' ? 'en' : 'ar');
      }
    };
    loadQuizLanguage();
  }, [appLanguage]);

  const handleLanguageSelect = (lang: 'ar' | 'en') => {
    setQuizLang(lang);
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length || QUIZ_SESSION_TOTAL;
  const questionNumber = Math.min(currentIndex + 1, totalQuestions);
  const canGoNext = answerPhase === 'revealed';

  useEffect(() => {
    if (!currentQuestion) return;
    setSelected(null);
    setAnswerPhase('idle');
    setIsCorrect(null);
    setCorrectKey(null);
    setSeconds(QUIZ_TIME_LIMIT_SEC);
    setHintUsed(currentQuestion.hintUsed ?? false);
    setHintText(null);
    questionStartedAt.current = Date.now();

    if (currentQuestion.status === 'answered') {
      setSelected((currentQuestion.selectedKey as OptionKey) ?? null);
      setIsCorrect(currentQuestion.isCorrect ?? false);
      setAnswerPhase('revealed');
    } else if (currentQuestion.status === 'skipped') {
      setAnswerPhase('revealed');
    }
  }, [currentIndex, currentQuestion?.id, currentQuestion?.status]);

  useEffect(() => {
    if (!currentQuestion || answerPhase === 'revealed') return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev <= 1 ? QUIZ_TIME_LIMIT_SEC : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, currentQuestion?.id, answerPhase]);

  const goNextQuestion = useCallback(() => {
    if (!canGoNext) return;
    
    const dailyData: any = queryClient.getQueryData(['dailyQuiz', quizLang]);
    const isCompleted = dailyData?.stats?.completed || currentIndex + 1 >= questions.length;
    
    if (isCompleted) {
      const correctAnswers = dailyData?.stats?.correct ?? questions.filter(q => q.isCorrect).length;
      setFinalScore(correctAnswers);
      setFinalXp(dailyData?.stats?.xpEarned ?? (correctAnswers * 2));
      setScorePopupVisible(true);
      return;
    }
    
    queryClient.setQueryData(['dailyQuiz', quizLang], (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        currentIndex: nextIndexRef.current ?? (oldData.currentIndex + 1),
      };
    });
  }, [canGoNext, currentIndex, questions, queryClient, quizLang]);

  const handleSelectOption = useCallback(
    async (key: OptionKey) => {
      if (!currentQuestion || answerPhase !== 'idle') return;
      setSelected(key);
      setAnswerPhase('submitting');
      try {
        const token = await getToken();
        if (!token) return;
        const timeTaken = Math.round(
          (Date.now() - questionStartedAt.current) / 1000,
        );
        const res = await QuizApiService.submitAnswer(token, {
          questionId: currentQuestion.id,
          selectedKey: key as QuizApiOptionKey,
          timeTaken,
          language: quizLang,
        });
        if (res?.status !== 'SUCCESS' || !res.data) {
          setAnswerPhase('idle');
          setSelected(null);
          return;
        }
        const d = res.data as any;
        nextIndexRef.current = d.currentIndex;

        setIsCorrect(d.isCorrect);
        setCorrectKey(d.correctKey as OptionKey);
        setAnswerPhase('revealed');
        if (d.xpEvents?.length) {
          handleXpEvents(
            d.xpEvents.map((e: any) => ({
              action: e.action,
              amount: e.amount,
              leveledUp: e.leveledUp,
              newLevel: e.newLevel,
            })),
          );
        }

        queryClient.setQueryData(['dailyQuiz', quizLang], (oldData: any) => {
          if (!oldData) return oldData;
          const newQuestions = [...oldData.questions];
          newQuestions[currentIndex] = {
            ...newQuestions[currentIndex],
            status: 'answered',
            isCorrect: d.isCorrect,
            selectedKey: key,
          };
          return { 
            ...oldData, 
            questions: newQuestions,
            stats: d.stats ?? oldData.stats
          };
        });

        // Backend updates XP/Coins directly, UI handles XpEvents, refresh coins manually
        await refreshCoins();
        
        if (d.isCorrect) {
          toastManager.showSuccess(t.quiz.excellent, `+${d.xpEvents?.[0]?.amount ?? 2} XP`);
        } else {
          toastManager.showInfo(t.quiz.wrong, t.quiz.wrong);
        }
      } catch {
        setAnswerPhase('idle');
        setSelected(null);
      }
    },
    [
      currentQuestion,
      answerPhase,
      getToken,
      quizLang,
      handleXpEvents,
      queryClient,
      currentIndex,
      refreshCoins,
      t.quiz,
    ],
  );

  const handleSkip = useCallback(async () => {
    if (!currentQuestion || answerPhase === 'revealed') return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await QuizApiService.skipQuestion(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });
      if (res?.status !== 'SUCCESS') {
        toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
        return;
      }
      await refreshCoins();
      
      const d = res.data as any;
      nextIndexRef.current = d.currentIndex;
      
      queryClient.setQueryData(['dailyQuiz', quizLang], (oldData: any) => {
        if (!oldData) return oldData;
        const newQuestions = [...oldData.questions];
        newQuestions[currentIndex] = {
          ...newQuestions[currentIndex],
          status: 'skipped',
        };
        return { 
          ...oldData, 
          questions: newQuestions,
          stats: d.stats ?? oldData.stats,
          currentIndex: d.currentIndex ?? (oldData.currentIndex + 1)
        };
      });

      const isCompleted = d.completed || currentIndex + 1 >= questions.length;
      if (isCompleted) {
        const correctAnswers = d.stats?.correct ?? questions.filter(q => q.isCorrect).length;
        setFinalScore(correctAnswers);
        setFinalXp(d.stats?.xpEarned ?? (correctAnswers * 2));
        setScorePopupVisible(true);
      }
    } catch {
      toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
    }
  }, [
    currentQuestion,
    answerPhase,
    getToken,
    quizLang,
    refreshCoins,
    queryClient,
    currentIndex,
    questions,
    t.quiz,
  ]);

  const handleHint = useCallback(async () => {
    if (!currentQuestion || hintUsed || answerPhase === 'revealed') return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await QuizApiService.useHint(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });
      if (res?.status !== 'SUCCESS' || !res.data) {
        toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
        return;
      }
      const d = res.data as any;
      nextIndexRef.current = d.currentIndex;
      
      setHintUsed(true);
      setHintText(d.hint || t.quiz.hintAppliedMessage);
      
      queryClient.setQueryData(['dailyQuiz', quizLang], (oldData: any) => {
        if (!oldData) return oldData;
        const newQuestions = [...oldData.questions];
        newQuestions[currentIndex] = {
          ...newQuestions[currentIndex],
          hintUsed: true,
          hint: d.hint || t.quiz.hintAppliedMessage,
        };
        return { 
          ...oldData, 
          questions: newQuestions,
          currentIndex: d.currentIndex ?? oldData.currentIndex 
        };
      });

      await refreshCoins();
      toastManager.showSuccess(t.quiz.useHint, t.quiz.hintAppliedMessage);
    } catch {
      toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
    }
  }, [
    currentQuestion,
    hintUsed,
    answerPhase,
    getToken,
    quizLang,
    queryClient,
    currentIndex,
    refreshCoins,
    t.quiz,
  ]);

  const toggleQuizLanguage = () => {
    const next: QuizApiLanguage = quizLang === 'ar' ? 'en' : 'ar';
    setQuizLang(next);
  };

  const progress = questionNumber / Math.max(totalQuestions, QUIZ_SESSION_TOTAL);

  const difficultyKey =
    `difficulty${mapDifficulty(currentQuestion?.difficulty ?? 'MEDIUM')}` as
      | 'difficultyEasy'
      | 'difficultyMedium'
      | 'difficultyHard';
  const difficultyText =
    t.quiz[difficultyKey] || mapDifficulty(currentQuestion?.difficulty ?? 'MEDIUM');

  const HEADER_H = insets.top + 10 + 44 + 12;

  if (loadingQuestions && !dailyData) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <ActivityIndicator size="large" color={ACCENT_SOFT} />
        <Text style={styles.loadingText}>{t.quiz.loadingQuestions}</Text>
      </View>
    );
  }

  if (error?.message === 'RATE_LIMIT') {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>
          {t.common.errorTitle ?? 'Too many requests. Please wait a moment and try again.'}
        </Text>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.loadingText}>{t.quiz.noQuestionsAvailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <QuizBackground />
      <QuizHeader topInset={insets.top} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: HEADER_H + 4,
          paddingHorizontal: SCREEN_PADDING_H,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <QuizProgressCard
          current={questionNumber}
          total={Math.max(totalQuestions, QUIZ_SESSION_TOTAL)}
          progress={progress}
          seconds={seconds}
          questionLabel={t.quiz.questionNumber}
        />

        <View style={styles.badgeRow}>
          <View style={styles.chip}>
            <Ionicons name="football" size={14} color="#C084FC" />
            <Text style={styles.chipTextPurple}>{t.quiz.footballQuiz}</Text>
          </View>
          <TouchableOpacity style={styles.chip} onPress={toggleQuizLanguage} activeOpacity={0.85}>
            <Ionicons name="language" size={14} color="#C084FC" />
            <Text style={styles.chipTextPurple}>
              {quizLang === 'ar' ? t.quiz.langArabic : t.quiz.langEnglish}
            </Text>
          </TouchableOpacity>
          <View style={styles.chip}>
            <Text style={styles.chipTextPurple}>{difficultyText}</Text>
          </View>
        </View>

        <QuizCard
          question={currentQuestion.question}
          imageUrl={currentQuestion.imageUrl}
          imageLayout={currentQuestion.imageLayout ?? 'square'}
          options={currentQuestion.options.map((o) => ({
            key: o.key as OptionKey,
            text: o.text,
          }))}
          selectedKey={selected}
          onSelectOption={handleSelectOption}
          onUseHint={handleHint}
          hintUsed={hintUsed}
          hintText={hintText}
          answerRevealed={answerPhase === 'revealed'}
          isCorrect={isCorrect}
          correctKey={correctKey}
          disableOptions={answerPhase !== 'idle'}
        />

        <QuizFooterActions
          onSkip={handleSkip}
          onNext={goNextQuestion}
          skipDisabled={
            coinsLoading ||
            coins < QUIZ_COIN_COST ||
            answerPhase === 'revealed'
          }
          nextDisabled={!canGoNext}
          answerRevealed={answerPhase === 'revealed'}
          isCorrect={isCorrect}
        />
      </ScrollView>
      <QuizLanguagePopup onSelectLanguage={handleLanguageSelect} />
      <QuizScorePopup
        visible={scorePopupVisible}
        score={finalScore}
        total={totalQuestions}
        xpEarned={finalXp}
        onClose={() => {
          setScorePopupVisible(false);
          loadDaily(quizLang);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: QUIZ_SCREEN_BG,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    backgroundColor: QUIZ_SCREEN_BG,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: QUIZ_RADIUS_SM,
    borderWidth: 1,
    borderColor: QUIZ_CARD_BORDER,
    backgroundColor: QUIZ_CHIP_BG,
  },
  chipTextPurple: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
});
