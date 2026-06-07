/**
 * Resolves a raw (Arabic or English) player name to the English name that
 * API-Football expects, plus a known apiPlayerId when available.
 *
 * Resolution order:
 *   1. Exact / alias match against PlayerNameMapping (normalized, diacritics
 *      stripped) — covers seeded common names instantly.
 *   2. Fuzzy match (scoreEntityNameMatch) for typos and partial names.
 *   3. null — caller falls back to API search + normal chat flow.
 *
 * The map self-learns: call `learnPlayerMapping()` after a successful API
 * resolution to upsert the discovered apiPlayerId for instant future lookups.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  containsArabicScript,
  normalizeName,
  scoreEntityNameMatch,
} from './quiz-name-match.util';

export interface ResolvedPlayer {
  english: string;
  arabic?: string;
  apiPlayerId?: number;
  /** "mapping" = exact/alias hit, "fuzzy" = approximate, "raw" = passthrough. */
  source: 'mapping' | 'fuzzy' | 'raw';
}

interface SeedMapping {
  arabicName: string;
  englishName: string;
  aliases: string[];
  apiPlayerId: number;
}

/**
 * Seed list of common players. apiPlayerId values are API-Football player IDs.
 * Aliases include Arabic spelling variants + common English short forms so the
 * normalized matcher catches typos like صلاح / صلح / Salah / salah.
 */
export const COMMON_PLAYER_MAPPINGS: SeedMapping[] = [
  {
    arabicName: 'محمد صلاح',
    englishName: 'Mohamed Salah',
    aliases: ['صلاح', 'صلح', 'مو صلاح', 'Salah', 'Mo Salah', 'Mohamed Salah'],
    apiPlayerId: 306,
  },
  {
    arabicName: 'أشرف حكيمي',
    englishName: 'Achraf Hakimi',
    aliases: ['حكيمي', 'اشرف حكيمي', 'Hakimi', 'Achraf Hakimi'],
    apiPlayerId: 22197,
  },
  {
    arabicName: 'كريم بنزيمة',
    englishName: 'Karim Benzema',
    aliases: ['بنزيمة', 'بنزيما', 'Benzema', 'Karim Benzema'],
    apiPlayerId: 762,
  },
  {
    arabicName: 'كيليان مبابي',
    englishName: 'Kylian Mbappe',
    aliases: ['مبابي', 'امبابي', 'Mbappe', 'Mbappé', 'Kylian Mbappe'],
    apiPlayerId: 278,
  },
  {
    arabicName: 'كريستيانو رونالدو',
    englishName: 'Cristiano Ronaldo',
    aliases: ['رونالدو', 'كريستيانو', 'Ronaldo', 'CR7', 'Cristiano Ronaldo'],
    apiPlayerId: 874,
  },
  {
    arabicName: 'ليونيل ميسي',
    englishName: 'Lionel Messi',
    aliases: ['ميسي', 'ليو ميسي', 'Messi', 'Leo Messi', 'Lionel Messi'],
    apiPlayerId: 154,
  },
  {
    arabicName: 'إيرلينج هالاند',
    englishName: 'Erling Haaland',
    aliases: ['هالاند', 'هولاند', 'Haaland', 'Erling Haaland'],
    apiPlayerId: 1100,
  },
  {
    arabicName: 'فينيسيوس جونيور',
    englishName: 'Vinicius Junior',
    aliases: ['فينيسيوس', 'فينيسوس', 'Vinicius', 'Vini Jr', 'Vinicius Junior'],
    apiPlayerId: 2295,
  },
];

interface CachedMapping {
  arabicName: string;
  englishName: string;
  apiPlayerId: number;
  /** Normalized alias keys for matching. */
  normalizedKeys: string[];
}

let mappingCache: CachedMapping[] | null = null;
let mappingCacheLoadedAt = 0;
const MAPPING_CACHE_TTL_MS = 10 * 60_000;
let seedAttempted = false;

function buildNormalizedKeys(
  arabicName: string,
  englishName: string,
  aliases: string[],
): string[] {
  const keys = new Set<string>();
  for (const raw of [arabicName, englishName, ...aliases]) {
    const norm = normalizeName(raw);
    if (norm) keys.add(norm);
  }
  return Array.from(keys);
}

/**
 * Idempotent: upsert the common seed mappings. Safe to call repeatedly
 * (keyed on apiPlayerId @unique). Runs once lazily if the table is empty so
 * production works without a separate seed step.
 */
export async function seedCommonPlayerMappings(): Promise<void> {
  for (const m of COMMON_PLAYER_MAPPINGS) {
    try {
      await prisma.playerNameMapping.upsert({
        where: { apiPlayerId: m.apiPlayerId },
        create: {
          arabicName: m.arabicName,
          englishName: m.englishName,
          aliases: m.aliases,
          apiPlayerId: m.apiPlayerId,
        },
        update: {
          arabicName: m.arabicName,
          englishName: m.englishName,
          aliases: m.aliases,
        },
      });
    } catch (err) {
      logger.warn(
        `[PlayerResolver] seed upsert failed for ${m.englishName}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

async function loadMappings(): Promise<CachedMapping[]> {
  const now = Date.now();
  if (mappingCache && now - mappingCacheLoadedAt < MAPPING_CACHE_TTL_MS) {
    return mappingCache;
  }

  try {
    let rows = await prisma.playerNameMapping.findMany();

    // Lazy one-time seed if the table is empty (covers prod where seed.ts
    // is never run). Guarded so we only attempt it once per process.
    if (rows.length === 0 && !seedAttempted) {
      seedAttempted = true;
      await seedCommonPlayerMappings();
      rows = await prisma.playerNameMapping.findMany();
    }

    mappingCache = rows.map((r) => ({
      arabicName: r.arabicName,
      englishName: r.englishName,
      apiPlayerId: r.apiPlayerId,
      normalizedKeys: buildNormalizedKeys(r.arabicName, r.englishName, r.aliases),
    }));
    mappingCacheLoadedAt = now;
    return mappingCache;
  } catch (err) {
    logger.warn(
      '[PlayerResolver] loadMappings failed:',
      err instanceof Error ? err.message : err,
    );
    return mappingCache ?? [];
  }
}

/** Invalidate the in-memory mapping cache (after a learn/upsert). */
export function invalidateMappingCache(): void {
  mappingCache = null;
  mappingCacheLoadedAt = 0;
}

const EXACT_MATCH_MIN_LEN = 2;
const FUZZY_THRESHOLD = 0.82;

/**
 * Resolve a raw player name (Arabic or English) to an English name + optional
 * apiPlayerId. Returns null only when the input clearly isn't a usable name.
 */
export async function resolvePlayerName(raw: string): Promise<ResolvedPlayer | null> {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length < EXACT_MATCH_MIN_LEN) return null;

  const normalizedInput = normalizeName(trimmed);
  if (!normalizedInput) {
    // Non-alphanumeric junk — but if it's Latin, still let the caller search.
    return containsArabicScript(trimmed) ? null : { english: trimmed, source: 'raw' };
  }

  const mappings = await loadMappings();

  // 1. Exact / alias match (normalized).
  for (const m of mappings) {
    if (m.normalizedKeys.includes(normalizedInput)) {
      return {
        english: m.englishName,
        arabic: m.arabicName,
        apiPlayerId: m.apiPlayerId,
        source: 'mapping',
      };
    }
  }

  // 2. Fuzzy match (typos / partial names). Score against each known name.
  let best: CachedMapping | null = null;
  let bestScore = 0;
  for (const m of mappings) {
    const score = Math.max(
      scoreEntityNameMatch(trimmed, m.arabicName),
      scoreEntityNameMatch(trimmed, m.englishName),
    );
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best && bestScore >= FUZZY_THRESHOLD) {
    return {
      english: best.englishName,
      arabic: best.arabicName,
      apiPlayerId: best.apiPlayerId,
      source: 'fuzzy',
    };
  }

  // 3. Passthrough: Latin input goes to API search as-is. Arabic input we
  // couldn't map can't be searched on API-Football (Latin only) — return the
  // raw string anyway so the caller can attempt transliteration via search.
  return { english: trimmed, source: 'raw' };
}

/**
 * Self-learning: after a successful API resolution, persist the discovered
 * apiPlayerId so the next identical query resolves instantly from the map.
 */
export async function learnPlayerMapping(params: {
  rawQuery: string;
  englishName: string;
  apiPlayerId: number;
}): Promise<void> {
  const { rawQuery, englishName, apiPlayerId } = params;
  if (!apiPlayerId || !englishName?.trim()) return;

  const arabicName = containsArabicScript(rawQuery) ? rawQuery.trim() : englishName;
  const aliases = Array.from(
    new Set(
      [rawQuery.trim(), englishName.trim()].filter(
        (s) => s && s.toLowerCase() !== englishName.toLowerCase(),
      ),
    ),
  );

  try {
    await prisma.playerNameMapping.upsert({
      where: { apiPlayerId },
      create: { arabicName, englishName, aliases, apiPlayerId },
      update: {
        englishName,
        // Append new aliases without clobbering existing ones (deduped on read).
        aliases: { push: aliases },
      },
    });
    invalidateMappingCache();
  } catch (err) {
    logger.warn(
      '[PlayerResolver] learnPlayerMapping failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
