/**
 * Coach Lookup Service
 *
 * Fetches head coach / assistant coach data for both teams in a specific
 * 365Scores game.  Standalone service with its own resilient fetch wrapper,
 * explicit HTTP-status error handling, AbortController timeout (10 s), and
 * dual-layer Redis caching (fresh + stale-backup for 5xx fallback).
 *
 * Usage:
 *   import { coachLookupService } from './coach-lookup.service';
 *   const result = await coachLookupService.getMatchCoaches(gameId, matchupId, 'ar');
 */

import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';

// ─── Constants ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://webws.365scores.com/web';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.365scores.com/',
  Origin: 'https://www.365scores.com',
};

const FETCH_TIMEOUT_MS = 10_000;

/** Fresh cache lives 24 hours. */
const FRESH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Stale-backup cache lives 7 days (fallback when 5xx). */
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Public Interfaces ──────────────────────────────────────────────────────

export interface CoachInfo {
  teamId: number;
  teamName: string;
  coachAthleteId: number;
  coachName: string;
  coachImageUrl: string | null;
  role: 'head_coach' | 'assistant_coach';
  nationality?: string;
  bio?: string;
  stale?: boolean;
}

export interface CoachNotAvailable {
  teamId: number;
  teamName: string;
  status: 'LINEUPS_NOT_CONFIRMED' | 'COACH_NOT_LISTED';
}

export interface MatchCoachesResult {
  home: CoachInfo | CoachNotAvailable;
  away: CoachInfo | CoachNotAvailable;
}

// ─── Internal Types ─────────────────────────────────────────────────────────

/** A single member inside competitor.lineups.members */
interface LineupMember {
  id: number;
  status?: number;
  formation?: { id?: number; name?: string; shortName?: string };
  [key: string]: unknown;
}

/** A member inside game.members (top-level array) */
interface GameMember {
  id: number;
  athleteId?: number;
  competitorId?: number;
  name?: string;
  shortName?: string;
  imageVersion?: number;
  [key: string]: unknown;
}

interface Competitor {
  id: number;
  name: string;
  score?: number;
  lineups?: {
    status?: string;
    formation?: string;
    members?: LineupMember[];
  };
  [key: string]: unknown;
}

interface GamePayload {
  game?: {
    homeCompetitor?: Competitor;
    awayCompetitor?: Competitor;
    members?: GameMember[];
    [key: string]: unknown;
  };
}

interface AthletePayload {
  athletes?: Array<{
    id?: number;
    name?: string;
    shortName?: string;
    nationalityName?: string;
    shortBio?: string;
    imageVersion?: number;
    [key: string]: unknown;
  }>;
}

// ─── Custom Errors ──────────────────────────────────────────────────────────

export class Scores365HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly rateKey: string,
    message?: string,
  ) {
    super(message ?? `365Scores HTTP ${status} for ${rateKey}`);
    this.name = 'Scores365HttpError';
  }
}

// ─── Pure Helper (exported for unit testing) ────────────────────────────────

/**
 * Find the coach in a lineup members array.
 * Priority: formation.id === 16 (Head Coach) first in the ENTIRE array.
 * Fallback: formation.id === 17 (Assistant Coach) if 16 is not found anywhere.
 * Returns null if neither exists.
 */
export function findCoachInLineup(
  members: LineupMember[],
): { member: LineupMember; role: 'head_coach' | 'assistant_coach' } | null {
  const headCoach = members.find((m) => m.formation?.id === 16);
  if (headCoach) return { member: headCoach, role: 'head_coach' };

  const assistantCoach = members.find((m) => m.formation?.id === 17);
  if (assistantCoach) return { member: assistantCoach, role: 'assistant_coach' };

  return null;
}

// ─── Service Class ──────────────────────────────────────────────────────────

class CoachLookupService {
  /**
   * Main entry point: fetch coaches for both teams in a specific game.
   * Each team is processed independently — one team failing does not block the other.
   */
  async getMatchCoaches(
    gameId: number,
    matchupId: string,
    language?: string,
  ): Promise<MatchCoachesResult> {
    const langId = this.resolveLangId(language);

    // Step 1: Fetch game data
    const gameData = await this.fetchGameData(gameId, matchupId, langId);

    const homeCompetitor = gameData.game?.homeCompetitor;
    const awayCompetitor = gameData.game?.awayCompetitor;
    const allMembers = gameData.game?.members ?? [];

    // Step 2: Process each team independently
    const [home, away] = await Promise.all([
      this.processTeamCoach(homeCompetitor, allMembers, langId),
      this.processTeamCoach(awayCompetitor, allMembers, langId),
    ]);

    return { home, away };
  }

  // ─── Private: Per-team Coach Processing ─────────────────────────────────

  private async processTeamCoach(
    competitor: Competitor | undefined,
    allMembers: GameMember[],
    langId: number,
  ): Promise<CoachInfo | CoachNotAvailable> {
    const teamId = competitor?.id ?? 0;
    const teamName = competitor?.name ?? 'Unknown';

    // Case 1: No lineups at all, or empty members array
    const lineupMembers = competitor?.lineups?.members;
    if (!lineupMembers || lineupMembers.length === 0) {
      return { teamId, teamName, status: 'LINEUPS_NOT_CONFIRMED' };
    }

    // Case 2: Lineups exist, but no formation.id 16 or 17
    const coachResult = findCoachInLineup(lineupMembers);
    if (!coachResult) {
      return { teamId, teamName, status: 'COACH_NOT_LISTED' };
    }

    // Case 3: Found a coach entry — map to game.members for athleteId
    const gameMember = allMembers.find((m) => m.id === coachResult.member.id);
    if (!gameMember?.athleteId) {
      return { teamId, teamName, status: 'COACH_NOT_LISTED' };
    }

    // Step 3: Fetch athlete details (with cache + stale fallback)
    const athleteId = gameMember.athleteId;
    const athleteData = await this.fetchAthleteDetails(athleteId, langId, gameMember);

    return {
      teamId,
      teamName,
      coachAthleteId: athleteId,
      coachName: athleteData.name,
      coachImageUrl: athleteData.imageUrl,
      role: coachResult.role,
      nationality: athleteData.nationality,
      bio: athleteData.bio,
      ...(athleteData.stale ? { stale: true } : {}),
    };
  }

  // ─── Private: Fetch Game Data ───────────────────────────────────────────

  private async fetchGameData(
    gameId: number,
    matchupId: string,
    langId: number,
  ): Promise<GamePayload> {
    const params = this.buildParams(langId, {
      gameId: String(gameId),
      matchupId,
    });
    const url = `${BASE_URL}/game/?${params}`;

    const data = await this.resilientFetch<GamePayload>(url, `coach-game:${gameId}`);
    if (!data?.game) {
      throw new Error(`[CoachLookup] No game data returned for gameId=${gameId}`);
    }
    return data;
  }

  // ─── Private: Fetch Athlete Details with Dual Cache ─────────────────────

  private async fetchAthleteDetails(
    athleteId: number,
    langId: number,
    fallbackMember: GameMember,
  ): Promise<{
    name: string;
    imageUrl: string | null;
    nationality?: string;
    bio?: string;
    stale?: boolean;
  }> {
    const freshKey = `coach:athlete:${athleteId}:${langId}`;
    const staleKey = `coach:athlete:stale:${athleteId}:${langId}`;

    // 1. Try fresh cache
    const freshCached = await redisCacheService.get<{
      name: string;
      imageUrl: string | null;
      nationality?: string;
      bio?: string;
    }>(freshKey);
    if (freshCached) return freshCached;

    // 2. Fetch from 365Scores
    const params = this.buildParams(langId, {
      athletes: String(athleteId),
      fullDetails: 'true',
    });
    const url = `${BASE_URL}/athletes/?${params}`;

    try {
      const data = await this.resilientFetch<AthletePayload>(
        url,
        `coach-athlete:${athleteId}`,
      );
      const athlete = data?.athletes?.[0];

      if (athlete) {
        const imageVersion = athlete.imageVersion;
        const imageUrl = imageVersion != null
          ? `https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco,dpr_2/v${imageVersion}/Athletes/${athlete.id ?? athleteId}`
          : null;

        const result = {
          name: athlete.name || fallbackMember.name || 'Unknown',
          imageUrl,
          nationality: athlete.nationalityName,
          bio: athlete.shortBio,
        };

        // Save to both fresh and stale caches
        await Promise.all([
          redisCacheService.set(freshKey, result, FRESH_CACHE_TTL_MS),
          redisCacheService.set(staleKey, result, STALE_CACHE_TTL_MS),
        ]);

        return result;
      }
    } catch (err) {
      // On 5xx errors, try stale-backup
      if (err instanceof Scores365HttpError && err.status >= 500) {
        logger.warn(
          `[CoachLookup] 5xx for athlete ${athleteId}, trying stale cache`,
        );
        const staleCached = await redisCacheService.get<{
          name: string;
          imageUrl: string | null;
          nationality?: string;
          bio?: string;
        }>(staleKey);
        if (staleCached) {
          return { ...staleCached, stale: true };
        }
      }
      throw err;
    }

    // 3. Athlete endpoint returned empty — use fallback from game.members
    return {
      name: fallbackMember.name || 'Unknown',
      imageUrl: fallbackMember.imageVersion != null
        ? `https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco,dpr_2/v${fallbackMember.imageVersion}/Athletes/${athleteId}`
        : null,
    };
  }

  // ─── Private: Resilient Fetch with Detailed Error Handling ──────────────

  private async resilientFetch<T>(url: string, rateKey: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
      });

      if (res.status === 403) {
        logger.warn(
          `[CoachLookup] HTTP 403 for ${rateKey} — headers missing or IP blocked`,
        );
        throw new Scores365HttpError(403, rateKey, 'Forbidden — check headers/IP');
      }

      if (res.status === 429) {
        logger.warn(`[CoachLookup] HTTP 429 for ${rateKey} — rate limited`);
        throw new Scores365HttpError(429, rateKey, 'Rate limited by 365Scores');
      }

      if (res.status >= 500) {
        logger.warn(`[CoachLookup] HTTP ${res.status} for ${rateKey} — upstream error`);
        throw new Scores365HttpError(res.status, rateKey, `Upstream error ${res.status}`);
      }

      if (!res.ok) {
        logger.warn(`[CoachLookup] HTTP ${res.status} for ${rateKey}`);
        return null;
      }

      const text = await res.text();
      if (!text?.trim()) {
        logger.warn(`[CoachLookup] Empty body for ${rateKey}`);
        return null;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        logger.error(
          `[CoachLookup] JSON parse failed for ${rateKey}. First 300 chars: ${text.substring(0, 300)}`,
        );
        return null;
      }
    } catch (err) {
      if (err instanceof Scores365HttpError) throw err;

      if ((err as Error)?.name === 'AbortError') {
        logger.warn(`[CoachLookup] Timeout (${FETCH_TIMEOUT_MS}ms) for ${rateKey}`);
      } else {
        logger.warn(
          `[CoachLookup] Fetch failed for ${rateKey}:`,
          (err as Error)?.message,
        );
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Private: Helpers ───────────────────────────────────────────────────

  private buildParams(langId: number, extra: Record<string, string>): string {
    const tz = encodeURIComponent(process.env.SCORES365_TIMEZONE || 'Africa/Cairo');
    const countryId = process.env.SCORES365_USER_COUNTRY_ID || '131';
    const base = `appTypeId=5&langId=${langId}&timezoneName=${tz}&userCountryId=${countryId}`;
    const extraStr = Object.entries(extra)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return `${base}&${extraStr}`;
  }

  private resolveLangId(language?: string): number {
    if (!language) return 1; // English
    const lang = language.toLowerCase().split('-')[0];
    if (lang === 'ar') return 27;
    if (lang === 'fr') return 9;
    if (lang === 'es') return 15;
    if (lang === 'de') return 5;
    return 1;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const coachLookupService = new CoachLookupService();
export default coachLookupService;
