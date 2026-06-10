/**
 * End-to-end verification for the hardened Daily Quiz system:
 * entity dataset, metrics, quality scoring, fallback, generation metadata, analytics, image cache.
 *
 * Usage:
 *   npm run verify:quiz-system
 *   npx ts-node scripts/verify-quiz-system.ts
 *   npx ts-node scripts/verify-quiz-system.ts --with-metrics-write
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { parseAiQuizResponse } from '../src/services/quiz-generator.service';
import { buildQuizEntityDataset, isDatasetSufficient, selectDailyEntitySlice } from '../src/services/quiz-entity-dataset.service';
import {
  isCompletePack,
  remapPackQuestionsForDate,
  loadMostRecentValidPack,
} from '../src/services/quiz-fallback.service';
import { calculateQuestionQuality } from '../src/services/quiz-question-quality.service';
import {
  recordQuestionShown,
  recordCorrectAnswer,
  recordQuestionSkip,
  recordQuestionHint,
  getQuestionMetric,
} from '../src/services/quiz-question-metrics.service';
import {
  getHardestQuestions,
  getEasiestQuestions,
  getTypePerformance,
  getAvgAnswerTimeByDifficulty,
} from '../src/services/quiz-analytics.service';
import {
  getCachedQuizImageUrl,
  setCachedQuizImageUrl,
} from '../src/services/quiz-image-cache.service';
import {
  buildPackGenerationMeta,
  QUIZ_GENERATOR_VERSION,
  QUIZ_PROMPT_VERSION,
  QUIZ_DATASET_VERSION,
} from '../src/constants/quiz-generation.constants';
import { buildQuizSystemPrompt, buildQuizUserPrompt } from '../src/services/quiz-prompt.builder';
import { QUIZ_PACK_SIZE, QUIZ_MIN_CONFIDENCE } from '../src/constants/quiz.constants';
import type { QuizLanguage } from '../src/types/quiz.types';

const WITH_METRICS_WRITE = process.argv.includes('--with-metrics-write');

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`);
}

async function checkDatabaseSchema() {
  section('1. Database schema');

  try {
    const metricCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quiz_question_metrics'
      ORDER BY column_name`;
    const requiredMetric = [
      'shownCount', 'correctCount', 'wrongCount', 'skipCount',
      'hintCount', 'totalAnswerTimeMs', 'questionId', 'packDate', 'language',
    ];
    const found = metricCols.map((c) => c.column_name);
    const missing = requiredMetric.filter((c) => !found.includes(c));
    if (missing.length === 0) {
      pass('quiz_question_metrics table', `${found.length} columns`);
    } else {
      fail('quiz_question_metrics table', `missing: ${missing.join(', ')}`);
    }
  } catch (err) {
    fail('quiz_question_metrics table', String(err));
  }

  try {
    const packCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'daily_quiz_packs' AND column_name IN (
        'isFallback', 'generatorModel', 'generatorVersion', 'promptVersion', 'datasetVersion'
      )`;
    if (packCols.length >= 5) {
      pass('daily_quiz_packs metadata columns', packCols.map((c) => c.column_name).join(', '));
    } else {
      fail('daily_quiz_packs metadata columns', `found ${packCols.length}/5`);
    }
  } catch (err) {
    fail('daily_quiz_packs metadata columns', String(err));
  }
}

function checkPureLogic() {
  section('2. Quality scoring & fallback logic');

  const high = calculateQuestionQuality({
    shownCount: 100,
    correctCount: 55,
    wrongCount: 35,
    skipCount: 8,
    hintCount: 12,
    totalAnswerTimeMs: 1_080_000,
  });
  if (high.qualityScore >= 60 && high.correctRate > 0.5) {
    pass('calculateQuestionQuality (balanced)', `score=${high.qualityScore}`);
  } else {
    fail('calculateQuestionQuality (balanced)', `score=${high.qualityScore}`);
  }

  const low = calculateQuestionQuality({
    shownCount: 50,
    correctCount: 2,
    wrongCount: 40,
    skipCount: 20,
    hintCount: 25,
    totalAnswerTimeMs: 500_000,
  });
  if (low.qualityScore < 50) {
    pass('calculateQuestionQuality (poor)', `score=${low.qualityScore}`);
  } else {
    fail('calculateQuestionQuality (poor)', `score=${low.qualityScore}`);
  }

  const sample = Array.from({ length: QUIZ_PACK_SIZE }, (_, i) => ({
    id: `daily-2026-06-09-en-${i + 1}`,
    question: `Q${i}`,
    type: 'normal' as const,
    options: [
      { key: 'A' as const, text: 'A' },
      { key: 'B' as const, text: 'B' },
      { key: 'C' as const, text: 'C' },
      { key: 'D' as const, text: 'D' },
    ],
    correctKey: 'A' as const,
    difficulty: 'EASY' as const,
  }));
  const remapped = remapPackQuestionsForDate(sample, '2026-06-10', 'en');
  if (remapped[0]?.id === 'daily-2026-06-10-en-1' && isCompletePack(remapped)) {
    pass('remapPackQuestionsForDate');
  } else {
    fail('remapPackQuestionsForDate');
  }

  const insufficient = parseAiQuizResponse(
    JSON.stringify({ questions: [{ question: 'x' }], status: 'INSUFFICIENT_DATA' }),
  );
  if (insufficient.status === 'INSUFFICIENT_DATA' && insufficient.questions.length === 0) {
    pass('parseAiQuizResponse INSUFFICIENT_DATA');
  } else {
    fail('parseAiQuizResponse INSUFFICIENT_DATA');
  }

  const meta = buildPackGenerationMeta(false);
  if (
    meta.generatorVersion === QUIZ_GENERATOR_VERSION &&
    meta.promptVersion === QUIZ_PROMPT_VERSION &&
    meta.datasetVersion === QUIZ_DATASET_VERSION &&
    meta.isFallback === false
  ) {
    pass('buildPackGenerationMeta', meta.generatorModel);
  } else {
    fail('buildPackGenerationMeta');
  }

  const system = buildQuizSystemPrompt({ language: 'ar', topicFocus: 'Test' });
  if (system.includes('ENTITY SELECTION RULE') && system.includes(String(QUIZ_MIN_CONFIDENCE))) {
    pass('buildQuizSystemPrompt');
  } else {
    fail('buildQuizSystemPrompt');
  }
}

async function checkEntityDataset() {
  section('3. Entity dataset (TeamInfo + CachedTeam)');

  try {
    const teamPlayerCount = await prisma.teamPlayer.count();
    const cachedTeamCount = await prisma.cachedTeam.count();
    pass('CachedTeam rows in DB', String(cachedTeamCount));

    const result = await buildQuizEntityDataset();

    if (teamPlayerCount > 0) {
      pass('TeamPlayer rows in DB', String(teamPlayerCount));
    } else if (result.ok) {
      pass(
        'TeamPlayer rows in DB',
        '0 — dataset uses PlayerInfo fallback (run npm run seed:quiz-rosters for squads)',
      );
    } else {
      fail(
        'TeamPlayer rows in DB',
        '0 — run npm run seed:quiz-rosters or wait for monthly roster sync',
      );
    }
    if (result.ok) {
      pass(
        'buildQuizEntityDataset',
        `players=${result.dataset.players.length} clubs=${result.dataset.clubs.length} stadiums=${result.dataset.stadiums.length}`,
      );
      const slice = selectDailyEntitySlice(result.dataset, '2026-06-10', 'en', 0);
      if (slice.players.length > 0 && slice.clubs.length > 0) {
        pass('selectDailyEntitySlice', `${slice.players.length} players in slice`);
      } else {
        fail('selectDailyEntitySlice', 'empty slice');
      }
      const userPrompt = buildQuizUserPrompt({
        language: 'en',
        packDate: '2026-06-10',
        topicFocus: 'Premier League',
        slice,
      });
      if (userPrompt.includes('ENTITY DATASET') && userPrompt.includes('"players"')) {
        pass('buildQuizUserPrompt includes dataset JSON');
      } else {
        fail('buildQuizUserPrompt includes dataset JSON');
      }
    } else if (result.counts.clubs >= 8 && result.counts.stadiums >= 4) {
      fail(
        'buildQuizEntityDataset',
        `needs player data — players=${result.counts.players} (run npm run seed:quiz-rosters) clubs=${result.counts.clubs} stadiums=${result.counts.stadiums}`,
      );
    } else {
      fail(
        'buildQuizEntityDataset',
        `INSUFFICIENT_DATA players=${result.counts.players} clubs=${result.counts.clubs} stadiums=${result.counts.stadiums}`,
      );
    }
  } catch (err) {
    fail('buildQuizEntityDataset', String(err));
  }
}

async function checkDailyPacks() {
  section('4. Daily quiz packs');

  try {
    const packs = await prisma.dailyQuizPack.findMany({
      orderBy: { packDate: 'desc' },
      take: 4,
      select: {
        packDate: true,
        language: true,
        isFallback: true,
        generatorModel: true,
        generatorVersion: true,
        promptVersion: true,
        datasetVersion: true,
        questions: true,
      },
    });

    if (packs.length === 0) {
      fail('daily packs exist', 'no packs in DB — run warmup or open quiz in app');
      return;
    }

    pass('daily packs in DB', `${packs.length} recent pack(s) found`);

    for (const pack of packs) {
      const date = pack.packDate.toISOString().slice(0, 10);
      const qs = pack.questions as unknown[];
      const complete = isCompletePack(qs);
      const hasMeta = Boolean(pack.generatorVersion || pack.promptVersion);
      const label = `${date}/${pack.language}`;
      if (complete) {
        pass(`pack ${label} complete`, `${qs.length} questions`);
      } else {
        fail(`pack ${label} complete`, `count=${Array.isArray(qs) ? qs.length : 0}`);
      }
      if (pack.isFallback) {
        pass(`pack ${label} fallback flag`, 'isFallback=true');
      }
      if (hasMeta) {
        pass(
          `pack ${label} generation metadata`,
          `v=${pack.generatorVersion ?? '?'} model=${pack.generatorModel ?? '?'}`,
        );
      }
      const first = (qs as Array<{ confidence?: number }>)?.[0];
      if (first && typeof first.confidence === 'number') {
        pass(`pack ${label} per-question confidence`, `Q1 confidence=${first.confidence}`);
      }
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const fallbackSource = await loadMostRecentValidPack('en', today);
    if (fallbackSource) {
      pass(
        'loadMostRecentValidPack (en)',
        `source=${fallbackSource.packDate.toISOString().slice(0, 10)}`,
      );
    } else {
      fail('loadMostRecentValidPack (en)', 'no prior valid pack');
    }
  } catch (err) {
    fail('daily packs check', String(err));
  }
}

async function checkMetricsWrite() {
  section('5. Metrics atomic write (optional)');

  if (!WITH_METRICS_WRITE) {
    console.log('  ⏭️  Skipped — pass --with-metrics-write to test DB metric upserts');
    return;
  }

  const testDate = new Date('2099-01-01T00:00:00.000Z');
  const testId = 'verify-quiz-system-test-q1';
  const lang: QuizLanguage = 'en';

  try {
    await prisma.quizQuestionMetric.deleteMany({
      where: { questionId: testId, packDate: testDate, language: lang },
    });

    const key = {
      questionId: testId,
      packDate: testDate,
      language: lang,
      questionType: 'normal' as const,
      difficulty: 'EASY' as const,
    };

    await recordQuestionShown(key);
    await recordCorrectAnswer(key, 8);
    await recordQuestionSkip(key);
    await recordQuestionHint(key);

    const row = await getQuestionMetric(testId, testDate, lang);
    if (
      row &&
      row.shownCount === 1 &&
      row.correctCount === 1 &&
      row.skipCount === 1 &&
      row.hintCount === 1 &&
      Number(row.totalAnswerTimeMs) === 8000
    ) {
      pass('atomic metric increments', JSON.stringify({
        shown: row.shownCount,
        correct: row.correctCount,
        skip: row.skipCount,
        hint: row.hintCount,
        ms: Number(row.totalAnswerTimeMs),
      }));
    } else {
      fail('atomic metric increments', row ? JSON.stringify(row) : 'no row');
    }

    const quality = calculateQuestionQuality(row!);
    pass('quality score on test metric', `score=${quality.qualityScore}`);

    await prisma.quizQuestionMetric.deleteMany({
      where: { questionId: testId, packDate: testDate, language: lang },
    });
    pass('test metrics cleaned up');
  } catch (err) {
    fail('metrics write test', String(err));
  }
}

async function checkAnalytics() {
  section('6. Admin analytics aggregations');

  try {
    const [hardest, easiest, types, timing] = await Promise.all([
      getHardestQuestions({ limit: 5, minShown: 0 }),
      getEasiestQuestions({ limit: 5, minShown: 0 }),
      getTypePerformance({}),
      getAvgAnswerTimeByDifficulty({}),
    ]);

    pass('getHardestQuestions', `${hardest.length} row(s)`);
    pass('getEasiestQuestions', `${easiest.length} row(s)`);
    pass('getTypePerformance', `${types.length} type(s)`);
    pass('getAvgAnswerTimeByDifficulty', `${timing.length} difficulty bucket(s)`);

    if (hardest.length > 0 && hardest[0]?.quality.qualityScore != null) {
      pass('analytics includes qualityScore', `top hardest score=${hardest[0].quality.qualityScore}`);
    }
  } catch (err) {
    fail('analytics aggregations', String(err));
  }
}

async function checkImageCache() {
  section('7. Quiz image cache (Redis)');

  const testKey = 999999991;
  const testUrl = 'https://example.com/verify-quiz-cache.png';

  try {
    await setCachedQuizImageUrl('player', testKey, testUrl);
    const cached = await getCachedQuizImageUrl('player', testKey);
    if (cached === testUrl) {
      pass('quiz image cache round-trip', `player:${testKey}`);
    } else {
      fail('quiz image cache round-trip', cached ?? 'null');
    }
  } catch (err) {
    fail('quiz image cache', String(err));
  }
}

async function checkMetricRowCount() {
  section('8. Production metrics snapshot');

  try {
    const count = await prisma.quizQuestionMetric.count();
    const recent = await prisma.quizQuestionMetric.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: {
        questionId: true,
        packDate: true,
        language: true,
        shownCount: true,
        correctCount: true,
        wrongCount: true,
        skipCount: true,
        hintCount: true,
      },
    });

    pass('quiz_question_metrics row count', String(count));
    if (recent.length > 0) {
      for (const r of recent) {
        console.log(
          `     · ${r.questionId} (${r.packDate.toISOString().slice(0, 10)}/${r.language}) shown=${r.shownCount} correct=${r.correctCount} skip=${r.skipCount}`,
        );
      }
    } else {
      console.log('     (no metrics yet — play the quiz in the app to populate)');
    }
  } catch (err) {
    fail('metrics snapshot', String(err));
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('90Plus — Daily Quiz System Verification');
  console.log('═'.repeat(60));
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✓ set' : '✗ missing'}`);
  console.log(`OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✓ set (AI gen optional)' : '— not set'}`);
  console.log(`Flags: --with-metrics-write=${WITH_METRICS_WRITE}`);

  await checkDatabaseSchema();
  checkPureLogic();
  await checkEntityDataset();
  await checkDailyPacks();
  await checkMetricsWrite();
  await checkAnalytics();
  await checkImageCache();
  await checkMetricRowCount();

  section('Summary');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n  Failed checks:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`    - ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
    }
    console.log('\n  Tip: run unit tests with: npm test -- --testPathPattern=quiz-');
    process.exitCode = 1;
  } else {
    console.log('\n  All checks passed.');
    console.log('  Optional: npm test -- --testPathPattern=quiz-');
  }
}

main()
  .catch((err) => {
    console.error('\nFatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeRedis();
  });
