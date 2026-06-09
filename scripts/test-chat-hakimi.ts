/**
 * Test harness: "حكيمي جاب كام دوري أبطال؟" — same path as Captain AI chat.
 *
 * Usage:
 *   npm run test:chat-hakimi
 *   npx ts-node scripts/test-chat-hakimi.ts "حكيمي جاب كام دوري أبطال؟"
 *
 * Requires FOOTBALL_API_KEY in .env (or environment).
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { footballService } from '../src/services/football.service';
import {
  resolvePlayerName,
  seedCommonPlayerMappings,
  invalidateMappingCache,
} from '../src/services/player-name-resolver.service';
import {
  buildFootballChatContext,
  fetchPlayerStatsRow,
} from '../src/services/chat-football-tools.service';

const DEFAULT_QUESTION = 'حكيمي جاب كام دوري أبطال؟';

const UCL_PATTERNS = [
  /champions\s*league/i,
  /uefa\s*champions/i,
  /دوري\s*الأبطال/i,
  /دوري\s*ابطال/i,
  /ابطال\s*اوروبا/i,
  /أبطال\s*أوروبا/i,
];

function isUclTrophy(name: string): boolean {
  return UCL_PATTERNS.some((p) => p.test(name));
}

async function fetchPlayerTrophies(playerId: number): Promise<any[]> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return [];

  const url = `https://v3.football.api-sports.io/trophies?player=${playerId}`;
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': key,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.warn(`   trophies HTTP ${res.status}`);
    return [];
  }

  const json = (await res.json()) as { response?: any[] };
  return json.response ?? [];
}

async function resolveHakimiPlayerId(): Promise<{
  raw: string;
  english: string;
  apiPlayerId: number | null;
}> {
  const raw = 'حكيمي';
  const resolved = await resolvePlayerName(raw);
  const english = resolved?.english ?? 'Achraf Hakimi';

  if (resolved?.apiPlayerId) {
    return { raw, english, apiPlayerId: resolved.apiPlayerId };
  }

  const results = await footballService.searchPlayers(english);
  const hit =
    results.find((r: any) =>
      /hakimi/i.test(r?.player?.name ?? ''),
    ) ?? results[0];

  return {
    raw,
    english: hit?.player?.name ?? english,
    apiPlayerId: hit?.player?.id ?? null,
  };
}

async function main() {
  const question = process.argv[2]?.trim() || DEFAULT_QUESTION;

  console.log('═'.repeat(64));
  console.log('Captain AI — Hakimi UCL test');
  console.log('═'.repeat(64));
  console.log(`Question     : "${question}"`);
  console.log(`API ready    : ${footballService.isConfigured()}`);
  console.log('═'.repeat(64));

  if (!footballService.isConfigured()) {
    console.error('\n❌ FOOTBALL_API_KEY missing — set it in .env');
    process.exit(1);
  }

  await seedCommonPlayerMappings();
  invalidateMappingCache();

  // ─── 1. What chat does before calling the LLM ─────────────────────────────
  console.log('\n▶ Step 1 — buildFootballChatContext (chat.routes.ts)');
  const t0 = Date.now();
  const ctx = await buildFootballChatContext(question);
  const elapsed = Date.now() - t0;

  if (!ctx) {
    console.log('   Result       : null (no football context injected)');
    console.log(
      '   Note         : chat would answer from model memory only (no API).',
    );
  } else {
    console.log(`   usedApi      : ${ctx.usedApi}`);
    console.log(`   cacheable    : ${ctx.cacheable}`);
    console.log(`   elapsed      : ${elapsed}ms`);
    console.log('\n   Injected block (this is what the LLM + API cooperation uses):');
    console.log('─'.repeat(64));
    console.log(ctx.block);
    console.log('─'.repeat(64));
    console.log(
      '\n   Note         : Step 1 = API data fed to the model before streaming.',
    );
  }

  // ─── 2. Player lookup (season stats — what chat injects today) ────────────
  console.log('\n▶ Step 2 — fetchPlayerStatsRow("حكيمي")');
  const statsRow = await fetchPlayerStatsRow('حكيمي');
  if (!statsRow) {
    console.log('   (no season stats block)');
  } else {
    console.log(`   apiPlayerId  : ${statsRow.apiPlayerId ?? '—'}`);
    console.log('─'.repeat(64));
    console.log(statsRow.aiResponse);
    console.log('─'.repeat(64));
    console.log(
      '   Note         : season stats ≠ trophy count (UCL titles not in this block).',
    );
  }

  // ─── 3. Direct trophies API (authoritative for UCL count) ─────────────────
  console.log('\n▶ Step 3 — API-Football /trophies?player=…');
  const player = await resolveHakimiPlayerId();
  console.log(`   resolved     : ${player.english} (id ${player.apiPlayerId ?? '—'})`);

  if (!player.apiPlayerId) {
    console.log('   ❌ Could not resolve Hakimi player id');
    return;
  }

  const trophies = await fetchPlayerTrophies(player.apiPlayerId);
  const ucl = trophies.filter((t) => isUclTrophy(String(t?.league ?? t?.name ?? '')));

  console.log(`   total trophies in API : ${trophies.length}`);
  console.log(`   Champions League wins : ${ucl.length}`);

  if (ucl.length > 0) {
    console.log('\n   UCL titles:');
    for (const t of ucl) {
      const league = t.league ?? t.name ?? '—';
      const season = t.season ?? t.year ?? '—';
      const place = t.place ?? '';
      console.log(`     • ${league} — ${season}${place ? ` (${place})` : ''}`);
    }
  } else if (trophies.length > 0) {
    console.log('\n   All trophies (no UCL label matched):');
    for (const t of trophies.slice(0, 15)) {
      console.log(`     • ${t.league ?? t.name ?? JSON.stringify(t)}`);
    }
    if (trophies.length > 15) console.log(`     … +${trophies.length - 15} more`);
  }

  console.log('\n▶ Expected chat answer (if trophies were wired in):');
  console.log(
    `   حكيمي (${player.english}) فاز بـ ${ucl.length} دوري أبطال أوروبا حسب API-Football.`,
  );
  console.log('═'.repeat(64));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ test-chat-hakimi failed:', err);
    await prisma.$disconnect();
    await closeRedis();
    process.exit(1);
  });
