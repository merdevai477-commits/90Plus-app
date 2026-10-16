/**
 * Follow / unfollow competitions (365 competitionIds).
 *
 * Offline-first metadata in LeagueFavoritesStorage; IDs also live in
 * Settings.favoriteLeagues so signed-in users sync via /users/settings.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import {
  LeagueFavoritesStorage,
  followedLeaguesEqual,
  toCompetitionId,
  type StoredFollowedLeague,
} from '../src/storage/leagueFavorites.storage';
import { logger } from '../utils/logger';
import { toastManager } from '../services/toastManager';
import { useTranslation } from '../src/i18n';
import * as Haptics from 'expo-haptics';

export interface FollowLeagueInput {
  id: number;
  name?: string | null;
  logo?: string | null;
  country?: string | null;
}

export interface UseFavoriteLeaguesResult {
  favoriteLeagues: number[];
  followedLeagues: StoredFollowedLeague[];
  isFavorite: (leagueId: number) => boolean;
  isFollowing: (leagueId: number | string) => boolean;
  toggleFavorite: (league: FollowLeagueInput | number) => Promise<void>;
  toggleFollow: (league: FollowLeagueInput) => Promise<void>;
  pending: boolean;
  isLoading: boolean;
  error: string | null;
}

function toStored(league: FollowLeagueInput): StoredFollowedLeague {
  const competitionId = toCompetitionId(league.id);
  return {
    competitionId,
    name: league.name || `Competition ${competitionId}`,
    logo: league.logo ?? null,
    country: league.country ?? null,
  };
}

type FollowedListener = (leagues: StoredFollowedLeague[]) => void;

let memoryLeagues: StoredFollowedLeague[] | null = null;
let inflight: Promise<StoredFollowedLeague[]> | null = null;
const listeners = new Set<FollowedListener>();

function publishFollowedLeagues(leagues: StoredFollowedLeague[]): void {
  memoryLeagues = leagues;
  for (const listener of listeners) listener(leagues);
}

async function loadFollowedLeagues(settingsIds: number[]): Promise<StoredFollowedLeague[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const local = memoryLeagues ?? (await LeagueFavoritesStorage.getLeagues());
    const byId = new Map<number, StoredFollowedLeague>();
    for (const row of local) byId.set(row.competitionId, row);

    const normalizedSettings = [
      ...new Set(settingsIds.map(toCompetitionId).filter((id) => id > 0)),
    ];

    // Keep meta for settings IDs; stub missing rows; drop orphans not in settings
    // only when settings already has at least one id (avoid wiping local before sync).
    if (normalizedSettings.length > 0) {
      for (const id of normalizedSettings) {
        if (!byId.has(id)) {
          byId.set(id, {
            competitionId: id,
            name: `Competition ${id}`,
            logo: null,
            country: null,
          });
        }
      }
      for (const id of [...byId.keys()]) {
        if (!normalizedSettings.includes(id)) byId.delete(id);
      }
    }

    const merged = [...byId.values()];
    if (!followedLeaguesEqual(local, merged)) {
      await LeagueFavoritesStorage.setLeagues(merged);
    }
    publishFollowedLeagues(merged);
    return merged;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export const useFavoriteLeagues = (): UseFavoriteLeaguesResult => {
  const { settings, addFavoriteLeague, removeFavoriteLeague } = useSettings();
  const { t } = useTranslation();
  const settingsIds = settings.favoriteLeagues || [];
  const [followedLeagues, setFollowedLeagues] = useState<StoredFollowedLeague[]>(
    () => memoryLeagues ?? [],
  );
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(memoryLeagues == null);
  const settingsIdsRef = useRef(settingsIds);
  settingsIdsRef.current = settingsIds;

  useEffect(() => {
    const onChange: FollowedListener = (leagues) => {
      setFollowedLeagues((prev) => (followedLeaguesEqual(prev, leagues) ? prev : leagues));
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (memoryLeagues == null) {
          const local = await LeagueFavoritesStorage.getLeagues();
          if (!cancelled) {
            setFollowedLeagues((prev) => (followedLeaguesEqual(prev, local) ? prev : local));
          }
        }
        await loadFollowedLeagues(settingsIdsRef.current);
      } catch (error) {
        logger.error('[useFavoriteLeagues] Error loading followed leagues:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [settingsIds.join(',')]);

  const favoriteLeagues = useMemo(
    () => followedLeagues.map((l) => l.competitionId),
    [followedLeagues],
  );

  const isFollowing = useCallback(
    (leagueId: number | string): boolean => {
      const cid = toCompetitionId(Number(leagueId));
      return followedLeagues.some((l) => l.competitionId === cid);
    },
    [followedLeagues],
  );

  const isFavorite = useCallback(
    (leagueId: number) => isFollowing(leagueId),
    [isFollowing],
  );

  const toggleFollow = useCallback(
    async (league: FollowLeagueInput) => {
      const nextRow = toStored(league);
      if (nextRow.competitionId <= 0) return;

      const currentlyFollowing = followedLeagues.some(
        (row) => row.competitionId === nextRow.competitionId,
      );
      const snapshot = followedLeagues;
      const nextLeagues = currentlyFollowing
        ? snapshot.filter((row) => row.competitionId !== nextRow.competitionId)
        : [
            ...snapshot.filter((row) => row.competitionId !== nextRow.competitionId),
            nextRow,
          ];

      setPending(true);
      publishFollowedLeagues(nextLeagues);

      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (currentlyFollowing) {
          await LeagueFavoritesStorage.removeLeague(nextRow.competitionId);
          await removeFavoriteLeague(nextRow.competitionId);
        } else {
          await LeagueFavoritesStorage.upsertLeague(nextRow);
          await addFavoriteLeague(nextRow.competitionId);
        }

        if (!currentlyFollowing) {
          const toastTitle =
            t.matches.screen.followedToFavoritesTitle ?? 'Added to Favorites';
          const toastBody = (
            t.matches.screen.followedLeagueToFavoritesBody ??
            '"{name}" was added to your Favorites tab.'
          ).replace('{name}', nextRow.name);
          toastManager.showSuccess(toastTitle, toastBody, {
            position: 'top',
            duration: 2400,
          });
        }
      } catch (error) {
        logger.error('[useFavoriteLeagues] Error toggling favorite:', error);
        publishFollowedLeagues(snapshot);
        try {
          await LeagueFavoritesStorage.setLeagues(snapshot);
        } catch (storageErr) {
          logger.error('[useFavoriteLeagues] Failed to roll back storage:', storageErr);
        }
        throw error;
      } finally {
        setPending(false);
      }
    },
    [followedLeagues, addFavoriteLeague, removeFavoriteLeague, t],
  );

  const toggleFavorite = useCallback(
    async (league: FollowLeagueInput | number) => {
      if (typeof league === 'number') {
        await toggleFollow({ id: league });
        return;
      }
      await toggleFollow(league);
    },
    [toggleFollow],
  );

  return {
    favoriteLeagues,
    followedLeagues,
    isFavorite,
    isFollowing,
    toggleFavorite,
    toggleFollow,
    pending,
    isLoading: loading,
    error: null,
  };
};

export default useFavoriteLeagues;
