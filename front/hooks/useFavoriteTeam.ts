/**
 * Follow / unfollow clubs & national teams.
 *
 * IDs stored here are 365Scores competitorIds (same integer column on
 * FavoriteTeam.apiTeamId). Offline-first (TeamFavoritesStorage) with optimistic
 * UI and rollback, backed by the dedicated FavoriteTeam API (TeamsService)
 * when the user is signed in.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import {
    TeamFavoritesStorage,
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

export const useFavoriteTeam = (): UseFavoriteTeamResult => {
    const [followedTeams, setFollowedTeams] = useState<StoredFollowedTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const { getToken, isSignedIn } = useAuth();
    const { t } = useTranslation();

    const followedTeamIds = useMemo(
        () => followedTeams.map((team) => String(team.apiTeamId)),
        [followedTeams],
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const token = isSignedIn ? await getToken() : null;
                if (token) {
                    const serverTeams = await TeamsService.getFollowed(token);
                    const stored = serverTeams.map((row) => toStored(row));
                    await TeamFavoritesStorage.setTeams(stored);
                    if (!cancelled) setFollowedTeams(stored);
                    return;
                }
                const local = await TeamFavoritesStorage.getTeams();
                if (!cancelled) setFollowedTeams(local);
            } catch (error) {
                logger.error('Error loading followed teams:', error);
                try {
                    const local = await TeamFavoritesStorage.getTeams();
                    if (!cancelled) setFollowedTeams(local);
                } catch {
                    /* ignore */
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [getToken, isSignedIn]);

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

            setPending(true);
            setFollowedTeams((prev) =>
                currentlyFollowing
                    ? prev.filter((row) => String(row.apiTeamId) !== teamId)
                    : [...prev.filter((row) => String(row.apiTeamId) !== teamId), nextRow],
            );

            try {
                if (currentlyFollowing) {
                    await TeamFavoritesStorage.removeFavorite(teamId);
                } else {
                    await TeamFavoritesStorage.addFavorite(teamId, nextRow);
                }

                const token = isSignedIn ? await getToken() : null;
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
                setFollowedTeams(snapshot);
                try {
                    await TeamFavoritesStorage.setTeams(snapshot);
                } catch (storageErr) {
                    logger.error('Failed to roll back followed teams storage:', storageErr);
                }
            } finally {
                setPending(false);
            }
        },
        [followedTeams, getToken, isSignedIn, t],
    );

    return { followedTeamIds, followedTeams, isFollowing, toggleFollow, pending, loading };
};
