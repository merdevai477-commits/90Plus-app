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

  /** Synchronous double-tap guard for submitAnswer — see there for why. */
  const submittingRef = useRef(false);

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
        // Surfaced, never papered over with canned football content. The
        // message is the backend's own stable reason where it sent one
        // (QUESTIONS_CHALLENGE_EMPTY, MODE_NOT_FOUND, AUTH_REQUIRED…), so the
        // screen never shows an unexplained generic failure.
        failure = err instanceof Error ? err.message : 'SESSION_LOAD_FAILED';
      }

      if (!mounted) return;

      const questions = apiSession?.questions ?? [];

      if (__DEV__) {
        // Never logs the token or any header — mode/counts/ids only.
        console.log('[QuestionMode] session', {
          mode: modeId,
          language,
          ok: Boolean(apiSession),
          questionCount: questions.length,
          firstQuestionId: questions[0]?.id ?? null,
          failure,
        });
      }

      if (!apiSession || questions.length === 0) {
        setError(failure ?? 'SESSION_LOAD_FAILED');
        setSession(null);
        setLoading(false);
        return;
      }

      setSession({
        sessionId: apiSession.sessionId,
        mode: apiSession.mode,
        // The server's own position, not a hardcoded 0 — see createSession in
        // questionsModes.ts. Re-entering mid-round must resume where the
        // server left off, or an answer for a question it already closed
        // reads back as a session conflict (409).
        currentIndex: apiSession.currentIndex,
        // Drives the progress card's segment count — never hardcoded.
        totalQuestions: questions.length,
        timeLimitSec: apiSession.timeLimitSec,
        questions,
        completed: apiSession.completed,
      });
      setCompleted(apiSession.completed);
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
    // Guards against a double-tap firing two concurrent submissions:
    // `revealed` only flips true after the network call resolves, so without
    // this a second tap in that window would read the same `false` state and
    // send a second POST for the same question/answer.
    if (!currentQuestion || revealed || !session || submittingRef.current) return;
    submittingRef.current = true;

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
        const reason = err instanceof Error ? err.message : 'SUBMIT_FAILED';

        // Expected session-state races (double submit, a retried request that
        // actually landed, resuming after the timer elapsed) — the session
        // already moved on server-side, so just unblock the UI instead of
        // showing the raw reason code as a fatal error.
        if (reason.startsWith('QUESTIONS_SESSION_')) {
          if (__DEV__) {
            console.log('[QuestionMode] submitAnswer conflict — revealing without a score change', reason);
          }
          setRevealed(true);
          return;
        }

        setError(reason);
      } finally {
        submittingRef.current = false;
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
   * the correct one and exactly one wrong one remain visible.
   *
   * The client is never told the round's answer key up front (the session the
   * question came from strips it — see sanitizeQuestionForClient), so which
   * option is correct has to be resolved server-side: GET
   * /quiz/questions/modes/:mode/fifty-fifty returns exactly the two option ids
   * to keep, computed from the round's real stored answer. Nothing here
   * guesses, and the eliminated set can never include the actual correct
   * option purely by chance.
   *
   * Only meaningful for a question with a flat `options` list (mcq /
   * connections / transfer / guess-club's card grid) — a board-based question
   * (grid / bingo / top10) has no discrete "wrong answer" to hide, so this is
   * a no-op there and the caller should leave the lifeline disabled.
   *
   * Returns whether anything was actually eliminated, so the caller only
   * spends a use when the row of options genuinely shrank.
   */
  const eliminateWrongAnswers = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || revealed || !session) return false;
    const options = currentQuestion.options;
    if (!options || options.length <= 2) return false;
    if (eliminatedIds.length > 0) return false; // already used this question

    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return false;

      const result = await QuestionsModesService.getFiftyFifty(token, modeId, {
        challengeId: session.sessionId,
        questionId: currentQuestion.id,
        language,
      });
      if (!result || result.keepIds.length !== 2) return false;

      const keepSet = new Set(result.keepIds);
      const toEliminate = options.map((option) => option.id).filter((id) => !keepSet.has(id));
      if (toEliminate.length === 0) return false;

      setEliminatedIds((prev) => [...prev, ...toEliminate]);
      // A selection that just got hidden can't stay "selected" underneath it.
      setSelected((prev) => prev.filter((id) => !toEliminate.includes(id)));
      return true;
    } catch {
      // A failed lookup spends no use — never falls back to a random pick.
      return false;
    }
  }, [currentQuestion, eliminatedIds, language, modeId, revealed, session]);


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
