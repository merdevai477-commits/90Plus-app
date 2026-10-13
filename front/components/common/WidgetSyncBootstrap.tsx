/**
 * Keeps the home-screen widgets in step with the followed teams and app language,
 * and nudges them to refresh whenever the app returns to the foreground.
 */
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useFavoriteTeam } from '../../hooks/useFavoriteTeam';
import { useLanguageStore } from '../../src/i18n/store';
import { MatchFavoritesStorage, type StoredFavoriteMatch } from '../../src/storage/matchFavorites.storage';
import { syncMatchesWidget } from '../../src/widgets/syncMatchesWidget';

const MAX_FAVORITES = 8;
/** Long enough to cover a match with extra time and the widget's short hold after the whistle. */
const FAVORITE_ACTIVE_MS = 6 * 60 * 60 * 1000;

/**
 * Bell matches still worth showing, soonest kick-off first. Old ones would otherwise fill
 * the cap and keep newer favorites off the widget. Stored status is stale, so only kick-off counts.
 */
async function favoriteFixtureIds(): Promise<number[]> {
  const [raw, meta] = await Promise.all([
    MatchFavoritesStorage.getFavorites().catch(() => [] as string[]),
    MatchFavoritesStorage.getMatches().catch(() => [] as StoredFavoriteMatch[]),
  ]);
  const kickoffById = new Map<string, number>(meta.map((match) => [String(match.id), Date.parse(match.matchDate)]));
  const now = Date.now();
  const candidates: { id: number; kickoff: number }[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0 || candidates.some((c) => c.id === id)) continue;
    const kickoff = kickoffById.get(String(value));
    if (kickoff !== undefined && Number.isFinite(kickoff) && now - kickoff > FAVORITE_ACTIVE_MS) continue;
    candidates.push({ id, kickoff: kickoff !== undefined && Number.isFinite(kickoff) ? kickoff : now });
  }
  return candidates
    .sort((a, b) => a.kickoff - b.kickoff)
    .slice(0, MAX_FAVORITES)
    .map((c) => c.id);
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
      if (latest.current.loading) return;
      // Leaving the app hands over bells set during the session; returning forces a fresh feed.
      if (state !== 'active' && state !== 'background') return;
      void favoriteFixtureIds().then((favoriteIds) => {
        syncMatchesWidget(latest.current.teamIds, latest.current.language, state === 'active', favoriteIds);
      });
    });
    return () => sub.remove();
  }, []);

  return null;
}
