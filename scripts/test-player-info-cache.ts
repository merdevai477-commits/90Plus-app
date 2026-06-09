/**
 * Test player_info cache — instant DB answers + API fingerprint refresh.
 *
 * Usage:
 *   npm run test:player-info-cache
 *   npx ts-node scripts/test-player-info-cache.ts "حكيمي جاب كام دوري أبطال؟"
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import {
  detectPlayerInfoQuery,
  buildFootballChatContext,
} from '../src/services/chat-football-tools.service';
import {
  resolvePlayerInfoAnswer,
  savePlayerInfoAnswer,
  fetchPlayerApiContext,
  hashApiContext,
} from '../src/services/player-info-cache.service';

const QUESTION = process.argv[2]?.trim() || 'حكيمي جاب كام دوري أبطال؟';
const LANG = /[\u0600-\u06FF]/.test(QUESTION) ? 'ar' : 'en';

const MOCK_ANSWER = `## دوري أبطال أوروبا — أشرف حكيمي

فاز **حكيمي** بدوري أبطال أوروبا مرتين مع ريال مدريد (2017/18 و2018/19 حسب بيانات API).

| الموسم | النادي | مباريات UCL | أهداف | أسيست |
|--------|--------|-------------|-------|-------|
| 2017/2018 | Real Madrid | 2 | 0 | 0 |

*(إجابة تجريبية للاختبار — سيتم استبدالها برد الموديل الحقيقي في الإنتاج)*`;

async function clearTestRow(playerName: string, queryType: string) {
  await prisma.playerInfo.deleteMany({
    where: {
      playerName: playerName.trim().toLowerCase(),
      queryType,
      language: LANG,
    },
  });
}

async function main() {
  console.log('═'.repeat(68));
  console.log('player_info cache test');
  console.log('═'.repeat(68));
  console.log(`Question : "${QUESTION}"`);
  console.log(`Language : ${LANG}`);

  const detected = detectPlayerInfoQuery(QUESTION);
  if (!detected) {
    console.error('\n❌ Question not detected as player_info query');
    process.exit(1);
  }
  console.log(`Detected : player="${detected.playerName}" type=${detected.queryType}`);

  const lookup = { ...detected, language: LANG };
  const playerKey = detected.playerName.trim().toLowerCase();

  // ─── Scenario A: cache MISS (first user ever) ─────────────────────────────
  console.log('\n▶ Scenario A — أول مرة (لا يوجد صف في player_info)');
  await clearTestRow(detected.playerName, detected.queryType);

  const miss = await resolvePlayerInfoAnswer(lookup);
  console.log(`   resolvePlayerInfoAnswer : ${miss ? 'HIT (unexpected)' : 'MISS ✓'}`);
  console.log('   → الشات يستدعي API + الموديل ثم يحفظ في player_info');

  const apiCtx = await fetchPlayerApiContext(detected.playerName, detected.queryType);
  if (!apiCtx) {
    console.error('   ❌ Could not fetch API context');
    process.exit(1);
  }
  console.log(`   API context length : ${apiCtx.context.length} chars`);
  console.log(`   API fingerprint    : ${hashApiContext(apiCtx.context).slice(0, 16)}…`);

  await savePlayerInfoAnswer({
    lookup,
    question: QUESTION,
    answer: MOCK_ANSWER,
    apiContext: apiCtx.context,
    usedModel: 'test-mock',
    apiPlayerId: apiCtx.apiPlayerId,
    displayName: apiCtx.displayName,
  });

  const row = await prisma.playerInfo.findUnique({
    where: {
      playerName_queryType_language: {
        playerName: playerKey,
        queryType: detected.queryType,
        language: LANG,
      },
    },
  });
  console.log(`   saved row answeredOn : ${row?.answeredOn?.toISOString() ?? '—'}`);
  console.log(`   expiresAt            : ${row?.expiresAt?.toISOString() ?? '—'}`);

  // ─── Scenario B: cache HIT (same user days later) ───────────────────────
  console.log('\n▶ Scenario B — بعد أيام (نفس اللاعب، بيانات API لم تتغير)');
  const t0 = Date.now();
  const hit = await resolvePlayerInfoAnswer(lookup);
  const elapsed = Date.now() - t0;

  if (!hit) {
    console.error('   ❌ Expected instant HIT');
    process.exit(1);
  }
  console.log(`   source   : ${hit.source}`);
  console.log(`   elapsed  : ${elapsed}ms (no LLM, no full chat API path)`);
  console.log(`   hits     : ${hit.hits}`);
  console.log(`   preview  : ${hit.answer.slice(0, 120).replace(/\n/g, ' ')}…`);

  // ─── Scenario C: API drift → force refresh ────────────────────────────────
  console.log('\n▶ Scenario C — API تغيّر (fingerprint مختلف) → يطلب تجديد');
  await prisma.playerInfo.update({
    where: {
      playerName_queryType_language: {
        playerName: playerKey,
        queryType: detected.queryType,
        language: LANG,
      },
    },
    data: {
      apiFingerprint: 'stale_fingerprint_on_purpose',
      refreshedAt: new Date(Date.now() - 48 * 60 * 60_000),
    },
  });

  const stale = await resolvePlayerInfoAnswer(lookup);
  console.log(
    `   resolvePlayerInfoAnswer : ${stale ? 'still HIT (unexpected)' : 'MISS → regenerate ✓'}`,
  );

  // ─── Scenario D: what chat injects on fresh path ────────────────────────
  console.log('\n▶ Scenario D — مسار الشات الكامل عند MISS (buildFootballChatContext)');
  const ctx = await buildFootballChatContext(QUESTION);
  console.log(`   usedApi  : ${ctx?.usedApi ?? false}`);
  console.log(`   block    : ${ctx?.block ? `${ctx.block.length} chars` : 'null'}`);

  console.log('\n═'.repeat(68));
  console.log('Done — player_info ready for production chat');
  console.log('═'.repeat(68));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ test-player-info-cache failed:', err);
    await prisma.$disconnect();
    await closeRedis();
    process.exit(1);
  });
