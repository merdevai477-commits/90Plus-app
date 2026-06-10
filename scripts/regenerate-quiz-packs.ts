/**
 * Delete today's quiz packs + Redis cache and regenerate via AI.
 * Requires QUIZ_THEME (e.g. WORLD_CUP) and OPENROUTER_API_KEY in env.
 *
 * Usage:
 *   npm run regenerate:quiz-packs
 *   npx ts-node scripts/regenerate-quiz-packs.ts --date=2026-06-10 --lang=en
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { resolveQuizTheme } from '../src/constants/quiz-theme.config';
import { regenerateDailyQuizPacks } from '../src/services/quiz-daily.service';
import { packDateYmd, todayPackDate } from '../src/services/quiz-generator.service';
import type { QuizLanguage } from '../src/types/quiz.types';

function parseArgs() {
  const dateArg = process.argv.find((a) => a.startsWith('--date='))?.split('=')[1];
  const langArg = process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1];
  const packDate = dateArg ? new Date(`${dateArg}T00:00:00.000Z`) : todayPackDate();
  const languages =
    langArg === 'en' || langArg === 'ar' ? ([langArg] as QuizLanguage[]) : (['ar', 'en'] as QuizLanguage[]);
  return { packDate, languages };
}

async function main() {
  const theme = resolveQuizTheme();
  const { packDate, languages } = parseArgs();
  const dateStr = packDateYmd(packDate);

  console.log(`QUIZ_THEME=${theme}`);
  console.log(`Regenerating ${dateStr} for: ${languages.join(', ')}`);
  console.log('(AI generation may take 1–3 minutes per language)\n');

  await regenerateDailyQuizPacks({ packDate, languages });

  const rows = await prisma.dailyQuizPack.findMany({
    where: { packDate },
    select: {
      language: true,
      promptVersion: true,
      generatorVersion: true,
      isFallback: true,
      questions: true,
    },
  });

  for (const row of rows) {
    const qs = row.questions as { type?: string; question?: string }[];
    const types: Record<string, number> = {};
    for (const q of qs) {
      if (q.type) types[q.type] = (types[q.type] ?? 0) + 1;
    }
    console.log(`\n${row.language}: promptVersion=${row.promptVersion} fallback=${row.isFallback}`);
    console.log('Types:', types);
    qs.slice(0, 3).forEach((q, i) => console.log(`  ${i + 1}. [${q.type}] ${String(q.question).slice(0, 100)}`));
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
