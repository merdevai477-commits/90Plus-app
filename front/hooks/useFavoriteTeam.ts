/**
 * Follow / unfollow clubs & national teams.
 *
 * IDs stored here are 365Scores competitorIds (same integer column on
 * FavoriteTeam.apiTeamId). Offline-first (TeamFavoritesStorage) with optimistic
 * UI and rollback, backed by the dedicated FavoriteTeam API (TeamsService)
 * when the user is signed in.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { TeamFavoritesStorage } from '../src/storage/teamFavorites.storage';
import { TeamsService } from '../src/services/authService';
import { logger } from '../utils/logger';

export interface FollowTeamInput {
    id: number;
    name?: string | null;
    logo?: string | null;
    country?: string | null;
}

interface UseFavoriteTeamResult {
    followedTeamIds: string[];
    isFollowing: (teamId: number | string) => boolean;
    toggleFollow: (team: FollowTeamInput) => Promise<void>;
    pending: boolean;
    loading: boolean;
}

export const useFavoriteTeam = (): UseFavoriteTeamResult => {
    const [followedTeamIds, setFollowedTeamIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const { getToken, isSignedIn } = useAuth();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const token = isSignedIn ? await getToken() : null;
                if (token) {
                    const serverTeams = await TeamsService.getFollowed(token);
                    const serverIds = serverTeams.map((t) => String(t.apiTeamId));
                    await TeamFavoritesStorage.setFavorites(serverIds);
                    if (!cancelled) setFollowedTeamIds(serverIds);
                    return;
                }
                const local = await TeamFavoritesStorage.getFavorites();
                if (!cancelled) setFollowedTeamIds(local);
            } catch (error) {
                logger.error('Error loading followed teams:', error);
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
        (teamId: number | string): boolean => followedTeamIds.includes(String(teamId)),
        [followedTeamIds],
    );

    const toggleFollow = useCallback(
        async (team: FollowTeamInput) => {
            const teamId = String(team.id);
            const currentlyFollowing = followedTeamIds.includes(teamId);
            const snapshot = followedTeamIds;

            // Optimistic update.
            setPending(true);
            setFollowedTeamIds((prev) =>
                currentlyFollowing ? prev.filter((id) => id !== teamId) : [...prev, teamId],
            );

            try {
                if (currentlyFollowing) {
                    await TeamFavoritesStorage.removeFavorite(teamId);
                } else {
                    await TeamFavoritesStorage.addFavorite(teamId);
                }

                const token = isSignedIn ? await getToken() : null;
                if (token) {
                    const result = currentlyFollowing
                        ? await TeamsService.unfollow(token, team.id)
                        : await TeamsService.follow(token, team.id, {
                              teamName: team.name ?? undefined,
                              teamLogo: team.logo ?? undefined,
                              country: team.country ?? undefined,
                          });
                    if (!result.success) {
                        throw new Error(result.error || 'follow_request_failed');
                    }
                }
            } catch (error) {
                logger.warn('Failed to sync team follow — rolling back:', error);
                // Roll back optimistic UI + local storage.
                setFollowedTeamIds(snapshot);
                try {
                    await TeamFavoritesStorage.setFavorites(snapshot);
                } catch (storageErr) {
                    logger.error('Failed to roll back followed teams storage:', storageErr);
                }
            } finally {
                setPending(false);
            }
        },
        [followedTeamIds, getToken, isSignedIn],
    );

    return { followedTeamIds, isFollowing, toggleFollow, pending, loading };
};
