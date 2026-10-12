/**
 * Keeps the home-screen widgets in step with the followed teams and app language,
 * and nudges them to refresh whenever the app returns to the foreground.
 */
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useFavoriteTeam } from '../../hooks/useFavoriteTeam';
import { useLanguageStore } from '../../src/i18n/store';
import { syncMatchesWidget } from '../../src/widgets/syncMatchesWidget';

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
    syncMatchesWidget(latest.current.teamIds, language);
  }, [teamKey, language, loading]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || latest.current.loading) return;
      syncMatchesWidget(latest.current.teamIds, latest.current.language, true);
    });
    return () => sub.remove();
  }, []);

  return null;
}
