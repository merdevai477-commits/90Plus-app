/**
 * Shell for the three "خماسي الهدافين" tabs — pitch (node 1263:10333), matches
 * (1288:14161) and ranking (1288:14458 empty / 1288:14284 filled).
 *
 * The bar at the foot is an in-page switcher rather than a router tab bar, so
 * all three live on one route and the picks survive moving between them.
 * Leagues in `TSF_LIVE_LEAGUES` load their pool and the saved pick from the
 * backend; the others stay local placeholder picks.
 *
 * Picking is two steps: a tap in the grid only proposes the player, and the
 * confirmation sheet's "Yes" saves it — final for the gameweek, which the
 * server enforces (GAMEWEEK_PICK_LOCKED). "View player profile" opens the
 * app's player career screen with the picker hidden, and the pending
 * proposal is still there on return.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TSF_LIVE_LEAGUES,
  TsfApiError,
  topScorersFiveService,
} from '../../services/topScorersFive.service';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../utils/logger';
import { useScreenFont } from '../../utils/fontSetup';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';

import { TSF_DESIGN_WIDTH, type TsfLeagueKey } from './assets';
import { tsfPickFromSelection, tsfPlayerFromApi } from './liveData';
import { type TsfPlayer } from './mockData';
import { MatchesTab } from './MatchesTab';
import { PitchTab, TSF_PITCH_DESIGN_HEIGHT } from './PitchTab';
import { PlayerPicker } from './PlayerPicker';
import { RankingTab } from './RankingTab';
import { TsfNav, type TsfTabKey } from './TsfNav';

const BG = '#030303';

const isLive = (league: TsfLeagueKey) => TSF_LIVE_LEAGUES.includes(league);

export default function TopScorersFivePickScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t, language } = useTranslation();
  const pickCopy = t.topScorersFive.pick;
  const { getToken, isSignedIn } = useAuth();
  // Clerk hands out a new getToken on renders; keeping it out of effect deps.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [tab, setTab] = useState<TsfTabKey>('pitch');
  const [picks, setPicks] = useState<Partial<Record<TsfLeagueKey, TsfPlayer>>>({});
  const [openLeague, setOpenLeague] = useState<TsfLeagueKey | null>(null);
  const [livePlayers, setLivePlayers] = useState<Partial<Record<TsfLeagueKey, readonly TsfPlayer[]>>>({});
  const [pending, setPending] = useState<TsfPlayer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProfileOpen(false);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    for (const league of TSF_LIVE_LEAGUES) {
      topScorersFiveService
        .getPlayers(league, language)
        .then((players) => {
          if (!cancelled) setLivePlayers((prev) => ({ ...prev, [league]: players.map(tsfPlayerFromApi) }));
        })
        .catch((error) => logger.warn('[TopScorersFive] players load failed', error));
    }
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current().catch(() => null);
      if (!token || cancelled) return;
      for (const league of TSF_LIVE_LEAGUES) {
        try {
          const data = await topScorersFiveService.getSelection(token, league, language);
          const pick = tsfPickFromSelection(data);
          if (cancelled) return;
          setPicks((prev) => {
            const next = { ...prev };
            if (pick) next[league] = pick;
            else delete next[league];
            return next;
          });
        } catch (error) {
          logger.warn('[TopScorersFive] selection load failed', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, language]);

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

  const setPick = useCallback((league: TsfLeagueKey, player: TsfPlayer | undefined) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (player) next[league] = player;
      else delete next[league];
      return next;
    });
  }, []);

  const explainLocked = useCallback(
    (player: TsfPlayer | undefined) => {
      if (player?.confirmed) {
        Alert.alert(pickCopy.pickLockedTitle, pickCopy.pickLockedBody.replace('{name}', player.name));
      } else {
        Alert.alert(pickCopy.lockedTitle, pickCopy.lockedBody);
      }
    },
    [pickCopy],
  );

  /** Re-reads one league's saved pick, e.g. after the server refused a change. */
  const reloadPick = useCallback(
    async (token: string, league: TsfLeagueKey) => {
      try {
        const data = await topScorersFiveService.getSelection(token, league, language);
        const pick = tsfPickFromSelection(data);
        setPick(league, pick ?? undefined);
        return pick;
      } catch (error) {
        logger.warn('[TopScorersFive] selection reload failed', error);
        return null;
      }
    },
    [language, setPick],
  );

  const explainFailure = useCallback(
    (error: unknown) => {
      if (error instanceof TsfApiError && error.reason === 'GAMEWEEK_LOCKED') {
        Alert.alert(pickCopy.lockedTitle, pickCopy.lockedBody);
      } else if (error instanceof TsfApiError && error.status === 401) {
        Alert.alert(pickCopy.signInTitle, pickCopy.signInBody);
      } else {
        Alert.alert(pickCopy.saveFailedTitle, pickCopy.saveFailedBody);
      }
    },
    [pickCopy],
  );

  const handleOpenLeague = useCallback(
    (league: TsfLeagueKey) => {
      const current = picks[league];
      if (current?.locked) {
        explainLocked(current);
        return;
      }
      setOpenLeague(league);
    },
    [explainLocked, picks],
  );

  const handlePick = useCallback((league: TsfLeagueKey, player: TsfPlayer) => {
    if (!isLive(league)) {
      setPick(league, player);
      setOpenLeague(null);
      return;
    }
    setPending(player);
  }, [setPick]);

  const closePicker = useCallback(() => {
    setPending(null);
    setOpenLeague(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const league = openLeague;
    const player = pending;
    if (!league || !player || confirming) return;

    (async () => {
      const token = isSignedIn ? await getTokenRef.current().catch(() => null) : null;
      if (!token) {
        Alert.alert(pickCopy.signInTitle, pickCopy.signInBody);
        return;
      }
      setConfirming(true);
      try {
        const data = await topScorersFiveService.saveSelection(token, league, player.id, language);
        setPick(league, tsfPickFromSelection(data) ?? { ...player, locked: true, confirmed: true });
        closePicker();
      } catch (error) {
        logger.warn('[TopScorersFive] confirm failed', error);
        if (error instanceof TsfApiError && error.reason === 'GAMEWEEK_PICK_LOCKED') {
          const saved = await reloadPick(token, league);
          closePicker();
          explainLocked(saved ?? { ...player, confirmed: true });
        } else {
          explainFailure(error);
        }
      } finally {
        setConfirming(false);
      }
    })();
  }, [closePicker, confirming, explainFailure, explainLocked, isSignedIn, language, openLeague, pending, pickCopy, reloadPick, setPick]);

  const handleViewProfile = useCallback(
    (player: TsfPlayer) => {
      if (player.athleteId == null) return;
      setProfileOpen(true);
      pushPlayerCareer(router, {
        athleteId: player.athleteId,
        name: player.name,
        photo: player.photo,
        teamName: player.club,
        teamLogo: player.clubLogo,
        teamId: player.teamId,
      });
    },
    [router],
  );

  const handleRemove = useCallback(
    (league: TsfLeagueKey) => {
      const previous = picks[league];
      if (previous?.locked) {
        explainLocked(previous);
        return;
      }
      setPick(league, undefined);
      if (!isLive(league) || !previous) return;

      (async () => {
        const token = isSignedIn ? await getTokenRef.current().catch(() => null) : null;
        if (!token) return;
        try {
          await topScorersFiveService.clearSelection(token, league);
        } catch (error) {
          logger.warn('[TopScorersFive] clear failed', error);
          if (error instanceof TsfApiError && error.reason === 'GAMEWEEK_PICK_LOCKED') {
            explainLocked((await reloadPick(token, league)) ?? previous);
            return;
          }
          setPick(league, previous);
          explainFailure(error);
        }
      })();
    },
    [explainFailure, explainLocked, isSignedIn, picks, reloadPick, setPick],
  );

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
          onOpenLeague={handleOpenLeague}
          onRemove={handleRemove}
        />
      ) : null}

      {tab === 'matches' ? (
        <MatchesTab picked={picked} onBack={handleBack} onGoToPitch={goToPitch} />
      ) : null}

      {tab === 'ranking' ? <RankingTab onBack={handleBack} onPickNow={goToPitch} /> : null}

      <TsfNav activeTab={tab} onChange={setTab} scale={scale} />

      <PlayerPicker
        league={openLeague}
        hidden={profileOpen}
        players={livePlayers}
        selectedId={openLeague ? (pending?.id ?? picks[openLeague]?.id) : undefined}
        onClose={closePicker}
        onPick={handlePick}
        pending={pending}
        confirming={confirming}
        onConfirm={handleConfirm}
        onCancelPending={() => setPending(null)}
        onViewProfile={handleViewProfile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
});
