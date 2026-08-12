/**
 * VERIFY EVERY QUESTION MODE END-TO-END
 *
 * Calls the same service the session route calls, once per mode, and checks
 * what the mobile app would actually receive:
 *
 *   session exists → content.questions non-empty → every question carries the
 *   fields the app's mapper reads (front/services/questionsModes.ts)
 *
 * This is the check that a plain "did it return 200" misses: a round can be
 * served successfully and still be unplayable.
 *
 * Nothing here writes content. It only reports.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/verify-question-modes.ts
 *   npx ts-node --transpile-only scripts/verify-question-modes.ts --language=ar
 *   npx ts-node --transpile-only scripts/verify-question-modes.ts --user=user_xxx
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { getQuestionsChallengeSession } from '../src/services/questions-challenges.service';
import type { QuestionChallengeMode } from '../src/types/questions-challenges.types';

const MODES: QuestionChallengeMode[] = [
  'guess-player',
  'football-bingo',
  'football-grid',
  'player-connections',
  'guess-club',
  'transfer-puzzle',
  'top10-challenge',
  'football-quiz',
];

function arg(name: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
}

/** The fields the app's mapper reads off one question. */
function inspectQuestion(mode: QuestionChallengeMode, raw: any): string[] {
  const problems: string[] = [];
  if (!raw?.id) problems.push('missing id');
  if (!raw?.prompt || String(raw.prompt).trim() === '') problems.push('empty prompt');

  /*
   * Deliberately NOT asserted here: `answer.correctIds` / `answer.orderedIds`.
   * The session strips grading secrets before they reach a client
   * (sanitizeQuestionForClient), so a correctly-behaving server always omits
   * them — asserting on them reported every healthy mode as "no correct
   * answer" and turned a real 3/8 into a headline 0/8. Whether a stored round
   * can actually be graded is checked against the DB in checkStoredAnswers(),
   * which reads the column the client never sees.
   */

  // Mode-shaped payload the renderer needs, mirroring mapRoundQuestion.
  switch (mode) {
    case 'football-bingo':
      if (!Array.isArray(raw?.bingoBoard) || raw.bingoBoard.length === 0) problems.push('no bingoBoard');
      break;
    case 'football-grid':
      if (!Array.isArray(raw?.rows) || raw.rows.length === 0) problems.push('no grid rows');
      if (!Array.isArray(raw?.columns) || raw.columns.length === 0) problems.push('no grid columns');
      break;
    case 'player-connections':
      if (!Array.isArray(raw?.players) || raw.players.length === 0) problems.push('no players');
      break;
    case 'transfer-puzzle':
      if (!Array.isArray(raw?.transferTimeline) || raw.transferTimeline.length === 0)
        problems.push('no transferTimeline');
      break;
    default:
      if (!Array.isArray(raw?.options) || raw.options.length === 0) problems.push('no options');
      break;
  }
  return problems;
}

/**
 * Gradability lives in the DB, not in the session payload. Reads the stored
 * round and reports any question the server could not grade — the real version
 * of the check the session payload cannot answer.
 */
async function checkStoredAnswers(challengeId: string): Promise<string[]> {
  const row = await prisma.dailyQuestionChallenge.findUnique({
    where: { id: challengeId },
    select: { content: true, answer: true },
  });
  const questions = Array.isArray((row?.content as any)?.questions)
    ? ((row!.content as any).questions as any[])
    : [];
  if (questions.length === 0) return ['stored round has no questions'];

  const byQuestionId = ((row?.answer as any)?.byQuestionId ?? {}) as Record<string, any>;
  const problems: string[] = [];
  questions.forEach((q, i) => {
    const stored = q?.answer ?? byQuestionId[q?.id];
    const gradable =
      (Array.isArray(stored?.correctIds) && stored.correctIds.length > 0) ||
      (Array.isArray(stored?.orderedIds) && stored.orderedIds.length > 0);
    if (!gradable) problems.push(`q${i + 1}: stored round has no gradable answer`);
  });
  return problems;
}

async function main() {
  const language = arg('language', 'en');
  const clerkUserId = arg('user', process.env.VERIFY_CLERK_USER_ID ?? '');
  const timezone = arg('tz', 'UTC');

  if (!clerkUserId) {
    console.error('Provide a Clerk user id: --user=user_xxx (or VERIFY_CLERK_USER_ID)');
    process.exitCode = 1;
    return;
  }

  console.log(`\nVerifying ${MODES.length} modes  language=${language}  tz=${timezone}\n`);

  let ok = 0;
  const failures: string[] = [];

  for (const mode of MODES) {
    let line = mode.padEnd(19);
    try {
      const session = await getQuestionsChallengeSession(clerkUserId, mode, language, timezone);
      const questions = Array.isArray((session.content as any)?.questions)
        ? ((session.content as any).questions as any[])
        : [];

      if (questions.length === 0) {
        line += '→ SESSION OK but 0 QUESTIONS';
        failures.push(`${mode}: zero questions`);
      } else {
        const problems = [
          ...questions.flatMap((q, i) => inspectQuestion(mode, q).map((p) => `q${i + 1}: ${p}`)),
          ...(await checkStoredAnswers(session.challengeId)),
        ];
        const withImage = questions.filter((q) => typeof q?.imageUrl === 'string' && q.imageUrl).length;
        if (problems.length === 0) {
          ok += 1;
          line += `→ OK  questions=${questions.length}  withImage=${withImage}  session=${session.challengeId}`;
        } else {
          line += `→ INVALID  questions=${questions.length}  ${problems.slice(0, 3).join('; ')}`;
          failures.push(`${mode}: ${problems.length} field problem(s)`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      line += `→ FAILED  ${message}`;
      failures.push(`${mode}: ${message}`);
    }
    console.log(line);
  }

  console.log(`\n${ok}/${MODES.length} modes playable`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
