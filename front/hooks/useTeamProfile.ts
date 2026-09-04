/**
 * Club / National-team profile data hooks (365Scores-powered).
 *
 * Thin React Query wrappers over ApiFootballService's 365 competitor endpoints
 * (which are cached in Redis + Postgres on the server). React Query adds request
 * dedup, per-section loading/error states, and lets each tab fetch lazily via the
 * `enabled` flag so we never call every endpoint on every render.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import ApiFootballService, {
    type Competitor365Info,
    type Competitor365Matches,
    type Competitor365Transfers,
    type Competitor365Stats,
    type Competitor365Squad,
    type Competitor365Coach,
    type Standing365Row,
} from '../services/apiFootball';
import { CompetitorMatchesCache } from '../src/storage/competitorMatches.cache';

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
        queryFn: async () => {
            const data = await ApiFootballService.getCompetitor365Matches(competitorId);
            void CompetitorMatchesCache.write(competitorId, data);
            return data;
        },
        enabled: enabled && competitorId > 0,
        staleTime: 90 * 1000,
        gcTime: FIVE_MIN * 6,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

/** Favorites accordion: disk placeholder + shared RQ key with profile matches. */
export function useFavoriteCompetitorMatches(competitorId: number, enabled = true) {
    const [disk, setDisk] = useState<Competitor365Matches | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        if (!competitorId || competitorId <= 0) {
            setDisk(undefined);
            return;
        }
        void CompetitorMatchesCache.read(competitorId).then((cached) => {
            if (!cancelled && cached) setDisk(cached);
        });
        return () => {
            cancelled = true;
        };
    }, [competitorId]);

    return useQuery<Competitor365Matches, Error>({
        queryKey: competitorKey(competitorId, 'matches'),
        queryFn: async () => {
            const data = await ApiFootballService.getCompetitor365Matches(competitorId);
            void CompetitorMatchesCache.write(competitorId, data);
            return data;
        },
        enabled: enabled && competitorId > 0,
        staleTime: 90 * 1000,
        gcTime: FIVE_MIN * 6,
        retry: 1,
        refetchOnWindowFocus: false,
        placeholderData: disk,
    });
}

/** Warm the shared matches query on press-in so expand feels instant. */
export function usePrefetchFavoriteCompetitorMatches() {
    const queryClient = useQueryClient();
    return useCallback(
        (competitorId: number) => {
            if (!competitorId || competitorId <= 0) return;
            void queryClient.prefetchQuery({
                queryKey: competitorKey(competitorId, 'matches'),
                queryFn: async () => {
                    const data = await ApiFootballService.getCompetitor365Matches(competitorId);
                    void CompetitorMatchesCache.write(competitorId, data);
                    return data;
                },
                staleTime: 90 * 1000,
            });
        },
        [queryClient],
    );
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

export function useCompetitorSquad(competitorId: number, enabled = true) {
    return useQuery<Competitor365Squad | null, Error>({
        queryKey: competitorKey(competitorId, 'squad'),
        queryFn: () => ApiFootballService.getCompetitor365Squad(competitorId),
        enabled: enabled && competitorId > 0,
        staleTime: FIVE_MIN * 6,
        gcTime: FIVE_MIN * 12,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useCompetitorCoach(competitorId: number, enabled = true) {
    return useQuery<Competitor365Coach | null, Error>({
        queryKey: competitorKey(competitorId, 'coach'),
        queryFn: () => ApiFootballService.getCompetitor365Coach(competitorId),
        enabled: enabled && competitorId > 0,
        staleTime: FIVE_MIN * 6,
        gcTime: FIVE_MIN * 12,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
