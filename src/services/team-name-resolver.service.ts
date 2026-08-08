/**
 * Resolves a raw (Arabic or English) club/team name to an API-Football team id.
 *
 * Resolution order:
 *   1. Static alias dictionary (Arabic spellings + common abbreviations) — instant,
 *      no API quota spent. Seeded from the verified KNOWN_TEAM_IDS used elsewhere.
 *   2. Transliterate Arabic → Latin and call searchTeams (only when the search
 *      term is long enough to pass API-Football's >=3 alpha-numeric guard — this
 *      avoids the "PSG"/short-name failed-search storm).
 *   3. null — caller treats the team as unresolved (no invented data).
 *
 * Additive: brand new file. Nothing imports-and-changes here.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { footballMetrics } from '../utils/football-metrics';
import {
  normalizeName,
  transliterateArabicToLatin,
  containsArabicScript,
  scoreEntityNameMatch,
  foldArabic,
} from './quiz-name-match.util';

export interface ResolvedTeam {
  apiTeamId: number;
  englishName: string;
  /** "mapping" = alias dictionary hit, "search" = API search, "raw" = passthrough. */
  source: 'mapping' | 'search';
}

interface TeamAlias {
  englishName: string;
  apiTeamId: number;
  aliases: string[];
}

/**
 * Static dictionary of the most-queried clubs. apiTeamId values reuse the
 * verified KNOWN_TEAM_IDS from quiz-image-enricher.service.ts (same source of
 * truth) so a dictionary hit can never point at the wrong club.
 */
const TEAM_ALIASES: TeamAlias[] = [
  {
    englishName: 'Real Madrid',
    apiTeamId: 541,
    aliases: ['ريال مدريد', 'ريال', 'الريال', 'real madrid', 'real', 'madrid', 'rmcf'],
  },
  {
    englishName: 'Barcelona',
    apiTeamId: 529,
    aliases: ['برشلونة', 'برشلونه', 'البرسا', 'برسا', 'barcelona', 'barca', 'barça', 'fcb'],
  },
  {
    englishName: 'Atletico Madrid',
    apiTeamId: 530,
    aliases: ['اتلتيكو مدريد', 'أتلتيكو مدريد', 'اتلتيكو', 'atletico madrid', 'atletico', 'atleti'],
  },
  {
    englishName: 'Manchester City',
    apiTeamId: 50,
    aliases: ['مانشستر سيتي', 'مان سيتي', 'السيتي', 'manchester city', 'man city', 'mcfc', 'city'],
  },
  {
    englishName: 'Manchester United',
    apiTeamId: 33,
    aliases: [
      'مانشستر يونايتد',
      'مان يونايتد',
      'اليونايتد',
      'manchester united',
      'man united',
      'man utd',
      'mufc',
    ],
  },
  {
    englishName: 'Liverpool',
    apiTeamId: 40,
    aliases: ['ليفربول', 'الريدز', 'liverpool', 'lfc', 'the reds'],
  },
  {
    englishName: 'Arsenal',
    apiTeamId: 42,
    aliases: ['ارسنال', 'أرسنال', 'الارسنال', 'arsenal', 'afc', 'gunners'],
  },
  {
    englishName: 'Chelsea',
    apiTeamId: 49,
    aliases: ['تشيلسي', 'تشلسي', 'chelsea', 'cfc', 'blues'],
  },
  {
    englishName: 'Tottenham',
    apiTeamId: 47,
    aliases: ['توتنهام', 'توتنهم', 'tottenham', 'spurs', 'thfc'],
  },
  {
    englishName: 'Paris Saint Germain',
    apiTeamId: 85,
    aliases: ['باريس سان جيرمان', 'باريس', 'سان جيرمان', 'بي اس جي', 'psg', 'paris saint germain', 'paris', 'paris sg'],
  },
  {
    englishName: 'Bayern Munich',
    apiTeamId: 157,
    aliases: ['بايرن ميونخ', 'بايرن', 'البايرن', 'bayern munich', 'bayern munchen', 'bayern', 'fc bayern', 'fcb bayern'],
  },
  {
    englishName: 'Borussia Dortmund',
    apiTeamId: 165,
    aliases: ['بوروسيا دورتموند', 'دورتموند', 'borussia dortmund', 'dortmund', 'bvb'],
  },
  {
    englishName: 'Bayer Leverkusen',
    apiTeamId: 168,
    aliases: ['باير ليفركوزن', 'ليفركوزن', 'bayer leverkusen', 'leverkusen', 'bayer 04 leverkusen'],
  },
  {
    englishName: 'RB Leipzig',
    apiTeamId: 173,
    aliases: ['لايبزيغ', 'لايبزغ', 'rb leipzig', 'leipzig'],
  },
  {
    englishName: 'Juventus',
    apiTeamId: 496,
    aliases: ['يوفنتوس', 'اليوفي', 'يوفي', 'juventus', 'juve'],
  },
  {
    englishName: 'Inter',
    apiTeamId: 505,
    aliases: ['انتر ميلان', 'إنتر ميلان', 'انتر', 'إنتر', 'inter milan', 'inter', 'internazionale'],
  },
  {
    englishName: 'AC Milan',
    apiTeamId: 489,
    aliases: ['ميلان', 'الميلان', 'ايه سي ميلان', 'ac milan', 'milan'],
  },
  {
    englishName: 'Napoli',
    apiTeamId: 492,
    aliases: ['نابولي', 'napoli'],
  },
  {
    englishName: 'Al Ahly',
    apiTeamId: 1015,
    aliases: [
      'الأهلي',
      'الاهلي',
      'اهلي',
      'الأهلي المصري',
      'الاهلي المصري',
      'al ahly',
      'al-ahly',
      'ahly',
    ],
  },
  {
    englishName: 'Zamalek',
    apiTeamId: 1016,
    aliases: ['الزمالك', 'زمالك', 'zamalek'],
  },
];

/**
 * Arabic → English country names for national teams. API-Football stores the
 * national side under the country's English name (e.g. "Egypt"), so mapping the
 * Arabic query to English lets the normal team search resolve it — no fragile
 * hardcoded team ids. Keys are stored Arabic-folded for typo tolerance.
 */
const NATIONAL_TEAM_COUNTRIES: Array<[string, string]> = [
  ['مصر', 'Egypt'],
  ['السعوديه', 'Saudi Arabia'],
  ['المغرب', 'Morocco'],
  ['الجزائر', 'Algeria'],
  ['تونس', 'Tunisia'],
  ['العراق', 'Iraq'],
  ['الاردن', 'Jordan'],
  ['قطر', 'Qatar'],
  ['الامارات', 'United Arab Emirates'],
  ['الارجنتين', 'Argentina'],
  ['البرازيل', 'Brazil'],
  ['فرنسا', 'France'],
  ['اسبانيا', 'Spain'],
  ['البرتغال', 'Portugal'],
  ['المانيا', 'Germany'],
  ['انجلترا', 'England'],
  ['ايطاليا', 'Italy'],
  ['هولندا', 'Netherlands'],
  ['بلجيكا', 'Belgium'],
  ['كرواتيا', 'Croatia'],
  ['الاوروجواي', 'Uruguay'],
  ['المكسيك', 'Mexico'],
  ['امريكا', 'USA'],
  ['نيجيريا', 'Nigeria'],
  ['السنغال', 'Senegal'],
  ['اليابان', 'Japan'],
];

const NATIONAL_TEAM_WORD_RE = /منتخب|المنتخب|national\s*team|\bnational\b|\bnt\b/gi;

/**
 * If the query is a national team (has a "منتخب/national team" marker or is an
 * exact country name), return the English country name to search by. Returns
 * null for club queries so the normal path handles them.
 */
export function resolveNationalTeamEnglishName(rawName: string): string | null {
  const raw = rawName?.trim();
  if (!raw) return null;
  const hasNtWord = NATIONAL_TEAM_WORD_RE.test(raw);
  NATIONAL_TEAM_WORD_RE.lastIndex = 0;
  const cleaned = raw.replace(NATIONAL_TEAM_WORD_RE, ' ').replace(/\s+/g, ' ').trim();
  NATIONAL_TEAM_WORD_RE.lastIndex = 0;
  const norm = normalizeName(foldArabic(cleaned));
  if (!norm) return null;

  for (const [arabic, english] of NATIONAL_TEAM_COUNTRIES) {
    const arNorm = normalizeName(foldArabic(arabic));
    const enNorm = normalizeName(english);
    if (norm === arNorm || norm === enNorm) return english; // exact country name
    if (hasNtWord && (norm.includes(arNorm) || norm.includes(enNorm))) return english;
  }
  return null;
}

interface NormalizedTeamAlias {
  englishName: string;
  apiTeamId: number;
  normalizedKeys: string[];
}

let normalizedAliases: NormalizedTeamAlias[] | null = null;

function getNormalizedAliases(): NormalizedTeamAlias[] {
  if (normalizedAliases) return normalizedAliases;
  normalizedAliases = TEAM_ALIASES.map((t) => {
    const keys = new Set<string>();
    for (const raw of [t.englishName, ...t.aliases]) {
      const norm = normalizeName(raw);
      if (norm) keys.add(norm);
    }
    return { englishName: t.englishName, apiTeamId: t.apiTeamId, normalizedKeys: Array.from(keys) };
  });
  return normalizedAliases;
}

/**
 * Synchronous alias-dictionary lookup (no API, no quota). Returns a resolved
 * team only for a known alias/abbreviation/exact club name. Used for fast,
 * race-free precedence decisions (club vs player) in the chat context builder.
 */
export function resolveTeamFromDictionary(rawName: string): ResolvedTeam | null {
  const trimmed = rawName?.trim();
  if (!trimmed || trimmed.length < 2) return null;
  const normalizedInput = normalizeName(trimmed);
  if (!normalizedInput) return null;
  for (const t of getNormalizedAliases()) {
    if (t.normalizedKeys.includes(normalizedInput)) {
      return { apiTeamId: t.apiTeamId, englishName: t.englishName, source: 'mapping' };
    }
  }
  return null;
}

/**
 * Resolve a raw team/club name to an API-Football team id.
 * Records a team-resolver metric (resolved/unresolved) on every attempt.
 * Set `opts.allowSearch=false` to restrict to the alias dictionary (skips the
 * API search — avoids spending quota on names that aren't clubs).
 */
export async function resolveTeamId(
  rawName: string,
  opts?: { allowSearch?: boolean },
): Promise<ResolvedTeam | null> {
  const allowSearch = opts?.allowSearch !== false;
  const trimmed = rawName?.trim();
  if (!trimmed || trimmed.length < 2) {
    footballMetrics.recordTeamResolver(false);
    return null;
  }

  const normalizedInput = normalizeName(trimmed);
  const aliases = getNormalizedAliases();

  // 1. Exact / alias dictionary hit (covers PSG, برشلونة, مان سيتي, ...).
  if (normalizedInput) {
    for (const t of aliases) {
      if (t.normalizedKeys.includes(normalizedInput)) {
        logger.info(
          `[TeamResolve] "${trimmed}" -> mapping -> ${t.englishName} (id ${t.apiTeamId})`,
        );
        footballMetrics.recordTeamResolver(true);
        return { apiTeamId: t.apiTeamId, englishName: t.englishName, source: 'mapping' };
      }
    }
  }

  if (!allowSearch) {
    logger.info(`[TeamResolve] "${trimmed}" -> unresolved (dictionary-only)`);
    footballMetrics.recordTeamResolver(false);
    return null;
  }

  // 2. API search. National teams first: map "منتخب مصر"/"مصر" → "Egypt" so the
  //    search hits the country's national side (API stores it under the English
  //    country name) instead of transliterating to gibberish.
  const nationalTeam = resolveNationalTeamEnglishName(trimmed);
  //    Otherwise transliterate Arabic so Arabic-only names still get a Latin
  //    query. Only search when the term is >=3 latin chars — this guards the
  //    API's isValidSearch (Arabic/short terms would 0-result anyway).
  const searchTerm =
    nationalTeam ??
    (containsArabicScript(trimmed) ? transliterateArabicToLatin(trimmed) : trimmed);

  if (searchTerm.replace(/[^a-z0-9]/gi, '').length < 3) {
    logger.info(`[TeamResolve] "${trimmed}" -> unresolved (search term too short)`);
    footballMetrics.recordTeamResolver(false);
    return null;
  }

  try {
    const results = await footballService.searchTeams(searchTerm);
    let best: any = null;
    let bestScore = 0;
    for (const row of results ?? []) {
      const team = row?.team;
      if (!team?.id) continue;
      let score = Math.max(
        scoreEntityNameMatch(searchTerm, team.name ?? ''),
        scoreEntityNameMatch(trimmed, team.name ?? ''),
      );
      // For national-team queries, prefer the actual national side over any
      // club that happens to share the country name.
      if (nationalTeam) {
        if (team.national === true) score += 0.15;
        else score -= 0.2;
      }
      if (score > bestScore) {
        bestScore = score;
        best = team;
      }
    }
    if (best?.id && bestScore >= 0.6) {
      logger.info(
        `[TeamResolve] "${trimmed}" -> search -> ${best.name} (id ${best.id}, score ${bestScore.toFixed(2)})`,
      );
      footballMetrics.recordTeamResolver(true);
      return { apiTeamId: best.id, englishName: best.name ?? searchTerm, source: 'search' };
    }
  } catch (err) {
    logger.warn(
      '[TeamResolve] searchTeams failed:',
      err instanceof Error ? err.message : err,
    );
  }

  logger.info(`[TeamResolve] "${trimmed}" -> unresolved`);
  footballMetrics.recordTeamResolver(false);
  return null;
}
