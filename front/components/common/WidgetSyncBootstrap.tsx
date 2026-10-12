/**
 * Keeps the home-screen widgets in step with the followed teams and app language,
 * and nudges them to refresh whenever the app returns to the foreground.
 */
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useFavoriteTeam } from '../../hooks/useFavoriteTeam';
import { useLanguageStore } from '../../src/i18n/store';
import { MatchFavoritesStorage } from '../../src/storage/matchFavorites.storage';
import { syncMatchesWidget } from '../../src/widgets/syncMatchesWidget';

const MAX_FAVORITES = 8;

async function favoriteFixtureIds(): Promise<number[]> {
  const raw = await MatchFavoritesStorage.getFavorites().catch(() => [] as string[]);
  const ids: number[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_FAVORITES) break;
  }
  return ids;
}

export function WidgetSyncBootstrap(): null {
  const { followedTeams, loading } = useFavoriteTeam();
  const language = useLanguageStore((state) => state.language);

  const teamIds = useMemo(
    () => followedTeams.map((team) => Number(team.apiTeamId)).filter((id) => Number.isFinite(id) && id > 0),
    [followedTeams],
  );
  const teamKey = teamIds.join(',');

  const latest = useRef({ teamIds, language, loading });
  latest.current = { teamIds, language, loading };

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void favoriteFixtureIds().then((favoriteIds) => {
      if (cancelled) return;
      syncMatchesWidget(latest.current.teamIds, latest.current.language, false, favoriteIds);
    });
    return () => {
      cancelled = true;
    };
  }, [teamKey, language, loading]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || latest.current.loading) return;
      void favoriteFixtureIds().then((favoriteIds) => {
        syncMatchesWidget(latest.current.teamIds, latest.current.language, true, favoriteIds);
      });
    });
    return () => sub.remove();
  }, []);

  return null;
}
