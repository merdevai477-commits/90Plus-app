/**
 * Shell for the three "خماسي الهدافين" tabs — pitch (node 1263:10333), matches
 * (1288:14161) and ranking (1288:14458 empty / 1288:14284 filled).
 *
 * The bar at the foot is an in-page switcher rather than a router tab bar, so
 * all three live on one route and the picks survive moving between them. Picks
 * are component state and the player pool is placeholder data until the real
 * selectable list is decided.
 */

import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenFont } from '../../utils/fontSetup';

import { TSF_DESIGN_WIDTH, type TsfLeagueKey } from './assets';
import { type TsfPlayer } from './mockData';
import { MatchesTab } from './MatchesTab';
import { PitchTab, TSF_PITCH_DESIGN_HEIGHT } from './PitchTab';
import { PlayerPicker } from './PlayerPicker';
import { RankingTab } from './RankingTab';
import { TsfNav, type TsfTabKey } from './TsfNav';

const BG = '#030303';

export default function TopScorersFivePickScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [tab, setTab] = useState<TsfTabKey>('pitch');
  const [picks, setPicks] = useState<Partial<Record<TsfLeagueKey, TsfPlayer>>>({});
  const [openLeague, setOpenLeague] = useState<TsfLeagueKey | null>(null);

  /**
   * One scale for the pitch and the nav: the pitch is pinned to design
   * coordinates and reserves the nav's slot inside its own height, so sizing
   * the bar off anything looser would let it grow into the formation.
   */
  const availableHeight = height - insets.top - Math.max(insets.bottom, 12);
  const scale = Math.min(width / TSF_DESIGN_WIDTH, availableHeight / TSF_PITCH_DESIGN_HEIGHT);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/top-scorers-five' as never);
  }, [router]);

  const handlePick = useCallback((league: TsfLeagueKey, player: TsfPlayer) => {
    setPicks((prev) => ({ ...prev, [league]: player }));
    setOpenLeague(null);
  }, []);

  const handleRemove = useCallback((league: TsfLeagueKey) => {
    setPicks((prev) => {
      const next = { ...prev };
      delete next[league];
      return next;
    });
  }, []);

  const goToPitch = useCallback(() => setTab('pitch'), []);

  /** Design order, so a tab reads the same whichever one opened it. */
  const picked = useMemo(
    () =>
      (['pl', 'laliga', 'bundesliga', 'ligue1', 'seriea'] as const)
        .map((league) => {
          const player = picks[league];
          return player ? { league, player } : null;
        })
        .filter((entry): entry is { league: TsfLeagueKey; player: TsfPlayer } => entry != null),
    [picks],
  );

  return (
    <View style={styles.root}>
      {tab === 'pitch' ? (
        <PitchTab
          picks={picks}
          scale={scale}
          onBack={handleBack}
          onOpenLeague={setOpenLeague}
          onRemove={handleRemove}
        />
      ) : null}

      {tab === 'matches' ? (
        <MatchesTab picked={picked} onBack={handleBack} onGoToPitch={goToPitch} />
      ) : null}

      {tab === 'ranking' ? (
        <RankingTab complete={picked.length === 5} onBack={handleBack} onPickNow={goToPitch} />
      ) : null}

      <TsfNav activeTab={tab} onChange={setTab} scale={scale} />

      <PlayerPicker
        league={openLeague}
        selectedId={openLeague ? picks[openLeague]?.id : undefined}
        onClose={() => setOpenLeague(null)}
        onChangeLeague={setOpenLeague}
        onPick={handlePick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
});
