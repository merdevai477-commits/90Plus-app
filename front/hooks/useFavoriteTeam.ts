/**
 * Follow / unfollow clubs & national teams.
 *
 * IDs stored here are 365Scores competitorIds (same integer column on
 * FavoriteTeam.apiTeamId). Offline-first (TeamFavoritesStorage) with optimistic
 * UI and rollback, backed by the dedicated FavoriteTeam API (TeamsService)
 * when the user is signed in.
 *
 * `getToken` from Clerk is not a stable identity — never put it in effect deps
 * or Matches live rerenders will hammer GET /api/teams/favorites in a loop.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import {
    TeamFavoritesStorage,
    followedTeamsEqual,
    type StoredFollowedTeam,
} from '../src/storage/teamFavorites.storage';
import { TeamsService, type FollowedTeam } from '../src/services/authService';
import { logger } from '../utils/logger';
import { toastManager } from '../services/toastManager';
import { useTranslation } from '../src/i18n';

export interface FollowTeamInput {
    id: number;
    name?: string | null;
    logo?: string | null;
    country?: string | null;
    isNationalTeam?: boolean;
    language?: 'ar' | 'en';
}

interface UseFavoriteTeamResult {
    followedTeamIds: string[];
    followedTeams: StoredFollowedTeam[];
    isFollowing: (teamId: number | string) => boolean;
    toggleFollow: (team: FollowTeamInput) => Promise<void>;
    pending: boolean;
    loading: boolean;
}

function toStored(team: FollowTeamInput | FollowedTeam): StoredFollowedTeam {
    if ('apiTeamId' in team) {
        return {
            apiTeamId: team.apiTeamId,
            teamName: team.teamName || `Team ${team.apiTeamId}`,
            teamLogo: team.teamLogo ?? null,
            country: team.country ?? null,
        };
    }
    return {
        apiTeamId: team.id,
        teamName: team.name || `Team ${team.id}`,
        teamLogo: team.logo ?? null,
        country: team.country ?? null,
    };
}

type FollowedListener = (teams: StoredFollowedTeam[]) => void;

let memoryTeams: StoredFollowedTeam[] | null = null;
let memoryUserKey = '';
let lastSyncedKey = '';
let inflight: Promise<StoredFollowedTeam[]> | null = null;
const listeners = new Set<FollowedListener>();

function userKey(isSignedIn: boolean | undefined, userId: string | null | undefined): string {
    return `${isSignedIn ? '1' : '0'}:${userId ?? ''}`;
}

function rememberUserKey(key: string): void {
    if (memoryUserKey && memoryUserKey !== key) {
        memoryTeams = null;
        lastSyncedKey = '';
    }
    memoryUserKey = key;
}

function publishFollowedTeams(teams: StoredFollowedTeam[]): void {
    memoryTeams = teams;
    for (const listener of listeners) listener(teams);
}

async function loadFollowedTeams(args: {
    isSignedIn: boolean | undefined;
    userId: string | null | undefined;
    getToken: () => Promise<string | null>;
}): Promise<StoredFollowedTeam[]> {
    const key = userKey(args.isSignedIn, args.userId);
    rememberUserKey(key);
    if (memoryTeams && lastSyncedKey === key) return memoryTeams;
    if (inflight) return inflight;
    inflight = (async () => {
        const local = memoryTeams ?? (await TeamFavoritesStorage.getTeams());
        if (!args.isSignedIn) {
            lastSyncedKey = key;
            publishFollowedTeams(local);
            return local;
        }
        const token = await args.getToken();
        if (!token) {
            publishFollowedTeams(local);
            return local;
        }
        const stored = (await TeamsService.getFollowed(token)).map((row) => toStored(row));
        if (!followedTeamsEqual(local, stored)) {
            await TeamFavoritesStorage.setTeams(stored);
        }
        lastSyncedKey = key;
        publishFollowedTeams(stored);
        return stored;
    })().finally(() => {
        inflight = null;
    });
    return inflight;
}

export const useFavoriteTeam = (): UseFavoriteTeamResult => {
    const [followedTeams, setFollowedTeams] = useState<StoredFollowedTeam[]>(
        () => memoryTeams ?? [],
    );
    const [loading, setLoading] = useState(memoryTeams == null);
    const [pending, setPending] = useState(false);
    const { getToken, isSignedIn, userId } = useAuth();
    const { t } = useTranslation();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    const followedTeamIds = useMemo(
        () => followedTeams.map((team) => String(team.apiTeamId)),
        [followedTeams],
    );

    useEffect(() => {
        const onChange = (teams: StoredFollowedTeam[]) => {
            setFollowedTeams((prev) => (followedTeamsEqual(prev, teams) ? prev : teams));
        };
        listeners.add(onChange);
        return () => {
            listeners.delete(onChange);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        rememberUserKey(userKey(isSignedIn, userId));

        const load = async () => {
            try {
                if (memoryTeams == null) {
                    const local = await TeamFavoritesStorage.getTeams();
                    if (!cancelled) {
                        setFollowedTeams((prev) => (followedTeamsEqual(prev, local) ? prev : local));
                    }
                }
                await loadFollowedTeams({
                    isSignedIn,
                    userId,
                    getToken: () => getTokenRef.current(),
                });
            } catch (error) {
                logger.error('Error loading followed teams:', error);
                try {
                    const local = await TeamFavoritesStorage.getTeams();
                    if (!cancelled) {
                        setFollowedTeams((prev) => (followedTeamsEqual(prev, local) ? prev : local));
                    }
                } catch {
                    /* ignore */
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [isSignedIn, userId]);

    const isFollowing = useCallback(
        (teamId: number | string): boolean =>
            followedTeams.some((team) => String(team.apiTeamId) === String(teamId)),
        [followedTeams],
    );

    const toggleFollow = useCallback(
        async (team: FollowTeamInput) => {
            const teamId = String(team.id);
            const currentlyFollowing = followedTeams.some(
                (row) => String(row.apiTeamId) === teamId,
            );
            const snapshot = followedTeams;
            const nextRow = toStored(team);
            const nextTeams = currentlyFollowing
                ? snapshot.filter((row) => String(row.apiTeamId) !== teamId)
                : [...snapshot.filter((row) => String(row.apiTeamId) !== teamId), nextRow];

            setPending(true);
            publishFollowedTeams(nextTeams);

            try {
                if (currentlyFollowing) {
                    await TeamFavoritesStorage.removeFavorite(teamId);
                } else {
                    await TeamFavoritesStorage.addFavorite(teamId, nextRow);
                }

                const token = isSignedIn ? await getTokenRef.current() : null;
                if (token) {
                    const result = currentlyFollowing
                        ? await TeamsService.unfollow(token, team.id)
                        : await TeamsService.follow(token, team.id, {
                              teamName: team.name ?? undefined,
                              teamLogo: team.logo ?? undefined,
                              country: team.country ?? undefined,
                              isNationalTeam: team.isNationalTeam,
                              language: team.language,
                          });
                    if (!result.success) {
                        throw new Error(result.error || 'follow_request_failed');
                    }
                }

                if (!currentlyFollowing) {
                    const toastTitle =
                        t.matches.screen.followedToFavoritesTitle ?? 'Added to Favorites';
                    const toastBody = (
                        t.matches.screen.followedToFavoritesBody ??
                        '"{name}" was added to your Favorites tab.'
                    ).replace('{name}', team.name || nextRow.teamName);
                    toastManager.showSuccess(toastTitle, toastBody, {
                        position: 'top',
                        duration: 2400,
                    });
                }
            } catch (error) {
                logger.warn('Failed to sync team follow — rolling back:', error);
                publishFollowedTeams(snapshot);
                try {
                    await TeamFavoritesStorage.setTeams(snapshot);
                } catch (storageErr) {
                    logger.error('Failed to roll back followed teams storage:', storageErr);
                }
            } finally {
                setPending(false);
            }
        },
        [followedTeams, isSignedIn, t],
    );

    return { followedTeamIds, followedTeams, isFollowing, toggleFollow, pending, loading };
};
