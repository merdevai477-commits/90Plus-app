/**
 * Club / National-team profile data hooks (365Scores-powered).
 *
 * Thin React Query wrappers over ApiFootballService's 365 competitor endpoints
 * (which are cached in Redis + Postgres on the server). React Query adds request
 * dedup, per-section loading/error states, and lets each tab fetch lazily via the
 * `enabled` flag so we never call every endpoint on every render.
 */

import { useQuery } from '@tanstack/react-query';
import ApiFootballService, {
    type Competitor365Info,
    type Competitor365Matches,
    type Competitor365Transfers,
    type Competitor365Stats,
    type Standing365Row,
} from '../services/apiFootball';

const FIVE_MIN = 5 * 60 * 1000;

/** Grouped competitor matches (kept as a named export for tab components). */
export type TeamMatches = Competitor365Matches;

const competitorKey = (
    competitorId: number,
    section: string,
    ...rest: (string | number)[]
) => ['competitor365', competitorId, section, ...rest] as const;

export function useCompetitorInfo(competitorId: number, enabled = true) {
    return useQuery<Competitor365Info | null, Error>({
        queryKey: competitorKey(competitorId, 'info'),
        queryFn: () => ApiFootballService.getCompetitor365Info(competitorId),
        enabled: enabled && competitorId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 4,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useCompetitorMatches(competitorId: number, enabled = true) {
    return useQuery<Competitor365Matches, Error>({
        queryKey: competitorKey(competitorId, 'matches'),
        queryFn: () => ApiFootballService.getCompetitor365Matches(competitorId),
        enabled: enabled && competitorId > 0,
        staleTime: 60 * 1000,
        gcTime: FIVE_MIN,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useCompetitorTransfers(competitorId: number, enabled = true) {
    return useQuery<Competitor365Transfers, Error>({
        queryKey: competitorKey(competitorId, 'transfers'),
        queryFn: () => ApiFootballService.getCompetitor365Transfers(competitorId),
        enabled: enabled && competitorId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 4,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useCompetitorStats(
    competitorId: number,
    competitionId: number | null | undefined,
    enabled = true,
) {
    return useQuery<Competitor365Stats | null, Error>({
        queryKey: competitorKey(competitorId, 'stats', competitionId ?? 0),
        queryFn: () =>
            ApiFootballService.getCompetitor365Stats(competitorId, competitionId ?? undefined),
        enabled: enabled && competitorId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 4,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useCompetitorStandings(
    competitionId: number | null | undefined,
    enabled = true,
) {
    return useQuery<Standing365Row[], Error>({
        queryKey: competitorKey(competitionId ?? 0, 'standings'),
        queryFn: () => ApiFootballService.getCompetitor365Standings(competitionId ?? 0),
        enabled: enabled && !!competitionId && competitionId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 4,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
