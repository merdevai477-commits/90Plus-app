/**
 * Throwaway verification for the CHAT screen 365Scores integration.
 *
 * Run: npx tsx scripts/verify-chat-365.ts
 *
 * 1. Offline (deterministic) — intent classifiers for player + today-matches.
 * 2. Online (graceful) — fetch365PlayerChatContext + buildFootballChatContext.
 *    Network/DB/env failures are caught and reported, never thrown.
 */

import 'dotenv/config';
import {
  buildFootballChatContext,
  detectPlayerInfoQuery,
  isTodayFootballScopeQuery,
} from '../src/services/chat-football-tools.service';
import { fetch365PlayerChatContext } from '../src/services/chat-365-player-context.service';
import type { MessageLanguage } from '../src/utils/message-language.util';

function hr(title: string): void {
  console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`);
}

function snippet(text: string | null | undefined, max = 500): string {
  if (!text) return '(null)';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ─── 1. Offline classifier checks (no network) ───────────────────────────────
function offlineChecks(): void {
  hr('1. OFFLINE INTENT CLASSIFIERS (deterministic)');

  const todayCases: Array<[string, boolean]> = [
    ['إيه أهم مباريات النهارده؟', true],
    ['اهم مباريات النهاردة', true],
    ['مباريات اليوم', true],
    ["today's matches", true],
    ['important matches today', true],
    ['what matches are on', true],
    ['مين هو مصطفى محمد؟', false],
    ['كام هدف سجل محمد صلاح؟', false],
  ];

  console.log('isTodayFootballScopeQuery:');
  let pass = 0;
  for (const [msg, expected] of todayCases) {
    const got = isTodayFootballScopeQuery(msg);
    const ok = got === expected;
    if (ok) pass++;
    console.log(`  ${ok ? '✅' : '❌'} "${msg}" → ${got} (expected ${expected})`);
  }
  console.log(`  → ${pass}/${todayCases.length} passed`);

  console.log('\ndetectPlayerInfoQuery:');
  const playerCases = [
    'مين هو مصطفى محمد؟',
    'كام هدف سجل محمد صلاح الموسم ده؟',
    'Who is Mohamed Salah?',
    'How many Champions League titles has Vinicius won?',
    'إيه أهم مباريات النهارده؟', // should be null (today-scope, not a player)
  ];
  for (const msg of playerCases) {
    const got = detectPlayerInfoQuery(msg);
    console.log(`  "${msg}" → ${got ? JSON.stringify(got) : 'null'}`);
  }
}

// ─── 2. Online 365 lookup (graceful) ─────────────────────────────────────────
async function online365(name: string, lang: MessageLanguage): Promise<void> {
  try {
    const res = await fetch365PlayerChatContext(name, lang);
    if (!res) {
      console.log(`  "${name}" [${lang}] → null (no 365 result — API-Football fallback would run)`);
      return;
    }
    console.log(`  "${name}" [${lang}] → athleteId=${res.athleteId} name="${res.displayName}"`);
    console.log(`    block:\n${snippet(res.block, 400).replace(/^/gm, '      ')}`);
  } catch (err) {
    console.log(`  "${name}" [${lang}] → ERROR ${(err as Error)?.message ?? err}`);
  }
}

// ─── 3. Online full context builder (graceful) ───────────────────────────────
async function onlineContext(msg: string, lang: MessageLanguage): Promise<void> {
  try {
    const ctx = await buildFootballChatContext(msg, { language: lang });
    if (!ctx) {
      console.log(`  "${msg}" [${lang}] → null context`);
      return;
    }
    console.log(
      `  "${msg}" [${lang}] → usedApi=${ctx.usedApi} cacheable=${ctx.cacheable} ` +
        `sources=[${ctx.sources?.join(',') ?? ''}] ` +
        `playerMeta=${ctx.playerMeta ? JSON.stringify(ctx.playerMeta) : 'none'} ` +
        `playerApiContext=${ctx.playerApiContext ? 'yes' : 'no'}`,
    );
    console.log(`    block:\n${snippet(ctx.block, 500).replace(/^/gm, '      ')}`);
  } catch (err) {
    console.log(`  "${msg}" [${lang}] → ERROR ${(err as Error)?.message ?? err}`);
  }
}

async function main(): Promise<void> {
  offlineChecks();

  hr('2. ONLINE fetch365PlayerChatContext (graceful on failure)');
  await online365('مصطفى محمد', 'ar');
  await online365('Mohamed Salah', 'en');
  await online365('ThisPlayerDoesNotExist12345', 'en'); // expect null

  hr('3. ONLINE buildFootballChatContext (graceful on failure)');
  await onlineContext('مين هو مصطفى محمد؟', 'ar');
  await onlineContext('Who is Mohamed Salah and his stats?', 'en');
  await onlineContext('إيه أهم مباريات النهارده؟', 'ar');
  await onlineContext("what are today's matches", 'en');

  hr('DONE');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal (unexpected):', err);
    process.exit(1);
  });
