import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import type { StoredQuizQuestion } from '../src/types/quiz.types';

const date = process.argv[2] ?? '2026-06-10';
const lang = process.argv[3] ?? 'ar';

async function main() {
  const pack = await prisma.dailyQuizPack.findUnique({
    where: {
      packDate_language: {
        packDate: new Date(`${date}T00:00:00.000Z`),
        language: lang,
      },
    },
    select: {
      questions: true,
      isFallback: true,
      promptVersion: true,
      generatorVersion: true,
    },
  });

  if (!pack) {
    console.log(`No pack for ${date}/${lang}`);
    return;
  }

  const qs = pack.questions as unknown as StoredQuizQuestion[];
  console.log(`${date} / ${lang} — ${qs.length} questions`);
  console.log(`fallback=${pack.isFallback} promptVersion=${pack.promptVersion}\n`);

  qs.forEach((q, i) => {
    const opts = q.options.map((o) => `${o.key}) ${o.text}`).join('  |  ');
    console.log(`${i + 1}. [${q.type} / ${q.difficulty}]`);
    console.log(`   ${q.question}`);
    console.log(`   ${opts}`);
    console.log(`   ✓ الإجابة: ${q.correctKey}`);
    if (q.hint) console.log(`   💡 ${q.hint}`);
    console.log('');
  });
}

main()
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
