/**
 * =============================================================================
 * QUESTION MODE SESSION
 * =============================================================================
 *
 * Owns one round of a question mode: loading it, tracking selections, grading
 * answers, hints, score and XP.
 *
 * ── HOW A ROUND IS ASSEMBLED ─────────────────────────────────────────────────
 * A round is the set of questions the API published for this mode today. They
 * are written by the project's quiz AI over real 90Plus football entities, and
 * every picture on them was resolved server-side for the entity it belongs to
 * (365Scores portraits, API-Football crests). There is no bundled question bank
 * behind this screen and nothing here is looked up from a name.
 *
 * If the API call fails the round does NOT fall back to canned football
 * content — `error` is set and the screen shows its error state, because
 * showing invented players/clubs/stats is worse than showing a retry.
 *
 * ── GRADING ──────────────────────────────────────────────────────────────────
 * Answers are graded by the API (POST /quiz/questions/modes/:id/answer) one
 * question at a time, which owns XP, streak and leaderboard side effects.
 * =============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import type { Language } from '../src/i18n';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import {
  QuestionsModesService,
  type QuestionModeId,
  type QuestionModeQuestion,
  type QuestionModeSession,
} from '../services/questionsModes';

type PlayableModeId = Exclude<QuestionModeId, 'football-quiz'>;

export function isPlayableQuestionMode(mode: string): mode is PlayableModeId {
  return (
    mode === 'guess-player' ||
    mode === 'football-bingo' ||
    mode === 'football-grid' ||
    mode === 'player-connections' ||
    mode === 'guess-club' ||
    mode === 'transfer-puzzle' ||
    mode === 'top10-challenge'
  );
}

export function useQuestionModeSession(modeId: PlayableModeId, language: Language) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Clerk's getToken returns a NEW function reference on every render.
  // Using a ref prevents infinite re-fetch loops in useEffect/useCallback.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [session, setSession] = useState<QuestionModeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  /** Option ids hidden by the "eliminate wrong answers" lifeline, this question. */
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  /** Whether the "ask the crowd" percentages are showing, this question. */
  const [showStats, setShowStats] = useState(false);
  /**
   * Real per-option percentages for the question on screen, counted by the API
   * from other players' submissions. Empty until "ask the crowd" is used and
   * the API actually has enough answers to report a split.
   */
  const [answerStats, setAnswerStats] = useState<Record<string, number>>({});
  /** False until the API confirms a real distribution exists for this question. */
  const [crowdAvailable, setCrowdAvailable] = useState(false);

  const currentQuestion: QuestionModeQuestion | null = useMemo(() => {
    if (!session) return null;
    return session.questions[session.currentIndex] ?? null;
  }, [session]);

  useEffect(() => {
    let mounted = true;

    // Clerk hasn't resolved yet. Stay in the loading state rather than falling
    // through to the offline bank and then flashing the API round a beat later.
    if (isLoaded !== true) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSelected([]);
    setRevealed(false);
    setUsedHint(false);
    setScore(0);
    setXpEarned(0);
    setCompleted(false);
    setLastAnswerCorrect(null);
    setEliminatedIds([]);
    setShowStats(false);
    setAnswerStats({});
    setCrowdAvailable(false);

    void (async () => {
      if (isSignedIn !== true) {
        if (!mounted) return;
        setError('AUTH_REQUIRED');
        setSession(null);
        setLoading(false);
        return;
      }

      /* ── Load today's real challenge for this mode ───────────────────── */
      let apiSession: QuestionModeSession | null = null;
      let failure: string | null = null;

      try {
        const token = await getClerkBearerToken(getTokenRef.current);
        if (!token) {
          throw new Error('AUTH_REQUIRED');
        }
        apiSession = await QuestionsModesService.createSession(token, modeId, language);
      } catch (err: unknown) {
        // Surfaced, never papered over with canned football content.
        failure = err instanceof Error ? err.message : 'SESSION_LOAD_FAILED';
      }

      if (!mounted) return;

      const questions = apiSession?.questions ?? [];

      if (!apiSession || questions.length === 0) {
        setError(failure ?? 'SESSION_LOAD_FAILED');
        setSession(null);
        setLoading(false);
        return;
      }

      setSession({
        sessionId: apiSession.sessionId,
        mode: apiSession.mode,
        currentIndex: 0,
        // Drives the progress card's segment count — never hardcoded.
        totalQuestions: questions.length,
        timeLimitSec: apiSession.timeLimitSec,
        questions,
      });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, language, modeId]);

  const toggleSelection = useCallback((id: string) => {
    if (!currentQuestion || revealed) return;

    setSelected((prev) => {
      if (currentQuestion.type === 'mcq' || currentQuestion.type === 'connections' || currentQuestion.type === 'transfer') {
        return [id];
      }
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      const maxSelectable = Math.max(currentQuestion.correctAnswers.length, 1);
      if (prev.length >= maxSelectable) {
        return prev;
      }
      return [...prev, id];
    });
  }, [currentQuestion, revealed]);

  const submitAnswer = useCallback(() => {
    if (!currentQuestion || revealed || !session) return;

    void (async () => {
      try {
        const token = await getClerkBearerToken(getTokenRef.current);
        if (!token) {
          throw new Error('AUTH_REQUIRED');
        }

        const result = await QuestionsModesService.submitAnswer(token, modeId, {
          challengeId: session.sessionId,
          // The round holds several questions on one challenge row — the API
          // needs to know which of them this answer is for.
          questionId: currentQuestion.id,
          selectedIds: selected,
          elapsedTime: 0,
          language,
        });

        setRevealed(true);
        setLastAnswerCorrect(result.isCorrect);

        const correctAnswers = result.answer.orderedIds?.length
          ? result.answer.orderedIds
          : result.answer.correctIds ?? [];

        setSession((prev) => {
          if (!prev) return prev;
          const nextQuestions = [...prev.questions];
          const current = nextQuestions[prev.currentIndex];
          if (!current) return prev;
          nextQuestions[prev.currentIndex] = {
            ...current,
            correctAnswers,
          };
          return {
            ...prev,
            questions: nextQuestions,
          };
        });

        if (result.isCorrect) {
          setScore((s) => s + 1);
        }
        setXpEarned((x) => x + result.totalXpAwarded);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'SUBMIT_FAILED');
      }
    })();
  }, [currentQuestion, language, modeId, revealed, selected, session]);

  const nextQuestion = useCallback(() => {
    if (!session) return;
    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.totalQuestions) {
      setCompleted(true);
      return;
    }
    setSession({ ...session, currentIndex: nextIndex });
    setSelected([]);
    setRevealed(false);
    setUsedHint(false);
    setLastAnswerCorrect(null);
    setEliminatedIds([]);
    setShowStats(false);
    setAnswerStats({});
    setCrowdAvailable(false);
  }, [session]);

  /**
   * CHANGE QUESTION — the "reload" lifeline (Figma 385:378, `GLYPH_RELOAD`:
   * "swap the current question"). This is NOT `nextQuestion`: the round does
   * not advance, nothing is marked answered and no score/XP is touched.
   *
   * A replacement has to be another REAL question of this round, and one the
   * player has not reached yet: the current question is swapped with a later
   * one, so nothing is skipped and nothing is shown twice.
   *
   * Returns `false` (and changes nothing) when there is no unseen question
   * left, so the caller — which owns the "2 uses" count — only spends a use on
   * an actual swap.
   */
  const changeQuestion = useCallback((): boolean => {
    if (!session || revealed) return false;

    const upcoming = session.questions
      .map((question, index) => ({ question, index }))
      .filter((entry) => entry.index > session.currentIndex);
    if (upcoming.length === 0) return false;

    const pick = upcoming[Math.floor(Math.random() * upcoming.length)]!;

    setSession((prev) => {
      if (!prev) return prev;
      const nextQuestions = [...prev.questions];
      const current = nextQuestions[prev.currentIndex]!;
      nextQuestions[prev.currentIndex] = nextQuestions[pick.index]!;
      nextQuestions[pick.index] = current;
      return { ...prev, questions: nextQuestions };
    });
    setSelected([]);
    setUsedHint(false);
    setEliminatedIds([]);
    setShowStats(false);
    setAnswerStats({});
    setCrowdAvailable(false);
    return true;
  }, [revealed, session]);

  /**
   * ELIMINATE WRONG ANSWERS — the "50:50" lifeline. Hides options until only
   * the correct one and exactly one wrong one remain visible; which wrong
   * option survives is picked at random each time, same as a real 50:50.
   *
   * Only meaningful for a question with a flat `options` list (mcq /
   * connections / transfer / guess-club's card grid) — a board-based question
   * (grid / bingo / top10) has no discrete "wrong answer" to hide, so this is
   * a no-op there and the caller should leave the lifeline disabled.
   *
   * Returns whether anything was actually eliminated, so the caller only
   * spends a use when the row of options genuinely shrank.
   */
  const eliminateWrongAnswers = useCallback((): boolean => {
    if (!currentQuestion || revealed) return false;
    const options = currentQuestion.options;
    if (!options || options.length <= 2) return false;

    const correctSet = new Set(currentQuestion.correctAnswers);
    const wrongIds = options.map((option) => option.id).filter((id) => !correctSet.has(id));
    const remainingWrong = wrongIds.filter((id) => !eliminatedIds.includes(id));
    if (remainingWrong.length <= 1) return false;

    const survivor = remainingWrong[Math.floor(Math.random() * remainingWrong.length)];
    const toEliminate = remainingWrong.filter((id) => id !== survivor);

    setEliminatedIds((prev) => [...prev, ...toEliminate]);
    // A selection that just got hidden can't stay "selected" underneath it.
    setSelected((prev) => prev.filter((id) => !toEliminate.includes(id)));
    return true;
  }, [currentQuestion, eliminatedIds, revealed]);

  /**
   * ASK THE CROWD — reveals, next to each still-visible option, the share of
   * OTHER players who picked it. The split is counted by the API from real
   * submissions (UserQuestionChallenge.answeredPayload); nothing is generated
   * here and the correct answer gets no weight of its own.
   *
   * Returns false — and spends no use — when the API has no distribution yet,
   * so a question nobody has answered leaves the lifeline untouched instead of
   * showing a made-up one. Never selects and never submits.
   */
  const revealAnswerStats = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || revealed || showStats || !session) return false;
    if (!currentQuestion.options || currentQuestion.options.length === 0) return false;

    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return false;

      const stats = await QuestionsModesService.getCrowdStats(token, modeId, {
        challengeId: session.sessionId,
        questionId: currentQuestion.id,
        language,
      });

      if (!stats.available || Object.keys(stats.percentages).length === 0) {
        setCrowdAvailable(false);
        return false;
      }

      setAnswerStats(stats.percentages);
      setCrowdAvailable(true);
      setShowStats(true);
      return true;
    } catch {
      // A failed lookup is "no crowd data", never an invented one.
      setCrowdAvailable(false);
      return false;
    }
  }, [currentQuestion, language, modeId, revealed, session, showStats]);

  const useHint = useCallback(() => {
    if (!currentQuestion || usedHint || revealed) return;

    void (async () => {
      try {
        const token = await getClerkBearerToken(getTokenRef.current);
        if (!token || !session) {
          throw new Error('AUTH_REQUIRED');
        }

        const hintResult = await QuestionsModesService.useHint(token, modeId, {
          challengeId: session.sessionId,
          language,
        });

        if (hintResult.hint) {
          setSession((prev) => {
            if (!prev) return prev;
            const nextQuestions = [...prev.questions];
            const current = nextQuestions[prev.currentIndex];
            if (!current) return prev;
            nextQuestions[prev.currentIndex] = {
              ...current,
              hint: hintResult.hint ?? current.hint,
            };
            return {
              ...prev,
              questions: nextQuestions,
            };
          });
        }

        setUsedHint(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'HINT_FAILED');
      }
    })();
  }, [currentQuestion, language, modeId, revealed, session, usedHint]);

  return {
    loading,
    error,
    session,
    currentQuestion,
    selected,
    revealed,
    usedHint,
    completed,
    score,
    xpEarned,
    lastAnswerCorrect,
    eliminatedIds,
    showStats,
    answerStats,
    crowdAvailable,
    toggleSelection,
    submitAnswer,
    nextQuestion,
    changeQuestion,
    eliminateWrongAnswers,
    revealAnswerStats,
    useHint,
  };
}
