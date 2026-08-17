/**
 * PLAY TODAY'S FOOTBALL GRID END TO END
 * =============================================================================
 *
 * Drives a whole round through the SAME service functions the HTTP route calls
 * (`getQuestionsChallengeSession` / `submitQuestionsChallengeAnswer`), against
 * the real database, and asserts what actually happens:
 *
 *   1  session loads, 9 cells, board attached, answers not leaked
 *   2  WRONG placement is rejected and the cell is not filled
 *   3  CORRECT placement is accepted and the cell locks
 *   4  a replayed submission is idempotent (no second charge, no second credit)
 *   5  concurrent submissions of one cell settle once
 *   6  all 9 cells complete → the round reports completed 9/9
 *   7  reopening the session preserves every placement and the completion
 *
 * It plays as a scratch user of its own and deletes that user afterwards, so a
 * verification run never disturbs a real account's progress or leaderboard.
 *
 *   npx ts-node --transpile-only scripts/play-football-grid.ts
 *   npx ts-node --transpile-only scripts/play-football-grid.ts --language=ar
 *   npx ts-node --transpile-only scripts/play-football-grid.ts --keep-user
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import {
  getQuestionsChallengeSession,
  submitQuestionsChallengeAnswer,
} from '../src/services/questions-challenges.service';

const MODE = 'football-grid' as const;
const TZ = 'UTC';

function arg(name: string, fallback: string): string {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
}

const failures: string[] = [];
function check(ok: boolean, label: string, detail?: unknown): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(label);
}

async function main(): Promise<void> {
  const language = arg('language', 'en');
  const clerkUserId = `grid_verify_${Date.now()}`;

  console.log(`\nFOOTBALL GRID PLAYTHROUGH — language=${language} user=${clerkUserId}\n`);

  // ── 1. Session ──────────────────────────────────────────────────────────
  console.log('1) SESSION');
  const session: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
  const questions: any[] = session.content?.questions ?? [];

  check(questions.length === 9, `session serves 9 cells (got ${questions.length})`);
  check(session.totalQuestions === 9, `session reports 9 total (got ${session.totalQuestions})`);
  check(Boolean(session.challengeId), 'session carries a challengeId');

  const q0 = session.question ?? {};
  check(Array.isArray(q0.rows) && q0.rows.length === 3, '3 row headers on the current cell');
  check(Array.isArray(q0.columns) && q0.columns.length === 3, '3 column headers on the current cell');
  check(Array.isArray(q0.rowImages) && q0.rowImages.length === 3, '3 row crests on the current cell');
  check(q0.gridCell && Number.isInteger(q0.gridCell.row), 'the current cell names its coordinates');
  check(q0.selection?.autoSubmit === true, 'placement auto-submits (no confirm step)');
  check(q0.selection?.requiredSelections === 1, 'one player per cell');
  check(
    questions.every((q) => q.answer === undefined) && session.answer === undefined,
    'the grading key is NOT sent to the client',
  );
  check(
    questions.every((q) => (q.options ?? []).length === 4),
    'every cell offers 4 players',
  );
  check(
    questions.every((q) => (q.options ?? []).every((o: any) => /^https?:\/\//.test(o.imageUrl ?? ''))),
    'every offered player carries a real portrait',
  );
  check(
    new Set(questions.map((q) => `r${q.gridCell?.row}-c${q.gridCell?.column}`)).size === 9,
    'the 9 cells of the board are covered exactly once',
  );
  console.log(`     board: ${q0.rows?.join(' | ')}  ×  ${q0.columns?.join(' | ')}`);

  /*
   * The answer key stays server-side, so this playthrough reads it from the
   * round row directly — the same source the grader uses. That is the point:
   * the script must NOT be able to learn the answer from the session payload.
   */
  const [row] = await prisma.$queryRawUnsafe<Array<{ id: string; content: any; answer: any }>>(
    `select id, content, answer from public.daily_question_challenges
      where type='FOOTBALL_GRID' and language=$1 and "refreshDate"=current_date`,
    language,
  );
  if (!row) {
    check(false, 'today\'s round row exists');
    return;
  }
  const keyed: any[] = row.content?.questions ?? [];
  const correctIdFor = (questionId: string): string => {
    const q = keyed.find((entry) => entry.id === questionId);
    return (q?.answer?.correctIds ?? [])[0];
  };
  const wrongIdFor = (questionId: string): string => {
    const q = keyed.find((entry) => entry.id === questionId);
    const correct = correctIdFor(questionId);
    return (q?.options ?? []).find((option: any) => option.id !== correct)?.id;
  };

  const submit = (questionId: string, optionId: string) =>
    submitQuestionsChallengeAnswer(
      clerkUserId,
      MODE,
      { challengeId: session.challengeId, questionId, selectedIds: [optionId], elapsedTime: 3, language },
      TZ,
    ) as Promise<any>;

  // ── 2. Wrong placement ──────────────────────────────────────────────────
  console.log('\n2) WRONG PLACEMENT');
  const firstId = session.question.id;
  const wrongOption = wrongIdFor(firstId);
  const wrong = await submit(firstId, wrongOption);
  check(wrong.isCorrect === false, 'server rejects a player who does not fill the cell', {
    isCorrect: wrong.isCorrect,
  });
  check(wrong.xpEarned <= 0, 'a rejected placement earns no XP', { xpEarned: wrong.xpEarned });

  check(wrong.pointsEarned === 0, 'a rejected placement scores nothing', {
    pointsEarned: wrong.pointsEarned,
  });

  const afterWrong: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
  check(
    afterWrong.completed === false,
    'a wrong placement does not end the round',
    { completed: afterWrong.completed },
  );
  check(
    afterWrong.currentQuestion === 2,
    'the round moves on to the next cell',
    { currentQuestion: afterWrong.currentQuestion },
  );

  // ── 3. Correct placement ────────────────────────────────────────────────
  console.log('\n3) CORRECT PLACEMENT');
  const secondId = afterWrong.question.id;
  const right = await submit(secondId, correctIdFor(secondId));
  check(right.isCorrect === true, 'server accepts a player who fills the cell', {
    isCorrect: right.isCorrect,
  });
  check(right.pointsEarned === 1, 'the accepted cell scores', { pointsEarned: right.pointsEarned });
  /*
   * The session's own `score` stays 0 until the round completes — by design
   * (buildSessionView: `progressMeta.completed ? score : 0`), so no running
   * total is shown mid-board. The placement is still recorded: it is the
   * persisted progress row, checked here, that the reopen test relies on.
   */
  const persisted = await prisma.userQuestionChallenge.findFirst({
    where: { challengeId: session.challengeId, user: { clerkUserId } },
    select: { score: true },
  });
  check(persisted?.score === 1, 'the accepted placement is persisted', { stored: persisted?.score });

  // ── 4. Replay of the same cell ──────────────────────────────────────────
  console.log('\n4) DUPLICATE SUBMISSION');
  const replay = await submit(secondId, correctIdFor(secondId));
  check(replay.idempotent === true, 'a repeated submission for a settled cell is idempotent');
  check(replay.xpEarned === 0, 'the replay awards no second time', { xpEarned: replay.xpEarned });
  check(replay.coinsDeducted === 0, 'the replay charges nothing');

  // ── 5. Concurrent submission of one cell ────────────────────────────────
  console.log('\n5) CONCURRENT SUBMISSION');
  const third: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
  const thirdId = third.question.id;
  const raced = await Promise.all([
    submit(thirdId, correctIdFor(thirdId)),
    submit(thirdId, correctIdFor(thirdId)),
  ]);
  check(
    raced.filter((result) => !result.idempotent).length === 1,
    'two simultaneous placements settle the cell exactly once',
    raced.map((r) => r.idempotent),
  );

  // ── 6. Finish the board ─────────────────────────────────────────────────
  console.log('\n6) COMPLETE THE BOARD');
  for (;;) {
    const live: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
    if (live.completed || !live.question) break;
    const result = await submit(live.question.id, correctIdFor(live.question.id));
    console.log(
      `     ${live.question.id} r${live.question.gridCell.row}c${live.question.gridCell.column} ` +
        `${live.question.rows[live.question.gridCell.row]} × ${live.question.columns[live.question.gridCell.column]}` +
        ` → ${result.isCorrect ? 'ACCEPTED' : 'REJECTED'}`,
    );
  }

  const finished: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
  check(finished.completed === true, 'the round reports completed', { completed: finished.completed });
  check(
    finished.finalResult?.totalQuestions === 9,
    'the final result covers all 9 cells',
    finished.finalResult,
  );
  check(
    finished.finalResult?.correctAnswers === 8 && finished.finalResult?.wrongAnswers === 1,
    '8 accepted placements and the 1 deliberate miss are both recorded',
    finished.finalResult,
  );
  check(finished.score === 8, `score counts the 8 correct placements (got ${finished.score})`);
  check(finished.completionPercentage === 100, 'completion is 100%', finished.completionPercentage);

  // ── 7. Reopen ───────────────────────────────────────────────────────────
  console.log('\n7) REOPEN AFTER COMPLETION');
  const reopened: any = await getQuestionsChallengeSession(clerkUserId, MODE, language, TZ);
  check(reopened.completed === true, 'reopening keeps the round completed');
  check(reopened.score === finished.score, 'reopening keeps the score', {
    before: finished.score,
    after: reopened.score,
  });
  check(
    reopened.completionState === 'completed',
    'reopening reports the completed state',
    reopened.completionState,
  );
  check(
    JSON.stringify(reopened.finalResult) === JSON.stringify(finished.finalResult),
    'reopening keeps every placement',
    { before: finished.finalResult, after: reopened.finalResult },
  );
  check(reopened.challengeId === session.challengeId, 'reopening serves the same challenge, not a new one');

  const xpBefore = (await prisma.user.findFirst({ where: { clerkUserId }, select: { xp: true } }))?.xp ?? 0;
  const replayAfterComplete = await submit(firstId, correctIdFor(firstId));
  const xpAfter = (await prisma.user.findFirst({ where: { clerkUserId }, select: { xp: true } }))?.xp ?? 0;
  check(
    replayAfterComplete.idempotent === true,
    'replaying a cell after completion does not re-open it',
  );
  check(xpAfter === xpBefore, 'replaying after completion awards no further XP', {
    xpBefore,
    xpAfter,
  });

  const xpRow = await prisma.user.findFirst({ where: { clerkUserId }, select: { xp: true } });
  console.log(`\n  scratch user finished with xp=${xpRow?.xp ?? 0}`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  if (!process.argv.includes('--keep-user')) {
    await prisma.user.deleteMany({ where: { clerkUserId } });
    console.log('  scratch user deleted');
  }

  console.log(`\n  ${failures.length ? `${failures.length} CHECK(S) FAILED` : 'ALL CHECKS PASSED'}\n`);
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[play-grid] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeRedis().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
