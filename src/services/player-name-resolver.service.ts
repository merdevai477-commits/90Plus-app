/**
 * Resolves a raw (Arabic or English) player name to the English name that
 * API-Football expects, plus a known apiPlayerId when available.
 *
 * Resolution order:
 *   1. Exact match on canonical englishName / arabicName.
 *   2. Normalized match (diacritics stripped via normalizedName column).
 *   3. Alias match (normalized alias keys).
 *   4. Fuzzy match (scoreEntityNameMatch on normalized strings).
 *   5. Raw passthrough — caller falls back to API search.
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

export type ResolveMethod = 'exact' | 'normalized' | 'alias' | 'fuzzy' | 'raw';

export interface ResolvedPlayer {
  english: string;
  arabic?: string;
  apiPlayerId?: number;
  resolvedBy: ResolveMethod;
  confidenceScore: number;
  /** @deprecated Prefer resolvedBy — kept for existing fast-path checks. */
  source: 'mapping' | 'fuzzy' | 'raw';
}

interface SeedMapping {
  arabicName: string;
  englishName: string;
  aliases: string[];
  apiPlayerId: number;
}

export interface CachedMapping {
  arabicName: string;
  englishName: string;
  apiPlayerId: number;
  normalizedName: string;
  normalizedAliasKeys: string[];
}

const EXACT_CONFIDENCE = 1;
const NORMALIZED_CONFIDENCE = 0.98;
const ALIAS_CONFIDENCE = 0.95;
const EXACT_MATCH_MIN_LEN = 2;
const FUZZY_THRESHOLD = 0.82;

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
    apiPlayerId: 9,
  },
  {
    arabicName: 'كريم بنزيمة',
    englishName: 'Karim Benzema',
    aliases: ['بنزيمة', 'بنزيما', 'Benzema', 'Karim Benzema'],
    apiPlayerId: 759,
  },
  {
    arabicName: 'كيليان مبابي',
    englishName: 'Kylian Mbappé',
    aliases: ['مبابي', 'امبابي', 'Mbappe', 'Mbappé', 'Kylian Mbappe', 'Kylian Mbappé'],
    apiPlayerId: 278,
  },
  {
    arabicName: 'ديزيري دويه',
    englishName: 'Désiré Doué',
    aliases: ['دويه', 'Desire Doue', 'Désiré Doué', 'Doue', 'Doué'],
    apiPlayerId: 343027,
  },
  {
    arabicName: 'جواو فيليكس',
    englishName: 'João Félix',
    aliases: ['فيليكس', 'Joao Felix', 'João Félix', 'Felix', 'Félix'],
    apiPlayerId: 583,
  },
  {
    arabicName: 'أنخيل دي ماريا',
    englishName: 'Ángel Di María',
    aliases: ['دي ماريا', 'Angel Di Maria', 'Ángel Di María', 'Di Maria', 'Di María'],
    apiPlayerId: 266,
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
    apiPlayerId: 762,
  },
  {
    arabicName: 'جود بيلينغهام',
    englishName: 'Jude Bellingham',
    aliases: ['بيلينغهام', 'بيلنغهام', 'بيلينجهام', 'Bellingham', 'Jude Bellingham'],
    apiPlayerId: 129718,
  },
  {
    arabicName: 'لامين يامال',
    englishName: 'Lamine Yamal',
    aliases: ['يامال', 'لامين يامال', 'Yamal', 'Lamine Yamal'],
    apiPlayerId: 386828,
  },
  {
    arabicName: 'روبرت ليفاندوفسكي',
    englishName: 'Robert Lewandowski',
    aliases: ['ليفاندوفسكي', 'ليفاندوسكي', 'ليفا', 'Lewandowski', 'Robert Lewandowski'],
    apiPlayerId: 521,
  },
  {
    arabicName: 'كيفين دي بروين',
    englishName: 'Kevin De Bruyne',
    aliases: ['دي بروين', 'دي بروينه', 'De Bruyne', 'KDB', 'Kevin De Bruyne'],
    apiPlayerId: 629,
  },
  {
    arabicName: 'فيل فودن',
    englishName: 'Phil Foden',
    aliases: ['فودن', 'فودين', 'Foden', 'Phil Foden'],
    apiPlayerId: 631,
  },
  {
    arabicName: 'رودري',
    englishName: 'Rodri',
    aliases: ['رودري', 'Rodri', 'Rodrigo Hernandez', 'Rodrigo Hernández'],
    apiPlayerId: 44,
  },
];

let mappingCache: CachedMapping[] | null = null;
let mappingCacheLoadedAt = 0;
const MAPPING_CACHE_TTL_MS = 10 * 60_000;
let seedAttempted = false;

export function buildNormalizedAliasKeys(
  englishName: string,
  aliases: string[],
): string[] {
  const canonical = normalizeName(englishName);
  const keys = new Set<string>();
  for (const raw of aliases) {
    const norm = normalizeName(raw);
    if (norm && norm !== canonical) keys.add(norm);
  }
  return Array.from(keys);
}

export function toCachedMapping(row: {
  arabicName: string;
  englishName: string;
  aliases: string[];
  apiPlayerId: number;
  normalizedName?: string | null;
}): CachedMapping {
  const normalizedName = row.normalizedName?.trim()
    ? row.normalizedName
    : normalizeName(row.englishName);
  return {
    arabicName: row.arabicName,
    englishName: row.englishName,
    apiPlayerId: row.apiPlayerId,
    normalizedName,
    normalizedAliasKeys: buildNormalizedAliasKeys(row.englishName, row.aliases),
  };
}

export function resolveMethodToSource(
  resolvedBy: ResolveMethod,
): ResolvedPlayer['source'] {
  if (resolvedBy === 'fuzzy') return 'fuzzy';
  if (resolvedBy === 'raw') return 'raw';
  return 'mapping';
}

export function matchPlayerMapping(
  trimmed: string,
  normalizedInput: string,
  mapping: CachedMapping,
): { resolvedBy: Exclude<ResolveMethod, 'fuzzy' | 'raw'>; confidenceScore: number } | null {
  const trimmedLower = trimmed.toLowerCase();
  const englishLower = mapping.englishName.toLowerCase();

  if (trimmedLower === englishLower || trimmed === mapping.arabicName) {
    return { resolvedBy: 'exact', confidenceScore: EXACT_CONFIDENCE };
  }

  if (normalizedInput === mapping.normalizedName) {
    return { resolvedBy: 'normalized', confidenceScore: NORMALIZED_CONFIDENCE };
  }

  if (mapping.normalizedAliasKeys.includes(normalizedInput)) {
    return { resolvedBy: 'alias', confidenceScore: ALIAS_CONFIDENCE };
  }

  return null;
}

function toResolvedPlayer(
  mapping: CachedMapping,
  resolvedBy: Exclude<ResolveMethod, 'raw'>,
  confidenceScore: number,
): ResolvedPlayer {
  return {
    english: mapping.englishName,
    arabic: mapping.arabicName,
    apiPlayerId: mapping.apiPlayerId,
    resolvedBy,
    confidenceScore,
    source: resolveMethodToSource(resolvedBy),
  };
}

/**
 * Idempotent: upsert the common seed mappings. Safe to call repeatedly
 * (keyed on apiPlayerId @unique). Runs once lazily if the table is empty so
 * production works without a separate seed step.
 */
export async function seedCommonPlayerMappings(): Promise<void> {
  try {
    const seedNames = COMMON_PLAYER_MAPPINGS.map((m) => m.englishName);
    const seedIds = COMMON_PLAYER_MAPPINGS.map((m) => m.apiPlayerId);
    await prisma.playerNameMapping.deleteMany({
      where: {
        englishName: { in: seedNames },
        apiPlayerId: { notIn: seedIds },
      },
    });
  } catch {
    // non-fatal
  }

  for (const m of COMMON_PLAYER_MAPPINGS) {
    const normalizedName = normalizeName(m.englishName);
    try {
      await prisma.playerNameMapping.upsert({
        where: { apiPlayerId: m.apiPlayerId },
        create: {
          arabicName: m.arabicName,
          englishName: m.englishName,
          normalizedName,
          aliases: m.aliases,
          apiPlayerId: m.apiPlayerId,
        },
        update: {
          arabicName: m.arabicName,
          englishName: m.englishName,
          normalizedName,
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

  // Backfill normalizedName for learned rows missing the column value.
  try {
    const stale = await prisma.playerNameMapping.findMany({
      where: { normalizedName: '' },
      select: { id: true, englishName: true },
    });
    for (const row of stale) {
      await prisma.playerNameMapping.update({
        where: { id: row.id },
        data: { normalizedName: normalizeName(row.englishName) },
      });
    }
  } catch {
    // non-fatal
  }
}

async function loadMappings(): Promise<CachedMapping[]> {
  const now = Date.now();
  if (mappingCache && now - mappingCacheLoadedAt < MAPPING_CACHE_TTL_MS) {
    return mappingCache;
  }

  try {
    let rows = await prisma.playerNameMapping.findMany();

    if (rows.length === 0 && !seedAttempted) {
      seedAttempted = true;
      await seedCommonPlayerMappings();
      rows = await prisma.playerNameMapping.findMany();
    }

    mappingCache = rows.map((r) => toCachedMapping(r));
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

/**
 * Resolve a raw player name (Arabic or English) to an English name + optional
 * apiPlayerId. Returns null only when the input clearly isn't a usable name.
 */
export async function resolvePlayerName(raw: string): Promise<ResolvedPlayer | null> {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length < EXACT_MATCH_MIN_LEN) return null;

  const normalizedInput = normalizeName(trimmed);
  if (!normalizedInput) {
    return containsArabicScript(trimmed)
      ? null
      : { english: trimmed, resolvedBy: 'raw', confidenceScore: 0, source: 'raw' };
  }

  const mappings = await loadMappings();

  for (const m of mappings) {
    const hit = matchPlayerMapping(trimmed, normalizedInput, m);
    if (hit) {
      logger.info(
        `[Resolve] "${trimmed}" -> ${hit.resolvedBy} -> ${m.englishName} (id ${m.apiPlayerId}, confidence ${hit.confidenceScore.toFixed(2)})`,
      );
      return toResolvedPlayer(m, hit.resolvedBy, hit.confidenceScore);
    }
  }

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
    logger.info(
      `[Resolve] "${trimmed}" -> fuzzy -> ${best.englishName} (id ${best.apiPlayerId}, confidence ${bestScore.toFixed(2)})`,
    );
    return {
      english: best.englishName,
      arabic: best.arabicName,
      apiPlayerId: best.apiPlayerId,
      resolvedBy: 'fuzzy',
      confidenceScore: bestScore,
      source: 'fuzzy',
    };
  }

  logger.info(
    `[Resolve] "${trimmed}" -> raw (no mapping, bestScore ${bestScore.toFixed(2)})`,
  );

  return { english: trimmed, resolvedBy: 'raw', confidenceScore: bestScore, source: 'raw' };
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
  const normalizedName = normalizeName(englishName);

  try {
    await prisma.playerNameMapping.upsert({
      where: { apiPlayerId },
      create: { arabicName, englishName, normalizedName, aliases, apiPlayerId },
      update: {
        englishName,
        normalizedName,
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
