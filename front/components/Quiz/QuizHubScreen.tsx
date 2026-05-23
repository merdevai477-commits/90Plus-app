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
  const [questions, setQuestions] = useState<QuizApiQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctKey, setCorrectKey] = useState<OptionKey | null>(null);
  const [seconds, setSeconds] = useState(QUIZ_TIME_LIMIT_SEC);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const questionStartedAt = useRef(Date.now());

  const loadDaily = useCallback(async (lang: QuizApiLanguage) => {
    setLoadingQuestions(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const data = await QuizApiService.fetchDaily(token, lang);
      if (!data?.questions?.length) throw new Error('empty pack');
      setQuestions(data.questions);
      setCurrentIndex(data.currentIndex >= data.questions.length ? 0 : data.currentIndex);
      await refreshCoins();
      await refreshXp();
    } catch {
      toastManager.showWarning(
        t.quiz.matchesPreviewFailed,
        t.quiz.matchesPreviewFailed,
      );
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [getToken, refreshCoins, refreshXp, t.quiz.matchesPreviewFailed]);

  useEffect(() => {
    setQuizLang(appLanguage === 'en' ? 'en' : 'ar');
  }, [appLanguage]);

  useEffect(() => {
    loadDaily(quizLang);
  }, [quizLang, loadDaily]);

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
    if (currentIndex + 1 >= questions.length) {
      toastManager.showSuccess(t.quiz.quizCompleted, t.quiz.quizCompleted);
      loadDaily(quizLang);
      return;
    }
    setCurrentIndex((i) => i + 1);
  }, [canGoNext, currentIndex, questions.length, loadDaily, quizLang, t.quiz]);

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
        const d = res.data as {
          isCorrect: boolean;
          correctKey: QuizApiOptionKey;
          xpEvents?: Array<{
            action: string;
            amount: number;
            leveledUp: boolean;
            newLevel: number;
          }>;
          coins?: number;
        };
        setIsCorrect(d.isCorrect);
        setCorrectKey(d.correctKey as OptionKey);
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
        } else {
          await refreshXp();
        }
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
      refreshXp,
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
      if (currentIndex + 1 >= questions.length) {
        toastManager.showSuccess(t.quiz.quizCompleted, t.quiz.quizCompleted);
        loadDaily(quizLang);
      } else {
        setCurrentIndex((i) => i + 1);
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
    goNextQuestion,
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
      const d = res.data as { hint?: string; coins?: number };
      setHintUsed(true);
      setHintText(d.hint || t.quiz.hintAppliedMessage);
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

  if (loadingQuestions) {
    return (
      <View style={[styles.root, styles.centered]}>
        <QuizBackground />
        <QuizHeader topInset={insets.top} />
        <ActivityIndicator size="large" color={ACCENT_SOFT} />
        <Text style={styles.loadingText}>{t.quiz.loadingQuestions}</Text>
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
        />
      </ScrollView>
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
