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

import { useCoins } from '../contexts/CoinsContext';
import { useXp } from '../contexts/XpContext';
import type { Language } from '../src/i18n';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import {
  QuestionsModesService,
  type QuestionModeId,
  type QuestionModeQuestion,
  type QuestionModeSession,
} from '../services/questionsModes';

type PlayableModeId = Exclude<QuestionModeId, 'football-quiz'>;

/**
 * How long to wait for Clerk to report whether there is a session before
 * treating the silence as "not signed in".
 *
 * Nothing else in this hook can run until `isLoaded` flips, so an SDK that
 * never resolves (offline cold start, Clerk outage) used to hold the screen on
 * a spinner with no arrow and no retry — indistinguishable from a freeze.
 * Generous enough that a slow network still signs the user in normally.
 */
const CLERK_READY_TIMEOUT_MS = 12_000;

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
  /**
   * The header's coin pill reads this context. A wrong answer costs coins and
   * the SERVER decides how many (see submitQuestionsChallengeAnswer), so the
   * balance it returns is pushed straight in — nothing here subtracts a
   * penalty of its own.
   */
  const { applyCoinsBalance } = useCoins();
  /**
   * The header's XP pill reads this context. A Questions answer moves XP by
   * ±1 and the SERVER decides which, so the balance it returns is pushed
   * straight in — the same way the daily quiz applies its own snapshot.
   */
  const { applyXpSnapshot } = useXp();

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
  /**
   * FOOTBALL GRID — players already fixed on the board, keyed `r{row}-c{col}`.
   *
   * A cell is filled only after the SERVER confirms the placement; a rejected
   * one is never written here, so the board can only ever show placements that
   * were graded correct. Kept for the whole round because every question of a
   * grid round is a cell of the SAME board.
   */
  const [gridPlacements, setGridPlacements] = useState<
    Record<string, { label: string; imageUrl?: string }>
  >({});
  /** The last placement the server refused, so the board can shake that cell. */
  const [rejectedCell, setRejectedCell] = useState<string | null>(null);
  /** TOP 10 — what the player has typed, one entry per slot. */
  const [textEntries, setTextEntries] = useState<string[]>([]);
  /** Per slot, whether the server matched it. Empty until the list is graded. */
  const [textResults, setTextResults] = useState<boolean[]>([]);
  /** The real Top 10, as returned WITH the graded result — never before it. */
  const [top10Reveal, setTop10Reveal] = useState<
    Array<{ rank: number; canonical: string; imageUrl?: string; value?: number }>
  >([]);
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

  /**
   * Bumped to re-run the loader. `reload()` is what the loading state's
   * "Try Again" and the error state's retry both call, so a round that failed
   * or stalled can be re-requested without leaving and re-entering the screen.
   */
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => setReloadNonce((nonce) => nonce + 1), []);

  useEffect(() => {
    let mounted = true;

    /*
     * Clerk hasn't resolved yet. Stay in the loading state rather than falling
     * through to the offline bank and then flashing the API round a beat later.
     *
     * BOUNDED, though. `isLoaded` staying false is a real failure mode (no
     * network on a cold start, a Clerk outage) and it used to park the screen
     * on an unescapable spinner forever, because nothing else in this hook
     * runs until Clerk reports in. After CLERK_READY_TIMEOUT_MS the wait is
     * called a failure and the screen shows its error state — which has a
     * retry and a way out — instead of spinning indefinitely.
     */
    if (isLoaded !== true) {
      setLoading(true);
      const timer = setTimeout(() => {
        if (!mounted) return;
        setError('AUTH_REQUIRED');
        setSession(null);
        setLoading(false);
      }, CLERK_READY_TIMEOUT_MS);
      return () => {
        mounted = false;
        clearTimeout(timer);
      };
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
    setGridPlacements({});
    setRejectedCell(null);
    setTextEntries([]);
    setTextResults([]);
    setTop10Reveal([]);

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
      /*
       * FOOTBALL GRID — redraw the cells this player already won.
       *
       * The board is per-round but the filled cells are per-user, and this
       * component's state does not survive leaving the screen. Without seeding
       * from the server the player came back to a blank board part-way through
       * a round the server still had every placement for.
       */
      if (apiSession.gridPlacements) {
        setGridPlacements(apiSession.gridPlacements);
      }
      setCompleted(apiSession.completed);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, language, modeId, reloadNonce]);

  /**
   * Send ONE answer. `idsOverride` exists for the auto-submitting board modes:
   * a selection made microseconds ago is not in `selected` yet (React state is
   * async), so the caller hands over exactly the ids it just computed rather
   * than submitting the previous, incomplete set.
   */
  const submitAnswer = useCallback((idsOverride?: string[]) => {
    // Guards against a double-tap firing two concurrent submissions:
    // `revealed` only flips true after the network call resolves, so without
    // this a second tap in that window would read the same `false` state and
    // send a second POST for the same question/answer.
    if (!currentQuestion || revealed || !session || submittingRef.current) return;
    const selectedIds = idsOverride ?? selected;
    if (selectedIds.length === 0) return;
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
          selectedIds,
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

        /*
         * FOOTBALL GRID — the placement is only fixed on the board once the
         * SERVER says it belongs there. A refused placement leaves the cell
         * empty and is flagged so the board can say so; nothing is drawn from
         * a client-side judgement of the answer.
         */
        if (currentQuestion.gridCell) {
          const cellKey = `r${currentQuestion.gridCell.row}-c${currentQuestion.gridCell.column}`;
          const placed = currentQuestion.options?.find((option) => option.id === selectedIds[0]);
          if (result.isCorrect && placed) {
            setGridPlacements((prev) => ({
              ...prev,
              [cellKey]: { label: placed.label, imageUrl: placed.imageUrl },
            }));
            setRejectedCell(null);
          } else {
            setRejectedCell(cellKey);
          }
        }

        // TOP 10 — which of the ten slots the server matched, and the real
        // names. Both arrive only WITH the graded result.
        if (Array.isArray(result.slotResults)) {
          setTextResults(result.slotResults);
        }
        if (Array.isArray(result.answer.orderedAnswers)) {
          setTop10Reveal(result.answer.orderedAnswers);
        }

        if (result.isCorrect) {
          setScore((s) => s + 1);
        }
        setXpEarned((x) => x + result.totalXpAwarded);

        // Authoritative balances from the grader — the header updates the
        // moment an answer is graded, by the amounts the server actually
        // moved, for both currencies.
        if (typeof result.coins === 'number') {
          applyCoinsBalance(result.coins);
        }
        if (typeof result.xp === 'number' && typeof result.level === 'number') {
          applyXpSnapshot({ xp: result.xp, level: result.level });
        }
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
  }, [applyCoinsBalance, applyXpSnapshot, currentQuestion, language, modeId, revealed, selected, session]);

  /**
   * SELECT / DESELECT one option or board cell.
   *
   * The cap and the "answer is now complete" moment both come from the
   * server's own selection contract (`question.selection`) — never from
   * `correctAnswers`, which a live session does not carry. Football Bingo
   * therefore takes its three cells, and the third one submits the answer
   * immediately: that mode has no confirm step (`autoSubmit`).
   */
  const toggleSelection = useCallback((id: string) => {
    if (!currentQuestion || revealed || submittingRef.current) return;

    const rules = currentQuestion.selection;
    const isSingle = rules.selectionMode === 'single' || rules.maxSelections <= 1;

    let next: string[];
    if (isSingle) {
      next = [id];
    } else if (selected.includes(id)) {
      next = selected.filter((entry) => entry !== id);
    } else if (selected.length >= rules.maxSelections) {
      // Cap reached — a fourth tap is ignored rather than replacing a pick.
      return;
    } else {
      next = [...selected, id];
    }

    setSelected(next);

    if (rules.autoSubmit && next.length === rules.requiredSelections) {
      // Hand the ids over explicitly: `selected` has not re-rendered yet.
      submitAnswer(next);
    }
  }, [currentQuestion, revealed, selected, submitAnswer]);

  /**
   * TOP 10 — type into one of the ten slots.
   *
   * Nothing is graded here: the names go to the server on submit and it says
   * which ones matched (spelling tolerance included). The app has no copy of
   * the answer to check against, by design.
   */
  const setTextEntry = useCallback((index: number, value: string) => {
    if (revealed) return;
    setTextEntries((prev) => {
      const slots = currentQuestion?.top10?.slots ?? prev.length;
      const next = Array.from({ length: Math.max(slots, prev.length) }, (_, i) => prev[i] ?? '');
      next[index] = value;
      return next;
    });
  }, [currentQuestion?.top10?.slots, revealed]);

  /** Submit the ten typed names as this question's answer. */
  const submitTextEntries = useCallback(() => {
    const slots = currentQuestion?.top10?.slots ?? 0;
    if (!slots) return;
    const entries = Array.from({ length: slots }, (_, index) => textEntries[index]?.trim() ?? '');
    if (entries.every((entry) => entry === '')) return;
    submitAnswer(entries);
  }, [currentQuestion?.top10?.slots, submitAnswer, textEntries]);

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
    // `gridPlacements` deliberately survives: the next question is the next
    // CELL of the same board, and a placement the server accepted stays put.
    setRejectedCell(null);
    setTextEntries([]);
    setTextResults([]);
    setTop10Reveal([]);
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
      if (!result) return false;
      // The answer that came back must be for the question actually on screen —
      // a reply that raced a "change question" is not applied to the new one.
      if (result.questionId && result.questionId !== currentQuestion.id) return false;

      const optionIds = options.map((option) => option.id);
      /*
       * THE INVARIANT: 50:50 leaves EXACTLY TWO options visible.
       *
       * Duplicates are collapsed and any id this question does not actually
       * have is dropped BEFORE counting, so a malformed response (two copies of
       * one id, an id from another question, a missing id) can never eliminate
       * three options and leave one — it is refused whole, the board is left
       * untouched and the caller spends no use.
       */
      const keepIds = [...new Set(result.keepIds ?? [])].filter((id) => optionIds.includes(id));
      if (keepIds.length !== 2) return false;

      const toEliminate = optionIds.filter((id) => !keepIds.includes(id));
      if (toEliminate.length === 0) return false;
      if (optionIds.length - toEliminate.length !== 2) return false;

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
    reload,
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
    gridPlacements,
    rejectedCell,
    textEntries,
    textResults,
    top10Reveal,
    setTextEntry,
    submitTextEntries,
    toggleSelection,
    submitAnswer,
    nextQuestion,
    changeQuestion,
    eliminateWrongAnswers,
    revealAnswerStats,
    useHint,
  };
}
