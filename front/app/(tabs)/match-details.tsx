import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiFootballService, { TeamStatistics, TeamFixture, FixtureEvent } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { prefetchFootballTranslations } from '../../src/stores/footballTranslationStore';
import { collectUniqueStrings } from '../../utils/footballNamePrefetch';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { APP_BG } from '../../constants/ui';
import { FootballField } from '../../components/match-details/FootballField';
import { matchArchiveService } from '../../services/matchArchiveService';
import TeamBadge from '../../components/common/TeamBadge';
import LeagueIcon from '../../components/common/LeagueIcon';
import { useScreenFont } from '../../utils/fontSetup';
import { Image as ExpoImage } from 'expo-image';
import {
  EventsSkeleton,
  LineupsSkeleton,
  StatsSkeleton,
  FormSkeleton,
  StandingsSkeleton,
  useShimmer,
} from '../../components/match-details/MatchDetailsSkeleton';
import { useLiveFixture } from '../../hooks/useLiveFixture';
import { useLiveFixtureStore } from '../../src/store/liveFixtureStore';
import {
  hasApiStatistics,
} from '../../utils/matchStatsFallback';
import { hasLineupData, isAuthoritativeLineupData } from '../../utils/matchLineupsFallback';
import { sortPlayersByGrid } from '../../utils/lineupGrid';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import {
  WC_LEAGUE_ID,
  SCORES365_LEAGUE_ID_OFFSET,
  scores365CompetitionIdFromLeagueId,
} from '../../constants/worldCup';
import type { StandingsGroup } from '../../utils/standingsHelpers';
import {
  resolveStandingsGroupsForMatch,
  sortStandingsGroups,
  standingRowMatchesTeam,
} from '../../utils/standingsHelpers';
import { getPeriodStartTimestamp } from '../../src/store/liveFixtureSelectors';

const { width, height } = Dimensions.get('window');

const LIVE_MATCH_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] as const;
const FINISHED_MATCH_STATUSES = ['FT', 'AET', 'PEN'] as const;

interface MatchDetailsParams {
  fixtureId: string;
}

/** Win/loss/draw from the displayed team's score — not fixture home/away winner flags. */
function resolveFormResult(
  teamScore: number | null | undefined,
  opponentScore: number | null | undefined,
): 'win' | 'lose' | 'draw' {
  if (teamScore == null || opponentScore == null) return 'draw';
  if (teamScore > opponentScore) return 'win';
  if (teamScore < opponentScore) return 'lose';
  return 'draw';
}

const MatchDetailsScreen = () => {
  useScreenFont();
  const router = useRouter();
  const { t, language } = useTranslation();
  const params = useLocalSearchParams() as unknown as MatchDetailsParams;
  const shimmerX = useShimmer();
  const translationsReady = Boolean(t?.matchDetails);

  const [activeTab, setActiveTab] = useState<'lineups' | 'stats' | 'form' | 'events' | 'standings' | 'stadium'>('events');

  const [homeLastFixtures, setHomeLastFixtures] = useState<TeamFixture[]>([]);
  const [awayLastFixtures, setAwayLastFixtures] = useState<TeamFixture[]>([]);
  const [standingsGroups, setStandingsGroups] = useState<StandingsGroup[]>([]);
  const [standingsSeasonUsed, setStandingsSeasonUsed] = useState<number | null>(null);
  const [standingsUnavailable, setStandingsUnavailable] = useState(false);

  const fixtureId = parseInt(params.fixtureId || '0', 10);
  const snapshot = useLiveFixture(fixtureId > 0 ? fixtureId : null, { focused: true });
  const fixture = snapshot?.fixture ?? null;
  const events = snapshot?.events ?? [];
  const statistics = snapshot?.statistics ?? [];
  const statsFromEvents = snapshot?.statsFromEvents ?? false;
  const lineups = snapshot?.lineups ?? [];
  const venue = snapshot?.venue ?? null;

  const homeTeamName = fixture?.teams?.home?.name ?? '';
  const awayTeamName = fixture?.teams?.away?.name ?? '';
  const homeTeamLogo = fixture?.teams?.home?.logo ?? '';
  const awayTeamLogo = fixture?.teams?.away?.logo ?? '';
  const leagueName = fixture?.league?.name ?? '';

  const is365Fixture = useMemo(() => {
    const leagueId = fixture?.league?.id ?? 0;
    return (
      leagueId === WC_LEAGUE_ID ||
      leagueId >= SCORES365_LEAGUE_ID_OFFSET ||
      Boolean((fixture as { _experiment?: string; _scores365GameId?: number } | null)?._experiment === 'scores365') ||
      Boolean((fixture as { _scores365GameId?: number } | null)?._scores365GameId)
    );
  }, [fixture]);

  const resolveLineupPlayerPhoto = useCallback(
    (playerId: number, photo?: string | null) =>
      playerPhotoUrl(playerId, photo, is365Fixture ? { source: '365' } : undefined),
    [is365Fixture],
  );

  const kickoffDate = fixture?.fixture?.date
    ? new Date(fixture.fixture.date).toISOString().split('T')[0]
    : '';
  const kickoffTime = fixture?.fixture?.date
    ? new Date(fixture.fixture.date).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  const [loading, setLoading] = useState(true);
  const [detailsFetching, setDetailsFetching] = useState(false);
  const [lineupsLoading, setLineupsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  const [lineupFetchAttempts, setLineupFetchAttempts] = useState(0);
  const [venueLoading, setVenueLoading] = useState(false);
  const MAX_LINEUP_AUTO_RETRIES = 4;

  const loadedTabsRef = useRef<Set<string>>(new Set());
  const lineupsPreloadedForRef = useRef<number | null>(null);
  const lineupsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineupsTabRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const isLive = useCallback(() => {
    if (!fixture) return snapshot?.phase === 'live';
    return LIVE_MATCH_STATUSES.includes(
      fixture.fixture.status.short as (typeof LIVE_MATCH_STATUSES)[number],
    );
  }, [fixture, snapshot?.phase]);

  const isFinishedMatch = useCallback(() => {
    const short = fixture?.fixture?.status?.short;
    return short
      ? ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)
      : snapshot?.phase === 'finished';
  }, [fixture, snapshot?.phase]);

  useEffect(() => {
    if (snapshot && loading) {
      setLoading(false);
    }
  }, [snapshot, loading]);

  useEffect(() => {
    if (language !== 'ar') return;
    const standingNames = standingsGroups.flatMap((g) =>
      g.standings.map((row) => row.team.name),
    );
    const lineupNames = lineups.flatMap((l) => [l.team?.name, ...(l.startXI?.map((p) => p.player?.name) ?? [])]);
    const eventNames = events.map((e) => e.team?.name);
    prefetchFootballTranslations(
      collectUniqueStrings(
        fixture?.teams?.home?.name,
        fixture?.teams?.away?.name,
        fixture?.league?.name,
        fixture?.league?.country,
        ...standingNames,
        ...lineupNames,
        ...eventNames,
        ...homeLastFixtures.flatMap((f) => [f.teams?.home?.name, f.teams?.away?.name, f.league?.name]),
        ...awayLastFixtures.flatMap((f) => [f.teams?.home?.name, f.teams?.away?.name, f.league?.name]),
      ),
      language,
    );
  }, [
    language,
    fixture,
    events,
    lineups,
    standingsGroups,
    homeLastFixtures,
    awayLastFixtures,
  ]);

  useEffect(() => {
    if (!translationsReady) return;

    setHomeLastFixtures([]);
    setAwayLastFixtures([]);
    setStandingsGroups([]);
    setStandingsSeasonUsed(null);
    setStandingsUnavailable(false);
    setLineupFetchAttempts(0);
    setLineupsError(null);
    setStatsError(null);
    setStandingsError(null);
    setFormError(null);
    setDetailsFetching(false);
    setLoading(true);
    setError(null);
    setLineupsLoading(false);
    setStatsLoading(false);
    setFormLoading(false);
    setStandingsLoading(false);
    loadedTabsRef.current = new Set();
    lineupsPreloadedForRef.current = null;

    void loadMatchDetails();

    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fixtureId, translationsReady]);

  const loadMatchDetails = async () => {
    if (!t?.matchDetails) return;

    if (!fixtureId) {
      setError(t.matchDetails.invalidMatchId);
      setLoading(false);
      return;
    }

    try {
      setDetailsFetching(true);
      setLoading(true);
      setError(null);

      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
      const snap = useLiveFixtureStore.getState().snapshots[fixtureId];

      if (snap?.fixture) {
        const details = snap.fixture;
        const finishedStatuses = ['FT', 'AET', 'PEN'];
        if (finishedStatuses.includes(details.fixture.status.short)) {
          Promise.allSettled([
            Promise.resolve(snap.lineups ?? []),
            Promise.resolve(snap.statistics ?? []),
            Promise.resolve(snap.events ?? []),
          ]).then(([lineupsRes, statsRes, eventsRes]) => {
            try {
              matchArchiveService.archiveMatchFromData(
                details,
                lineupsRes.status === 'fulfilled' ? lineupsRes.value : [],
                statsRes.status === 'fulfilled' ? statsRes.value : [],
                eventsRes.status === 'fulfilled' ? eventsRes.value : [],
              );
            } catch { /* non-fatal */ }
          }).catch(() => {});
        }
        if (isAuthoritativeLineupData(snap.lineups)) loadedTabsRef.current.add('lineups');
        if (hasApiStatistics(snap.statistics)) loadedTabsRef.current.add('stats');
        if (snap.venue) loadedTabsRef.current.add('stadium');
      } else {
        const archived = await matchArchiveService.getArchivedMatch(String(fixtureId));
        if (!archived) {
          setError(t.matchDetails.loadDetailsFailed);
        }
      }

      setLoading(false);
      setDetailsFetching(false);
    } catch (err: any) {
      setError(err?.message || t.matchDetails.loadDetailsFailed);
      setLoading(false);
      setDetailsFetching(false);
    }
  };

  // ── Lazy loaders — called when a tab is first activated ───────────────────
  const loadLineupsIfNeeded = useCallback(async (force = false) => {
    const snapLineups = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups;
    if (!force && loadedTabsRef.current.has('lineups') && isAuthoritativeLineupData(snapLineups)) {
      return;
    }
    if (!force) loadedTabsRef.current.add('lineups');
    setLineupsLoading(true);
    setLineupsError(null);
    try {
      const fresh = await ApiFootballService.getFixtureLineups(fixtureId, { skipCache: true });
      if (isAuthoritativeLineupData(fresh)) {
        const snap = useLiveFixtureStore.getState().snapshots[fixtureId];
        if (snap) {
          useLiveFixtureStore.getState().ingestSnapshot({
            ...snap,
            lineups: fresh,
            revision: snap.revision + 1,
            updatedAt: Date.now(),
          });
        }
      } else {
        await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
      }

      let data = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups ?? [];
      if (!isAuthoritativeLineupData(data) && isAuthoritativeLineupData(fresh)) {
        data = fresh;
      }

      if (isAuthoritativeLineupData(data)) {
        setLineupFetchAttempts(0);
        loadedTabsRef.current.add('lineups');
      } else if (hasLineupData(data)) {
        setLineupFetchAttempts((n) => n + 1);
        loadedTabsRef.current.delete('lineups');
      } else {
        setLineupFetchAttempts((n) => n + 1);
        loadedTabsRef.current.delete('lineups');
      }
    } catch (err: any) {
      setLineupsError(err?.message || t.matchDetails.loadLineupsFailed);
      setLineupFetchAttempts((n) => n + 1);
      loadedTabsRef.current.delete('lineups');
    } finally {
      setLineupsLoading(false);
    }
  }, [fixtureId, t?.matchDetails?.loadLineupsFailed]);

  const retryLineups = useCallback(() => {
    setLineupFetchAttempts(0);
    loadedTabsRef.current.delete('lineups');
    void loadLineupsIfNeeded(true);
  }, [loadLineupsIfNeeded]);

  // Lineups may be published shortly before kickoff — refresh every 60s while live + tab open
  useEffect(() => {
    if (lineupsPollingRef.current) {
      clearInterval(lineupsPollingRef.current);
      lineupsPollingRef.current = null;
    }
    if (!isLive() || !fixtureId || activeTab !== 'lineups') return;

    lineupsPollingRef.current = setInterval(async () => {
      try {
        loadedTabsRef.current.delete('lineups');
        await loadLineupsIfNeeded(true);
      } catch { /* silent */ }
    }, 15_000);

    return () => {
      if (lineupsPollingRef.current) {
        clearInterval(lineupsPollingRef.current);
        lineupsPollingRef.current = null;
      }
    };
  }, [fixtureId, isLive, activeTab, loadLineupsIfNeeded]);

  // Auto-retry lineups while the tab is open (capped — then show empty state + manual retry).
  useEffect(() => {
    if (lineupsTabRetryRef.current) {
      clearInterval(lineupsTabRetryRef.current);
      lineupsTabRetryRef.current = null;
    }
    if (activeTab !== 'lineups' || !fixtureId || lineupsError) return;
    if (isAuthoritativeLineupData(lineups)) return;
    if (lineupFetchAttempts >= MAX_LINEUP_AUTO_RETRIES) return;

    const tick = () => {
      if (!lineupsLoading && lineupFetchAttempts < MAX_LINEUP_AUTO_RETRIES) {
        void loadLineupsIfNeeded(true);
      }
    };
    tick();
    lineupsTabRetryRef.current = setInterval(tick, 8_000);

    return () => {
      if (lineupsTabRetryRef.current) {
        clearInterval(lineupsTabRetryRef.current);
        lineupsTabRetryRef.current = null;
      }
    };
  }, [
    activeTab,
    fixtureId,
    lineups,
    lineupsError,
    lineupsLoading,
    lineupFetchAttempts,
    isFinishedMatch,
    loadLineupsIfNeeded,
  ]);

  const loadStatsIfNeeded = useCallback(async (force = false) => {
    if (!force && loadedTabsRef.current.has('stats')) return;
    if (!force) loadedTabsRef.current.add('stats');
    setStatsLoading(true);
    setStatsError(null);
    try {
      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
      const snap = useLiveFixtureStore.getState().snapshots[fixtureId];
      const data = snap?.statistics ?? [];
      if (isLive() && !hasApiStatistics(data) && !snap?.statsFromEvents) {
        loadedTabsRef.current.delete('stats');
      }
    } catch (err: any) {
      setStatsError(err?.message || t.matchDetails.loadStatsFailed);
      loadedTabsRef.current.delete('stats');
    } finally {
      setStatsLoading(false);
    }
  }, [fixtureId, isLive, t?.matchDetails?.loadStatsFailed]);

  // Retry stats every 45s while live (lower-tier leagues often publish late)
  useEffect(() => {
    if (statsPollingRef.current) {
      clearInterval(statsPollingRef.current);
      statsPollingRef.current = null;
    }
    if (!isLive() || !fixtureId || activeTab !== 'stats') return;

    statsPollingRef.current = setInterval(() => {
      loadedTabsRef.current.delete('stats');
      loadStatsIfNeeded(true).catch(() => {});
    }, 5_000);

    return () => {
      if (statsPollingRef.current) {
        clearInterval(statsPollingRef.current);
        statsPollingRef.current = null;
      }
    };
  }, [fixtureId, isLive, activeTab, loadStatsIfNeeded]);

  const loadFormIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('form') || !fixture) return;
    loadedTabsRef.current.add('form');
    setFormLoading(true);
    try {
      const is365 =
        (fixture as { _experiment?: string })._experiment === 'scores365' ||
        (fixture as { _scores365GameId?: number })._scores365GameId != null ||
        fixture.league?.id === WC_LEAGUE_ID ||
        (fixture.league?.id ?? 0) >= SCORES365_LEAGUE_ID_OFFSET;
      if (is365 && fixtureId) {
        const form365 = await ApiFootballService.get365MatchForm(fixtureId);
        if (form365) {
          setHomeLastFixtures(form365.home);
          setAwayLastFixtures(form365.away);
          return;
        }
      }
      const homeId = fixture.teams.home.id;
      const awayId = fixture.teams.away.id;
      const leagueId = fixture.league.id;
      const season = fixture.league.season;
      const [homeRes, awayRes] = await Promise.allSettled([
        ApiFootballService.getTeamLastFixtures(homeId, 5, { leagueId, season }),
        ApiFootballService.getTeamLastFixtures(awayId, 5, { leagueId, season }),
      ]);
      if (homeRes.status === 'fulfilled') setHomeLastFixtures(homeRes.value);
      if (awayRes.status === 'fulfilled') setAwayLastFixtures(awayRes.value);
    } catch { /* silent */ }
    finally { setFormLoading(false); }
  }, [fixtureId, fixture]);

  const loadStandingsIfNeeded = useCallback(async (force = false) => {
    if (!force && loadedTabsRef.current.has('standings')) return;
    if (!fixture) return;
    if (!force) loadedTabsRef.current.add('standings');
    setStandingsLoading(true);
    setStandingsError(null);
    setStandingsUnavailable(false);
    try {
      // 365Scores standings cover the World Cup AND all non-WC leagues synced
      // via the allscores pipeline (namespaced leagueId >= offset). Detect via the
      // experiment markers, the WC league id, or the namespaced league id, so
      // standings still resolve if a runtime fixture object dropped the markers.
      const non365CompetitionId = scores365CompetitionIdFromLeagueId(fixture.league?.id);
      const is365 =
        (fixture as { _experiment?: string })._experiment === 'scores365' ||
        (fixture as { _scores365GameId?: number })._scores365GameId != null ||
        fixture.league?.id === WC_LEAGUE_ID ||
        (fixture.league?.id ?? 0) >= SCORES365_LEAGUE_ID_OFFSET;
      if (is365) {
        // Non-WC leagues must pass their 365 competitionId; WC omits it (defaults).
        const result365 = await ApiFootballService.get365StandingsGrouped(
          non365CompetitionId ?? undefined,
        );
        if (result365.available) {
          const homeTeam = { id: fixture.teams.home.id, name: fixture.teams.home.name };
          const awayTeam = { id: fixture.teams.away.id, name: fixture.teams.away.name };
          const isWcLeague = fixture.league?.id === WC_LEAGUE_ID;
          const matchGroups = isWcLeague
            ? sortStandingsGroups(result365.groups)
            : resolveStandingsGroupsForMatch(result365.groups, homeTeam, awayTeam);
          if (matchGroups.length > 0) {
            setStandingsGroups(matchGroups);
            setStandingsSeasonUsed(fixture.league.season);
            return;
          }
          // 365 returned standings but neither team is in a group table
          // (e.g. knockout stage) — fall through to the league standings path.
        }
        // Synthetic 365 leagues have no API-Football leagueId — don't query it
        // with a namespaced id; just show "standings unavailable".
        if (non365CompetitionId != null) {
          setStandingsUnavailable(true);
          return;
        }
      }
      const preferFresh = force || isLive() || isFinishedMatch();
      const result = await ApiFootballService.getLeagueStandingsGrouped(
        fixture.league.id,
        fixture.league.season,
        { skipCache: preferFresh },
      );
      const homeTeam = {
        id: fixture.teams.home.id,
        name: fixture.teams.home.name,
      };
      const awayTeam = {
        id: fixture.teams.away.id,
        name: fixture.teams.away.name,
      };
      const matchGroups = resolveStandingsGroupsForMatch(
        result.groups,
        homeTeam,
        awayTeam,
      );
      setStandingsGroups(matchGroups);
      setStandingsSeasonUsed(result.available ? result.season : null);
      if (!result.available || matchGroups.length === 0) {
        setStandingsUnavailable(true);
      }
    } catch (err: any) {
      setStandingsError(err?.message || t.matchDetails.loadStandingsFailed);
      loadedTabsRef.current.delete('standings');
    } finally {
      setStandingsLoading(false);
    }
  }, [
    fixture,
    isLive,
    isFinishedMatch,
    t?.matchDetails?.loadStandingsFailed,
  ]);

  const loadVenueIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('stadium') || !fixture) return;
    loadedTabsRef.current.add('stadium');
    setVenueLoading(true);
    try {
      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
    } catch {
      // venue may remain from fixture stub in snapshot
    } finally {
      setVenueLoading(false);
    }
  }, [fixtureId, fixture]);

  // Reload stats when match reaches HT or full time
  useEffect(() => {
    const short = fixture?.fixture?.status?.short;
    if (!short) return;
    if (short === 'HT' || short === 'FT' || short === 'AET' || short === 'PEN') {
      loadedTabsRef.current.delete('stats');
      if (short === 'FT' || short === 'AET' || short === 'PEN') {
        loadedTabsRef.current.delete('standings');
      }
      if (activeTab === 'stats') {
        loadStatsIfNeeded();
      }
      if (
        (short === 'FT' || short === 'AET' || short === 'PEN') &&
        activeTab === 'standings'
      ) {
        void loadStandingsIfNeeded(true);
      }
    }
  }, [fixture?.fixture?.status?.short, activeTab, loadStatsIfNeeded, loadStandingsIfNeeded]);

  // Standings need fixture league ids — load when fixture arrives while tab is open
  useEffect(() => {
    if (activeTab !== 'standings' || !fixture) return;
    if (loadedTabsRef.current.has('standings')) return;
    void loadStandingsIfNeeded();
  }, [activeTab, fixture?.fixture?.id, loadStandingsIfNeeded]);

  // Refresh group table during live matches (updates after goals)
  useEffect(() => {
    if (!isLive() || !fixtureId || activeTab !== 'standings') return;
    const interval = setInterval(() => {
      loadedTabsRef.current.delete('standings');
      void loadStandingsIfNeeded(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [fixtureId, isLive, activeTab, loadStandingsIfNeeded]);

  // Preload lineups for live matches so the tab is ready when opened
  useEffect(() => {
    if (!fixtureId || !fixture || !isLive()) return;
    if (lineupsPreloadedForRef.current === fixtureId) return;
    lineupsPreloadedForRef.current = fixtureId;
    void loadLineupsIfNeeded(true);
  }, [fixtureId, fixture?.fixture?.id, isLive, loadLineupsIfNeeded]);

  // ── Tab change handler — triggers lazy load ───────────────────────────────
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as any);
    switch (tab) {
      case 'lineups':   loadLineupsIfNeeded(); break;
      case 'stats':     loadStatsIfNeeded(); break;
      case 'form':      loadFormIfNeeded(); break;
      case 'standings': loadStandingsIfNeeded(); break;
      case 'stadium':   loadVenueIfNeeded(); break;
    }
  }, [loadLineupsIfNeeded, loadStatsIfNeeded, loadFormIfNeeded, loadStandingsIfNeeded, loadVenueIfNeeded]);

  const openPlayerProfile = useCallback(
    (
      player: { id: number; name: string; photo?: string | null; athleteId?: number },
      lineupTeam: { id: number; name: string; logo: string },
    ) => {
      const athleteId = player.athleteId ?? player.id;
      router.push({
        pathname: '/player-profile' as any,
        params: {
          id: String(athleteId),
          athleteId: String(athleteId),
          name: player.name,
          photo: resolveLineupPlayerPhoto(athleteId, player.photo),
          teamName: lineupTeam.name,
          teamLogo: lineupTeam.logo,
          teamId: String(lineupTeam.id),
          season: fixture?.league?.season != null ? String(fixture.league.season) : '',
          fixtureId: fixtureId > 0 ? String(fixtureId) : '',
          dataSource: is365Fixture ? '365' : 'api',
          fresh: '1',
        },
      } as any);
    },
    [router, fixture?.league?.season, fixtureId, is365Fixture, resolveLineupPlayerPhoto],
  );

  const parseFormation = (formation: string | null): number[] => {
    if (!formation) return [];
    return formation.split('-').map(Number).filter(n => !isNaN(n));
  };

  const parseGrid = (grid: string | null): { x: number; y: number } | null => {
    if (!grid) return null;
    const [x, y] = grid.split(':').map(Number);
    return { x: x || 0, y: y || 0 };
  };

  const getPositionName = (pos: string | null): string => {
    const positions: { [key: string]: string } = {
      'G': t.matchDetails?.goalkeeper || 'GK',
      'D': t.matchDetails?.defender || 'DEF',
      'M': t.matchDetails?.midfielder || 'MID',
      'F': t.matchDetails?.forward || 'FWD',
    };
    return positions[pos || ''] || String(pos || '') || t.common?.unknown || 'Unknown';
  };

  // Player Card Component with proper player photo
  const PlayerCard = ({ player, number, position }: { player: any; number: number; position: string | null }) => {
    const playerPhoto = resolveLineupPlayerPhoto(player.id, player.photo);
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerNumber}>
          <Text style={styles.playerNumberText}>{number}</Text>
        </View>
        <ExpoImage
          source={{ uri: playerPhoto }}
          style={styles.playerPhoto}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={require('../../assets/images/football.png')}
        />
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.playerName} numberOfLines={2}>{player.name}</Text>
          <Text style={styles.playerPosition}>{getPositionName(position)}</Text>
        </View>
      </View>
    );
  };

  // Helper function to get event icon
  const getEventIcon = (type: string, detail: string) => {
    if (type === 'Goal') return 'football';
    if (type === 'Card') {
      if (detail.includes('Yellow')) return 'card';
      if (detail.includes('Red')) return 'card';
    }
    if (type === 'subst') return 'swap-horizontal';
    return 'information-circle';
  };

  // Helper function to get event color
  const getEventColor = (type: string, detail: string) => {
    if (type === 'Goal') return '#22c55e';
    if (type === 'Card') {
      if (detail.includes('Yellow')) return '#f59e0b';
      if (detail.includes('Red')) return '#ef4444';
    }
    if (type === 'subst') return '#3b82f6';
    return '#888';
  };

  // Helper function to get event label
  const getEventLabel = (type: string, detail: string) => {
    if (type === 'Goal') {
      if (detail.includes('Penalty')) return t.matchDetails.penaltyGoal;
      if (detail.includes('Own')) return t.matchDetails.ownGoal;
      return t.matchDetails.goal;
    }
    if (type === 'Card') {
      if (detail.includes('Yellow')) return t.matchDetails.yellowCard;
      if (detail.includes('Red')) return t.matchDetails.redCard;
    }
    if (type === 'subst') return t.matchDetails.substitution;
    return detail;
  };

  // Render Events Tab
  const renderEvents = () => {
    if (detailsFetching && events.length === 0) {
      return <EventsSkeleton shimmerX={shimmerX} />;
    }
    if (events.length === 0) {
      const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];
      const inPlay =
        liveStatuses.includes(fixture?.fixture?.status?.short ?? '') ||
        isLive();
      return (
        <View style={styles.emptyState}>
          <Ionicons name="football-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noEvents}</Text>
          {inPlay ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId)}
            >
              <Text style={styles.retryButtonText}>
                {t.matchDetails.standingsRetry || t.common.retry}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>{t.matchDetails.matchEvents}</Text>
          {events.map((event, index) => {
            const homeTeamId = fixture?.teams?.home?.id;
            const isHomeTeam = homeTeamId != null
              ? event.team.id === homeTeamId
              : event.team.name.toLowerCase().includes(homeTeamName.toLowerCase()) ||
                homeTeamName.toLowerCase().includes(event.team.name.toLowerCase());

            return (
              <View key={index} style={[styles.eventCard, isHomeTeam ? styles.eventHome : styles.eventAway]}>
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>{event.time.elapsed}'</Text>
                  {!!event.time.extra && (
                    <Text style={styles.eventExtraTime}>+{event.time.extra}'</Text>
                  )}
                </View>

                <View style={[styles.eventIcon, { backgroundColor: `${getEventColor(event.type, event.detail)}20` }]}>
                  <Ionicons
                    name={getEventIcon(event.type, event.detail) as any}
                    size={20}
                    color={getEventColor(event.type, event.detail)}
                  />
                </View>

                <View style={styles.eventDetails}>
                  {!!event.player.name && <Text style={styles.eventPlayer}>{String(event.player.name)}</Text>}
                  <Text style={styles.eventType}>{getEventLabel(event.type, event.detail)}</Text>
                  {!!event.assist.name && (
                    <Text style={styles.eventAssist}>{t.matchDetails?.assist || 'Assist'}: {String(event.assist.name)}</Text>
                  )}
                </View>

                <TeamBadge name={getTeamDisplayName(event.team.name, language)} logo={event.team.logo} size={30} color="transparent" />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Lineups Tab
  const renderLineups = () => {
    if (lineupsLoading) {
      return <LineupsSkeleton shimmerX={shimmerX} />;
    }

    if (lineupsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{lineupsError}</Text>
        </View>
      );
    }

    if (!hasLineupData(lineups)) {
      // Only keep showing the spinner while auto-retry is actually running:
      // live matches always poll; non-finished matches retry until the cap.
      // Finished matches with no data must fall through to the empty state
      // immediately so the user never gets stuck on an infinite spinner.
      const stillRetrying = lineupFetchAttempts < MAX_LINEUP_AUTO_RETRIES;
      if (stillRetrying) {
        return (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#A855F7" />
            <Text style={styles.emptyStateSubtext}>
              {t.matchDetails.lineupsLoadingRetry}
            </Text>
          </View>
        );
      }
      // Finished matches with no provider data get a clear "missing data" copy;
      // not-yet-started matches keep the "not available yet / retry" wording.
      const subtext = isFinishedMatch()
        ? t.matchDetails.lineupsNoData
        : t.matchDetails.lineupsUnavailable;
      return (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noLineups}</Text>
          <Text style={styles.emptyStateSubtext}>{subtext}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryLineups}>
            <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.lineupsContainer}>
          {lineups.map((lineup, index) => {
            const formation = lineup.formation || '4-4-2';
            const startingXI = lineup.startXI || [];
            const substitutes = lineup.substitutes || [];

            const fieldPlayers = sortPlayersByGrid(
              startingXI.map((item: any) => ({
                id: item.player.athleteId ?? item.player.id,
                athleteId: item.player.athleteId ?? item.player.id,
                name: item.player.name,
                number: item.player.number,
                pos: item.player.pos,
                grid: item.player.grid,
                fieldLine: item.player.fieldLine,
                fieldSide: item.player.fieldSide,
                photo: resolveLineupPlayerPhoto(
                  item.player.athleteId ?? item.player.id,
                  item.player.photo,
                ) || undefined,
              })),
            );

            return (
              <View key={index} style={styles.teamLineupContainer}>
                <View style={styles.teamHeader}>
                  <TeamBadge name={lineup.team.name} logo={lineup.team.logo} size={60} color="transparent" />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName} numberOfLines={2}>{getTeamDisplayName(lineup.team.name, language)}</Text>
                    <Text style={styles.formationText}>
                      {t.matchDetails.formation}: {formation}
                    </Text>
                    <Text style={styles.coachText}>
                      {t.matchDetails.coach}: {lineup.coach?.name || t.common.unknown}
                    </Text>
                  </View>
                </View>

                {/* Football Field Visualization */}
                <FootballField
                  formation={formation}
                  players={fieldPlayers}
                  teamName={lineup.team.name}
                  teamColor={index === 0 ? homeTeamName === lineup.team.name ? '#A855F7' : '#3b82f6' : awayTeamName === lineup.team.name ? '#3b82f6' : '#A855F7'}
                  onPlayerPress={(player) => {
                    if (player.id) {
                      openPlayerProfile(
                        { id: player.id, name: player.name, photo: player.photo },
                        lineup.team,
                      );
                    }
                  }}
                />

                {/* Substitutes */}
                {substitutes.length > 0 && (
                  <View style={styles.substitutesSection}>
                    <Text style={styles.substitutesTitle}>{t.matchDetails.substitutes}</Text>
                    <View style={styles.substitutesGrid}>
                      {substitutes.map((item: any) => (
                        <TouchableOpacity
                          key={item.player.id}
                          style={styles.substituteCard}
                          onPress={() => {
                            openPlayerProfile(
                              {
                                id: item.player.athleteId ?? item.player.id,
                                athleteId: item.player.athleteId ?? item.player.id,
                                name: item.player.name,
                                photo: item.player.photo,
                              },
                              lineup.team,
                            );
                          }}
                        >
                          <ExpoImage
                            source={{
                              uri: resolveLineupPlayerPhoto(
                                item.player.athleteId ?? item.player.id,
                                item.player.photo,
                              ),
                            }}
                            style={{ width: 28, height: 28, borderRadius: 14 }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          <Text style={styles.substituteNumber}>{item.player.number || '-'}</Text>
                          <View style={styles.substituteInfo}>
                            <Text style={styles.substituteName} numberOfLines={1}>{item.player.name}</Text>
                            <Text style={styles.substitutePos}>{item.player.pos}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Statistics Tab
  const renderStatistics = () => {
    if (statsLoading) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (statsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{statsError}</Text>
        </View>
      );
    }

    if (statistics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="stats-chart-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noStats || 'Statistics not available'}</Text>
          <Text style={styles.emptyStateSubtext}>
            {isLive()
              ? (t.matchDetails.statsLiveRetry || 'Stats may appear later for this league. Retrying…')
              : (t.matchDetails.statsLeagueLimited || 'Full statistics are not provided for this competition.')}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statsContainer}>
          {statsFromEvents && (
            <Text style={styles.statsPartialNote}>
              {t.matchDetails.statsFromEvents || 'Partial stats derived from match events'}
            </Text>
          )}
          <Text style={styles.sectionTitle}>{t.matchDetails.statistics || 'Match Statistics'}</Text>
          {statistics[0]?.statistics.map((stat: any, index: number) => {
            const homeValue = stat.value;
            const awayStat = statistics[1]?.statistics.find(
              (s: { type: string }) => s.type === stat.type,
            );
            const awayValue = awayStat?.value ?? 0;

            const parseStatNum = (v: unknown): number => {
              if (typeof v === 'number' && Number.isFinite(v)) return v;
              if (typeof v === 'string') {
                const pct = v.match(/^(\d+(?:\.\d+)?)\s*%$/);
                if (pct) return parseFloat(pct[1]) || 0;
                const n = parseFloat(v.replace(/[^\d.]/g, ''));
                return Number.isFinite(n) ? n : 0;
              }
              return 0;
            };

            const homeNum = parseStatNum(homeValue);
            const awayNum = parseStatNum(awayValue);
            const total = homeNum + awayNum || 1;
            const homePercentage = (homeNum / total) * 100;
            const awayPercentage = (awayNum / total) * 100;

            return (
              <View key={index} style={styles.statRow}>
                <Text style={styles.statValue}>{String(homeValue || '0')}</Text>
                <View style={styles.statCenter}>
                  <Text style={styles.statLabel}>{String(stat.type || '')}</Text>
                  <View style={styles.statBarsContainer}>
                    <View style={[styles.statBar, styles.statBarHome, { width: `${homePercentage}%` }]} />
                    <View style={[styles.statBar, styles.statBarAway, { width: `${awayPercentage}%` }]} />
                  </View>
                </View>
                <Text style={styles.statValue}>{String(awayValue || '0')}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };


  const renderForm = () => {
    // البحث عن team IDs من lineups
    const homeLineup = lineups.find(l =>
      l.team.name.toLowerCase().includes(homeTeamName.toLowerCase()) ||
      homeTeamName.toLowerCase().includes(l.team.name.toLowerCase())
    );
    const awayLineup = lineups.find(l =>
      l.team.name.toLowerCase().includes(awayTeamName.toLowerCase()) ||
      awayTeamName.toLowerCase().includes(l.team.name.toLowerCase())
    );

    const homeTeamId = homeLineup?.team.id || (lineups.length > 0 ? lineups[0]?.team.id : null);
    const awayTeamId = awayLineup?.team.id || (lineups.length > 1 ? lineups[1]?.team.id : null);

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Home Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TeamBadge name={homeTeamName} logo={homeTeamLogo} size={50} color="transparent" />
            <Text style={styles.formTeamName}>{getTeamDisplayName(homeTeamName, language)}</Text>
            <Text style={styles.formTitle}>{t.matchDetails.last5Matches}</Text>
          </View>
          {homeLastFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {homeLastFixtures.map((fixture, index) => {
                const isHome = homeTeamId ? fixture.teams.home.id === homeTeamId : true;
                const opponent = isHome ? fixture.teams.away : fixture.teams.home;
                const teamScore = isHome ? fixture.goals.home : fixture.goals.away;
                const opponentScore = isHome ? fixture.goals.away : fixture.goals.home;
                const result = resolveFormResult(teamScore, opponentScore);

                return (
                  <View key={index} style={styles.fixtureCard}>
                    <TeamBadge name={opponent.name} logo={opponent.logo} size={40} color="transparent" />
                    <View style={styles.fixtureInfo}>
                      <Text style={styles.fixtureOpponent}>{getTeamDisplayName(opponent.name, language)}</Text>
                      <Text style={styles.fixtureLeague}>
                        {getLeagueDisplayName(
                          fixture.league.name,
                          language,
                          fixture.league.id,
                          undefined,
                        )}
                      </Text>
                    </View>
                    <View style={[styles.fixtureResult, result === 'win' && styles.fixtureWin,
                    result === 'lose' && styles.fixtureLose,
                    result === 'draw' && styles.fixtureDraw]}>
                      <Text style={styles.fixtureScore}>{teamScore} - {opponentScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t.matchDetails.noPreviousMatches}</Text>
            </View>
          )}
        </View>

        {/* Away Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TeamBadge name={awayTeamName} logo={awayTeamLogo} size={50} color="transparent" />
            <Text style={styles.formTeamName}>{getTeamDisplayName(awayTeamName, language)}</Text>
            <Text style={styles.formTitle}>{t.matchDetails.last5Matches}</Text>
          </View>
          {awayLastFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {awayLastFixtures.map((fixture, index) => {
                const isHome = awayTeamId ? fixture.teams.home.id === awayTeamId : false;
                const opponent = isHome ? fixture.teams.away : fixture.teams.home;
                const teamScore = isHome ? fixture.goals.home : fixture.goals.away;
                const opponentScore = isHome ? fixture.goals.away : fixture.goals.home;
                const result = resolveFormResult(teamScore, opponentScore);

                return (
                  <View key={index} style={styles.fixtureCard}>
                    <Image source={{ uri: opponent.logo }} style={styles.fixtureTeamLogo} />
                    <View style={styles.fixtureInfo}>
                      <Text style={styles.fixtureOpponent}>{getTeamDisplayName(opponent.name, language)}</Text>
                      <Text style={styles.fixtureLeague}>
                        {getLeagueDisplayName(
                          fixture.league.name,
                          language,
                          fixture.league.id,
                          undefined,
                        )}
                      </Text>
                    </View>
                    <View style={[styles.fixtureResult, result === 'win' && styles.fixtureWin,
                    result === 'lose' && styles.fixtureLose,
                    result === 'draw' && styles.fixtureDraw]}>
                      <Text style={styles.fixtureScore}>{teamScore} - {opponentScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t.matchDetails.noPreviousMatches}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStadium = () => {
    if (venueLoading) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (!venue && !fixture?.fixture.venue) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noStadiumInfo || 'No stadium information available'}</Text>
        </View>
      );
    }

    const venueData = venue || {
      id: fixture?.fixture.venue?.id,
      name: fixture?.fixture.venue?.name,
      city: fixture?.fixture.venue?.city,
      address: null,
      country: null,
      capacity: null,
      surface: null,
      image: null,
    };

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.stadiumContainer}>
          {venueData.image && (
            <Image source={{ uri: venueData.image }} style={styles.stadiumImage} />
          )}
          <View style={styles.stadiumInfo}>
            <Text style={styles.stadiumName}>{venueData.name || 'Unknown Stadium'}</Text>
            {venueData.city && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="location" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{venueData.city}</Text>
                {venueData.country && <Text style={styles.stadiumDetailText}> • {venueData.country}</Text>}
              </View>
            )}
            {venueData.address && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="map" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{venueData.address}</Text>
              </View>
            )}
            {venueData.capacity && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="people" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{t.matchDetails.capacity || 'Capacity'}: {venueData.capacity.toLocaleString()}</Text>
              </View>
            )}
            {venueData.surface && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="football" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{t.matchDetails.surface || 'Surface'}: {venueData.surface}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderStandings = () => {
    if (standingsLoading) {
      return <StandingsSkeleton shimmerX={shimmerX} />;
    }

    if (standingsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{standingsError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              loadedTabsRef.current.delete('standings');
              void loadStandingsIfNeeded(true);
            }}
          >
            <Text style={styles.retryButtonText}>{t.matchDetails.standingsRetry || t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (standingsUnavailable || standingsGroups.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>
            {t.matchDetails.standingsUnavailable || t.matchDetails.standingsLeagueLimited}
          </Text>
          <Text style={styles.emptyStateSubtext}>
            {t.matchDetails.standingsLeagueLimited}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              loadedTabsRef.current.delete('standings');
              void loadStandingsIfNeeded(true);
            }}
          >
            <Text style={styles.retryButtonText}>{t.matchDetails.standingsRetry || t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const renderStandingsTable = (rows: any[], keyPrefix: string) => (
      <>
        <View style={styles.standingsHeader}>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>#</Text>
          <Text style={[styles.standingsHeaderText, { flex: 1, textAlign: 'left' }]}>{t.matchDetails.team}</Text>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>P</Text>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>GD</Text>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>Pts</Text>
        </View>
        {rows.map((team: any, index: number) => {
          const homeRef = {
            id: fixture?.teams?.home?.id,
            name: fixture?.teams?.home?.name,
          };
          const awayRef = {
            id: fixture?.teams?.away?.id,
            name: fixture?.teams?.away?.name,
          };
          const isHighlighted =
            standingRowMatchesTeam(team, homeRef) ||
            standingRowMatchesTeam(team, awayRef);

          return (
            <View
              key={`${keyPrefix}-${team.team.id ?? index}`}
              style={[styles.standingsRow, isHighlighted && styles.standingsRowHighlighted]}
            >
              <Text style={[styles.standingsText, { width: 30 }]}>{team.rank}</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={{ uri: team.team.logo }} style={{ width: 20, height: 20 }} />
                <Text style={[styles.standingsText, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                  {getTeamDisplayName(team.team.name, language)}
                </Text>
              </View>
              <Text style={[styles.standingsText, { width: 30 }]}>{team.all.played}</Text>
              <Text style={[styles.standingsText, { width: 30 }]}>{team.goalsDiff}</Text>
              <Text style={[styles.standingsText, { width: 30, fontWeight: 'bold' }]}>{team.points}</Text>
            </View>
          );
        })}
      </>
    );

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {standingsSeasonUsed != null && standingsSeasonUsed !== fixture?.league?.season && (
          <Text style={styles.standingsSeasonNote}>
            {(t.matchDetails.standingsSeasonNote || 'Season {season}').replace(
              '{season}',
              String(standingsSeasonUsed),
            )}
          </Text>
        )}
        {standingsGroups.map((groupBlock, groupIndex) => (
          <View key={`${groupBlock.group}-${groupIndex}`} style={styles.standingsContainer}>
            {groupBlock.group !== 'Table' && (
              <Text style={styles.standingsGroupTitle}>
                {(t.matchDetails.standingsGroupLabel || 'Group {name}').replace(
                  '{name}',
                  groupBlock.group.replace(/^Group\s+/i, ''),
                )}
              </Text>
            )}
            {renderStandingsTable(groupBlock.standings, `${groupBlock.group}-${groupIndex}`)}
          </View>
        ))}
      </ScrollView>
    );
  };

  if (loading && !snapshot) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={{ paddingHorizontal: 20, paddingTop: 100 }}>
          {/* Header skeleton */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1b4b' }} />
            <View style={{ flex: 1, marginHorizontal: 16, height: 16, borderRadius: 8, backgroundColor: '#1e1b4b' }} />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1b4b' }} />
          </View>
          {/* Score card skeleton */}
          <View style={{ height: 160, borderRadius: 24, backgroundColor: '#1e1b4b', marginBottom: 16 }} />
          {/* Tabs skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[80, 80, 90, 80, 70, 80].map((w, i) => (
              <View key={i} style={{ width: w, height: 36, borderRadius: 12, backgroundColor: '#1e1b4b' }} />
            ))}
          </View>
          {/* Events skeleton */}
          <EventsSkeleton shimmerX={shimmerX} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMatchDetails}>
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!translationsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  const tabs = [
    { key: 'events', label: t.matchDetails.events, icon: 'football' as const },
    { key: 'lineups', label: t.matchDetails.lineups, icon: 'people' as const },
    { key: 'stats', label: t.matchDetails.statistics, icon: 'stats-chart' as const },
    { key: 'form', label: t.matchDetails.form, icon: 'trending-up' as const },
    { key: 'standings', label: t.matchDetails.standings || 'Table', icon: 'list' as const },
    { key: 'stadium', label: t.matchDetails.stadium || 'Stadium', icon: 'business' as const },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0720" />

      {/* Custom Top Bar */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          style={styles.backButtonRound}
          onPress={() => router.push('/(tabs)/matches' as any)}
          accessibilityRole="button"
          accessibilityLabel="العودة إلى المباريات"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.matchDetails.title || 'Match Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Modern Header (Score Card) */}
        <MatchHeader
          homeTeam={getTeamDisplayName(homeTeamName, language)}
          awayTeam={getTeamDisplayName(awayTeamName, language)}
          homeLogo={homeTeamLogo}
          awayLogo={awayTeamLogo}
          homeScore={fixture?.goals?.home != null ? String(fixture.goals.home) : undefined}
          awayScore={fixture?.goals?.away != null ? String(fixture.goals.away) : undefined}
          status={fixture ? (
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(fixture.fixture.status.short) ? 'live'
            : ['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short) ? 'finished'
            : 'upcoming'
          ) : 'upcoming'}
          league={getLeagueDisplayName(
            leagueName,
            language,
            fixture?.league?.id,
            fixture?.league?.country,
          )}
          date={kickoffDate}
          time={kickoffTime}
          fixtureDate={fixture?.fixture?.date}
          statusShort={fixture?.fixture.status.short}
          elapsed={fixture?.fixture.status.elapsed ?? undefined}
          stoppage={(fixture?.fixture.status as any)?.extra ?? null}
          startTimestamp={fixture ? getPeriodStartTimestamp(fixture) : undefined}
        />

        {/* Modern Tabs */}
        <ModernTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'lineups' && renderLineups()}
          {activeTab === 'stats' && renderStatistics()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'standings' && renderStandings()}
          {activeTab === 'stadium' && renderStadium()}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  customHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  lineupsContainer: {
    paddingBottom: 40,
  },
  substitutesSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  substitutesList: {
    marginBottom: 24,
  },
  substitutesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  substitutesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  substituteCard: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  substituteNumber: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  substituteName: {
    color: '#fff',
    fontSize: 12,
  },
  substituteInfo: {
    justifyContent: 'center',
  },
  substitutePos: {
    color: '#888',
    fontSize: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  matchHeader: {
    alignItems: 'center',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  matchTeam: {
    flex: 1,
    alignItems: 'center',
  },
  headerTeamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  headerTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
  },
  scoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreDivider: {
    color: '#666',
    fontSize: 20,
  },
  matchTime: {
    color: '#A855F7',
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueLogo: {
    width: 20,
    height: 20,
  },
  leagueName: {
    color: '#888',
    fontSize: 12,
  },
  matchDate: {
    color: '#888',
    fontSize: 12,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    minWidth: 100,
  },
  activeTab: {
    backgroundColor: '#A855F7',
  },
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryInlineBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  retryInlineTxt: {
    color: '#D8B4FE',
    fontSize: 14,
    fontWeight: '700',
  },
  teamLineupContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  teamLogo: {
    width: 60,
    height: 60,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  formationText: {
    color: '#A855F7',
    fontSize: 14,
    marginBottom: 2,
  },
  coachText: {
    color: '#888',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  startingXIContainer: {
    marginBottom: 20,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  playerCard: {
    width: (width - 80) / 3 - 8,
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 10,
  },
  playerNumber: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#A855F7',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  playerNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  playerPhotoPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  playerPosition: {
    color: '#888',
    fontSize: 9,
  },
  substitutesContainer: {
    marginTop: 20,
  },
  substitutePosition: {
    color: '#888',
    fontSize: 10,
  },
  statsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
  },
  statsPartialNote: {
    color: '#A855F7',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsTeam: {
    flex: 1,
    alignItems: 'center',
  },
  statsTeamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  statsTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  statCenter: {
    flex: 1,
    alignItems: 'center',
  },
  statLabelContainer: {
    marginBottom: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  statBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBar: {
    height: 8,
    borderRadius: 4,
  },
  statBarHome: {
    backgroundColor: '#A855F7',
  },
  statBarAway: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  formTeamLogo: {
    width: 50,
    height: 50,
  },
  formTeamName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formTitle: {
    color: '#888',
    fontSize: 12,
  },
  fixturesList: {
    gap: 12,
  },
  fixtureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  fixtureTeamLogo: {
    width: 40,
    height: 40,
  },
  fixtureInfo: {
    flex: 1,
  },
  fixtureOpponent: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fixtureLeague: {
    color: '#888',
    fontSize: 11,
  },
  fixtureResult: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  fixtureWin: {
    backgroundColor: '#22c55e',
  },
  fixtureLose: {
    backgroundColor: '#ef4444',
  },
  fixtureDraw: {
    backgroundColor: '#f59e0b',
  },
  fixtureScore: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  eventHome: {
    borderLeftWidth: 3,
    borderLeftColor: '#A855F7',
  },
  eventAway: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  eventTime: {
    minWidth: 50,
    alignItems: 'center',
  },
  eventTimeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventExtraTime: {
    color: '#888',
    fontSize: 11,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDetails: {
    flex: 1,
  },
  eventPlayer: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventType: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  eventAssist: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  eventTeamLogo: {
    width: 30,
    height: 30,
  },
  standingsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
  },
  standingsSeasonNote: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  standingsGroupTitle: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  standingsHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  standingsHeaderText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  standingsRowHighlighted: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    marginHorizontal: -5,
    paddingHorizontal: 5,
  },
  standingsText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  stadiumContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  stadiumImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  stadiumInfo: {
    gap: 12,
  },
  stadiumName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stadiumDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stadiumDetailText: {
    color: '#888',
    fontSize: 14,
  },
});

export default MatchDetailsScreen;

