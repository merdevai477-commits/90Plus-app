/**
 * Team / Club profile data hooks.
 *
 * Thin React Query wrappers over ApiFootballService (which already handles
 * Redis/AsyncStorage caching + the backend proxy). React Query adds request
 * dedup, per-section loading/error states, and lets each tab fetch lazily via
 * the `enabled` flag so we never call every endpoint on every render.
 */

import { useQuery } from '@tanstack/react-query';
import ApiFootballService, { Injury, Trophy, Coach, Fixture } from '../services/apiFootball';

const FIVE_MIN = 5 * 60 * 1000;

export interface TeamInfo {
    team: {
        id: number;
        name: string;
        logo: string | null;
        country: string | null;
        founded: number | null;
        code?: string | null;
        national?: boolean;
    };
    venue: {
        id: number | null;
        name: string | null;
        address: string | null;
        city: string | null;
        capacity: number | null;
        surface: string | null;
        image: string | null;
    };
}

export interface SquadPlayer {
    id: number;
    name: string;
    age: number | null;
    number: number | null;
    position: string | null;
    photo: string | null;
}

export interface TeamMatches {
    live: Fixture[];
    upcoming: Fixture[];
    finished: Fixture[];
    team: any;
}

const teamKey = (teamId: number, section: string, ...rest: Array<string | number>) =>
    ['team', teamId, section, ...rest] as const;

export function useTeamInfo(teamId: number, enabled = true) {
    return useQuery<TeamInfo | null, Error>({
        queryKey: teamKey(teamId, 'info'),
        queryFn: async () => {
            const rows = await ApiFootballService.getTeamById(teamId);
            return (Array.isArray(rows) && rows.length > 0 ? rows[0] : null) as TeamInfo | null;
        },
        enabled: enabled && teamId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamMatches(teamId: number, count = 20, enabled = true) {
    return useQuery<TeamMatches, Error>({
        queryKey: teamKey(teamId, 'matches', count),
        queryFn: async () => {
            const result = await ApiFootballService.getTeamMatches(teamId, count);
            return (result || { live: [], upcoming: [], finished: [], team: null }) as TeamMatches;
        },
        enabled: enabled && teamId > 0,
        staleTime: 60 * 1000,
        gcTime: FIVE_MIN,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamSquad(teamId: number, enabled = true) {
    return useQuery<SquadPlayer[], Error>({
        queryKey: teamKey(teamId, 'squad'),
        queryFn: async () => {
            const rows = await ApiFootballService.getTeamSquad(teamId);
            const players = Array.isArray(rows) && rows.length > 0 ? rows[0]?.players : [];
            return Array.isArray(players) ? (players as SquadPlayer[]) : [];
        },
        enabled: enabled && teamId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamStatistics(
    teamId: number,
    leagueId: number | null,
    season: number,
    enabled = true,
) {
    return useQuery<any, Error>({
        queryKey: teamKey(teamId, 'stats', leagueId ?? 0, season),
        queryFn: async () => {
            if (!leagueId) return null;
            return ApiFootballService.getTeamStatistics(teamId, leagueId, season);
        },
        enabled: enabled && teamId > 0 && !!leagueId,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamTrophies(teamId: number, enabled = true) {
    return useQuery<Trophy[], Error>({
        queryKey: teamKey(teamId, 'trophies'),
        queryFn: async () => ApiFootballService.getTeamTrophies(teamId),
        enabled: enabled && teamId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamInjuries(teamId: number, enabled = true) {
    return useQuery<Injury[], Error>({
        queryKey: teamKey(teamId, 'injuries'),
        queryFn: async () => ApiFootballService.getTeamInjuries(teamId),
        enabled: enabled && teamId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamCoaches(teamId: number, enabled = true) {
    return useQuery<Coach[], Error>({
        queryKey: teamKey(teamId, 'coaches'),
        queryFn: async () => ApiFootballService.getTeamCoaches(teamId),
        enabled: enabled && teamId > 0,
        staleTime: FIVE_MIN,
        gcTime: FIVE_MIN * 2,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
