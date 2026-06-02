/**
 * QuizHubScreen — Daily AI quiz (OpenRouter), API images, XP & coins via backend.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

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
import { prefetchQuizImages, useDailyQuiz, dailyQuizQueryKey, cacheDailyQuiz } from '../../hooks/useDailyQuiz';

type AnswerPhase = 'idle' | 'submitting' | 'revealed';

const AUTO_NEXT_MS = 3000;

function isAllQuestionsTerminal(questions: QuizDailyPayload['questions']): boolean {
  return (
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.status === 'answered' || q.status === 'skipped' || q.status === 'timed_out',
    )
  );
}

function scheduleQuestionAutoNext(
  clearTimer: () => void,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  advance: () => void,
  delayMs = AUTO_NEXT_MS,
) {
  clearTimer();
  timerRef.current = setTimeout(advance, delayMs);
}

function difficultyLocaleKey(
  d: string,
): 'difficultyEasy' | 'difficultyMedium' | 'difficultyHard' {
  if (d === 'EASY') return 'difficultyEasy';
  if (d === 'HARD') return 'difficultyHard';
  return 'difficultyMedium';
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
  const router = useRouter();
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((s) => s.language);
  const { getToken, isSignedIn } = useAuth();
  const { refreshCoins, coins, loading: coinsLoading, applyCoinsBalance } = useCoins();
  const { handleXpEvents, applyXpSnapshot, refresh: refreshXp } = useXp();

  const [quizLang, setQuizLang] = useState<QuizApiLanguage>(
    appLanguage === 'en' ? 'en' : 'ar',
  );

  const queryClient = useQueryClient();

  const {
    data: dailyData,
    isLoading: loadingQuestions,
    error,
    refetch,
    isFetching,
    dateKey: quizDateKey,
  } = useDailyQuiz(quizLang);

  const quizQueryKey = useMemo(
    () => dailyQuizQueryKey(quizLang, quizDateKey),
    [quizLang, quizDateKey],
  );

  const questions = dailyData?.questions ?? [];
  const rawCurrentIndex = dailyData?.currentIndex ?? 0;
  const isDailyCompleted =
    Boolean(dailyData?.stats?.completed) || isAllQuestionsTerminal(questions);
  const currentIndex =
    !isDailyCompleted && rawCurrentIndex < questions.length ? rawCurrentIndex : -1;
  const [timerRetryEpoch, setTimerRetryEpoch] = useState(0);
  /** Stops the countdown as soon as the user picks an option (before API returns). */
  const [answerLocked, setAnswerLocked] = useState(false);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctKey, setCorrectKey] = useState<OptionKey | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [revealedImageUrl, setRevealedImageUrl] = useState<string | null>(null);

  const [scorePopupVisible, setScorePopupVisible] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalXp, setFinalXp] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState('');

  const nextIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const questionStartedAt = useRef(Date.now());
  const timeoutCalledRef = useRef<string | null>(null);
  const pendingSelectedKeyRef = useRef<OptionKey | null>(null);
  const submitRetryCountRef = useRef(0);
  const answerLockedRef = useRef(false);
  const answerPhaseRef = useRef<AnswerPhase>('idle');
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goNextQuestionRef = useRef<() => void>(() => {});
  const tokenRef = useRef<string | null>(null);

  const setAnswerPhaseSync = useCallback((phase: AnswerPhase) => {
    answerPhaseRef.current = phase;
    setAnswerPhase(phase);
  }, []);

  const syncRankXpCaches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['rank'] });
  }, [queryClient]);

  const applyQuizXp = useCallback(
    (payload: {
      xp?: number;
      level?: number;
      xpEvents?: Array<{
        action: string;
        amount: number;
        leveledUp: boolean;
        newLevel: number;
        newTitle?: string;
      }>;
      xpAwarded?: number;
    }) => {
      const snapshot =
        typeof payload.xp === 'number' && typeof payload.level === 'number'
          ? { xp: payload.xp, level: payload.level }
          : undefined;

      if (snapshot) {
        applyXpSnapshot(snapshot);
        syncRankXpCaches();
      }

      if (payload.xpEvents?.length) {
        void handleXpEvents(
          payload.xpEvents.map((e) => ({
            action: e.action,
            amount: e.amount,
            leveledUp: e.leveledUp,
            newLevel: e.newLevel,
            newTitle: e.newTitle,
          })),
          snapshot,
        );
        return;
      }
      if (payload.xpAwarded && payload.xpAwarded > 0) {
        void handleXpEvents(
          [
            {
              action: 'QUIZ_ANSWER_CORRECT',
              amount: payload.xpAwarded,
              leveledUp: false,
              newLevel: payload.level ?? 1,
            },
          ],
          snapshot,
        );
        return;
      }
      void refreshXp();
    },
    [applyXpSnapshot, handleXpEvents, refreshXp, syncRankXpCaches],
  );

  const patchCacheCoins = useCallback(
    (nextCoins: number) => {
      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (old) =>
        old ? { ...old, coins: nextCoins } : old,
      );
    },
    [queryClient, quizQueryKey],
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

  useEffect(() => {
    if (dailyData?.packDate && dailyData.questions?.length) {
      void cacheDailyQuiz(quizLang, dailyData);
    }
  }, [dailyData, quizLang]);

  useEffect(() => {
    if (isSignedIn) {
      void refetch();
    }
  }, [isSignedIn, quizLang, quizDateKey]);

  const unlockQuestionTimer = useCallback(() => {
    pendingSelectedKeyRef.current = null;
    submitRetryCountRef.current = 0;
    timeoutCalledRef.current = null;
    answerLockedRef.current = false;
    setAnswerLocked(false);
    setAnswerPhaseSync('idle');
    setTimerRetryEpoch((n) => n + 1);
  }, [setAnswerPhaseSync]);

  const resetTimeoutAttempt = useCallback(() => {
    unlockQuestionTimer();
  }, [unlockQuestionTimer]);

  const handleLanguageSelect = async (lang: 'ar' | 'en') => {
    setQuizLang(lang);
    try {
      await AsyncStorage.setItem('quiz_language', lang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isDailyCompleted || !dailyData?.expiresAt) {
      setCountdownLabel('');
      return undefined; 
    }
    const updateCountdown = () => {
      const diff = new Date(dailyData.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownLabel('00:00:00');
        void refetch();
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setCountdownLabel(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      );
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [isDailyCompleted, dailyData?.expiresAt, refetch]);

  useEffect(() => {
    if (!questions.length || currentIndex < 0) return;
    prefetchQuizImages(questions, currentIndex);
  }, [currentIndex, questions]);

  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] : undefined;
  const totalQuestions = questions.length || QUIZ_SESSION_TOTAL;
  const questionNumber =
    currentIndex >= 0 ? currentIndex + 1 : Math.min(rawCurrentIndex + 1, totalQuestions);
  const canGoNext = answerPhase === 'revealed';

  useEffect(() => {
    if (!currentQuestion) return;
    clearAutoNextTimer();
    timeoutCalledRef.current = null;
    pendingSelectedKeyRef.current = null;
    submitRetryCountRef.current = 0;
    answerLockedRef.current = false;
    setAnswerLocked(false);
    setSelected(null);
    setAnswerPhaseSync('idle');
    setIsCorrect(null);
    setCorrectKey(null);
    setRevealedImageUrl(null);
    setHintUsed(currentQuestion.hintUsed ?? false);
    setHintText(null);
    questionStartedAt.current = Date.now();
    void getToken().then((t) => {
      tokenRef.current = t ?? null;
    });

    if (currentQuestion.status === 'answered') {
      setSelected((currentQuestion.selectedKey as OptionKey) ?? null);
      setIsCorrect(currentQuestion.isCorrect ?? false);
      setCorrectKey((currentQuestion.correctKey as OptionKey) ?? null);
      setRevealedImageUrl(currentQuestion.imageUrl ?? null);
      setAnswerPhaseSync('revealed');
      answerLockedRef.current = true;
      setAnswerLocked(true);
    } else if (currentQuestion.status === 'timed_out') {
      setIsCorrect(false);
      setCorrectKey((currentQuestion.correctKey as OptionKey) ?? null);
      setRevealedImageUrl(currentQuestion.imageUrl ?? null);
      setAnswerPhaseSync('revealed');
      answerLockedRef.current = true;
      setAnswerLocked(true);
    } else if (currentQuestion.status === 'skipped') {
      setAnswerPhaseSync('revealed');
      answerLockedRef.current = true;
      setAnswerLocked(true);
    }
  }, [currentIndex, currentQuestion?.id, currentQuestion?.status, clearAutoNextTimer, setAnswerPhaseSync]);

  // After reveal (especially correct + image), ensure footer buttons stay reachable.
  useEffect(() => {
    if (answerPhase !== 'revealed') return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [answerPhase, currentIndex, isCorrect, revealedImageUrl]);

  const showCompletionPopup = useCallback(
    (stats?: QuizDailyPayload['stats']) => {
      const cached = queryClient.getQueryData<QuizDailyPayload>(quizQueryKey);
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
      void refreshXp();
    },
    [queryClient, quizQueryKey, questions, refreshXp],
  );

  const goNextQuestion = useCallback(() => {
    clearAutoNextTimer();

    const cached = queryClient.getQueryData<QuizDailyPayload>(quizQueryKey);
    const cachedQuestions = cached?.questions ?? questions;
    const isCompleted =
      Boolean(cached?.stats?.completed) ||
      isAllQuestionsTerminal(cachedQuestions) ||
      (currentIndex >= 0 && currentIndex + 1 >= questions.length);

    if (isCompleted) {
      showCompletionPopup(cached?.stats);
      return;
    }

    queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        currentIndex: nextIndexRef.current ?? oldData.currentIndex + 1,
      };
    });
  }, [
    clearAutoNextTimer,
    currentIndex,
    questions.length,
    queryClient,
    quizQueryKey,
    showCompletionPopup,
  ]);

  goNextQuestionRef.current = goNextQuestion;

  const scheduleAutoNext = useCallback(() => {
    scheduleQuestionAutoNext(
      clearAutoNextTimer,
      autoNextTimerRef,
      () => goNextQuestionRef.current(),
    );
  }, [clearAutoNextTimer]);

  const submitSelectedAnswer = useCallback(
    async (key: OptionKey, opts?: { fromRetry?: boolean }) => {
      if (!currentQuestion) return;
      if (answerPhaseRef.current === 'revealed') return;

      if (!opts?.fromRetry) {
        if (answerPhaseRef.current === 'submitting') return;
        clearAutoNextTimer();
        pendingSelectedKeyRef.current = key;
        timeoutCalledRef.current = currentQuestion.id;
        answerLockedRef.current = true;
        setAnswerLocked(true);
        setSelected(key);
        setAnswerPhaseSync('submitting');
        submitRetryCountRef.current = 0;
      } else {
        submitRetryCountRef.current += 1;
      }

      try {
        const token = tokenRef.current ?? (await getToken());
        if (!token) {
          unlockQuestionTimer();
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
          throw new Error('QUIZ_ANSWER_FAILED');
        }
        const d = res.data as {
          isCorrect: boolean;
          correctKey: QuizApiOptionKey;
          imageUrl?: string | null;
          currentIndex: number;
          stats?: QuizDailyPayload['stats'];
          completed?: boolean;
          xpAwarded?: number;
          xp?: number;
          level?: number;
          coins?: number;
          coinsDeducted?: number;
          xpEvents?: Array<{
            action: string;
            amount: number;
            leveledUp: boolean;
            newLevel: number;
            newTitle?: string;
          }>;
        };
        nextIndexRef.current = d.currentIndex;
        pendingSelectedKeyRef.current = null;
        submitRetryCountRef.current = 0;

        setIsCorrect(d.isCorrect);
        setCorrectKey(d.correctKey as OptionKey);
        if (d.imageUrl) {
          setRevealedImageUrl(d.imageUrl);
        }
        setAnswerPhaseSync('revealed');
        applyQuizXp(d);

        if (typeof d.coins === 'number') {
          patchCacheCoins(d.coins);
          applyCoinsBalance(d.coins);
        }

        queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
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
            coins: d.coins ?? oldData.coins,
            xp: d.xp ?? oldData.xp,
            level: d.level ?? oldData.level,
            questions: newQuestions,
            stats: patchDailyStats(oldData.stats, d.stats),
          };
        });

        if (d.isCorrect) {
          const xpAmount =
            d.xpEvents?.reduce((sum, e) => sum + e.amount, 0) ??
            d.xpAwarded ??
            2;
          toastManager.showSuccess(
            t.quiz.excellent,
            t.quiz.xpBonus.replace('{amount}', String(xpAmount)),
            { position: 'top', duration: 2800 },
          );
        } else {
          const deducted = d.coinsDeducted ?? QUIZ_COIN_COST;
          toastManager.showWarning(
            t.quiz.wrong,
            t.quiz.wrongCoinsDeducted.replace('{amount}', String(deducted)),
            { position: 'top', duration: 2800 },
          );
        }

        if (d.completed) {
          clearAutoNextTimer();
          showCompletionPopup(d.stats);
        } else {
          scheduleAutoNext();
        }
      } catch {
        const retries = submitRetryCountRef.current;
        if (retries < 2 && pendingSelectedKeyRef.current) {
          setTimeout(() => {
            void submitSelectedAnswer(pendingSelectedKeyRef.current!, {
              fromRetry: true,
            });
          }, 900);
          return;
        }
        unlockQuestionTimer();
        setSelected(null);
        toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
      }
    },
    [
      currentQuestion,
      clearAutoNextTimer,
      getToken,
      quizLang,
      applyQuizXp,
      queryClient,
      quizQueryKey,
      currentIndex,
      t.quiz,
      showCompletionPopup,
      scheduleAutoNext,
      setAnswerPhaseSync,
      unlockQuestionTimer,
    ],
  );

  useEffect(() => {
    if (answerPhase !== 'submitting') return undefined;
    const key = pendingSelectedKeyRef.current;
    const safety = setTimeout(() => {
      if (key && submitRetryCountRef.current < 3) {
        void submitSelectedAnswer(key, { fromRetry: true });
        return;
      }
      unlockQuestionTimer();
      setSelected(null);
      toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
    }, 22_000);
    return () => clearTimeout(safety);
  }, [
    answerPhase,
    submitSelectedAnswer,
    unlockQuestionTimer,
    t.quiz.actionFailed,
    t.quiz.loadFailed,
  ]);

  const handleSelectOption = useCallback(
    (key: OptionKey) => {
      void submitSelectedAnswer(key);
    },
    [submitSelectedAnswer],
  );

  const handleTimeout = useCallback(async () => {
    if (!currentQuestion) return;
    if (answerLockedRef.current || pendingSelectedKeyRef.current) return;
    if (answerPhaseRef.current !== 'idle') return;
    if (timeoutCalledRef.current === currentQuestion.id) return;
    timeoutCalledRef.current = currentQuestion.id;
    answerLockedRef.current = true;
    setAnswerLocked(true);
    setAnswerPhaseSync('submitting');

    try {
      const token = tokenRef.current ?? (await getToken());
      if (!token) {
        resetTimeoutAttempt();
        return;
      }
      tokenRef.current = token;

      const res = await QuizApiService.submitTimeout(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });

      if (res?.status !== 'SUCCESS' || !res.data) {
        resetTimeoutAttempt();
        return;
      }

      const d = res.data;
      nextIndexRef.current = d.currentIndex;
      setIsCorrect(false);
      if (d.correctKey) {
        setCorrectKey(d.correctKey as OptionKey);
        setSelected(d.correctKey as OptionKey);
      }
      if (d.imageUrl) {
        setRevealedImageUrl(d.imageUrl);
      }
      setAnswerPhaseSync('revealed');
      scheduleAutoNext();

      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
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

      if (d.completed) {
        clearAutoNextTimer();
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
      }
    } catch {
      resetTimeoutAttempt();
      toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
    }
  }, [
    currentQuestion,
    getToken,
    quizLang,
    queryClient,
    currentIndex,
    patchCacheCoins,
    applyCoinsBalance,
    t.quiz,
    showCompletionPopup,
    quizQueryKey,
    clearAutoNextTimer,
    scheduleAutoNext,
    resetTimeoutAttempt,
    setAnswerPhaseSync,
  ]);

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
    queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
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
        void refetch();
        toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
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

      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
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
      void refetch();
      toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
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
    refetch,
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
        void refetch();
        toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
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

      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
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
      setHintUsed(false);
      setHintText(null);
      void refreshCoins();
      void refetch();
      toastManager.showError(t.quiz.actionFailed, t.quiz.loadFailed);
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
    refetch,
    t.quiz,
  ]);

  const applyQuizLanguage = useCallback(
    async (next: QuizApiLanguage) => {
      setQuizLang(next);
      try {
        await AsyncStorage.setItem('quiz_language', next);
      } catch {
        // ignore
      }
    },
    [],
  );

  const toggleQuizLanguage = () => {
    const next: QuizApiLanguage = quizLang === 'ar' ? 'en' : 'ar';
    const hasProgress =
      dailyData?.stats?.answered !== undefined && dailyData.stats.answered > 0;

    if (hasProgress && answerPhase !== 'revealed') {
      Alert.alert(t.quiz.switchLangConfirmTitle, t.quiz.switchLangConfirmMessage, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.quiz.switchQuizLang,
          onPress: () => {
            void applyQuizLanguage(next);
          },
        },
      ]);
      return;
    }
    void applyQuizLanguage(next);
  };

  const progress = questionNumber / Math.max(totalQuestions, QUIZ_SESSION_TOTAL);

  const difficultyText = t.quiz[difficultyLocaleKey(currentQuestion?.difficulty ?? 'MEDIUM')];

  const cardOptions = useMemo(
    () =>
      currentQuestion
        ? currentQuestion.options.map((o) => ({
            key: o.key as OptionKey,
            text: o.text,
          }))
        : [],
    [currentQuestion?.id, currentQuestion?.options],
  );

  const HEADER_H = insets.top + 10 + 44 + 12;
  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : '';

  if (isSignedIn === false) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Ionicons name="lock-closed-outline" size={48} color={ACCENT_SOFT} />
        <Text style={styles.noQuestionsText}>{t.quiz.signInRequired}</Text>
        <Text style={styles.loadingText}>{t.quiz.signInRequiredMessage}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.push('/auth' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>{t.home.signIn}</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  if (errorMessage === 'RATE_LIMIT') {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>{t.quiz.rateLimit}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void refetch()}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>{t.quiz.retryLoad}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && !dailyData) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>
          {errorMessage === 'EMPTY_PACK'
            ? t.quiz.noQuestionsAvailable
            : errorMessage === 'AUTH_REQUIRED'
              ? t.quiz.signInRequired
              : t.quiz.loadFailed}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void refetch()}
          disabled={isFetching}
          activeOpacity={0.85}
        >
          {isFetching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.retryButtonText}>{t.quiz.retryLoad}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (isDailyCompleted && !scorePopupVisible) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Ionicons name="checkmark-circle" size={56} color={ACCENT_SOFT} />
        <Text style={styles.completedTitle}>{t.quiz.dailyCompletedTitle}</Text>
        <Text style={styles.loadingText}>{t.quiz.dailyCompletedSubtitle}</Text>
        {countdownLabel ? (
          <Text style={styles.countdownText}>
            {t.quiz.newQuizIn} {countdownLabel}
          </Text>
        ) : null}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.push('/(tabs)/rank' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>{t.quiz.backToRank}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentQuestion) {
    if (loadingQuestions || isFetching) {
      return (
        <View style={[styles.root, styles.centered]}>
          <QuizBackground />
          <QuizHeader topInset={insets.top} />
          <ActivityIndicator size="large" color={ACCENT_SOFT} />
          <Text style={styles.loadingText}>{t.quiz.loadingQuestions}</Text>
        </View>
      );
    }

    const allDone =
      isDailyCompleted ||
      (questions.length > 0 && rawCurrentIndex >= questions.length);

    if (allDone) {
      return (
        <View style={[styles.root, styles.centered]}>
          <QuizBackground />
          <QuizHeader topInset={insets.top} />
          <Ionicons name="checkmark-circle" size={56} color={ACCENT_SOFT} />
          <Text style={styles.completedTitle}>{t.quiz.dailyCompletedTitle}</Text>
          <Text style={styles.loadingText}>{t.quiz.dailyCompletedSubtitle}</Text>
          {countdownLabel ? (
            <Text style={styles.countdownText}>
              {t.quiz.newQuizIn} {countdownLabel}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/(tabs)/rank' as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>{t.quiz.backToRank}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>
          {errorMessage === 'USER_NOT_FOUND'
            ? t.quiz.loadFailed
            : t.quiz.noQuestionsAvailable}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void refetch()}
          disabled={isFetching}
          activeOpacity={0.85}
        >
          {isFetching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.retryButtonText}>{t.quiz.retryLoad}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const resolvedImageUrl = currentQuestion.imageUrl?.trim() || null;

  return (
    <View style={styles.root}>
      <QuizBackground />
      <QuizHeader topInset={insets.top} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HEADER_H + 4,
            paddingHorizontal: SCREEN_PADDING_H,
            paddingBottom: Math.max(insets.bottom, 16) + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <QuizProgressCard
          current={questionNumber}
          total={Math.max(totalQuestions, QUIZ_SESSION_TOTAL)}
          progress={progress}
          questionLabel={t.quiz.questionNumber}
          timerKey={currentQuestion.id}
          timerRetryEpoch={timerRetryEpoch}
          timerActive={answerPhase === 'idle' && !answerLocked}
          timeLimitSec={QUIZ_TIME_LIMIT_SEC}
          onTimeUp={handleTimeout}
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
          options={cardOptions}
          selectedKey={selected}
          onSelectOption={handleSelectOption}
          onUseHint={handleHint}
          hintUsed={hintUsed}
          hintText={hintText}
          answerRevealed={answerPhase === 'revealed'}
          isCorrect={isCorrect}
          correctKey={correctKey}
          disableOptions={answerLocked || answerPhase !== 'idle'}
          isSubmitting={answerPhase === 'submitting'}
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
  scrollContent: {
    flexGrow: 1,
    backgroundColor: QUIZ_SCREEN_BG,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: QUIZ_RADIUS_SM,
    backgroundColor: 'rgba(124,58,237,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
    minWidth: 140,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  completedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  countdownText: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
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
