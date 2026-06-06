/**
 * Fetches live football data for Captain AI chat context injection.
 * Used before LLM calls when the user asks about players, stats, or standings.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { scoreEntityNameMatch } from './quiz-name-match.util';

const LEAGUE_ALIASES: Array<{ pattern: RegExp; id: number; label: string }> = [
  { pattern: /premier\s*league|بريمير|الدوري\s*الإنجليزي|الانجليزي/i, id: 39, label: 'Premier League' },
  { pattern: /la\s*liga|الدوري\s*الإسباني|الاسباني/i, id: 140, label: 'La Liga' },
  { pattern: /serie\s*a|الدوري\s*الإيطالي|الايطالي/i, id: 135, label: 'Serie A' },
  { pattern: /bundesliga|الدوري\s*الألماني|الالماني/i, id: 78, label: 'Bundesliga' },
  { pattern: /ligue\s*1|الدوري\s*الفرنسي/i, id: 61, label: 'Ligue 1' },
  { pattern: /champions\s*league|دوري\s*الأبطال|ابطال\s*اوروبا/i, id: 2, label: 'UEFA Champions League' },
  { pattern: /saudi\s*pro|الدوري\s*السعودي|روشن/i, id: 307, label: 'Saudi Pro League' },
  { pattern: /egyptian\s*premier|الدوري\s*المصري/i, id: 233, label: 'Egyptian Premier League' },
];

function isPlayerQuery(message: string): boolean {
  return /player|لاعب|إحصائيات|احصائيات|أهداف|اهداف|goals?|assists?|stats?|trophies|جوائز|ألقاب|القاب|top\s*scorer|هداف|who\s+is|من\s+هو|مين\s+هو/i.test(
    message,
  );
}

function isStandingsQuery(message: string): boolean {
  return /standings?|table|ترتيب|جدول|classification|league\s*table|top\s*\d+/i.test(message);
}

function extractNameCandidates(message: string): string[] {
  const out = new Set<string>();

  for (const m of message.matchAll(/["'«]([^"'»]{3,48})["'»]/g)) {
    out.add(m[1].trim());
  }

  for (const m of message.matchAll(/\b([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ'.-]+){1,3})\b/g)) {
    out.add(m[1].trim());
  }

  for (const m of message.matchAll(
    /(?:لاعب|إحصائيات|أهداف|معلومات\s+عن|stats?\s+(?:for|of)|about|tell\s+me\s+about)\s+([^\n?.!،؟]{3,48})/gi,
  )) {
    const cleaned = m[1].replace(/\s+(goals|stats|career|season).*$/i, '').trim();
    if (cleaned.length >= 3) out.add(cleaned);
  }

  return Array.from(out)
    .map((n) => n.replace(/[؟?!.,،]+$/g, '').trim())
    .filter((n) => n.length >= 3 && n.split(/\s+/).length <= 5)
    .slice(0, 3);
}

function detectLeague(message: string): { id: number; label: string } | null {
  for (const entry of LEAGUE_ALIASES) {
    if (entry.pattern.test(message)) {
      return { id: entry.id, label: entry.label };
    }
  }
  return null;
}

function pickBestPlayerMatch(name: string, results: any[]): any | null {
  let best: any | null = null;
  let bestScore = 0;
  for (const row of results ?? []) {
    const player = row?.player;
    if (!player?.id) continue;
    const score = scoreEntityNameMatch(name, player.name ?? '');
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 0.72 ? best : null;
}

function formatPlayerBlock(name: string, row: any): string {
  const player = row.player ?? {};
  const stats = row.statistics?.[0] ?? {};
  const team = stats.team?.name ?? '—';
  const league = stats.league?.name ?? '—';
  const games = stats.games ?? {};
  const goals = stats.goals ?? {};
  const cards = stats.cards ?? {};
  const passes = stats.passes ?? {};

  const lines = [
    `Player: ${player.name ?? name}`,
    `Age: ${player.age ?? '—'} | Nationality: ${player.nationality ?? '—'}`,
    `Position: ${games.position ?? '—'} | Team: ${team} | League: ${league}`,
    `Appearances: ${games.appearences ?? games.appearances ?? 0} | Minutes: ${games.minutes ?? 0}`,
    `Goals: ${goals.total ?? 0} (home ${goals.home ?? 0}, away ${goals.away ?? 0})`,
    `Assists: ${goals.assists ?? 0}`,
    `Cards: Y ${cards.yellow ?? 0} / R ${cards.red ?? 0}`,
  ];

  if (passes.total != null) {
    lines.push(`Passes: ${passes.total} (accuracy ${passes.accuracy ?? '—'}%)`);
  }
  if (games.rating) {
    lines.push(`Rating: ${games.rating}`);
  }

  return lines.join('\n');
}

async function fetchPlayerContext(name: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;
  try {
    const results = await footballService.searchPlayers(name);
    const match = pickBestPlayerMatch(name, results);
    if (!match) return null;

    const playerId = match.player.id;
    const detailed = await footballService.getPlayerStatistics(playerId);
    const row = detailed?.[0] ?? match;
    return formatPlayerBlock(name, row);
  } catch (err) {
    logger.warn('[ChatFootball] player lookup failed:', err);
    return null;
  }
}

async function fetchStandingsContext(message: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;
  const league = detectLeague(message);
  if (!league) return null;

  try {
    const { flat } = await footballService.getStandingsParsed(league.id);
    const top = (flat ?? []).slice(0, 12);
    if (!top.length) return null;

    const rows = top.map((row: any, i: number) => {
      const t = row.team?.name ?? '—';
      const pts = row.points ?? '—';
      const played = row.all?.played ?? '—';
      const gd = row.goalsDiff ?? '—';
      return `${i + 1}. ${t} — P${played} GD${gd} Pts ${pts}`;
    });

    return `${league.label} standings (top ${rows.length}):\n${rows.join('\n')}`;
  } catch (err) {
    logger.warn('[ChatFootball] standings lookup failed:', err);
    return null;
  }
}

export interface FootballChatContext {
  block: string;
  usedApi: boolean;
}

/**
 * Build optional live-data context for the user's message.
 * Returns null when no football API lookup applies.
 */
export async function buildFootballChatContext(
  message: string,
): Promise<FootballChatContext | null> {
  if (!footballService.isConfigured()) return null;

  const blocks: string[] = [];
  let usedApi = false;

  if (isPlayerQuery(message)) {
    const names = extractNameCandidates(message);
    for (const name of names) {
      const block = await fetchPlayerContext(name);
      if (block) {
        blocks.push(block);
        usedApi = true;
      }
    }
  }

  if (isStandingsQuery(message)) {
    const block = await fetchStandingsContext(message);
    if (block) {
      blocks.push(block);
      usedApi = true;
    }
  }

  if (blocks.length === 0) return null;

  const header =
    'LIVE FOOTBALL API DATA (authoritative — use these numbers in your answer; do not invent stats):';
  return {
    block: `${header}\n\n${blocks.join('\n\n---\n\n')}`,
    usedApi: true,
  };
}

export function shouldUsePrimaryModel(
  lengthMode: 'short' | 'medium' | 'detailed',
  hasFootballContext: boolean,
): boolean {
  if (hasFootballContext) return true;
  if (lengthMode === 'detailed') return true;
  return false;
}
