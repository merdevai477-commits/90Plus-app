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
import ApiFootballService, { TeamStatistics, TeamFixture, FixtureEvent, Fixture } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName, getLocalizedMatchStatus, getLocalizedStatType, getLocalizedEventLabel } from '../../utils/i18nHelpers';
import { prefetchFootballTranslations } from '../../src/stores/footballTranslationStore';
import { collectUniqueStrings } from '../../utils/footballNamePrefetch';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { TeamToggle } from '../../components/match-details/TeamToggle';
import { APP_BG } from '../../constants/ui';
import {
  BG_BASE,
  GLASS_BORDER_SIDE,
  GLASS_BORDER_TOP,
  GLASS_CARD,
  PURPLE_GLOW_SM,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  RADIUS_LG,
  RADIUS_MD,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/tokens';
import { FootballField } from '../../components/match-details/FootballField';
import { MatchEventIcon, getMatchEventColor } from '../../components/match-details/MatchEventIcon';
import { MatchLmtWebView } from '../../components/match-details/MatchLmtWebView';
import { fetchFixtureLmt, type Scores365LmtInfo } from '../../services/lmt.service';
import { applySubstitutionsToPitch } from '../../utils/lineupMatchState';
import { matchArchiveService, type MatchArchive } from '../../services/matchArchiveService';
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
import { buildSnapshotFromRaw } from '../../src/store/liveFixtureSync';
import {
  hasApiStatistics,
} from '../../utils/matchStatsFallback';
import { hasLineupData, isAuthoritativeLineupData } from '../../utils/matchLineupsFallback';
import { sortPlayersByGrid } from '../../utils/lineupGrid';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import { buildScores365CoachPhotoUrl } from '../../utils/scores365AthletePhoto';
import { prefetchImageUrls } from '../../utils/prefetchMatchAssets';
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
import { safeParseDate, safeToISOString } from '../../utils/safeDate';

const { width, height } = Dimensions.get('window');

const LIVE_MATCH_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] as const;
const FINISHED_MATCH_STATUSES = ['FT', 'AET', 'PEN'] as const;

interface MatchDetailsParams {
  fixtureId: string | string[];
}

/**
 * Rebuild the raw API-Football shapes the live store expects from a locally
 * archived (finished) match. Lets us ingest an archived match into the live
 * store when the network fetch returns nothing, so the details screen renders
 * the header/score/events instead of a blank shell.
 */
function buildFixtureFromArchive(archive: MatchArchive): {
  fixture: Fixture;
  events: FixtureEvent[];
} {
  const date = safeParseDate(archive.date instanceof Date ? archive.date : archive.date);
  const iso = safeToISOString(date);
  const kickoffMs = date?.getTime() ?? Date.now();

  const fixture: Fixture = {
    fixture: {
      id: archive.fixtureId,
      referee: null,
      timezone: 'UTC',
      date: iso,
      timestamp: Math.floor(kickoffMs / 1000),
      periods: { first: null, second: null },
      venue: {
        id: null,
        name: archive.venue?.name ?? null,
        city: archive.venue?.city ?? null,
      },
      status: {
        long: archive.status,
        short: archive.status,
        elapsed: null,
      },
    },
    league: {
      id: archive.league?.id ?? 0,
      name: archive.league?.name ?? '',
      country: archive.league?.country ?? '',
      logo: archive.league?.logo ?? '',
      flag: null,
      season: date?.getFullYear() ?? new Date().getFullYear(),
      round: archive.league?.round ?? '',
    },
    teams: {
      home: { ...archive.homeTeam, winner: null },
      away: { ...archive.awayTeam, winner: null },
    },
    goals: { home: archive.score?.home ?? null, away: archive.score?.away ?? null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: archive.score?.home ?? null, away: archive.score?.away ?? null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };

  const events: FixtureEvent[] = (archive.events ?? []).map((e) => {
    const team = e.team === 'home' ? archive.homeTeam : archive.awayTeam;
    return {
      time: { elapsed: e.minute ?? 0, extra: e.extraMinute ?? null },
      team: { id: team.id, name: team.name, logo: team.logo },
      player: { id: 0, name: e.player ?? '' },
      assist: { id: null, name: e.assist ?? null },
      type: e.type,
      detail: e.detail,
      comments: e.comments ?? null,
    };
  });

  return { fixture, events };
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
  const [h2hFixtures, setH2hFixtures] = useState<TeamFixture[]>([]);
  const [form365TeamIds, setForm365TeamIds] = useState<{
    home?: number;
    away?: number;
  }>({});
  const [standingsGroups, setStandingsGroups] = useState<StandingsGroup[]>([]);
  const [standingsSeasonUsed, setStandingsSeasonUsed] = useState<number | null>(null);
  const [standingsUnavailable, setStandingsUnavailable] = useState(false);

  // Home/Away selector shared by Events, Lineups, Previous Results.
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>('home');
  // Selected standings group index (World Cup groups A-G etc.).
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  // Expo Router can deliver a param as `string`, `string[]`, or drop it entirely
  // on physical devices during tab navigation. Normalize defensively so a valid
  // id is never lost (which previously showed an "Invalid match ID" screen).
  const rawFixtureId = Array.isArray(params.fixtureId)
    ? params.fixtureId[0]
    : params.fixtureId;
  const parsedFixtureId = parseInt(String(rawFixtureId ?? '').trim(), 10);
  const fixtureId = Number.isFinite(parsedFixtureId) && parsedFixtureId > 0 ? parsedFixtureId : 0;

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

  const resolveCoachPhoto = useCallback(
    (coachId: number | null | undefined, photo?: string | null) => {
      if (photo?.trim()) return photo;
      if (is365Fixture && coachId) return buildScores365CoachPhotoUrl(coachId, 80);
      return '';
    },
    [is365Fixture],
  );

  const kickoffMoment = fixture?.fixture?.date ? safeParseDate(fixture.fixture.date) : null;
  const kickoffValid = kickoffMoment != null;
  const kickoffDate = kickoffValid ? safeToISOString(kickoffMoment).split('T')[0] : '';
  const kickoffTime = kickoffValid
    ? (() => {
        try {
          return kickoffMoment!.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        } catch {
          return '';
        }
      })()
    : '';

  const [loading, setLoading] = useState(true);
  const [detailsFetching, setDetailsFetching] = useState(false);
  const [lineupsLoading, setLineupsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [lmtInfo, setLmtInfo] = useState<Scores365LmtInfo | null>(null);
  const [lmtChecked, setLmtChecked] = useState(false);
  /** When LMT is available: show live pitch or the score/time card. */
  const [heroView, setHeroView] = useState<'pitch' | 'score'>('pitch');

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
  /** Kept for Fast Refresh safety — previously used to auto-open Tracking tab. */
  const lmtAutoOpenedRef = useRef<number | null>(null);
  const lineupsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineupsTabRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const isLive = useCallback(() => {
    if (!fixture) return snapshot?.phase === 'live';
    const short = fixture.fixture?.status?.short;
    if (!short) return snapshot?.phase === 'live';
    return LIVE_MATCH_STATUSES.includes(
      short as (typeof LIVE_MATCH_STATUSES)[number],
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

  const loadMatchDetails = useCallback(async () => {
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
        const statusShort = details.fixture?.status?.short;
        if (statusShort && finishedStatuses.includes(statusShort)) {
          Promise.allSettled([
            Promise.resolve(snap.lineups ?? []),
            Promise.resolve(snap.statistics ?? []),
            Promise.resolve(snap.events ?? []),
          ]).then(([lineupsRes, statsRes, eventsRes]) => {
            // Archiving is best-effort; never let it surface as a screen error.
            void matchArchiveService
              .archiveMatchFromData(
                details,
                lineupsRes.status === 'fulfilled' ? lineupsRes.value : [],
                statsRes.status === 'fulfilled' ? statsRes.value : [],
                eventsRes.status === 'fulfilled' ? eventsRes.value : [],
              )
              .catch(() => {});
          }).catch(() => {});
        }
        if (isAuthoritativeLineupData(snap.lineups)) loadedTabsRef.current.add('lineups');
        if (hasApiStatistics(snap.statistics)) loadedTabsRef.current.add('stats');
        if (snap.venue) loadedTabsRef.current.add('stadium');
      } else {
        // Live fetch returned nothing — fall back to a locally/remotely archived
        // match and ingest it so the screen renders instead of a blank shell.
        const archived = await matchArchiveService.getArchivedMatch(String(fixtureId));
        if (archived) {
          try {
            const { fixture: archivedFixture, events: archivedEvents } =
              buildFixtureFromArchive(archived);
            const snapshotFromArchive = buildSnapshotFromRaw({
              fixtureId,
              fixture: archivedFixture,
              events: archivedEvents,
              source: 'http-full',
            });
            if (snapshotFromArchive) {
              useLiveFixtureStore.getState().ingestSnapshot(snapshotFromArchive);
            } else {
              setError(t.matchDetails.loadDetailsFailed);
            }
          } catch {
            setError(t.matchDetails.loadDetailsFailed);
          }
        }
        // No archive and no live data: leave `fixture` null. The render path
        // shows a dedicated "match unavailable" empty state (not a blank shell).
      }

      setLoading(false);
      setDetailsFetching(false);
    } catch (err: any) {
      setError(err?.message || t.matchDetails.loadDetailsFailed);
      setLoading(false);
      setDetailsFetching(false);
    }
  }, [fixtureId, t]);

  useEffect(() => {
    if (!translationsReady) return;

    setHomeLastFixtures([]);
    setAwayLastFixtures([]);
    setH2hFixtures([]);
    setForm365TeamIds({});
    setStandingsGroups([]);
    setStandingsSeasonUsed(null);
    setStandingsUnavailable(false);
    setSelectedTeamSide('home');
    setSelectedGroupIndex(0);
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
    setLmtInfo(null);
    setLmtChecked(false);
    setHeroView('pitch');
    lmtAutoOpenedRef.current = null;
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
  }, [fixtureId, translationsReady, loadMatchDetails]);

  // Default the visible standings group to the one containing either team.
  useEffect(() => {
    if (standingsGroups.length <= 1) {
      setSelectedGroupIndex(0);
      return;
    }
    const homeRef = { id: fixture?.teams?.home?.id, name: fixture?.teams?.home?.name };
    const awayRef = { id: fixture?.teams?.away?.id, name: fixture?.teams?.away?.name };
    const idx = standingsGroups.findIndex((g) =>
      g.standings.some(
        (row: any) =>
          standingRowMatchesTeam(row, homeRef) || standingRowMatchesTeam(row, awayRef),
      ),
    );
    setSelectedGroupIndex(idx >= 0 ? idx : 0);
  }, [standingsGroups, fixture?.teams?.home?.id, fixture?.teams?.away?.id]);

  // ── Lazy loaders — called when a tab is first activated ───────────────────
  const loadLineupsIfNeeded = useCallback(async (force = false) => {
    if (!fixtureId) return;

    const snapLineups = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups;
    if (!force && isAuthoritativeLineupData(snapLineups)) {
      loadedTabsRef.current.add('lineups');
      return;
    }

    const showLoading = !hasLineupData(snapLineups);
    if (!force) loadedTabsRef.current.add('lineups');
    if (showLoading) {
      setLineupsLoading(true);
    }
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
  // Live matches keep retrying (lineups can appear late); non-live matches (weak
  // leagues / lower divisions that never publish lineups) get a single quick
  // attempt so the user sees the empty state fast instead of a long spinner.
  useEffect(() => {
    if (lineupsTabRetryRef.current) {
      clearInterval(lineupsTabRetryRef.current);
      lineupsTabRetryRef.current = null;
    }
    if (activeTab !== 'lineups' || !fixtureId || lineupsError) return;
    if (isAuthoritativeLineupData(lineups)) return;
    const maxAttempts = isLive() ? MAX_LINEUP_AUTO_RETRIES : 1;
    if (lineupFetchAttempts >= maxAttempts) return;

    const tick = () => {
      if (!lineupsLoading && lineupFetchAttempts < maxAttempts) {
        void loadLineupsIfNeeded(true);
      }
    };
    tick();
    lineupsTabRetryRef.current = setInterval(tick, isLive() ? 8_000 : 4_000);

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
    isLive,
    loadLineupsIfNeeded,
  ]);

  // Warm the image cache with lineup player + coach photos as soon as lineups
  // are available (even before the user opens the tab) so pitch/bench photos
  // render instantly instead of loading one-by-one.
  useEffect(() => {
    if (!hasLineupData(lineups)) return;
    const urls: Array<string | null | undefined> = [];
    for (const lineup of lineups) {
      urls.push(resolveCoachPhoto(lineup.coach?.id, lineup.coach?.photo));
      for (const s of lineup.startXI ?? []) {
        urls.push(resolveLineupPlayerPhoto(s.player.id, s.player.photo));
      }
      for (const s of lineup.substitutes ?? []) {
        urls.push(resolveLineupPlayerPhoto(s.player.id, s.player.photo));
      }
    }
    prefetchImageUrls(urls);
  }, [lineups, resolveCoachPhoto, resolveLineupPlayerPhoto]);

  const loadStatsIfNeeded = useCallback(async (force = false) => {
    if (!fixtureId) return;

    const snap = useLiveFixtureStore.getState().snapshots[fixtureId];
    const snapStats = snap?.statistics ?? [];
    if (!force && (hasApiStatistics(snapStats) || snap?.statsFromEvents)) {
      loadedTabsRef.current.add('stats');
      return;
    }

    if (!force) loadedTabsRef.current.add('stats');
    const showLoading = !hasApiStatistics(snapStats) && !snap?.statsFromEvents;
    if (showLoading) setStatsLoading(true);
    setStatsError(null);
    try {
      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
      const freshSnap = useLiveFixtureStore.getState().snapshots[fixtureId];
      const data = freshSnap?.statistics ?? [];
      if (isLive() && !hasApiStatistics(data) && !freshSnap?.statsFromEvents) {
        loadedTabsRef.current.delete('stats');
      }
    } catch (err: any) {
      setStatsError(err?.message || t.matchDetails.loadStatsFailed);
      loadedTabsRef.current.delete('stats');
    } finally {
      setStatsLoading(false);
    }
  }, [fixtureId, isLive, t?.matchDetails?.loadStatsFailed]);

  const retryStats = useCallback(() => {
    loadedTabsRef.current.delete('stats');
    setStatsError(null);
    void loadStatsIfNeeded(true);
  }, [loadStatsIfNeeded]);

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

  const loadFormIfNeeded = useCallback(async (force = false) => {
    if (!fixture) return;
    if (!force && loadedTabsRef.current.has('form')) return;
    if (!force) loadedTabsRef.current.add('form');
    setFormLoading(true);
    setFormError(null);
    try {
      if (is365Fixture && fixtureId) {
        const form365 = await ApiFootballService.get365MatchForm(fixtureId);
        if (form365) {
          setHomeLastFixtures(form365.home);
          setAwayLastFixtures(form365.away);
          setH2hFixtures(form365.h2h);
          setForm365TeamIds({
            home: form365.homeCompetitorId ?? undefined,
            away: form365.awayCompetitorId ?? undefined,
          });
          return;
        }
        setFormError(t.matchDetails.loadFormFailed || t.matchDetails.noPreviousMatches);
        loadedTabsRef.current.delete('form');
        return;
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
    } catch {
      setFormError(t.matchDetails.loadFormFailed || t.common.retry);
      loadedTabsRef.current.delete('form');
    } finally {
      setFormLoading(false);
    }
  }, [fixtureId, fixture, is365Fixture, t?.matchDetails, t?.common]);

  const loadStandingsIfNeeded = useCallback(async (force = false) => {
    if (!fixture) return;
    if (!force && standingsGroups.length > 0) {
      loadedTabsRef.current.add('standings');
      return;
    }
    if (!force && loadedTabsRef.current.has('standings')) return;
    if (!force) loadedTabsRef.current.add('standings');
    const showLoading = standingsGroups.length === 0;
    if (showLoading) setStandingsLoading(true);
    setStandingsError(null);
    setStandingsUnavailable(false);
    try {
      // 365Scores standings cover the World Cup AND all non-WC leagues synced
      // via the allscores pipeline (namespaced leagueId >= offset). Detect via the
      // experiment markers, the WC league id, or the namespaced league id, so
      // standings still resolve if a runtime fixture object dropped the markers.
      const non365CompetitionId = scores365CompetitionIdFromLeagueId(fixture.league?.id);
      if (is365Fixture) {
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
          const groupsToShow =
            matchGroups.length > 0
              ? matchGroups
              : sortStandingsGroups(result365.groups);
          if (groupsToShow.length > 0) {
            setStandingsGroups(groupsToShow);
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
        if (is365Fixture) {
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
    is365Fixture,
    isLive,
    isFinishedMatch,
    standingsGroups.length,
    t?.matchDetails?.loadStandingsFailed,
  ]);

  // Preload 365 form (last 5 + H2H) as soon as the fixture is known.
  useEffect(() => {
    if (!fixtureId || !fixture || !is365Fixture) return;
    if (loadedTabsRef.current.has('form')) return;
    void loadFormIfNeeded();
  }, [fixtureId, fixture, is365Fixture, loadFormIfNeeded]);

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

  const loadLmtIfNeeded = useCallback(async (force = false) => {
    if (!fixtureId) return;
    if (!force && lmtChecked) return;
    try {
      const info = await fetchFixtureLmt(fixtureId, {
        language,
        force,
      });
      setLmtInfo(info);
    } catch {
      setLmtInfo(null);
    } finally {
      setLmtChecked(true);
    }
  }, [fixtureId, language, lmtChecked]);

  // Probe LMT for every opened match (404 = no pitch — show score card instead).
  useEffect(() => {
    if (!fixtureId || !fixture) return;
    void loadLmtIfNeeded();
  }, [fixtureId, fixture?.fixture?.id, loadLmtIfNeeded]);

  // Refresh events while empty on the Events tab (live / not finished) — no manual retry.
  useEffect(() => {
    if (eventsPollingRef.current) {
      clearInterval(eventsPollingRef.current);
      eventsPollingRef.current = null;
    }
    if (activeTab !== 'events' || !fixtureId || events.length > 0) return;
    if (isFinishedMatch()) return;

    const tick = () => {
      void useLiveFixtureStore.getState().fetchAndIngestFast(fixtureId);
    };
    tick();
    eventsPollingRef.current = setInterval(tick, isLive() ? 8_000 : 20_000);

    return () => {
      if (eventsPollingRef.current) {
        clearInterval(eventsPollingRef.current);
        eventsPollingRef.current = null;
      }
    };
  }, [activeTab, fixtureId, events.length, isLive, isFinishedMatch]);

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

  // If lineups tab is hidden, fall back to events so no orphan active state.
  useEffect(() => {
    if (!hasLineupData(lineups) && activeTab === 'lineups') {
      setActiveTab('events');
    }
  }, [lineups, activeTab]);

  // Poll lineups in the background for non-finished matches so the tab can
  // appear as soon as the provider publishes a lineup (tab stays hidden until then).
  useEffect(() => {
    if (!fixtureId || !fixture || hasLineupData(lineups) || isFinishedMatch()) return;

    if (lineupsPreloadedForRef.current !== fixtureId) {
      lineupsPreloadedForRef.current = fixtureId;
      void loadLineupsIfNeeded(true);
    }

    const intervalMs = isLive() ? 15_000 : 30_000;
    const interval = setInterval(() => {
      const current = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups;
      if (hasLineupData(current)) return;
      void loadLineupsIfNeeded(true);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [fixtureId, fixture?.fixture?.id, isLive, isFinishedMatch, loadLineupsIfNeeded, lineups]);

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

  // Render Events Tab
  const renderEvents = () => {
    if (detailsFetching && events.length === 0) {
      return <EventsSkeleton shimmerX={shimmerX} />;
    }
    if (events.length === 0) {
      const finished = isFinishedMatch();
      const live =
        LIVE_MATCH_STATUSES.includes(
          (fixture?.fixture?.status?.short ?? '') as (typeof LIVE_MATCH_STATUSES)[number],
        ) || isLive();

      if (!finished) {
        return (
          <View style={styles.emptyState}>
            <View style={styles.eventsWaitingIcon}>
              <Ionicons name="football-outline" size={36} color={PURPLE_SOFT} />
            </View>
            <Text style={styles.emptyStateText}>
              {live
                ? (t.matchDetails.eventsWaitingLive || 'Waiting for the first event…')
                : (t.matchDetails.eventsBeforeKickoff || 'Events will appear once the match starts')}
            </Text>
            {live ? (
              <>
                <ActivityIndicator
                  style={{ marginTop: 18 }}
                  size="small"
                  color={PURPLE_PRIMARY}
                />
                <Text style={styles.emptyStateSubtext}>
                  {t.matchDetails.eventsUpdatingAuto || 'Updating automatically'}
                </Text>
              </>
            ) : (
              <Text style={styles.emptyStateSubtext}>
                {t.matchDetails.beforeMatch}
              </Text>
            )}
          </View>
        );
      }

      return (
        <View style={styles.emptyState}>
          <Ionicons name="football-outline" size={56} color="#333" />
          <Text style={styles.emptyStateText}>
            {t.matchDetails.eventsNoneRecorded || t.matchDetails.noEvents}
          </Text>
        </View>
      );
    }

    const matchesSide = (event: FixtureEvent, side: 'home' | 'away') => {
      const id = side === 'home' ? fixture?.teams?.home?.id : fixture?.teams?.away?.id;
      const name = side === 'home' ? homeTeamName : awayTeamName;
      if (id != null && event.team?.id != null) return event.team.id === id;
      const en = (event.team?.name ?? '').toLowerCase();
      const tn = name.toLowerCase();
      return en.includes(tn) || tn.includes(en);
    };
    const filteredEvents = events.filter((e) => matchesSide(e, selectedTeamSide));

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TeamToggle
          home={{ name: getTeamDisplayName(homeTeamName, language), logo: homeTeamLogo }}
          away={{ name: getTeamDisplayName(awayTeamName, language), logo: awayTeamLogo }}
          value={selectedTeamSide}
          onChange={setSelectedTeamSide}
        />
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>{t.matchDetails.matchEvents}</Text>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="football-outline" size={48} color="#333" />
              <Text style={styles.emptyStateText}>{t.matchDetails.noEvents}</Text>
            </View>
          ) : filteredEvents.map((event, index) => {
            const homeTeamId = fixture?.teams?.home?.id;
            const isHomeTeam = homeTeamId != null
              ? event.team.id === homeTeamId
              : event.team.name.toLowerCase().includes(homeTeamName.toLowerCase()) ||
                homeTeamName.toLowerCase().includes(event.team.name.toLowerCase());

            const eventColor = getMatchEventColor(event.type, event.detail);
            const isSubstitution = event.type === 'subst';

            return (
              <View
                key={`${event.time.elapsed}-${event.type}-${event.player?.id ?? index}`}
                style={[
                  styles.eventCard,
                  isHomeTeam ? styles.eventHome : styles.eventAway,
                ]}
              >
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>{`${event.time.elapsed}'`}</Text>
                  {!!event.time.extra && (
                    <Text style={styles.eventExtraTime}>{`+${event.time.extra}'`}</Text>
                  )}
                </View>

                <View style={[styles.eventIcon, { backgroundColor: `${eventColor}20` }]}>
                  <MatchEventIcon type={event.type} detail={event.detail} size={20} />
                </View>

                <View style={styles.eventDetails}>
                  {isSubstitution ? (
                    <>
                      {!!event.assist?.name && (
                        <View style={styles.subEventRow}>
                          <Ionicons name="arrow-down" size={12} color="#ef4444" />
                          <Text style={styles.eventPlayer}>{String(event.assist.name)}</Text>
                        </View>
                      )}
                      {!!event.player?.name && (
                        <View style={styles.subEventRow}>
                          <Ionicons name="arrow-up" size={12} color="#22c55e" />
                          <Text style={styles.eventPlayer}>{String(event.player.name)}</Text>
                        </View>
                      )}
                      <Text style={styles.eventType}>{t.matchDetails.substitution}</Text>
                    </>
                  ) : (
                    <>
                      {!!event.player.name && <Text style={styles.eventPlayer}>{String(event.player.name)}</Text>}
                      <Text style={styles.eventType}>
                        {getLocalizedEventLabel(event.type, event.detail, language)}
                      </Text>
                      {!!event.assist?.name && event.type === 'Goal' && (
                        <Text style={styles.eventAssist}>{t.matchDetails?.assist || 'Assist'}: {String(event.assist.name)}</Text>
                      )}
                    </>
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
    if (lineupsLoading && !hasLineupData(lineups)) {
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
      const stillRetrying = lineupFetchAttempts < (isLive() ? MAX_LINEUP_AUTO_RETRIES : 1);
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

    const selectedTeamId = fixture?.teams?.[selectedTeamSide]?.id;
    const selectedTeamName = selectedTeamSide === 'home' ? homeTeamName : awayTeamName;
    const matchLineupSide = (l: typeof lineups[number]) => {
      if (selectedTeamId != null && l.team?.id != null) return l.team.id === selectedTeamId;
      const ln = (l.team?.name ?? '').toLowerCase();
      const tn = selectedTeamName.toLowerCase();
      return ln.includes(tn) || tn.includes(ln);
    };
    const fallbackIndex = selectedTeamSide === 'home' ? 0 : 1;
    const selectedLineup =
      lineups.find(matchLineupSide) ?? lineups[fallbackIndex] ?? lineups[0];
    const visibleLineups = selectedLineup ? [selectedLineup] : [];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TeamToggle
          home={{ name: getTeamDisplayName(homeTeamName, language), logo: homeTeamLogo }}
          away={{ name: getTeamDisplayName(awayTeamName, language), logo: awayTeamLogo }}
          value={selectedTeamSide}
          onChange={setSelectedTeamSide}
        />
        <View style={styles.lineupsContainer}>
          {visibleLineups.map((lineup, index) => {
            const formation = lineup.formation || '4-4-2';
            const startingXI = lineup.startXI || [];
            const substitutes = lineup.substitutes || [];
            const teamId = lineup.team?.id;

            const { pitchPlayers, benchPlayers } = applySubstitutionsToPitch(
              startingXI,
              substitutes,
              events,
              teamId,
            );

            const fieldPlayers = sortPlayersByGrid(
              pitchPlayers.map((player) => ({
                ...player,
                photo: resolveLineupPlayerPhoto(
                  player.id,
                  player.photo,
                ) || undefined,
              })),
            );

            return (
              <View key={index} style={styles.teamLineupContainer}>
                <View style={styles.teamHeader}>
                  <TeamBadge name={lineup.team.name} logo={lineup.team.logo} size={60} color="transparent" />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName} numberOfLines={2}>
                      {getTeamDisplayName(lineup.team.name, language)}
                    </Text>
                    <Text style={styles.formationText}>
                      {t.matchDetails.formation}: {formation}
                    </Text>
                  </View>
                  <View style={styles.coachBlock}>
                    {resolveCoachPhoto(lineup.coach?.id, lineup.coach?.photo) ? (
                      <ExpoImage
                        source={{ uri: resolveCoachPhoto(lineup.coach?.id, lineup.coach?.photo) }}
                        style={styles.coachPhoto}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.coachPhotoPlaceholder}>
                        <Ionicons name="person" size={22} color="#888" />
                      </View>
                    )}
                    <Text style={styles.coachName} numberOfLines={2}>
                      {lineup.coach?.name || t.common.unknown}
                    </Text>
                  </View>
                </View>

                {/* Football Field Visualization */}
                <FootballField
                  formation={formation}
                  players={fieldPlayers}
                  teamName={lineup.team.name}
                  teamColor={selectedTeamSide === 'home' ? '#A855F7' : '#3b82f6'}
                  onPlayerPress={(player) => {
                    if (player.id) {
                      openPlayerProfile(
                        { id: player.id, name: player.name, photo: player.photo },
                        lineup.team,
                      );
                    }
                  }}
                />

                {/* Substitutes & bench */}
                {benchPlayers.length > 0 && (
                  <View style={styles.substitutesSection}>
                    <Text style={styles.substitutesTitle}>{t.matchDetails.substitutes}</Text>
                    <View style={styles.substitutesGrid}>
                      {benchPlayers.map((player) => (
                        <TouchableOpacity
                          key={`bench-${player.id}`}
                          style={[
                            styles.substituteCard,
                            player.subbedOff != null && styles.substituteCardOut,
                          ]}
                          onPress={() => {
                            if (!player.id) return;
                            openPlayerProfile(
                              {
                                id: player.id,
                                athleteId: player.id,
                                name: player.name,
                                photo: player.photo,
                              },
                              lineup.team,
                            );
                          }}
                        >
                          <ExpoImage
                            source={{
                              uri: resolveLineupPlayerPhoto(player.id, player.photo),
                            }}
                            style={{ width: 28, height: 28, borderRadius: 14 }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          <Text style={styles.substituteNumber}>{player.number || '-'}</Text>
                          <View style={styles.substituteInfo}>
                            <Text style={styles.substituteName} numberOfLines={1}>{player.name}</Text>
                            <Text style={styles.substitutePos}>
                              {player.subbedOff != null
                                ? `${player.pos} · ${Math.floor(player.subbedOff)}'`
                                : player.pos}
                            </Text>
                          </View>
                          {player.subbedOff != null ? (
                            <Ionicons name="arrow-down" size={14} color="#ef4444" />
                          ) : player.rating != null && player.rating > 0 ? (
                            <Text style={styles.subRating}>{player.rating.toFixed(1)}</Text>
                          ) : null}
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
    const hasStats = statistics.length > 0 || statsFromEvents;
    if (statsLoading && !hasStats) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (statsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{statsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryStats}>
            <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.retryButton} onPress={retryStats}>
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
                  <Text style={styles.statLabel}>{getLocalizedStatType(stat.type, language)}</Text>
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
    if (formLoading && homeLastFixtures.length === 0 && awayLastFixtures.length === 0) {
      return <FormSkeleton shimmerX={shimmerX} />;
    }

    if (formError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{formError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              loadedTabsRef.current.delete('form');
              void loadFormIfNeeded(true);
            }}
          >
            <Text style={styles.retryButtonText}>{t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const resolveTeamSideInRow = (
      row: TeamFixture,
      side: 'home' | 'away',
    ): boolean => {
      const refId = side === 'home'
        ? (form365TeamIds.home ?? fixture?.teams.home.id)
        : (form365TeamIds.away ?? fixture?.teams.away.id);
      const refName = side === 'home' ? homeTeamName : awayTeamName;
      if (refId != null) {
        if (row.teams.home.id === refId) return true;
        if (row.teams.away.id === refId) return false;
      }
      const homeN = row.teams.home.name.toLowerCase();
      const awayN = row.teams.away.name.toLowerCase();
      const n = refName.toLowerCase();
      if (homeN.includes(n) || n.includes(homeN)) return true;
      if (awayN.includes(n) || n.includes(awayN)) return false;
      return false;
    };

    const selectedLastFixtures =
      selectedTeamSide === 'home' ? homeLastFixtures : awayLastFixtures;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Head-to-head (direct meetings) */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{t.matchDetails.headToHead}</Text>
          </View>
          {h2hFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {h2hFixtures.map((row, index) => (
                <View key={`h2h-${index}`} style={styles.fixtureCard}>
                  <View style={styles.h2hTeamsRow}>
                    <TeamBadge
                      name={row.teams.home.name}
                      logo={row.teams.home.logo}
                      size={32}
                      color="transparent"
                    />
                    <TeamBadge
                      name={row.teams.away.name}
                      logo={row.teams.away.logo}
                      size={32}
                      color="transparent"
                    />
                  </View>
                  <View style={styles.fixtureInfo}>
                    <Text style={styles.fixtureOpponent} numberOfLines={1}>
                      {getTeamDisplayName(row.teams.home.name, language)} {t.matchDetails.vs}{' '}
                      {getTeamDisplayName(row.teams.away.name, language)}
                    </Text>
                    <Text style={styles.fixtureLeague}>
                      {getLeagueDisplayName(
                        row.league.name,
                        language,
                        row.league.id,
                        undefined,
                      )}
                    </Text>
                  </View>
                  <View style={styles.fixtureResult}>
                    <Text style={styles.fixtureScore}>
                      {row.goals.home} - {row.goals.away}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t.matchDetails.noHeadToHead}</Text>
            </View>
          )}
        </View>

        {/* Team selector */}
        <TeamToggle
          home={{ name: getTeamDisplayName(homeTeamName, language), logo: homeTeamLogo }}
          away={{ name: getTeamDisplayName(awayTeamName, language), logo: awayTeamLogo }}
          value={selectedTeamSide}
          onChange={setSelectedTeamSide}
        />

        {/* Selected Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TeamBadge
              name={selectedTeamSide === 'home' ? homeTeamName : awayTeamName}
              logo={selectedTeamSide === 'home' ? homeTeamLogo : awayTeamLogo}
              size={50}
              color="transparent"
            />
            <Text style={styles.formTeamName}>
              {getTeamDisplayName(selectedTeamSide === 'home' ? homeTeamName : awayTeamName, language)}
            </Text>
            <Text style={styles.formTitle}>{t.matchDetails.last5Matches}</Text>
          </View>
          {selectedLastFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {selectedLastFixtures.map((fixture, index) => {
                const isHome = resolveTeamSideInRow(fixture, selectedTeamSide);
                const opponent = isHome ? fixture.teams.away : fixture.teams.home;
                const teamScore = isHome ? fixture.goals.home : fixture.goals.away;
                const opponentScore = isHome ? fixture.goals.away : fixture.goals.home;
                const result = resolveFormResult(teamScore, opponentScore);

                return (
                  <View key={index} style={styles.fixtureCard}>
                    <TeamBadge name={opponent.name} logo={opponent.logo} size={40} color="transparent" />
                    <View style={styles.fixtureInfo}>
                      <Text style={styles.fixtureOpponent} numberOfLines={1}>
                        {t.matchDetails.vs} {getTeamDisplayName(opponent.name, language)}
                      </Text>
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
        {/* Hero card: image/map placeholder + pill + name + subtitle */}
        <View style={styles.stadiumHeroCard}>
          {venueData.image ? (
            <Image source={{ uri: venueData.image }} style={styles.stadiumHeroImage} />
          ) : (
            <View style={styles.stadiumHeroPlaceholder} />
          )}
          <View style={styles.stadiumHeroBody}>
            <View style={styles.stadiumPill}>
              <Ionicons name="location" size={12} color={PURPLE_SOFT} />
              <Text style={styles.stadiumPillText}>{t.matchDetails.stadium || 'Stadium'}</Text>
            </View>
            <Text style={styles.stadiumName}>{venueData.name || t.matchDetails.stadium || 'Stadium'}</Text>
            {(venueData.city || venueData.country) && (
              <Text style={styles.stadiumSubtitle}>
                {[venueData.city, venueData.country].filter(Boolean).join(' • ')}
              </Text>
            )}
          </View>
        </View>

        {/* Location card */}
        {(venueData.city || venueData.country || venueData.address) && (
          <View style={styles.stadiumInfoCard}>
            <View style={styles.stadiumInfoIcon}>
              <Ionicons name="location" size={18} color={PURPLE_SOFT} />
            </View>
            <Text style={styles.stadiumInfoText} numberOfLines={2}>
              {venueData.address ||
                [venueData.city, venueData.country].filter(Boolean).join(' • ')}
            </Text>
          </View>
        )}

        {/* League card */}
        {!!leagueName && (
          <View style={styles.stadiumInfoCard}>
            <LeagueIcon
              name={leagueName}
              logo={fixture?.league?.logo}
              leagueId={fixture?.league?.id}
              size={36}
            />
            <Text style={styles.stadiumInfoText} numberOfLines={2}>
              {getLeagueDisplayName(leagueName, language, fixture?.league?.id, fixture?.league?.country)}
            </Text>
          </View>
        )}

        {/* Capacity / surface */}
        {(venueData.capacity || venueData.surface) && (
          <View style={styles.stadiumContainer}>
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
        )}
      </ScrollView>
    );
  };

  const renderStandings = () => {
    const hasStandings = standingsGroups.length > 0;
    if (standingsLoading && !hasStandings) {
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
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>{t.matchDetails.standingsPlayed}</Text>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>{t.matchDetails.standingsGoalDiff}</Text>
          <Text style={[styles.standingsHeaderText, { width: 30 }]}>{t.matchDetails.standingsPoints}</Text>
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

    const groupIndex = Math.min(selectedGroupIndex, standingsGroups.length - 1);
    const activeGroup = standingsGroups[groupIndex];
    const showGroupChips =
      standingsGroups.length > 1 ||
      (standingsGroups[0]?.group && standingsGroups[0].group !== 'Table');
    const chipLabel = (group: string) => group.replace(/^Group\s+/i, '');

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

        {showGroupChips && (
          <View style={styles.groupsSelector}>
            <Text style={styles.groupsLabel}>{t.matchDetails.standingsGroups || 'GROUPS'}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupChipsRow}
            >
              {standingsGroups.map((g, i) => {
                const isActive = i === groupIndex;
                return (
                  <TouchableOpacity
                    key={`${g.group}-${i}`}
                    style={[styles.groupChip, isActive && styles.groupChipActive]}
                    onPress={() => setSelectedGroupIndex(i)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.groupChipText, isActive && styles.groupChipTextActive]}>
                      {chipLabel(g.group)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {activeGroup && (
          <View style={styles.standingsContainer}>
            {renderStandingsTable(activeGroup.standings, `${activeGroup.group}-${groupIndex}`)}
          </View>
        )}
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

  // No live data, no archive, not loading, no error: show a dedicated empty
  // state instead of an empty header/tabs shell on a dark background.
  if (!fixture && !loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0720" />
        <View style={styles.customHeader}>
          <TouchableOpacity
            style={styles.backButtonRound}
            onPress={() => router.push('/(tabs)/matches' as any)}
            accessibilityRole="button"
            accessibilityLabel={t.matchDetails.backToMatches}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.matchDetails.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="football-outline" size={64} color="#333" />
          <Text style={styles.errorText}>{t.matchDetails.matchUnavailable}</Text>
          <Text style={styles.emptyStateSubtext}>{t.matchDetails.matchUnavailableSubtext}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMatchDetails}>
            <Text style={styles.retryButtonText}>{t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const baseTabs = [
    { key: 'events', label: t.matchDetails.events, icon: 'football' as const },
    { key: 'lineups', label: t.matchDetails.lineups, icon: 'people' as const },
    { key: 'stats', label: t.matchDetails.statistics, icon: 'stats-chart' as const },
    { key: 'form', label: t.matchDetails.form, icon: 'trending-up' as const },
    { key: 'standings', label: t.matchDetails.standings || 'Table', icon: 'list' as const },
    { key: 'stadium', label: t.matchDetails.stadium || 'Stadium', icon: 'business' as const },
  ];
  const tabs = baseTabs.filter(
    (tab) => tab.key !== 'lineups' || hasLineupData(lineups),
  );

  const hasLmt = Boolean(lmtInfo?.widgetUrl);
  const showPitch = hasLmt && heroView === 'pitch';

  const scoreHeader = (
    <MatchHeader
      homeTeam={getTeamDisplayName(homeTeamName, language)}
      awayTeam={getTeamDisplayName(awayTeamName, language)}
      homeLogo={homeTeamLogo}
      awayLogo={awayTeamLogo}
      homeScore={fixture?.goals?.home != null ? String(fixture.goals.home) : undefined}
      awayScore={fixture?.goals?.away != null ? String(fixture.goals.away) : undefined}
      status={fixture ? (
        ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'].includes(fixture.fixture?.status?.short ?? '') ? 'live'
        : ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(fixture.fixture?.status?.short ?? '') ? 'finished'
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
      statusShort={fixture?.fixture?.status?.short}
      elapsed={fixture?.fixture?.status?.elapsed ?? undefined}
      stoppage={fixture?.fixture?.status?.extra ?? null}
      startTimestamp={fixture ? getPeriodStartTimestamp(fixture) : undefined}
      statusLabel={
        fixture?.fixture?.status?.short
          ? getLocalizedMatchStatus(fixture.fixture.status.short, language)
          : undefined
      }
      penaltyHome={fixture?.score?.penalty?.home ?? undefined}
      penaltyAway={fixture?.score?.penalty?.away ?? undefined}
      halftimeLabel={getLocalizedMatchStatus('HT', language)}
      finishedLabel={getLocalizedMatchStatus('FT', language)}
      liveLabel={getLocalizedMatchStatus('LIVE', language)}
      vsLabel={t.matchDetails.vs}
      penaltiesShortLabel={getLocalizedMatchStatus('PEN', language)}
    />
  );

  const matchHero = showPitch ? (
    <MatchLmtWebView
      variant="hero"
      widgetUrl={lmtInfo!.widgetUrl}
      embedUrl={lmtInfo!.embedUrl}
      aspectRatio={lmtInfo!.widgetRatio}
      // DD branding: rewrite GetWidget HTML (pitchLogo / goalBannerImage / vlmtCourtBannerUrl).
      // hideBrand=true → transparent pixel; false → 90PLUS-app (or brandLogoUrl).
      hideBrand={
        process.env.EXPO_PUBLIC_LMT_HIDE_PITCH_BRAND === 'true' ||
        process.env.EXPO_PUBLIC_LMT_HIDE_PITCH_BRAND === '1'
      }
      brandLogoUrl={process.env.EXPO_PUBLIC_LMT_PITCH_LOGO_URL?.trim() || null}
      coverBrand={false}
      loadingLabel={t.matchDetails.trackingLoading || 'Loading live pitch…'}
      unavailableLabel={t.matchDetails.trackingUnavailable || 'Live pitch tracking is not provided for this match.'}
      retryLabel={t.matchDetails.retry || t.common.retry}
      expandLabel={t.matchDetails.trackingExpand || 'Wider view'}
      collapseLabel={t.matchDetails.trackingCollapse || 'Close wider view'}
    />
  ) : (
    scoreHeader
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0720" />

      {/* Custom Top Bar */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          style={styles.backButtonRound}
          onPress={() => router.push('/(tabs)/matches' as any)}
          accessibilityRole="button"
          accessibilityLabel={t.matchDetails.backToMatches}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.matchDetails.title || 'Match Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Pitch tracker or score card — user can switch when LMT is available */}
        {matchHero}

        {hasLmt ? (
          <View style={styles.heroViewToggleWrap}>
            <View style={styles.heroViewToggle}>
              <TouchableOpacity
                style={[styles.heroViewToggleBtn, heroView === 'pitch' && styles.heroViewToggleBtnActive]}
                onPress={() => setHeroView('pitch')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: heroView === 'pitch' }}
                accessibilityLabel={t.matchDetails.viewPitch || 'Pitch'}
              >
                <Ionicons
                  name="football-outline"
                  size={14}
                  color={heroView === 'pitch' ? '#fff' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.heroViewToggleText,
                    heroView === 'pitch' && styles.heroViewToggleTextActive,
                  ]}
                >
                  {t.matchDetails.viewPitch || 'Pitch'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.heroViewToggleBtn, heroView === 'score' && styles.heroViewToggleBtnActive]}
                onPress={() => setHeroView('score')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: heroView === 'score' }}
                accessibilityLabel={t.matchDetails.viewScore || 'Score'}
              >
                <Ionicons
                  name="timer-outline"
                  size={14}
                  color={heroView === 'score' ? '#fff' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.heroViewToggleText,
                    heroView === 'score' && styles.heroViewToggleTextActive,
                  ]}
                >
                  {t.matchDetails.viewScore || 'Score'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
    backgroundColor: BG_BASE,
  },
  backButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: GLASS_BORDER_TOP,
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroViewToggleWrap: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 20,
  },
  heroViewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 22,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroViewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  heroViewToggleBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  heroViewToggleText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  heroViewToggleTextActive: {
    color: '#fff',
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
    backgroundColor: BG_BASE,
  },
  loadingText: {
    color: TEXT_PRIMARY,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_BASE,
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
    backgroundColor: PURPLE_PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS_LG,
  },
  retryButtonText: {
    color: TEXT_PRIMARY,
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
    color: TEXT_MUTED,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  eventsWaitingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,85,247,0.28)',
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
    minWidth: 0,
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
  coachBlock: {
    alignItems: 'center',
    maxWidth: 88,
    flexShrink: 0,
  },
  coachPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.35)',
  },
  coachPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#252525',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachName: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
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
  h2hTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  subEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  substituteCardOut: {
    opacity: 0.55,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  subRating: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
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
    marginTop: 12,
  },
  stadiumHeroCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  stadiumHeroImage: {
    width: '100%',
    height: 170,
  },
  stadiumHeroPlaceholder: {
    width: '100%',
    height: 170,
    backgroundColor: '#0f0a1a',
  },
  stadiumHeroBody: {
    padding: 20,
  },
  stadiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PURPLE_GLOW_SM,
    borderWidth: 1,
    borderColor: PURPLE_PRIMARY,
    marginBottom: 12,
  },
  stadiumPillText: {
    color: PURPLE_SOFT,
    fontSize: 12,
    fontWeight: '700',
  },
  stadiumName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stadiumSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  stadiumInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  stadiumInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE_GLOW_SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stadiumInfoText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
  groupsSelector: {
    marginBottom: 12,
  },
  groupsLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  groupChipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  groupChip: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS_MD,
    backgroundColor: GLASS_CARD,
    borderWidth: 1,
    borderColor: GLASS_BORDER_SIDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipActive: {
    backgroundColor: PURPLE_PRIMARY,
    borderColor: PURPLE_GLOW_SM,
  },
  groupChipText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '700',
  },
  groupChipTextActive: {
    color: '#fff',
  },
});

export default MatchDetailsScreen;

