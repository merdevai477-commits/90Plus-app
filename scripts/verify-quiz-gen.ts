/**
 * Verifies daily quiz generation reliability + AR/EN quality + World Cup theming.
 *
 * Always runs OFFLINE checks (JSON parsing robustness, prompt language rules,
 * theme resolution). If a DB + Gemini key are reachable it ALSO attempts a live
 * AR + EN generation and prints the parsed questions. Missing env/network is
 * handled gracefully — the offline checks still pass.
 *
 * Usage:
 *   npx tsx scripts/verify-quiz-gen.ts            # offline + best-effort live
 *   npx tsx scripts/verify-quiz-gen.ts --no-live  # offline checks only
 */

import 'dotenv/config';
import { parseAiQuizResponse } from '../src/services/quiz-generator.service';
import { buildQuizSystemPrompt } from '../src/services/quiz-prompt.builder';
import { resolveQuizTheme, getQuizThemeCampaign } from '../src/constants/quiz-theme.config';
import {
  isGeminiQuizConfigured,
  resolveGeminiQuizModel,
  resolveGeminiQuizFallbackModel,
  resolveGeminiQuizTimeoutMs,
} from '../src/services/gemini-text.client';
import type { QuizLanguage } from '../src/types/quiz.types';

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  const label = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log(`[${label}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function runOfflineChecks(): void {
  console.log('\n=== Config ===');
  console.log(`Gemini quiz configured: ${isGeminiQuizConfigured()}`);
  console.log(`Primary model:  ${resolveGeminiQuizModel()}`);
  console.log(`Fallback model: ${resolveGeminiQuizFallbackModel()}`);
  console.log(`Per-call timeout: ${resolveGeminiQuizTimeoutMs()}ms`);
  const theme = resolveQuizTheme();
  console.log(`Active theme: ${theme} (campaign=${Boolean(getQuizThemeCampaign(theme))})`);

  console.log('\n=== JSON parsing robustness ===');
  const arr = '[{"question":"Q"}]';
  check('plain array', parseAiQuizResponse(arr).questions.length === 1);

  const fenced = '```json\n{"questions":[{"question":"Q"}]}\n```';
  check('fenced object', parseAiQuizResponse(fenced).questions.length === 1);

  const prose =
    'Sure! Here is your quiz:\n```json\n{"questions":[{"question":"Q1"},{"question":"Q2"}]}\n```\nEnjoy!';
  check('prose-wrapped fenced', parseAiQuizResponse(prose).questions.length === 2);

  const trailingComma = '{"questions":[{"question":"Q",},],}';
  check('trailing commas repaired', parseAiQuizResponse(trailingComma).questions.length === 1);

  const noFence =
    'Absolutely, here you go: {"questions":[{"question":"Q"}]} — let me know!';
  check('json embedded in prose (no fence)', parseAiQuizResponse(noFence).questions.length === 1);

  const insufficient = '{"questions":[],"status":"INSUFFICIENT_DATA"}';
  check(
    'INSUFFICIENT_DATA propagated',
    parseAiQuizResponse(insufficient).status === 'INSUFFICIENT_DATA',
  );

  const garbage = 'the model refused to answer';
  check('garbage yields empty pack', parseAiQuizResponse(garbage).questions.length === 0);

  console.log('\n=== Prompt language rules (AR + EN) ===');
  const ar = buildQuizSystemPrompt({ language: 'ar', topicFocus: 'Test', theme });
  check('AR prompt enforces Arabic', /Modern Standard Arabic/i.test(ar) && /Never answer in English/i.test(ar));
  check('AR prompt has single-correct rule', /EXACTLY ONE/i.test(ar));

  const en = buildQuizSystemPrompt({ language: 'en', topicFocus: 'Test', theme });
  check('EN prompt enforces English', /natural English/i.test(en) && /Never answer in Arabic/i.test(en));
  check('EN prompt has single-correct rule', /EXACTLY ONE/i.test(en));

  if (getQuizThemeCampaign(theme)) {
    check('WC prompt references World Cup 2026', /World Cup 2026/i.test(en));
    check('WC prompt names 2026 hosts', /United States/i.test(en) && /Canada/i.test(en) && /Mexico/i.test(en));
    check('WC prompt forbids live scores', /live 2026 scores|live scores/i.test(en));
  }
}

async function runLiveChecks(): Promise<void> {
  if (!isGeminiQuizConfigured()) {
    console.log('\n=== Live generation SKIPPED (Gemini not configured) ===');
    return;
  }
  console.log('\n=== Live generation (best-effort; needs DB + network) ===');

  // Imported lazily so offline checks never depend on prisma being reachable.
  const { generateDailyQuizPack } = await import('../src/services/quiz-generator.service');
  const { buildQuizEntityDataset } = await import('../src/services/quiz-entity-dataset.service');

  try {
    const dataset = await buildQuizEntityDataset();
    if (!dataset.ok) {
      console.log(`[SKIP] Entity dataset insufficient: ${JSON.stringify(dataset.counts)}`);
      return;
    }
  } catch (err) {
    console.log(`[SKIP] Could not reach DB for dataset: ${err instanceof Error ? err.message : err}`);
    return;
  }

  for (const language of ['ar', 'en'] as QuizLanguage[]) {
    const started = Date.now();
    try {
      const pack = await generateDailyQuizPack(language, new Date());
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\n--- ${language.toUpperCase()} pack (${pack.questions.length} questions, ${secs}s) ---`);
      pack.questions.slice(0, 3).forEach((q, i) => {
        console.log(`${i + 1}. [${q.difficulty}/${q.type}] ${q.question}`);
        q.options.forEach((o) => console.log(`     ${o.key}) ${o.text}${o.key === q.correctKey ? '  <== correct' : ''}`));
      });
      check(`${language} pack has 15 questions`, pack.questions.length === 15);
      check(
        `${language} every question has exactly one valid correctKey`,
        pack.questions.every((q) => q.options.filter((o) => o.key === q.correctKey).length === 1),
      );
    } catch (err) {
      console.log(`[WARN] ${language} live generation failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function main(): Promise<void> {
  runOfflineChecks();

  if (!process.argv.includes('--no-live')) {
    await runLiveChecks().catch((err) =>
      console.log(`[WARN] Live checks errored: ${err instanceof Error ? err.message : err}`),
    );
  }

  console.log(`\n${failures === 0 ? 'ALL OFFLINE CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);

  try {
    const { closeRedis } = await import('../src/lib/redis');
    await closeRedis();
  } catch {
    // ignore
  }
  try {
    const prisma = (await import('../src/lib/prisma')).default;
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(failures === 0 ? 0 : 1);
}

void main();
