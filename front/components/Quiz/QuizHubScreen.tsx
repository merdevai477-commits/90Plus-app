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
  type QuizApiOptionKey,
  type QuizDailyPayload,
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

const AUTO_NEXT_MS = 3000;

function mapDifficulty(d: string): 'Easy' | 'Medium' | 'Hard' {
  if (d === 'EASY') return 'Easy';
  if (d === 'HARD') return 'Hard';
  return 'Medium';
}

function patchDailyStats(
  oldStats: QuizDailyPayload['stats'] | undefined,
  nextStats: Partial<QuizDailyPayload['stats']> | undefined,
): QuizDailyPayload['stats'] {
  return {
    correct: nextStats?.correct ?? oldStats?.correct ?? 0,
    answered: nextStats?.answered ?? oldStats?.answered ?? 0,
    skipped: nextStats?.skipped ?? oldStats?.skipped ?? 0,
    timedOut: nextStats?.timedOut ?? oldStats?.timedOut ?? 0,
    closed: nextStats?.closed ?? oldStats?.closed ?? 0,
    xpEarned: nextStats?.xpEarned ?? oldStats?.xpEarned ?? 0,
    completed: nextStats?.completed ?? oldStats?.completed ?? false,
  };
}

export default function QuizHubScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((s) => s.language);
  const { getToken } = useAuth();
  const { refreshCoins, coins, loading: coinsLoading, applyCoinsBalance } = useCoins();
  const { handleXpEvents } = useXp();

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
    },
  });

  const questions = dailyData?.questions ?? [];
  const safeCurrentIndex =
    dailyData?.currentIndex !== undefined && dailyData.currentIndex >= questions.length
      ? 0
      : (dailyData?.currentIndex ?? 0);
  const currentIndex = safeCurrentIndex;
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctKey, setCorrectKey] = useState<OptionKey | null>(null);
  const [seconds, setSeconds] = useState(QUIZ_TIME_LIMIT_SEC);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [revealedImageUrl, setRevealedImageUrl] = useState<string | null>(null);

  const [scorePopupVisible, setScorePopupVisible] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalXp, setFinalXp] = useState(0);

  const nextIndexRef = useRef<number | null>(null);
  const questionStartedAt = useRef(Date.now());
  const timeoutCalledRef = useRef<string | null>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const patchCacheCoins = useCallback(
    (nextCoins: number) => {
      queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (old) =>
        old ? { ...old, coins: nextCoins } : old,
      );
    },
    [queryClient, quizLang],
  );

  useEffect(() => {
    void getToken().then((t) => {
      tokenRef.current = t ?? null;
    });
  }, [getToken, quizLang, currentIndex]);

  const clearAutoNextTimer = useCallback(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  }, []);

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

  useEffect(() => () => clearAutoNextTimer(), [clearAutoNextTimer]);

  const handleLanguageSelect = (lang: 'ar' | 'en') => {
    setQuizLang(lang);
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length || QUIZ_SESSION_TOTAL;
  const questionNumber = Math.min(currentIndex + 1, totalQuestions);
  const canGoNext = answerPhase === 'revealed';

  useEffect(() => {
    if (!currentQuestion) return;
    clearAutoNextTimer();
    timeoutCalledRef.current = null;
    setSelected(null);
    setAnswerPhase('idle');
    setIsCorrect(null);
    setCorrectKey(null);
    setRevealedImageUrl(null);
    setSeconds(QUIZ_TIME_LIMIT_SEC);
    setHintUsed(currentQuestion.hintUsed ?? false);
    setHintText(null);
    questionStartedAt.current = Date.now();

    if (currentQuestion.status === 'answered') {
      setSelected((currentQuestion.selectedKey as OptionKey) ?? null);
      setIsCorrect(currentQuestion.isCorrect ?? false);
      setCorrectKey((currentQuestion.correctKey as OptionKey) ?? null);
      setRevealedImageUrl(currentQuestion.imageUrl ?? null);
      setAnswerPhase('revealed');
    } else if (currentQuestion.status === 'timed_out') {
      setIsCorrect(false);
      setCorrectKey((currentQuestion.correctKey as OptionKey) ?? null);
      setRevealedImageUrl(currentQuestion.imageUrl ?? null);
      setAnswerPhase('revealed');
    } else if (currentQuestion.status === 'skipped') {
      setAnswerPhase('revealed');
    }
  }, [currentIndex, currentQuestion?.id, currentQuestion?.status, clearAutoNextTimer]);

  useEffect(() => {
    if (!currentQuestion || answerPhase !== 'idle') return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, currentQuestion?.id, answerPhase]);

  const showCompletionPopup = useCallback(
    (stats?: QuizDailyPayload['stats']) => {
      const cached = queryClient.getQueryData<QuizDailyPayload>(['dailyQuiz', quizLang]);
      const correctAnswers =
        stats?.correct ??
        cached?.stats?.correct ??
        questions.filter((q) => q.isCorrect).length;
      const xpEarned =
        stats?.xpEarned ??
        cached?.stats?.xpEarned ??
        correctAnswers * 2;
      setFinalScore(correctAnswers);
      setFinalXp(xpEarned);
      setScorePopupVisible(true);
    },
    [queryClient, quizLang, questions],
  );

  const goNextQuestion = useCallback(() => {
    clearAutoNextTimer();
    if (!canGoNext) return;

    const cached = queryClient.getQueryData<QuizDailyPayload>(['dailyQuiz', quizLang]);
    const isCompleted =
      cached?.stats?.completed || currentIndex + 1 >= questions.length;

    if (isCompleted) {
      showCompletionPopup(cached?.stats);
      return;
    }

    queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        currentIndex: nextIndexRef.current ?? oldData.currentIndex + 1,
      };
    });
  }, [
    canGoNext,
    clearAutoNextTimer,
    currentIndex,
    questions.length,
    queryClient,
    quizLang,
    showCompletionPopup,
  ]);

  const startAutoNext = useCallback(() => {
    clearAutoNextTimer();
    autoNextTimerRef.current = setTimeout(() => {
      goNextQuestion();
    }, AUTO_NEXT_MS);
  }, [clearAutoNextTimer, goNextQuestion]);

  const handleTimeout = useCallback(async () => {
    if (!currentQuestion || answerPhase !== 'idle') return;
    if (timeoutCalledRef.current === currentQuestion.id) return;
    timeoutCalledRef.current = currentQuestion.id;
    setAnswerPhase('submitting');

    try {
      const token = tokenRef.current ?? (await getToken());
      if (!token) {
        setAnswerPhase('idle');
        timeoutCalledRef.current = null;
        return;
      }
      tokenRef.current = token;

      const res = await QuizApiService.submitTimeout(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });

      if (res?.status !== 'SUCCESS' || !res.data) {
        setAnswerPhase('idle');
        timeoutCalledRef.current = null;
        return;
      }

      const d = res.data;
      nextIndexRef.current = d.currentIndex;
      setIsCorrect(false);
      if (d.correctKey) {
        setCorrectKey(d.correctKey as OptionKey);
      }
      if (d.imageUrl) {
        setRevealedImageUrl(d.imageUrl);
      }
      setAnswerPhase('revealed');

      queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
        if (!oldData) return oldData;
        const newQuestions = [...oldData.questions];
        newQuestions[currentIndex] = {
          ...newQuestions[currentIndex],
          status: 'timed_out',
          isCorrect: false,
          ...(d.correctKey ? { correctKey: d.correctKey } : {}),
          ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
          penaltyApplied: d.penaltyApplied,
        };
        return {
          ...oldData,
          coins: d.coins,
          questions: newQuestions,
          stats: patchDailyStats(oldData.stats, {
            correct: d.stats.correct,
            answered: d.stats.answered,
            skipped: d.stats.skipped,
            timedOut: d.stats.timedOut,
            closed: d.stats.closed,
            xpEarned: (d.stats as { xp?: number }).xp ?? oldData.stats.xpEarned,
            completed: d.completed,
          }),
        };
      });

      patchCacheCoins(d.coins);
      applyCoinsBalance(d.coins);
      if (d.penaltyApplied) {
        toastManager.showInfo(t.quiz.timesUpCoinsDeducted, t.quiz.timesUpCoinsDeducted);
      } else {
        toastManager.showInfo(t.quiz.timesUpNoCoinsDeducted, t.quiz.timesUpNoCoinsDeducted);
      }

      if (d.completed) {
        showCompletionPopup(
          patchDailyStats(undefined, {
            correct: d.stats.correct,
            answered: d.stats.answered,
            skipped: d.stats.skipped,
            timedOut: d.stats.timedOut,
            closed: d.stats.closed,
            xpEarned: d.stats.xpEarned ?? d.stats.xp,
            completed: true,
          }),
        );
      } else {
        startAutoNext();
      }
    } catch {
      setAnswerPhase('idle');
      timeoutCalledRef.current = null;
    }
  }, [
    currentQuestion,
    answerPhase,
    getToken,
    quizLang,
    queryClient,
    currentIndex,
    patchCacheCoins,
    applyCoinsBalance,
    t.quiz,
    showCompletionPopup,
    startAutoNext,
  ]);

  useEffect(() => {
    if (!currentQuestion || answerPhase !== 'idle' || seconds > 0) return;
    void handleTimeout();
  }, [seconds, currentQuestion?.id, answerPhase, handleTimeout]);

  const handleSelectOption = useCallback(
    async (key: OptionKey) => {
      if (!currentQuestion || answerPhase !== 'idle') return;
      clearAutoNextTimer();
      setSelected(key);
      setAnswerPhase('submitting');
      try {
        const token = tokenRef.current ?? (await getToken());
        if (!token) {
          setAnswerPhase('idle');
          setSelected(null);
          return;
        }
        tokenRef.current = token;
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
        const d = res.data as {
          isCorrect: boolean;
          correctKey: QuizApiOptionKey;
          imageUrl?: string | null;
          currentIndex: number;
          stats?: QuizDailyPayload['stats'];
          completed?: boolean;
          xpEvents?: Array<{
            action: string;
            amount: number;
            leveledUp: boolean;
            newLevel: number;
          }>;
        };
        nextIndexRef.current = d.currentIndex;

        setIsCorrect(d.isCorrect);
        setCorrectKey(d.correctKey as OptionKey);
        if (d.imageUrl) {
          setRevealedImageUrl(d.imageUrl);
        }
        setAnswerPhase('revealed');
        if (d.xpEvents?.length) {
          handleXpEvents(
            d.xpEvents.map((e) => ({
              action: e.action,
              amount: e.amount,
              leveledUp: e.leveledUp,
              newLevel: e.newLevel,
            })),
          );
        }

        queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
          if (!oldData) return oldData;
          const newQuestions = [...oldData.questions];
          newQuestions[currentIndex] = {
            ...newQuestions[currentIndex],
            status: 'answered',
            isCorrect: d.isCorrect,
            selectedKey: key,
            correctKey: d.correctKey,
            ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
          };
          return {
            ...oldData,
            questions: newQuestions,
            stats: patchDailyStats(oldData.stats, d.stats),
          };
        });

        if (d.isCorrect) {
          toastManager.showSuccess(t.quiz.excellent, `+${d.xpEvents?.[0]?.amount ?? 2} XP`);
        } else {
          toastManager.showInfo(t.quiz.wrong, t.quiz.wrong);
        }

        if (d.completed) {
          showCompletionPopup(d.stats);
        } else {
          startAutoNext();
        }
      } catch {
        setAnswerPhase('idle');
        setSelected(null);
      }
    },
    [
      currentQuestion,
      answerPhase,
      clearAutoNextTimer,
      getToken,
      quizLang,
      handleXpEvents,
      queryClient,
      currentIndex,
      t.quiz,
      showCompletionPopup,
      startAutoNext,
    ],
  );

  const handleSkip = useCallback(async () => {
    if (!currentQuestion || answerPhase === 'revealed') return;
    clearAutoNextTimer();
    if (coins < QUIZ_COIN_COST) {
      toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
      return;
    }
    patchCacheCoins(coins - QUIZ_COIN_COST);
    applyCoinsBalance(coins - QUIZ_COIN_COST);

    const optimisticNext = currentIndex + 1;
    const completedNow = optimisticNext >= questions.length;
    queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
      if (!oldData) return oldData;
      const newQuestions = [...oldData.questions];
      newQuestions[currentIndex] = {
        ...newQuestions[currentIndex],
        status: 'skipped',
      };
      return {
        ...oldData,
        questions: newQuestions,
        currentIndex: completedNow ? oldData.currentIndex : optimisticNext,
      };
    });

    if (completedNow) {
      showCompletionPopup();
    }

    try {
      const token = tokenRef.current ?? (await getToken());
      if (!token) return;
      tokenRef.current = token;
      const res = await QuizApiService.skipQuestion(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });
      if (res?.status !== 'SUCCESS') {
        void refreshCoins();
        return;
      }

      const d = res.data as {
        currentIndex: number;
        completed?: boolean;
        stats?: QuizDailyPayload['stats'];
        coins?: number;
      };
      nextIndexRef.current = d.currentIndex;
      if (typeof d.coins === 'number') {
        patchCacheCoins(d.coins);
        applyCoinsBalance(d.coins);
      }

      queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          stats: patchDailyStats(oldData.stats, d.stats),
          currentIndex: d.currentIndex ?? oldData.currentIndex,
        };
      });

      if (d.completed) {
        showCompletionPopup(d.stats);
      }
    } catch {
      void refreshCoins();
    }
  }, [
    currentQuestion,
    answerPhase,
    clearAutoNextTimer,
    coins,
    applyCoinsBalance,
    patchCacheCoins,
    getToken,
    quizLang,
    queryClient,
    currentIndex,
    questions.length,
    t.quiz,
    showCompletionPopup,
    refreshCoins,
  ]);

  const handleHint = useCallback(async () => {
    if (!currentQuestion || hintUsed || answerPhase === 'revealed') return;
    if (coins < QUIZ_COIN_COST) {
      toastManager.showWarning(t.quiz.notEnoughCoins, t.quiz.notEnoughCoinsMessage);
      return;
    }
    patchCacheCoins(coins - QUIZ_COIN_COST);
    applyCoinsBalance(coins - QUIZ_COIN_COST);
    setHintUsed(true);
    setHintText(t.quiz.hintAppliedMessage);
    toastManager.showSuccess(t.quiz.useHint, t.quiz.hintAppliedMessage);

    try {
      const token = tokenRef.current ?? (await getToken());
      if (!token) return;
      tokenRef.current = token;
      const res = await QuizApiService.useHint(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });
      if (res?.status !== 'SUCCESS' || !res.data) {
        void refreshCoins();
        return;
      }

      const d = res.data as { hint?: string; currentIndex: number; coins?: number };
      nextIndexRef.current = d.currentIndex;
      if (d.hint) {
        setHintText(d.hint);
      }
      if (typeof d.coins === 'number') {
        patchCacheCoins(d.coins);
        applyCoinsBalance(d.coins);
      }

      queryClient.setQueryData<QuizDailyPayload>(['dailyQuiz', quizLang], (oldData) => {
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
          currentIndex: d.currentIndex ?? oldData.currentIndex,
        };
      });
    } catch {
      void refreshCoins();
    }
  }, [
    currentQuestion,
    hintUsed,
    answerPhase,
    coins,
    applyCoinsBalance,
    patchCacheCoins,
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
          {t.common.error ?? 'Too many requests. Please wait a moment and try again.'}
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

  const resolvedImageUrl = currentQuestion.imageUrl?.trim() || null;

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
          questionType={currentQuestion.type ?? 'normal'}
          imageUrl={resolvedImageUrl}
          revealImageUrl={revealedImageUrl}
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
        onClose={() => setScorePopupVisible(false)}
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
  noQuestionsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
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
