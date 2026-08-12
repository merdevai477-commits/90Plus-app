import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import {
  getQuestionsChallengeSession,
  submitQuestionsChallengeAnswer,
} from '../src/services/questions-challenges.service';

const USER = 'user_3FvNl9TyaozoUWXrdKgFDmLpwhO';
const MODES = ['guess-player', 'guess-club', 'football-quiz'] as const;

async function main() {
  for (const mode of MODES) {
    console.log(`\n=== ${mode} ===`);
    try {
      const session = await getQuestionsChallengeSession(USER, mode, 'en', 'UTC');
      const content = session.content as any;
      const question = Array.isArray(content?.questions) ? content.questions[0] : null;
      if (!question) {
        console.log('no question in session');
        continue;
      }
      const optionId = question.options?.[0]?.id ?? question.options?.[0]?.key;
      console.log('challengeId', session.challengeId, 'questionId', question.id, 'optionId', optionId);

      const result = await submitQuestionsChallengeAnswer(
        USER,
        mode,
        {
          challengeId: session.challengeId,
          questionId: question.id,
          selectedIds: [String(optionId)],
          elapsedTime: 5,
          language: 'en',
        },
        'UTC',
      );
      console.log('SUBMIT OK', JSON.stringify(result).slice(0, 300));
    } catch (err) {
      console.error('SUBMIT FAILED', err instanceof Error ? err.stack : err);
    }
  }
}

main()
  .catch((err) => {
    console.error('SCRIPT ERROR', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
