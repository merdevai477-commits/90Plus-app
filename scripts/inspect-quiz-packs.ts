import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { resolveQuizTheme } from '../src/constants/quiz-theme.config';
import type { StoredQuizQuestion } from '../src/types/quiz.types';

const WC_KEYWORDS =
  /world cup|fifa|كأس العالم|mundial|golden boot|golden ball|host nation|world champion|نهائيات|بطولة العالم|كأس العالم/i;
const CLUB_KEYWORDS =
  /premier league|la liga|serie a|bundesliga|champions league|europa league|liverpool|manchester|barcelona|real madrid|الدوري الإنجليزي|الدوري الإسباني/i;

async function main() {
  if (process.argv[2] === '--recent') {
    const recent = await prisma.dailyQuizPack.findMany({
      orderBy: { packDate: 'desc' },
      take: 10,
      select: {
        packDate: true,
        language: true,
        createdAt: true,
        promptVersion: true,
        isFallback: true,
      },
    });
    console.log(JSON.stringify(recent, null, 2));
    return;
  }

  const dateArg = process.argv[2] ?? '2026-06-10';
  console.log('QUIZ_THEME env:', process.env.QUIZ_THEME ?? '(not set → DEFAULT)');
  console.log('Resolved theme:', resolveQuizTheme());

  const packs = await prisma.dailyQuizPack.findMany({
    where: { packDate: new Date(dateArg) },
    orderBy: { language: 'asc' },
    select: {
      language: true,
      packDate: true,
      isFallback: true,
      generatorModel: true,
      generatorVersion: true,
      promptVersion: true,
      datasetVersion: true,
      createdAt: true,
      updatedAt: true,
      questions: true,
    },
  });

  if (packs.length === 0) {
    console.log(`No packs for ${dateArg}`);
    return;
  }

  for (const pack of packs) {
    const qs = pack.questions as unknown as StoredQuizQuestion[];
    console.log(`\n=== Pack ${dateArg} ${pack.language} ===`);
    console.log('Meta:', {
      isFallback: pack.isFallback,
      promptVersion: pack.promptVersion,
      generatorVersion: pack.generatorVersion,
      model: pack.generatorModel,
      createdAt: pack.createdAt.toISOString(),
      updatedAt: pack.updatedAt.toISOString(),
    });

    const types: Record<string, number> = {};
    let wcHits = 0;
    let clubHits = 0;

    qs.forEach((q, i) => {
      types[q.type] = (types[q.type] ?? 0) + 1;
      const text = String(q.question ?? '');
      if (WC_KEYWORDS.test(text)) wcHits += 1;
      if (CLUB_KEYWORDS.test(text)) clubHits += 1;
      console.log(`${i + 1}. [${q.type}/${q.difficulty}] ${text}`);
    });

    console.log('Types:', types);
    console.log(`WC keyword hits: ${wcHits}/${qs.length}`);
    console.log(`Club/league keyword hits: ${clubHits}/${qs.length}`);
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
