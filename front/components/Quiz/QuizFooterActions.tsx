/**
 * QuizFooterActions — the Football Quiz screen's pinned bottom bar.
 *
 * Figma draws the SAME bar (Frame 174) on all seven game artboards: hexagon
 * lifelines over a full-width confirm button. This file draws no chrome
 * of its own — it maps Football Quiz's actions onto the shared `GameActionBar`
 * in ./gameChrome.tsx, the exact component QuestionsModeScreen.tsx uses.
 *
 * WHAT MAPS ONTO WHAT — identical to the six other modes' lifelines
 * (useQuestionModeSession.ts):
 *   50:50  → onEliminate()      hides options until only the correct one and
 *            one wrong one remain. See `handleEliminateWrongAnswers` in
 *            QuizHubScreen.tsx / `eliminateWrongAnswers()` in the shared hook.
 *   reload → onChangeQuestion() swaps the current question for a different
 *            one — NOT skip-and-advance. See `handleChangeQuestion` /
 *            `changeQuestion()`.
 *
 * Figma's third (middle) hexagon was "ask the crowd / ask a friend". 90Plus has
 * no such feature, so it is not rendered here or on any other mode's bar.
 *
 * Both are 'count' badges (remaining uses out of 2), no coin cost —
 * matching every other mode exactly. Football Quiz used to spend coins on the
 * first two and show Figma's wide "cost" badge (node 384:340) instead of the
 * 25pt "remaining uses" circle (node 385:378) the other six modes use; that
 * was the one visible difference between this footer and theirs, and it is
 * gone now that both actions are genuinely the same feature everywhere.
 *
 * The old hint-reveal feature (`handleHint` in QuizHubScreen.tsx, which does
 * spend coins and call the real backend) is left fully defined but no longer
 * wired to a hexagon — there are only three lifeline slots and this task
 * repoints "50:50" at answer elimination instead, exactly like the six other
 * modes' own hint→eliminate change.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '../../src/i18n';
import type { QuizApiLanguage } from '../../services/quizApi.service';
import { type Lifeline } from './QuestionLifelines';
import { GameActionBar } from './gameChrome';

interface QuizFooterActionsProps {
  /** Hides options until only the correct one + one wrong one remain. */
  onEliminate: () => void;
  eliminateUses: number;
  /** Swaps the current question for a different one — never advances the round. */
  onChangeQuestion: () => void;
  /** Remaining Change Question uses this round (badge label + auto-disable at 0). */
  changeQuestionUses: number;
  onNext: () => void;
  /** Fired by "Confirm Answer" — the only place a question is graded. */
  onSubmit: () => void;
  /** Disables "Confirm Answer" before reveal (no selection yet, or already submitting). */
  submitDisabled?: boolean;
  nextDisabled?: boolean;
  answerRevealed?: boolean;
  isCorrect?: boolean | null;
  bottomInset: number;
  /** No `t.quiz.confirmAnswer` key exists yet — literal mirrors Figma copy. */
  quizLang: QuizApiLanguage;
}

function QuizFooterActionsInner({
  onEliminate,
  eliminateUses,
  onChangeQuestion,
  changeQuestionUses,
  onNext,
  onSubmit,
  submitDisabled = true,
  nextDisabled = false,
  answerRevealed = false,
  bottomInset,
  quizLang,
}: QuizFooterActionsProps) {
  const { t } = useTranslation();

  const lifelines = useMemo<Lifeline[]>(
    () => [
      {
        id: 'fifty',
        glyph: 'fifty',
        badgeKind: 'count',
        badgeLabel: String(eliminateUses),
        disabled: eliminateUses === 0 || answerRevealed,
        accessibilityLabel: quizLang === 'ar' ? 'احذف إجابتين خاطئتين' : 'Remove wrong answers',
        onPress: onEliminate,
      },
      {
        id: 'change',
        glyph: 'reload',
        badgeKind: 'count',
        badgeLabel: String(changeQuestionUses),
        disabled: changeQuestionUses === 0 || answerRevealed,
        accessibilityLabel: quizLang === 'ar' ? 'تغيير السؤال' : 'Change question',
        onPress: onChangeQuestion,
      },
    ],
    [answerRevealed, changeQuestionUses, eliminateUses, onChangeQuestion, onEliminate, quizLang],
  );

  const confirmAnswerLabel = quizLang === 'ar' ? 'تأكيد الإجابة' : 'Confirm Answer';

  /*
   * Same pattern QuestionsModeScreen uses for its shared GameActionBar
   * (`onPrimary={revealed ? nextQuestion : submitAnswer}`): before reveal the
   * primary button SUBMITS the current selection; only after reveal does it
   * advance. Previously this always called `onNext`, which meant "Confirm
   * Answer" never actually confirmed anything — selection was graded the
   * instant a row was tapped, so the button only ever appeared already past
   * the point it was supposed to act at.
   */
  return (
    <GameActionBar
      lifelines={lifelines}
      primaryLabel={answerRevealed ? t.quiz.nextQuestion : confirmAnswerLabel}
      onPrimary={answerRevealed ? onNext : onSubmit}
      primaryDisabled={answerRevealed ? nextDisabled : submitDisabled}
      bottomInset={bottomInset}
    />
  );
}

export const QuizFooterActions = React.memo(QuizFooterActionsInner);
