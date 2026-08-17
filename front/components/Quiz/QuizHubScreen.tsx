/**
 * QuizHubScreen — Daily AI quiz (OpenRouter), API images, XP & coins via backend.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useTranslation } from '../../src/i18n';
import { useCoins } from '../../contexts/CoinsContext';
import { useXp } from '../../contexts/XpContext';
import { toastManager } from '../../services/toastManager';
import {
  QuizApiService,
  type QuizApiLanguage,
  type QuizApiOptionKey,
  type QuizDailyPayload,
} from '../../services/quizApi.service';
import {
  type OptionKey,
  QUIZ_AUTO_ADVANCE_ENABLED,
  QUIZ_SESSION_TOTAL,
  QUIZ_SCREEN_BG,
  QUIZ_RADIUS_SM,
  QUIZ_COIN_COST,
  QUIZ_TIME_LIMIT_SEC,
  ACCENT_SOFT,
} from './quiz.constants';

import { GameLoadingState, GAME_LAYOUT } from './gameChrome';
import { useQuestionEntrance } from './gameMotion';
import { goBackToQuestionsHub } from './quizNavigation';
import { useDesignScale } from '../../utils/responsive';
import { QuizBackground } from './QuizBackground';
import { QuizHeader } from './QuizHeader';
import { QuizProgressCard } from './QuizProgressCard';
import { QuizCard } from './QuizCard';
import { QuizFooterActions } from './QuizFooterActions';
import { QuizScorePopup } from './QuizScorePopup';
import { prefetchQuizImages, useDailyQuiz, dailyQuizQueryKey, cacheDailyQuiz } from '../../hooks/useDailyQuiz';

type AnswerPhase = 'idle' | 'submitting' | 'revealed';

const AUTO_NEXT_MS = 3000;

/**
 * Max uses per round for each of the three lifelines — matches
 * `LIFELINE_USES_PER_ROUND` in QuestionsModeScreen.tsx, which the six other
 * modes use for the exact same three actions (Figma badge 385:378 draws "2").
 */
const LIFELINE_USES_PER_ROUND = 2;

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
  const designScale = useDesignScale();
  const router = useRouter();
  const { t, language: appLanguage } = useTranslation();
  const { getToken, isSignedIn } = useAuth();
  const { refreshCoins, coins, applyCoinsBalance } = useCoins();
  const { handleXpEvents, applyXpSnapshot, refresh: refreshXp } = useXp();

  /**
   * QUIZ LANGUAGE = APP LANGUAGE.
   *
   * The other six question modes read it straight off the app locale
   * (`useQuestionModeSession(modeId, language)` in QuestionsModeScreen), and
   * Football Quiz now does the same. It used to keep its OWN language in
   * AsyncStorage (`quiz_language`, set by a one-time popup), so a device whose
   * app was English could still be served an Arabic pack forever — a
   * configuration no other mode had, and the reason the questions came up in
   * the wrong language.
   */
  const quizLang: QuizApiLanguage = appLanguage === 'en' ? 'en' : 'ar';

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
  /** Option keys hidden by "Remove Wrong Answers" this question. */
  const [eliminatedKeys, setEliminatedKeys] = useState<OptionKey[]>([]);

  /**
   * Remaining lifeline uses — ROUND totals, not per-question (never reset by
   * the per-question effect below), exactly like `fiftyUses` / `changeUses`
   * in QuestionsModeScreen.tsx, the same two lifelines this screen mirrors.
   */
  const [eliminateUses, setEliminateUses] = useState(LIFELINE_USES_PER_ROUND);
  const [changeUses, setChangeUses] = useState(LIFELINE_USES_PER_ROUND);

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

  useEffect(() => () => clearAutoNextTimer(), [clearAutoNextTimer]);

  useEffect(() => {
    // A bundled fallback pack is never persisted — the cache must only ever
    // hold a real pack, so tomorrow's launch doesn't replay dummy questions.
    if (dailyData?.packDate && dailyData.questions?.length && !dailyData.isStatic) {
      void cacheDailyQuiz(quizLang, dailyData);
    }
  }, [dailyData, quizLang]);

  useEffect(() => {
    // Never re-pull a bundled pack: there is no server progress to re-sync and
    // rebuilding it would restart the round (see keepBundledPack in useDailyQuiz).
    if (isSignedIn && !dailyData?.isStatic) {
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
  /** Shared question transition — replays whenever the question changes. */
  const questionEntrance = useQuestionEntrance(currentQuestion?.id);
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
    setEliminatedKeys([]);
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
    // Timed progression is off: the player advances with the "Next" button.
    // See QUIZ_AUTO_ADVANCE_ENABLED in ./quiz.constants.
    if (!QUIZ_AUTO_ADVANCE_ENABLED) {
      clearAutoNextTimer();
      return;
    }
    scheduleQuestionAutoNext(
      clearAutoNextTimer,
      autoNextTimerRef,
      () => goNextQuestionRef.current(),
    );
  }, [clearAutoNextTimer]);

  /**
   * BUNDLED QUESTION GRADING.
   *
   * A question from data/footballQuizFallback.ts carries its own answer key, so
   * it is graded here and never POSTed — /quiz/answer only knows about real
   * daily packs, and sending it a bundled id would 404. Everything downstream
   * (reveal, toast, auto-next, completion popup) runs through exactly the same
   * state the live path sets, so the screen keeps ONE rendering flow.
   *
   * Coins and XP are deliberately untouched: no server round-trip happened, so
   * pretending a balance changed would desync the real one.
   */
  const gradeStaticAnswer = useCallback(
    (question: QuizDailyPayload['questions'][number], key: OptionKey) => {
      clearAutoNextTimer();

      const answeredCorrectly = question.correctKey === key;
      const nextIndex = currentIndex + 1;
      const completedNow = nextIndex >= questions.length;

      nextIndexRef.current = nextIndex;
      pendingSelectedKeyRef.current = null;
      submitRetryCountRef.current = 0;
      timeoutCalledRef.current = question.id;
      answerLockedRef.current = true;
      setAnswerLocked(true);
      setSelected(key);
      setIsCorrect(answeredCorrectly);
      setCorrectKey((question.correctKey as OptionKey) ?? null);
      if (question.imageUrl) {
        setRevealedImageUrl(question.imageUrl);
      }
      setAnswerPhaseSync('revealed');

      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
        if (!oldData) return oldData;
        const newQuestions = [...oldData.questions];
        newQuestions[currentIndex] = {
          ...newQuestions[currentIndex],
          status: 'answered',
          isCorrect: answeredCorrectly,
          selectedKey: key,
        };
        return {
          ...oldData,
          questions: newQuestions,
          stats: patchDailyStats(oldData.stats, {
            correct: oldData.stats.correct + (answeredCorrectly ? 1 : 0),
            answered: oldData.stats.answered + 1,
            completed: completedNow,
          }),
        };
      });

      /*
       * NO correct/incorrect toast here. The other question modes give no
       * per-answer popup at all — the ONLY feedback is the row itself turning
       * green/red with a check or × (GameAnswerOption, shared by every mode
       * including this one). A toast on top of that was a Football-Quiz-only
       * addition; removed so the feedback is identical everywhere.
       */

      if (completedNow) {
        showCompletionPopup();
      } else {
        scheduleAutoNext();
      }
    },
    [
      clearAutoNextTimer,
      currentIndex,
      questions.length,
      queryClient,
      quizQueryKey,
      scheduleAutoNext,
      setAnswerPhaseSync,
      showCompletionPopup,
    ],
  );

  const submitSelectedAnswer = useCallback(
    async (key: OptionKey, opts?: { fromRetry?: boolean }) => {
      if (!currentQuestion) return;
      if (answerPhaseRef.current === 'revealed') return;

      /* ── Bundled question: graded on-device, no network ─────────────── */
      if (currentQuestion.isStatic) {
        gradeStaticAnswer(currentQuestion, key);
        return;
      }

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

        /*
         * NO correct/incorrect toast here — see the identical note in
         * gradeStaticAnswer above. The row itself (green/red, check/×) is the
         * only feedback, matching every other question mode.
         */

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
      gradeStaticAnswer,
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

  /*
   * TAP ONLY SELECTS — it never submits.
   *
   * This used to call `submitSelectedAnswer(key)` directly, so a single tap
   * graded the question immediately: no chance to change your mind, no
   * explicit confirm, and the "Confirm Answer" button on the action bar was
   * dead — by the time it could render, the phase was already 'revealed'.
   *
   * Every other question mode splits this into two steps (`toggleSelection`
   * then a separate `submitAnswer` in useQuestionModeSession), and Football
   * Quiz now follows the same shape: tapping a row just updates `selected`,
   * which QuizCard already renders as the picked option. Nothing is graded,
   * no network call happens, and the row stays interactive — tapping a
   * different option simply reassigns `selected`, satisfying "select A, change
   * to B, change to C" before anything is ever submitted.
   */
  const handleSelectOption = useCallback(
    (key: OptionKey) => {
      if (answerPhaseRef.current !== 'idle') return;
      setSelected(key);
    },
    [],
  );

  /** Fired only by the "Confirm Answer" button — the single place grading starts. */
  const handleSubmitAnswer = useCallback(() => {
    if (!selected) return;
    if (answerPhaseRef.current !== 'idle') return;
    void submitSelectedAnswer(selected);
  }, [selected, submitSelectedAnswer]);

  const handleTimeout = useCallback(async () => {
    // Hard stop: with timed progression off nothing may reveal or select an
    // answer on the player's behalf. The countdown that used to call this is
    // already inert (`timerActive` below), and this guard makes sure no other
    // caller can reintroduce a self-answering screen.
    if (!QUIZ_AUTO_ADVANCE_ENABLED) return;
    if (!currentQuestion) return;
    if (answerLockedRef.current || pendingSelectedKeyRef.current) return;
    if (answerPhaseRef.current !== 'idle') return;
    if (timeoutCalledRef.current === currentQuestion.id) return;
    timeoutCalledRef.current = currentQuestion.id;
    answerLockedRef.current = true;
    setAnswerLocked(true);
    setAnswerPhaseSync('submitting');

    /* ── Bundled question: reveal locally, no penalty, no network ────── */
    if (currentQuestion.isStatic) {
      const nextIndex = currentIndex + 1;
      const completedNow = nextIndex >= questions.length;
      nextIndexRef.current = nextIndex;
      setIsCorrect(false);
      setCorrectKey((currentQuestion.correctKey as OptionKey) ?? null);
      setSelected((currentQuestion.correctKey as OptionKey) ?? null);
      if (currentQuestion.imageUrl) {
        setRevealedImageUrl(currentQuestion.imageUrl);
      }
      setAnswerPhaseSync('revealed');

      queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
        if (!oldData) return oldData;
        const newQuestions = [...oldData.questions];
        newQuestions[currentIndex] = {
          ...newQuestions[currentIndex],
          status: 'timed_out',
          isCorrect: false,
          penaltyApplied: false,
        };
        return {
          ...oldData,
          questions: newQuestions,
          stats: patchDailyStats(oldData.stats, {
            timedOut: oldData.stats.timedOut + 1,
            completed: completedNow,
          }),
        };
      });

      toastManager.showWarning(t.quiz.wrong, t.quiz.timesUpNoCoinsDeducted);

      if (completedNow) {
        clearAutoNextTimer();
        showCompletionPopup();
      } else {
        scheduleAutoNext();
      }
      return;
    }

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
    questions.length,
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

  /**
   * CHANGE QUESTION — the "reload" lifeline, matching `changeQuestion()` in
   * useQuestionModeSession.ts (the hook the other six modes share).
   *
   * This used to be `handleSkip`: it advanced `currentIndex`, marked the slot
   * `status: 'skipped'`, deducted coins and — for the live daily question —
   * called the real `/quiz/skip` endpoint. That is a DIFFERENT feature
   * (skip-and-advance) from what the "reload" icon and its 2-use badge are
   * actually for everywhere else in the app: swapping the CURRENT question for
   * a different one, in place, so the player can still answer it.
   *
   * A replacement has to be another REAL question. The daily pack the server
   * builds IS the whole round, so every real question it produced for today is
   * already scheduled in it — there is no spare one to swap in. The bundled
   * bank that used to back this lifeline was canned football content and has
   * been removed.
   *
   * Returns whether a swap actually happened, so the caller only spends one of
   * the 2 uses on a real swap. Left in place so the lifeline starts working
   * again automatically if the pack ever carries spare questions.
   */
  const handleChangeQuestion = useCallback((): boolean => {
    if (!currentQuestion || answerPhase !== 'idle') return false;

    const replacement = questions.find(
      (question, index) => index !== currentIndex && question.status === 'pending',
    );
    if (!replacement) return false;

    queryClient.setQueryData<QuizDailyPayload>(quizQueryKey, (oldData) => {
      if (!oldData) return oldData;
      const newQuestions = [...oldData.questions];
      newQuestions[currentIndex] = replacement;
      return { ...oldData, questions: newQuestions };
    });
    setSelected(null);
    setHintUsed(false);
    setHintText(null);
    setEliminatedKeys([]);
    return true;
  }, [answerPhase, currentIndex, currentQuestion, questions, queryClient, quizQueryKey]);

  /**
   * REMOVE WRONG ANSWERS — the "50:50" lifeline. Leaves exactly TWO options
   * visible: the correct one and one wrong one.
   *
   * WHICH TWO IS THE SERVER'S DECISION (`GET /quiz/fifty-fifty`), for the same
   * reason it is in the six other modes: a pending question does not carry its
   * `correctKey` — the API hides it until the question is answered. Working the
   * elimination out here treated all four options as wrong, hid THREE of them
   * and left a survivor picked at random, which was usually not the correct
   * answer. Nothing on the device guesses any more.
   *
   * Returns false — spending no use and changing nothing — unless the response
   * genuinely leaves two of THIS question's options standing.
   */
  const handleEliminateWrongAnswers = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || answerPhase !== 'idle') return false;
    const options = currentQuestion.options;
    if (options.length <= 2) return false;
    if (eliminatedKeys.length > 0) return false; // already used on this question

    try {
      const token = tokenRef.current ?? (await getToken());
      if (!token) return false;

      const result = await QuizApiService.fiftyFifty(token, {
        questionId: currentQuestion.id,
        language: quizLang,
      });
      if (!result || result.questionId !== currentQuestion.id) return false;

      const optionKeys = options.map((option) => option.key as OptionKey);
      const keep = [...new Set(result.keepKeys as OptionKey[])].filter((key) =>
        optionKeys.includes(key),
      );
      // THE INVARIANT: a 50:50 leaves two. Anything else (a malformed body, a
      // key this question does not have, a duplicate) is refused outright
      // rather than applied half-way.
      if (keep.length !== 2) return false;

      const toEliminate = optionKeys.filter((key) => !keep.includes(key));
      if (toEliminate.length === 0) return false;

      setEliminatedKeys(toEliminate);
      // A pick that just got hidden can't stay selected underneath it.
      setSelected((prev) => (prev && toEliminate.includes(prev) ? null : prev));
      return true;
    } catch {
      // A failed lookup spends no use — never falls back to a random pick.
      return false;
    }
  }, [answerPhase, currentQuestion, eliminatedKeys, getToken, quizLang]);

  /**
   * Left fully defined but no longer wired to a hexagon: there are only three
   * lifeline slots, and this task repoints "50:50" at `handleEliminateWrongAnswers`
   * instead (matching the six other modes' own hint→eliminate change in
   * useQuestionModeSession.ts). Kept intact rather than deleted since it is a
   * real, working, backend-integrated feature (`/quiz/hint`, real coin spend)
   * that nothing here was asked to remove — only to stop triggering from the
   * action bar. `hintText`/`hintUsed` stay defined for the same reason.
   */
  const handleHint = useCallback(async () => {
    if (!currentQuestion || hintUsed || answerPhase === 'revealed') return;

    /* ── Bundled question: its hint text ships with it, no coins spent ─ */
    if (currentQuestion.isStatic) {
      if (!currentQuestion.hint) return;
      setHintUsed(true);
      setHintText(currentQuestion.hint);
      toastManager.showSuccess(t.quiz.useHint, currentQuestion.hint);
      return;
    }

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

  const progress = questionNumber / Math.max(totalQuestions, QUIZ_SESSION_TOTAL);

  const difficultyText = t.quiz[difficultyLocaleKey(currentQuestion?.difficulty ?? 'MEDIUM')];

  // Hides options a 50:50 has removed — same "don't render it at all" rule
  // `visibleChoices` applies in QuestionsModeScreen.tsx.
  const cardOptions = useMemo(
    () =>
      currentQuestion
        ? currentQuestion.options
            .filter((o) => !eliminatedKeys.includes(o.key as OptionKey))
            .map((o) => ({
              key: o.key as OptionKey,
              text: o.text,
            }))
        : [],
    [currentQuestion?.id, currentQuestion?.options, eliminatedKeys],
  );

  /**
   * The offset the scroll starts at — Figma's y 95 less the 62pt status bar,
   * on top of the real safe area. Identical to QuestionsModeScreen, which is
   * what makes the two screens scroll the same way, and it doubles as the
   * loading state's offset.
   */
  const contentTopInset = insets.top + designScale.s(GAME_LAYOUT.contentTop);
  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : '';
  const isPackPreparing =
    errorMessage === 'PACK_GENERATING' ||
    errorMessage === 'API_ERROR_503' ||
    errorMessage === 'SERVER_WARMING';

  // Escape hatch: if the pack has been "preparing" too long, stop showing a bare
  // spinner and offer a manual retry so the screen can never hang indefinitely.
  const [packPreparingTooLong, setPackPreparingTooLong] = useState(false);
  useEffect(() => {
    if (!isPackPreparing) {
      setPackPreparingTooLong(false);
      return undefined;
    }
    const timer = setTimeout(() => setPackPreparingTooLong(true), 45_000);
    return () => clearTimeout(timer);
  }, [isPackPreparing]);

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

  if (isPackPreparing || (loadingQuestions && !dailyData)) {
    /*
     * EXACTLY the loading state every other question mode shows: the shared
     * spinner on the game background, nothing else. Football Quiz used to draw
     * its own screen here — quiz background, header, a soft-accent spinner and
     * a "Loading questions…" caption — which is why entering it felt different
     * from entering Guess The Player or Football Grid.
     *
     * The one addition is the escape hatch: if the backend has been generating
     * the pack for 45s, a retry appears BELOW the spinner so the screen can
     * never hang forever. It is a recovery affordance, not a second loading UI.
     */
    return (
      <GameLoadingState topInset={contentTopInset}>
        {isPackPreparing && packPreparingTooLong ? (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setPackPreparingTooLong(false);
              void refetch();
            }}
            disabled={isFetching}
            activeOpacity={0.85}
          >
            {isFetching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.retryButtonText}>{t.quiz.retryLoad}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </GameLoadingState>
    );
  }

  if (errorMessage === 'REQUEST_TIMEOUT') {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>{t.quiz.requestTimeout}</Text>
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
              : errorMessage === 'REQUEST_TIMEOUT'
                ? t.quiz.requestTimeout
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
          onPress={goBackToQuestionsHub}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>{t.quiz.backToQuestions}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentQuestion) {
    if (loadingQuestions || isFetching) {
      // Same shared spinner as above and as every other mode.
      return <GameLoadingState topInset={contentTopInset} />;
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
            onPress={goBackToQuestionsHub}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>{t.quiz.backToQuestions}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <Text style={styles.noQuestionsText}>
          {errorMessage === 'AUTH_REQUIRED'
            ? t.quiz.signInRequired
            : errorMessage === 'USER_NOT_FOUND'
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

      {/*
        SCROLL STRUCTURE — identical to every other question mode.

        The header and the "Question X of Y" counter are the first two children
        INSIDE the scroll, so they scroll away with the content exactly as they
        do on QuestionsModeScreen. Nothing on this screen is pinned or sticky
        except the action bar, which is pinned on every mode. The scroll
        container owns the top inset and the 22pt column, so the header and the
        counter carry no positioning of their own (`pinned={false}`).

        No language pill: the pack follows the app language, like every other
        question mode. See `quizLang` at the top of this component.
      */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: contentTopInset,
            // 22pt gutters → the Figma 404pt content column, scaled per device.
            paddingHorizontal: designScale.s(GAME_LAYOUT.gutter),
            paddingBottom:
              designScale.s(GAME_LAYOUT.actionBarHeight) + insets.bottom + designScale.s(24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <QuizHeader topInset={insets.top} pinned={false} />

        <QuizProgressCard
          current={questionNumber}
          total={Math.max(totalQuestions, QUIZ_SESSION_TOTAL)}
          progress={progress}
          questionLabel={t.quiz.questionNumber}
          timerKey={currentQuestion.id}
          timerRetryEpoch={timerRetryEpoch}
          timerActive={QUIZ_AUTO_ADVANCE_ENABLED && answerPhase === 'idle' && !answerLocked}
          timeLimitSec={QUIZ_TIME_LIMIT_SEC}
          onTimeUp={handleTimeout}
          topInset={insets.top}
          pinned={false}
        />

        {/*
          The question block fades and rises 8pt on every new question — the
          shared transition from ./gameMotion, the same one the other modes use.
          Opacity + translate only, so the layout underneath never moves.
        */}
        <Animated.View
          style={[
            // Figma 238:374 leaves 28pt between the progress card and the
            // artwork (card at y 308, progress card ends at y 280).
            { marginTop: designScale.s(28) },
            questionEntrance,
          ]}
        >
          <QuizCard
            question={currentQuestion.question}
            questionType={currentQuestion.type ?? 'normal'}
            imageUrl={resolvedImageUrl}
            revealImageUrl={revealedImageUrl}
            // Passed through as-is: a live question that doesn't declare a
            // layout keeps the photo treatment (`cover`) it has always had.
            imageLayout={currentQuestion.imageLayout}
            options={cardOptions}
            selectedKey={selected}
            onSelectOption={handleSelectOption}
            hintText={hintText}
            answerRevealed={answerPhase === 'revealed'}
            isCorrect={isCorrect}
            correctKey={correctKey}
            disableOptions={answerLocked || answerPhase !== 'idle'}
            isSubmitting={answerPhase === 'submitting'}
          />
        </Animated.View>
      </ScrollView>

      <QuizFooterActions
        onEliminate={() => {
          if (eliminateUses === 0 || answerPhase !== 'idle') return;
          // Server-resolved — a use is only spent once it actually confirms
          // two option keys to keep.
          void handleEliminateWrongAnswers().then((didEliminate) => {
            if (didEliminate) setEliminateUses((remaining) => remaining - 1);
          });
        }}
        eliminateUses={eliminateUses}
        onChangeQuestion={() => {
          if (changeUses === 0 || answerPhase !== 'idle') return;
          if (handleChangeQuestion()) {
            setChangeUses((remaining) => remaining - 1);
          }
        }}
        changeQuestionUses={changeUses}
        onNext={goNextQuestion}
        onSubmit={handleSubmitAnswer}
        // Before reveal, the primary button is "Confirm Answer" and needs a
        // selection to press; after reveal it is "Next Question".
        submitDisabled={!selected || answerPhase !== 'idle'}
        nextDisabled={!canGoNext}
        answerRevealed={answerPhase === 'revealed'}
        isCorrect={isCorrect}
        bottomInset={insets.bottom}
        quizLang={quizLang}
      />

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
});
