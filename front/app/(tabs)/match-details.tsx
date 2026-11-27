import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  useWindowDimensions,
  BackHandler,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text } from '../../components/match-details/MatchText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { diagFlags } from '../../services/diagnostics/diagnosticsState';
import { recordDiagEvent } from '../../services/diagnostics/diagnosticsRecorder';
import { setDiagnosticsFixture, setDiagnosticsScreen } from '../../services/diagnostics/diagnosticsSentry';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiFootballService, {
  TeamStatistics,
  TeamFixture,
  FixtureEvent,
  Fixture,
  Lineup,
  Standing,
  Injury,
} from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import {
  getLeagueDisplayName,
  getLocalizedMatchStatus,
  getLocalizedStatType,
  getPersonDisplayName,
} from '../../utils/i18nHelpers';
import { displayMatchTeamName as getTeamDisplayName, isIsraelSeniorNationalTeam, presentTeamLogo } from '../../utils/maskedNationalTeam';
import { prefetchFootballTranslations } from '../../src/stores/footballTranslationStore';
import { collectUniqueStrings } from '../../utils/footballNamePrefetch';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { MatchCompactScore, MatchCompactProgress } from '../../components/match-details/MatchCompactScore';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { TeamToggle } from '../../components/match-details/TeamToggle';
import { MatchDetailsTopBar, useMatchTopBarHeight } from '../../components/match-details/MatchDetailsTopBar';
import { MatchChatTab } from '../../components/match-details/MatchChatTab';
import { MatchStatsCompare } from '../../components/match-details/MatchStatsCompare';
import { PreMatchRecentStats } from '../../components/match-details/PreMatchRecentStats';
import CachedAthletePhoto from '../../components/common/CachedAthletePhoto';
import { BG_BASE,
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
import { MatchDetailsThemeProvider, useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import { FootballField } from '../../components/match-details/FootballField';
import { LineupBestPlayers } from '../../components/match-details/LineupBestPlayers';
import { LineupBenchDrawer } from '../../components/match-details/LineupBenchDrawer';
import { LineupBelowSections } from '../../components/match-details/LineupBelowSections';
import { MatchStandingsTable } from '../../components/match-details/MatchStandingsTable';
import { MatchEventsTimeline } from '../../components/match-details/MatchEventsTimeline';
import { MatchEventsLegend } from '../../components/match-details/MatchEventsLegend';
import type { GoalClipMedia } from '../../utils/assignGoalClips';
import { MatchMomentumGraph } from '../../components/match-details/MatchMomentumGraph';
import { MatchSummaryVideo } from '../../components/match-details/MatchSummaryVideo';
import { HighlightVideoSheet } from '../../components/match-details/HighlightVideoSheet';
import {
  collectHighlightClipPlaybackUrls,
  preferDirectHighlightUrls,
} from '../../utils/highlightPlaybackUrl';
import { openHighlightPlayback } from '../../utils/openHighlightPlayback';
import { MatchKickoffHighlights } from '../../components/match-details/MatchKickoffHighlights';
import { MatchTopPlayersCard } from '../../components/match-details/MatchTopPlayersCard';
import { MatchLmtWebView } from '../../components/match-details/MatchLmtWebView';
import { fetchFixtureLmt, type Scores365LmtInfo } from '../../services/lmt.service';
import { applySubstitutionsToPitch, collectLineupSubstitutions } from '../../utils/lineupMatchState';
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
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { buildSnapshotFromRaw } from '../../src/store/liveFixtureSync';
import { isAbortError } from '../../utils/isAbortError';
import { findLocalPreviewFixture } from '../../utils/findLocalPreviewFixture';
import {
  hasApiStatistics,
  hasRichStatistics,
} from '../../utils/matchStatsFallback';
import { hasLineupData, isAuthoritativeLineupData, pickBetterLineups, shouldShowLineupsTab } from '../../utils/matchLineupsFallback';
import { extractMatchKickoffInfo } from '../../utils/extractMatchKickoffInfo';
import { match365CompetitionId } from '../../utils/matchTopPlayers';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import { addBreadcrumb, captureMessage } from '../../services/sentry.service';
import { logger } from '../../utils/logger';
import { resolveFormationLabel, sortPlayersForPitch } from '../../utils/lineupGrid';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';
import { prefetchImageUrls } from '../../utils/prefetchMatchAssets';
import { MatchSubscriptionsService } from '../../services/matchSubscriptions.service';
import { MatchFavoritesStorage } from '../../src/storage/matchFavorites.storage';
import { toastManager } from '../../services/toastManager';
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
import { safeFormatMatchTime, safeParseDate, safeToISOString } from '../../utils/safeDate';
import { isStaleInPlayClock } from '../../utils/staleMatchClock';
import { fixturesToTeamFixtures } from '../../utils/scores365Adapters';
import { summarizeRecentTeamAverages, type RecentFormAveragesPayload } from '../../utils/recentTeamFormStats';

const { width, height } = Dimensions.get('window');

const LIVE_MATCH_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] as const;
const EMPTY_EVENTS: FixtureEvent[] = [];
const EMPTY_STATISTICS: TeamStatistics[] = [];
const EMPTY_LINEUPS: Lineup[] = [];
/** Single 365 headshot size for prefetch + pitch/bench avatars (they render `preSized`). */
const LINEUP_PHOTO_PX = 80;
/** Stats tab refresh while live + focused (backend answers from cache). */
const STATS_LIVE_POLL_MS = 35_000;
/** Lineups tab: one scheduler — live cadence, then backoff after repeated empty answers. */
const LINEUPS_LIVE_POLL_MS = 20_000;
const LINEUPS_LIVE_BACKOFF_MS = 60_000;
const LINEUPS_EMPTY_RESULTS_BEFORE_BACKOFF = 4;
const FINISHED_MATCH_STATUSES = ['FT', 'AET', 'PEN'] as const;

interface MatchDetailsParams {
  fixtureId: string | string[];
}

type MatchDetailsTab = 'lineups' | 'stats' | 'form' | 'events' | 'standings' | 'chats' | 'info';

/** In-tab history for H2H / last-5 taps (same route can't stack in Tabs). */
type RelatedMatchHistoryEntry = {
  fixtureId: number;
  returnTab: MatchDetailsTab;
};

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

function detailsPullControl(
  refreshing: boolean,
  onRefresh: () => void,
  progressViewOffset = 0,
  progressBackgroundColor = BG_BASE,
) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      progressViewOffset={progressViewOffset}
      tintColor={PURPLE_SOFT}
      colors={[PURPLE_PRIMARY]}
      progressBackgroundColor={progressBackgroundColor}
    />
  );
}

function PullableTabBody({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

const MatchDetailsScreen = () => {
  const { colors: mdColors, isDark: mdIsDark } = useMatchDetailsTheme();
  useScreenFont();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { getToken } = useAuth();
  const { t, language, translate } = useTranslation();
  const params = useLocalSearchParams() as unknown as MatchDetailsParams;
  const shimmerX = useShimmer();
  const translationsReady = Boolean(t?.matchDetails);

  const [activeTab, setActiveTab] = useState<MatchDetailsTab>('events');
  /** Popped on back so Form/H2H → past match → back returns to that Form tab. */
  const relatedMatchStackRef = useRef<RelatedMatchHistoryEntry[]>([]);
  /** Fixture id we expect next from our own related/back navigation (not an external open). */
  const pendingRelatedFixtureIdRef = useRef<number | null>(null);
  /** Tab to restore after fixtureId changes from related-match back. */
  const pendingReturnTabRef = useRef<MatchDetailsTab | null>(null);
  /** Last fixtureId this screen applied history/tab rules for (avoids Strict Mode wiping the stack). */
  const lastHistoryFixtureIdRef = useRef<number | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [homeLastFixtures, setHomeLastFixtures] = useState<TeamFixture[]>([]);
  const [awayLastFixtures, setAwayLastFixtures] = useState<TeamFixture[]>([]);
  const [h2hFixtures, setH2hFixtures] = useState<TeamFixture[]>([]);
  const [form365TeamIds, setForm365TeamIds] = useState<{
    home?: number;
    away?: number;
  }>({});
  const [recentFormAverages, setRecentFormAverages] = useState<RecentFormAveragesPayload | null>(null);
  const [standingsGroups, setStandingsGroups] = useState<StandingsGroup[]>([]);
  const [standingsSeasonUsed, setStandingsSeasonUsed] = useState<number | null>(null);
  const [standingsUnavailable, setStandingsUnavailable] = useState(false);
  const [isMatchSubscribed, setIsMatchSubscribed] = useState(false);
  const [matchSubLoading, setMatchSubLoading] = useState(false);

  // Home/Away selector shared by Lineups and Previous Results.
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>('home');
  const [benchDrawerOpen, setBenchDrawerOpen] = useState(false);
  /** Team injuries for the absences section under the pitch (Figma 1823:25316). */
  const [lineupInjuries, setLineupInjuries] = useState<Injury[]>([]);
  const [coachNationality, setCoachNationality] = useState<string | null>(null);
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
  const [goalClips, setGoalClips] = useState<GoalClipMedia[]>([]);
  const [matchSummary, setMatchSummary] = useState<GoalClipMedia | null>(null);
  const [summaryUrls, setSummaryUrls] = useState<string[]>([]);
  const [highlightVideoUrls, setHighlightVideoUrls] = useState<string[]>([]);
  const [highlightPlaybackMeta, setHighlightPlaybackMeta] = useState<{
    title?: string | null;
    thumbnailUrl?: string | null;
  }>({});

  const snapshot = useLiveFixture(fixtureId > 0 ? fixtureId : null, { focused: true });
  const runDetailsPull = useCallback(async () => {
    if (!fixtureId) return;
    const started = diagFlags.active ? Date.now() : 0;
    let ok = true;
    try {
      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId, { pull: true });
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      if (started) {
        recordDiagEvent('pull_refresh', {
          screen: 'match_details',
          fixtureId,
          data: { tab: 'details', durationMs: Math.max(0, Date.now() - started), ok },
        });
      }
    }
  }, [fixtureId]);

  useEffect(() => {
    recordDiagEvent('screen_focus', {
      screen: 'match_details',
      fixtureId: fixtureId > 0 ? fixtureId : null,
      data: { focused: isFocused },
    });
    if (isFocused) {
      setDiagnosticsScreen('match_details');
      setDiagnosticsFixture(fixtureId > 0 ? fixtureId : null);
    }
  }, [isFocused, fixtureId]);

  const detailsTabPrev = useRef(activeTab);
  useEffect(() => {
    if (detailsTabPrev.current === activeTab) return;
    const from = detailsTabPrev.current;
    detailsTabPrev.current = activeTab;
    recordDiagEvent('category_switch', {
      screen: 'match_details',
      fixtureId: fixtureId > 0 ? fixtureId : null,
      data: { from, to: activeTab },
    });
  }, [activeTab, fixtureId]);

  // Every match opens on the events tab: labeled "Highlights" pre-kickoff, "Events" when live/finished.
  // Related-match back restores the Form/H2H tab the user came from.
  useEffect(() => {
    if (!fixtureId) return;

    const isExpectedRelated = pendingRelatedFixtureIdRef.current === fixtureId;
    const restoreTab = pendingReturnTabRef.current;

    if (isExpectedRelated) {
      pendingRelatedFixtureIdRef.current = null;
      pendingReturnTabRef.current = null;
      lastHistoryFixtureIdRef.current = fixtureId;
      const nextTab: MatchDetailsTab = restoreTab ?? 'events';
      setActiveTab(nextTab);
      detailsTabPrev.current = nextTab;
      return;
    }

    // Same fixture re-fire (React Strict Mode) — keep H2H stack + current tab.
    if (lastHistoryFixtureIdRef.current === fixtureId) {
      return;
    }

    // Opened from matches / push / deeplink — drop in-tab H2H history.
    lastHistoryFixtureIdRef.current = fixtureId;
    relatedMatchStackRef.current = [];
    pendingRelatedFixtureIdRef.current = null;
    pendingReturnTabRef.current = null;
    setActiveTab('events');
    detailsTabPrev.current = 'events';
  }, [fixtureId]);
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = usePullToRefresh(runDetailsPull);
  const fixture = snapshot?.fixture ?? null;
  // Stable empties: a fresh `[]` per render made every effect keyed on these arrays
  // re-arm its timers on each render (lineups scheduler, photo prefetch, ...).
  const events = snapshot?.events ?? EMPTY_EVENTS;
  const statistics = snapshot?.statistics ?? EMPTY_STATISTICS;
  const statsFromEvents = snapshot?.statsFromEvents ?? false;
  const lineups = snapshot?.lineups ?? EMPTY_LINEUPS;
  const venue = snapshot?.venue ?? null;
  // Backend verdict when present; otherwise infer from what we hold (real events → feed
  // exists; only score-delta goals, or goals with no events at all → no feed).
  const eventsFeedAvailable = useMemo<boolean | null>(() => {
    if (events.some((event) => event && !event._synthetic)) return true;
    if (events.some((event) => event?._synthetic)) return false;
    if (typeof snapshot?.eventsFeedAvailable === 'boolean') return snapshot.eventsFeedAvailable;
    return null;
  }, [events, snapshot?.eventsFeedAvailable]);
  const lineupsAvailable = snapshot?.lineupsAvailable ?? null;

  const homeTeamName = fixture?.teams?.home?.name ?? '';
  const awayTeamName = fixture?.teams?.away?.name ?? '';
  const homeTeamLogo = presentTeamLogo(
    fixture?.teams?.home?.name,
    fixture?.teams?.home?.logo ?? '',
    fixture?.teams?.home?.id,
  );
  const awayTeamLogo = presentTeamLogo(
    fixture?.teams?.away?.name,
    fixture?.teams?.away?.logo ?? '',
    fixture?.teams?.away?.id,
  );
  const leagueName = fixture?.league?.name ?? '';

  const goalScorers = useMemo(() => {
    const formatMinute = (elapsed?: number | null, extra?: number | null): string => {
      if (elapsed == null) return '';
      if (extra) return `${elapsed}+${extra}'`;
      return `${elapsed}'`;
    };
    const homeId = fixture?.teams?.home?.id;
    const awayId = fixture?.teams?.away?.id;
    const toScorer = (e: FixtureEvent) => ({
      name: getPersonDisplayName(e.player?.name, language),
      minute: formatMinute(e.time?.elapsed, e.time?.extra),
    });
    // Score-delta goals carry no scorer; the header list would show blank rows.
    const isGoal = (e: FixtureEvent) =>
      e.type === 'Goal' && e.detail !== 'Missed Penalty' && !e._synthetic && !!e.player?.name;
    return {
      home: events.filter((e) => isGoal(e) && e.team?.id === homeId).map(toScorer),
      away: events.filter((e) => isGoal(e) && e.team?.id === awayId).map(toScorer),
    };
  }, [events, fixture?.teams?.home?.id, fixture?.teams?.away?.id, language]);

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
    (playerId: number, photo?: string | null, px: number = LINEUP_PHOTO_PX) => {
      const raw = playerPhotoUrl(
        playerId,
        photo,
        is365Fixture ? { source: '365' } : undefined,
      );
      return with365ImageSize(raw, px) ?? raw ?? '';
    },
    [is365Fixture],
  );

  const kickoffMoment = fixture?.fixture?.date ? safeParseDate(fixture.fixture.date) : null;
  const kickoffValid = kickoffMoment != null;
  const kickoffDate = kickoffValid ? safeToISOString(kickoffMoment).split('T')[0] : '';
  const kickoffTime = kickoffValid ? safeFormatMatchTime(fixture!.fixture.date) : '';

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
  /** Max silent background retries while lineups tab is open (live matches). */
  const MAX_LINEUP_AUTO_RETRIES = 4;

  const loadedTabsRef = useRef<Set<string>>(new Set());
  const lineupsPreloadedForRef = useRef<number | null>(null);
  const statsFormAttemptedRef = useRef<number | null>(null);
  const recentAveragesAttemptedRef = useRef<number | null>(null);
  /** Kept for Fast Refresh safety — previously used to auto-open Tracking tab. */
  const lmtAutoOpenedRef = useRef<number | null>(null);
  const lineupsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineupsInFlightRef = useRef(false);
  const lastLineupAttemptAtRef = useRef(0);
  /** Fixture whose lineup retry cap was already reported to Sentry. */
  const lineupCapReportedForRef = useRef<number | null>(null);
  /** Mirror of the bundle's `lineupsAvailable` for use inside callbacks. */
  const lineupsAvailableRef = useRef<boolean | null>(null);
  lineupsAvailableRef.current = lineupsAvailable;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const isLive = useCallback(() => {
    if (!fixture) return snapshot?.phase === 'live';
    const short = fixture.fixture?.status?.short;
    if (
      isStaleInPlayClock({
        statusShort: short,
        elapsed: fixture.fixture?.status?.elapsed,
        extra: fixture.fixture?.status?.extra,
        kickoffIso: fixture.fixture?.date,
      })
    ) {
      return false;
    }
    if (!short) return snapshot?.phase === 'live';
    return LIVE_MATCH_STATUSES.includes(
      short as (typeof LIVE_MATCH_STATUSES)[number],
    );
  }, [fixture, snapshot?.phase]);

  const isFinishedMatch = useCallback(() => {
    const short = fixture?.fixture?.status?.short;
    if (
      isStaleInPlayClock({
        statusShort: short,
        elapsed: fixture?.fixture?.status?.elapsed,
        extra: fixture?.fixture?.status?.extra,
        kickoffIso: fixture?.fixture?.date,
      })
    ) {
      return true;
    }
    return short
      ? ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)
      : snapshot?.phase === 'finished';
  }, [fixture, snapshot?.phase]);

  useEffect(() => {
    if (!fixtureId || !isFinishedMatch()) {
      setGoalClips([]);
      setMatchSummary(null);
      setSummaryUrls([]);
      return;
    }
    let cancelled = false;
    ApiFootballService.getFixtureHighlights(fixtureId)
      .then((payload) => {
        if (cancelled) return;
        const clips = preferDirectHighlightUrls(
          (payload.summaries?.length
            ? payload.summaries
            : payload.summary
              ? [payload.summary]
              : []
          ).flatMap((clip) => collectHighlightClipPlaybackUrls(clip)),
        );
        setGoalClips(payload.goals ?? []);
        setMatchSummary(payload.summary);
        setSummaryUrls(clips);
      })
      .catch(() => {
        if (cancelled) return;
        setGoalClips([]);
        setMatchSummary(null);
        setSummaryUrls([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId, isFinishedMatch]);

  const isPreKickoff = useCallback(() => {
    const short = fixture?.fixture?.status?.short;
    const kickoffSec = fixture?.fixture?.timestamp;
    if (kickoffSec && kickoffSec * 1000 > Date.now()) return true;
    return short === 'NS' || short === 'TBD';
  }, [fixture?.fixture?.status?.short, fixture?.fixture?.timestamp]);

  // Hydrate per-match push subscription (same source as Matches screen bell).
  useEffect(() => {
    if (!fixtureId) {
      setIsMatchSubscribed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const ids = await MatchSubscriptionsService.listIds(token);
        if (!cancelled) setIsMatchSubscribed(ids.has(fixtureId));
      } catch {
        // Keep default false — toggle can still attempt subscribe.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureId, getToken]);

  /** Pop related H2H/last-5 match first, then the details screen. Never push Matches. */
  const handleMatchBack = useCallback(() => {
    const prev = relatedMatchStackRef.current.pop();
    if (prev && prev.fixtureId > 0) {
      pendingRelatedFixtureIdRef.current = prev.fixtureId;
      pendingReturnTabRef.current = prev.returnTab;
      router.setParams({ fixtureId: String(prev.fixtureId) });
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/matches' as never);
  }, [router]);

  // Hardware back must pop related matches one step (tabs layout otherwise jumps to Matches).
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleMatchBack();
      return true;
    });
    return () => sub.remove();
  }, [isFocused, handleMatchBack]);

  const handleToggleMatchNotifications = useCallback(async () => {
    if (!fixtureId || matchSubLoading) return;
    if (isFinishedMatch()) {
      toastManager.showInfo(
        translate('matches.bell.errorTitle') || t.matchDetails.notifications || 'Notifications',
        translate('matches.bell.finishedDisabled') ||
          'Notifications are unavailable for finished matches.',
        { position: 'top', duration: 2000 },
      );
      return;
    }

    const subscribe = !isMatchSubscribed;
    setMatchSubLoading(true);
    setIsMatchSubscribed(subscribe);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      if (subscribe) {
        await MatchSubscriptionsService.subscribe(token, {
          fixtureId,
          matchTime: fixture?.fixture?.date || new Date().toISOString(),
          homeTeam: homeTeamName || 'Home',
          awayTeam: awayTeamName || 'Away',
          homeTeamLogo: homeTeamLogo || undefined,
          awayTeamLogo: awayTeamLogo || undefined,
          leagueName: leagueName || undefined,
        });
        await MatchFavoritesStorage.addFavorite(String(fixtureId));
        toastManager.showSuccess(
          translate('matches.bell.subscribedTitle') || 'Subscribed',
          translate('matches.bell.subscribedMessage') ||
            'You will get push alerts for this match.',
          { position: 'top', duration: 2000 },
        );
      } else {
        await MatchSubscriptionsService.unsubscribe(token, fixtureId);
        await MatchFavoritesStorage.removeFavorite(String(fixtureId));
        toastManager.showInfo(
          translate('matches.bell.unsubscribedTitle') || 'Unsubscribed',
          translate('matches.bell.unsubscribedMessage') || 'Match alerts turned off.',
          { position: 'top', duration: 1800 },
        );
      }
    } catch {
      setIsMatchSubscribed(!subscribe);
      toastManager.showError(
        translate('matches.bell.errorTitle') || 'Error',
        translate('matches.bell.errorMessage') ||
          'Could not update match notifications.',
        { position: 'top' },
      );
    } finally {
      setMatchSubLoading(false);
    }
  }, [
    fixtureId,
    matchSubLoading,
    isFinishedMatch,
    isMatchSubscribed,
    getToken,
    fixture?.fixture?.date,
    homeTeamName,
    awayTeamName,
    homeTeamLogo,
    awayTeamLogo,
    leagueName,
    t,
    translate,
  ]);

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
    const lineupNames = lineups.flatMap((l) => [
      l.team?.name,
      l.coach?.name,
      ...(l.startXI?.map((p) => p.player?.name) ?? []),
      ...(l.substitutes?.map((p) => p.player?.name) ?? []),
    ]);
    const eventNames = events.flatMap((e) => [
      e.team?.name,
      e.player?.name,
      e.assist?.name,
    ]);
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
      let existing = useLiveFixtureStore.getState().snapshots[fixtureId];
      if (!existing?.fixture) {
        const preview = await findLocalPreviewFixture(fixtureId);
        if (preview) {
          useLiveFixtureStore.getState().ingestPreviewIfEmpty(fixtureId, preview);
          existing = useLiveFixtureStore.getState().snapshots[fixtureId];
        }
      }
      setDetailsFetching(true);
      if (!existing?.fixture) setLoading(true);
      else setLoading(false);
      setError(null);

      const ingestFull = async () => {
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
          const archived = await Promise.race([
            matchArchiveService.getArchivedMatch(String(fixtureId)),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 2_500);
            }),
          ]);
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
        }

        setLoading(false);
        setDetailsFetching(false);
      };

      if (existing?.fixture) {
        void ingestFull().catch((err: unknown) => {
          if (isAbortError(err)) {
            setDetailsFetching(false);
            return;
          }
          setError(err instanceof Error ? err.message : t.matchDetails.loadDetailsFailed);
          setLoading(false);
          setDetailsFetching(false);
        });
        return;
      }

      await ingestFull();
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setDetailsFetching(false);
        return;
      }
      setError(err instanceof Error ? err.message : t.matchDetails.loadDetailsFailed);
      setLoading(false);
      setDetailsFetching(false);
    }
  }, [fixtureId, t]);

  // 365 overlays names in the active language; drop the in-memory snapshot so a
  // language switch cannot keep Arabic player names while the UI is English (or vice versa).
  const detailsLanguageRef = useRef(language);
  useEffect(() => {
    if (!fixtureId || !translationsReady) return;
    if (detailsLanguageRef.current === language) return;
    detailsLanguageRef.current = language;
    useLiveFixtureStore.setState((state) => {
      if (!state.snapshots[fixtureId]) return state;
      const snapshots = { ...state.snapshots };
      delete snapshots[fixtureId];
      return { snapshots };
    });
    void loadMatchDetails();
  }, [language, fixtureId, translationsReady, loadMatchDetails]);

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
    statsFormAttemptedRef.current = null;
    recentAveragesAttemptedRef.current = null;
    setRecentFormAverages(null);
    lineupsInFlightRef.current = false;
    lastLineupAttemptAtRef.current = 0;

    const existing = fixtureId
      ? useLiveFixtureStore.getState().snapshots[fixtureId]
      : null;
    setLoading(!existing?.fixture);

    if (!existing?.fixture && fixtureId) {
      void findLocalPreviewFixture(fixtureId).then((preview) => {
        if (!preview) return;
        useLiveFixtureStore.getState().ingestPreviewIfEmpty(fixtureId, preview);
        setLoading(false);
      });
    }

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

    if (lineupsInFlightRef.current) return;
    lineupsInFlightRef.current = true;
    lastLineupAttemptAtRef.current = Date.now();

    // The bundle already said the provider has no lineups: render the empty state at
    // once instead of a spinner, while the scheduler keeps checking in the background.
    const showLoading = !hasLineupData(snapLineups) && lineupsAvailableRef.current !== false;
    if (!force) loadedTabsRef.current.add('lineups');
    if (showLoading) {
      setLineupsLoading(true);
    }
    setLineupsError(null);
    addBreadcrumb('lineups fetch started', 'match-details.lineups', 'info', {
      fixtureId,
      force,
      attempt: lineupFetchAttempts,
    });
    try {
      const fresh = await ApiFootballService.getFixtureLineups(fixtureId, {
        is365: is365Fixture,
      });
      if (hasLineupData(fresh)) {
        const snap = useLiveFixtureStore.getState().snapshots[fixtureId];
        if (snap?.fixture) {
          const merged = buildSnapshotFromRaw({
            fixtureId,
            fixture: snap.fixture,
            events: snap.events ?? [],
            lineups: pickBetterLineups(snap.lineups, fresh) ?? fresh,
            statistics: snap.statistics,
            venue: snap.venue,
            source: 'http-full',
            existing: snap,
          });
          if (merged) {
            useLiveFixtureStore.getState().ingestSnapshot(merged);
          }
        }
      }

      const data = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups ?? [];

      if (isAuthoritativeLineupData(data) || isAuthoritativeLineupData(fresh)) {
        setLineupFetchAttempts(0);
        loadedTabsRef.current.add('lineups');
        addBreadcrumb('lineups fetch authoritative', 'match-details.lineups', 'info', {
          fixtureId,
        });
      } else if (hasLineupData(data) || hasLineupData(fresh)) {
        // Show provisional lineups immediately; background retries upgrade silently.
        loadedTabsRef.current.add('lineups');
        setLineupFetchAttempts((n) => Math.min(n + 1, MAX_LINEUP_AUTO_RETRIES));
      } else {
        setLineupFetchAttempts((n) => Math.min(n + 1, MAX_LINEUP_AUTO_RETRIES));
        loadedTabsRef.current.delete('lineups');
      }
    } catch (err: any) {
      // Refresh failures must not wipe an already-rendered lineup (common after
      // navigating to player profile and back while LMT/WebView remounts).
      const stillHaveLineups = hasLineupData(
        useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups,
      );
      if (!stillHaveLineups) {
        const raw = typeof err?.message === 'string' ? err.message : '';
        const looksTechnical = /reload|undefined|null is not|cannot read/i.test(raw);
        setLineupsError(
          looksTechnical || !raw
            ? t.matchDetails.loadLineupsFailed
            : raw,
        );
      }
      setLineupFetchAttempts((n) => n + 1);
      loadedTabsRef.current.delete('lineups');
    } finally {
      lineupsInFlightRef.current = false;
      setLineupsLoading(false);
    }
  }, [fixtureId, is365Fixture, t?.matchDetails?.loadLineupsFailed, lineupFetchAttempts]);

  // Cap exhausted — Sentry only when the provider said lineups exist (`true`)
  // and we still have no authoritative set. Unknown (`null`) / unavailable live
  // empties are expected upstream noise → breadcrumb + logger only.
  useEffect(() => {
    if (lineupFetchAttempts < MAX_LINEUP_AUTO_RETRIES) return;
    if (isAuthoritativeLineupData(lineups)) return;
    if (lineupCapReportedForRef.current === fixtureId) return;
    if (!isLive()) return;
    lineupCapReportedForRef.current = fixtureId;
    if (lineupsAvailable === true) {
      captureMessage(
        `[MatchDetails] lineups retry cap (${MAX_LINEUP_AUTO_RETRIES}) fixture=${fixtureId}`,
        'warning',
      );
      return;
    }
    addBreadcrumb('lineups retry cap (expected empty/unknown)', 'match-details.lineups', 'info', {
      fixtureId,
      lineupsAvailable,
    });
    logger.warn('[MatchDetails] lineups retry cap without provider available flag', {
      fixtureId,
      lineupsAvailable,
    });
  }, [lineupFetchAttempts, lineups, fixtureId, lineupsAvailable, isLive]);

  const retryLineups = useCallback(() => {
    setLineupFetchAttempts(0);
    loadedTabsRef.current.delete('lineups');
    void loadLineupsIfNeeded(true);
  }, [loadLineupsIfNeeded]);

  // Drop stale lineup errors once we have data again (e.g. after player profile pop).
  useEffect(() => {
    if (isFocused && hasLineupData(lineups) && lineupsError) {
      setLineupsError(null);
    }
  }, [isFocused, lineups, lineupsError]);

  // One lineups scheduler for the open tab (replaces the 15s poller + 8s auto-retry that
  // together hammered `/lineups` for matches that have none):
  //   - live: first attempt at once, then every 20s; after 4 empty answers back off to 60s
  //     (lineups can still be published late, so never stop completely while live);
  //   - not live: a single attempt, then the empty state with a manual retry.
  // Authoritative lineups stop it; a provisional set keeps it running so it can upgrade.
  useEffect(() => {
    if (lineupsPollingRef.current) {
      clearInterval(lineupsPollingRef.current);
      lineupsPollingRef.current = null;
    }
    if (activeTab !== 'lineups' || !fixtureId || lineupsError || !isFocused) return;
    if (isAuthoritativeLineupData(lineups)) return;
    const live = isLive();
    if (!live && lineupFetchAttempts >= 1) return;

    const intervalMs =
      lineupFetchAttempts >= LINEUPS_EMPTY_RESULTS_BEFORE_BACKOFF
        ? LINEUPS_LIVE_BACKOFF_MS
        : LINEUPS_LIVE_POLL_MS;
    const tick = () => {
      if (lineupsInFlightRef.current) return;
      loadedTabsRef.current.delete('lineups');
      void loadLineupsIfNeeded(true);
    };
    // Each completed attempt re-runs this effect; only fire at once when the previous
    // attempt is older than the cadence, otherwise just re-arm the timer.
    if (Date.now() - lastLineupAttemptAtRef.current >= intervalMs) tick();
    if (!live) return;

    lineupsPollingRef.current = setInterval(tick, intervalMs);

    return () => {
      if (lineupsPollingRef.current) {
        clearInterval(lineupsPollingRef.current);
        lineupsPollingRef.current = null;
      }
    };
  }, [
    activeTab,
    fixtureId,
    lineups,
    lineupsError,
    lineupFetchAttempts,
    isLive,
    isFocused,
    loadLineupsIfNeeded,
  ]);

  // Warm the image cache with lineup photos as soon as lineups are available
  // (even before the user opens the tab). URLs must be byte-identical to what the
  // pitch/bench avatars request, or the warm-up is a wasted second download.
  // Both starting XIs go first so the visible pitch is ready before the benches.
  useEffect(() => {
    if (!hasLineupData(lineups)) return;
    const urls: Array<string | null | undefined> = [];
    for (const lineup of lineups) {
      for (const s of lineup.startXI ?? []) {
        urls.push(resolveLineupPlayerPhoto(s.player.id, s.player.photo));
      }
    }
    for (const lineup of lineups) {
      for (const s of lineup.substitutes ?? []) {
        urls.push(resolveLineupPlayerPhoto(s.player.id, s.player.photo));
      }
    }
    prefetchImageUrls(urls);
  }, [lineups, resolveLineupPlayerPhoto]);

  /**
   * Stats tab: the details bundle is the first source, but it may hold nothing or only
   * goals/cards counts (events-derived). `/cached/fixture/:id/statistics` has the rich
   * possession/shots/corners set for many more leagues, so pull it whenever the bundle
   * came up short and merge it into the shared snapshot. Last-good stats stay on screen
   * while a refresh runs.
   */
  const loadStatsIfNeeded = useCallback(async (force = false) => {
    if (!fixtureId) return;

    const snap = useLiveFixtureStore.getState().snapshots[fixtureId];
    const snapStats = snap?.statistics ?? [];
    const alreadyRich = hasRichStatistics(snapStats) && !snap?.statsFromEvents;
    if (!force && alreadyRich) {
      loadedTabsRef.current.add('stats');
      return;
    }

    if (!force) loadedTabsRef.current.add('stats');
    const showLoading = !hasApiStatistics(snapStats) && !snap?.statsFromEvents;
    if (showLoading) setStatsLoading(true);
    setStatsError(null);
    try {
      if (!snap?.fixture) {
        await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
      }
      const afterBundle = useLiveFixtureStore.getState().snapshots[fixtureId];
      const bundleStats = afterBundle?.statistics ?? [];
      const bundleShort = !hasRichStatistics(bundleStats) || afterBundle?.statsFromEvents;

      if (afterBundle?.fixture && (force || bundleShort)) {
        const fresh = await ApiFootballService.getFixtureStatistics(fixtureId);
        const upgrade =
          hasRichStatistics(fresh) ||
          (hasApiStatistics(fresh) && (!hasApiStatistics(bundleStats) || afterBundle.statsFromEvents));
        if (upgrade) {
          const current = useLiveFixtureStore.getState().snapshots[fixtureId] ?? afterBundle;
          const merged = buildSnapshotFromRaw({
            fixtureId,
            fixture: current.fixture,
            events: current.events ?? [],
            lineups: current.lineups,
            statistics: fresh,
            venue: current.venue,
            source: 'http-full',
            existing: current,
          });
          if (merged) useLiveFixtureStore.getState().ingestSnapshot(merged);
        }
      }

      const finalSnap = useLiveFixtureStore.getState().snapshots[fixtureId];
      const data = finalSnap?.statistics ?? [];
      if (isLive() && !hasApiStatistics(data) && !finalSnap?.statsFromEvents) {
        loadedTabsRef.current.delete('stats');
      }
    } catch (err: any) {
      const current = useLiveFixtureStore.getState().snapshots[fixtureId];
      // Only surface the error when there is nothing to show; otherwise keep last-good.
      if (!hasApiStatistics(current?.statistics) && !current?.statsFromEvents) {
        setStatsError(err?.message || t.matchDetails.loadStatsFailed);
      }
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

  // Live stats change every minute; one poller while the tab is open and focused. The
  // backend serves `/statistics` from cache (stale-while-revalidate), so this is cheap.
  useEffect(() => {
    if (statsPollingRef.current) {
      clearInterval(statsPollingRef.current);
      statsPollingRef.current = null;
    }
    if (!isLive() || !fixtureId || activeTab !== 'stats' || !isFocused) return;

    statsPollingRef.current = setInterval(() => {
      void loadStatsIfNeeded(true);
    }, STATS_LIVE_POLL_MS);

    return () => {
      if (statsPollingRef.current) {
        clearInterval(statsPollingRef.current);
        statsPollingRef.current = null;
      }
    };
  }, [fixtureId, isLive, activeTab, isFocused, loadStatsIfNeeded]);

  const loadFormIfNeeded = useCallback(async (force = false, options?: { skipApiFootball?: boolean }) => {
    if (!fixture) return;
    if (!force && loadedTabsRef.current.has('form')) return;
    if (!force && !options?.skipApiFootball) loadedTabsRef.current.add('form');
    setFormLoading(true);
    setFormError(null);
    addBreadcrumb('H2H form fetch started', 'match-details.h2h', 'info', { fixtureId });
    try {
      if (is365Fixture && fixtureId) {
        const formStarted = Date.now();
        const form365 = await ApiFootballService.get365MatchForm(fixtureId);
        const homeFrom365 = form365?.home ?? [];
        const awayFrom365 = form365?.away ?? [];
        const h2hFrom365 = form365?.h2h ?? [];
        if (homeFrom365.length || awayFrom365.length || h2hFrom365.length) {
          setHomeLastFixtures(homeFrom365);
          setAwayLastFixtures(awayFrom365);
          setH2hFixtures(h2hFrom365);
          setForm365TeamIds({
            home: form365?.homeCompetitorId ?? undefined,
            away: form365?.awayCompetitorId ?? undefined,
          });
          loadedTabsRef.current.add('form');
          addBreadcrumb('H2H form loaded via /form', 'match-details.h2h', 'info', {
            fixtureId,
            latencyMs: Date.now() - formStarted,
          });
          return;
        }

        // /form already ran server-side competitor fallback — skip duplicate parallel pair.
        if (form365) {
          setFormError(t.matchDetails.loadFormFailed || t.matchDetails.noPreviousMatches);
          loadedTabsRef.current.delete('form');
          return;
        }

        const homeId = fixture.teams.home.id;
        const awayId = fixture.teams.away.id;
        const [homeMatches, awayMatches] = await Promise.all([
          ApiFootballService.getCompetitor365Matches(homeId),
          ApiFootballService.getCompetitor365Matches(awayId),
        ]);
        const homeLast = fixturesToTeamFixtures(homeMatches.finished, 5);
        const awayLast = fixturesToTeamFixtures(awayMatches.finished, 5);
        const h2hFromComp = fixturesToTeamFixtures(
          homeMatches.finished.filter(
            (f) => f.teams?.home?.id === awayId || f.teams?.away?.id === awayId,
          ),
          10,
        );
        if (homeLast.length || awayLast.length || h2hFromComp.length) {
          setHomeLastFixtures(homeLast);
          setAwayLastFixtures(awayLast);
          setH2hFixtures(h2hFromComp);
          setForm365TeamIds({ home: homeId, away: awayId });
          loadedTabsRef.current.add('form');
          return;
        }

        setFormError(t.matchDetails.loadFormFailed || t.matchDetails.noPreviousMatches);
        loadedTabsRef.current.delete('form');
        return;
      }
      if (options?.skipApiFootball) {
        if (fixtureId) {
          const form365 = await ApiFootballService.get365MatchForm(fixtureId);
          const homeFrom365 = form365?.home ?? [];
          const awayFrom365 = form365?.away ?? [];
          const h2hFrom365 = form365?.h2h ?? [];
          if (homeFrom365.length || awayFrom365.length || h2hFrom365.length) {
            setHomeLastFixtures(homeFrom365);
            setAwayLastFixtures(awayFrom365);
            setH2hFixtures(h2hFrom365);
            setForm365TeamIds({
              home: form365?.homeCompetitorId ?? undefined,
              away: form365?.awayCompetitorId ?? undefined,
            });
            loadedTabsRef.current.add('form');
          }
        }
        return;
      }
      const homeId = fixture.teams.home.id;
      const awayId = fixture.teams.away.id;
      const leagueId = fixture.league.id;
      const season = fixture.league.season;
      const [homeRes, awayRes, h2hRes] = await Promise.allSettled([
        ApiFootballService.getTeamLastFixtures(homeId, 5, { leagueId, season }),
        ApiFootballService.getTeamLastFixtures(awayId, 5, { leagueId, season }),
        ApiFootballService.getHeadToHead(homeId, awayId, 10),
      ]);
      if (homeRes.status === 'fulfilled') setHomeLastFixtures(homeRes.value);
      if (awayRes.status === 'fulfilled') setAwayLastFixtures(awayRes.value);
      if (h2hRes.status === 'fulfilled') {
        setH2hFixtures(fixturesToTeamFixtures(h2hRes.value, 10));
      }
    } catch {
      setFormError(t.matchDetails.loadFormFailed || t.common.retry);
      loadedTabsRef.current.delete('form');
    } finally {
      setFormLoading(false);
    }
  }, [fixtureId, fixture, is365Fixture, t?.matchDetails, t?.common]);

  useEffect(() => {
    if (activeTab !== 'stats' || !isFocused || !fixtureId) return;
    if (!isPreKickoff() && hasRichStatistics(statistics)) return;
    if (homeLastFixtures.length > 0 || awayLastFixtures.length > 0) return;
    if (statsFormAttemptedRef.current === fixtureId) return;
    statsFormAttemptedRef.current = fixtureId;
    void loadFormIfNeeded(false, { skipApiFootball: true });
  }, [
    activeTab,
    isFocused,
    fixtureId,
    statistics,
    homeLastFixtures.length,
    awayLastFixtures.length,
    loadFormIfNeeded,
    isPreKickoff,
  ]);

  useEffect(() => {
    if (activeTab !== 'stats' || !isFocused || !fixtureId) return;
    if (!isPreKickoff() && hasRichStatistics(statistics)) return;
    if (recentAveragesAttemptedRef.current === fixtureId) return;
    recentAveragesAttemptedRef.current = fixtureId;
    let cancelled = false;
    void (async () => {
      const data = await ApiFootballService.get365RecentFormAverages(fixtureId, 4);
      if (!cancelled && data) setRecentFormAverages(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isFocused, fixtureId, statistics, isPreKickoff]);

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
        let result365 = await ApiFootballService.get365StandingsGrouped(
          non365CompetitionId ?? undefined,
        );
        if (!result365.available && non365CompetitionId != null) {
          result365 = await ApiFootballService.get365StandingsGrouped(non365CompetitionId, {
            force: true,
          });
        }
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
        }
        // Namespaced 365 leagues have no API-Football leagueId.
        if (non365CompetitionId != null) {
          setStandingsUnavailable(true);
          return;
        }
        // World Cup / league.id === 1: fall through to API-Football standings.
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
    try {
      await useLiveFixtureStore.getState().fetchAndIngestFull(fixtureId);
    } catch {
      // venue may remain from fixture stub in snapshot
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

  // When Events tab is empty, kick one focused ingest — ongoing updates come from
  // useLiveFixture focused sync (events included). Avoid a second 8s poller.
  useEffect(() => {
    if (activeTab !== 'events' || !fixtureId || events.length > 0) return;
    if (isFinishedMatch()) return;
    void useLiveFixtureStore.getState().fetchAndIngestFast(fixtureId, { includeEvents: true });
    void loadVenueIfNeeded();
  }, [activeTab, fixtureId, events.length, isFinishedMatch, loadVenueIfNeeded]);

  const infoTabVisible = events.length > 0 && !isFinishedMatch();
  useEffect(() => {
    if (activeTab === 'info' && !infoTabVisible) setActiveTab('events');
  }, [activeTab, infoTabVisible]);
  useEffect(() => {
    if (activeTab !== 'info') return;
    void loadVenueIfNeeded();
  }, [activeTab, loadVenueIfNeeded]);

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

  // Prefetch standings so the tab only appears when a table exists.
  useEffect(() => {
    if (!fixture) return;
    void loadStandingsIfNeeded();
  }, [fixture?.fixture?.id, loadStandingsIfNeeded]);

  // Leave standings if the table disappeared / never loaded.
  useEffect(() => {
    if (activeTab !== 'standings') return;
    if (standingsLoading) return;
    if (standingsGroups.length > 0) return;
    setActiveTab(infoTabVisible ? 'info' : 'events');
  }, [activeTab, standingsLoading, standingsGroups.length, infoTabVisible]);

  // Refresh group table during live matches (updates after goals)
  useEffect(() => {
    if (!isLive() || !fixtureId || activeTab !== 'standings') return;
    const interval = setInterval(() => {
      loadedTabsRef.current.delete('standings');
      void loadStandingsIfNeeded(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [fixtureId, isLive, activeTab, loadStandingsIfNeeded]);

  // Warm lineups in the background so the tab can appear as soon as 365 or
  // API-Football publishes an XI. The tab itself stays hidden until then.
  useEffect(() => {
    if (!fixtureId || !fixture || hasLineupData(lineups)) return;

    if (lineupsPreloadedForRef.current !== fixtureId) {
      lineupsPreloadedForRef.current = fixtureId;
      void loadLineupsIfNeeded(true);
    }

    // Finished matches: one-shot fetch only (no polling).
    if (isFinishedMatch()) return;

    const intervalMs = isLive() ? 15_000 : 30_000;
    const interval = setInterval(() => {
      const current = useLiveFixtureStore.getState().snapshots[fixtureId]?.lineups;
      if (hasLineupData(current)) return;
      void loadLineupsIfNeeded(true);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [fixtureId, fixture?.fixture?.id, isLive, isFinishedMatch, loadLineupsIfNeeded, lineups]);

  const showLineupsTab = shouldShowLineupsTab(lineups);

  useEffect(() => {
    if (activeTab === 'lineups' && !showLineupsTab) {
      setActiveTab('events');
    }
  }, [activeTab, showLineupsTab]);

  // Reset Pitch/Score to score when match is not live (NS / FT) — must run before
  // any early returns so hook order stays stable across loading/error states.
  useEffect(() => {
    if (!isLive() || isFinishedMatch()) {
      setHeroView('score');
    }
  }, [fixture?.fixture?.status?.short, snapshot?.phase, isLive, isFinishedMatch]);

  // ── Tab change handler — triggers lazy load ───────────────────────────────
  const loadTabData = useCallback((tab: string) => {
    switch (tab) {
      case 'lineups':   loadLineupsIfNeeded(); break;
      case 'stats':     loadStatsIfNeeded(); break;
      case 'form':      loadFormIfNeeded(); break;
      case 'standings': loadStandingsIfNeeded(); break;
      case 'info':      void loadVenueIfNeeded(); break;
    }
  }, [loadLineupsIfNeeded, loadStatsIfNeeded, loadFormIfNeeded, loadStandingsIfNeeded, loadVenueIfNeeded]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as any);
    loadTabData(tab);
  }, [loadTabData]);

  const openRelatedMatch = useCallback(
    (relatedFixtureId?: number | null) => {
      if (relatedFixtureId == null || !Number.isFinite(relatedFixtureId) || relatedFixtureId <= 0) {
        return;
      }
      if (String(relatedFixtureId) === String(fixtureId)) return;
      // Tabs reuse one match-details screen — keep a local stack so back returns here.
      if (fixtureId > 0) {
        relatedMatchStackRef.current.push({
          fixtureId,
          returnTab: activeTabRef.current,
        });
      }
      pendingRelatedFixtureIdRef.current = relatedFixtureId;
      pendingReturnTabRef.current = null;
      router.setParams({ fixtureId: String(relatedFixtureId) });
    },
    [router, fixtureId],
  );

  const tabs = useMemo(() => [
    ...(infoTabVisible
      ? [{
          key: 'info',
          label: t.matchDetails.infoShort || (language === 'ar' ? 'معلومات' : 'Information'),
          icon: 'information-circle' as const,
        }]
      : []),
    {
      key: 'events',
      label:
        events.length === 0 && !isFinishedMatch()
          ? (t.matchDetails.highlightsShort || 'Highlights')
          : (t.matchDetails.eventsShort || t.matchDetails.events),
      icon: 'football' as const,
    },
    { key: 'stats', label: t.matchDetails.statistics, icon: 'stats-chart' as const },
    ...(showLineupsTab
      ? [{ key: 'lineups', label: t.matchDetails.lineupsShort || t.matchDetails.lineups, icon: 'people' as const }]
      : []),
    { key: 'chats', label: t.matchDetails.chats || 'Chats', icon: 'chatbubbles' as const },
    { key: 'form', label: t.matchDetails.form, icon: 'trending-up' as const },
    ...(standingsGroups.length > 0
      ? [{ key: 'standings', label: t.matchDetails.standings || 'Table', icon: 'list' as const }]
      : []),
  ], [infoTabVisible, t, language, events.length, isFinishedMatch, showLineupsTab, standingsGroups.length]);

  // ── Swipeable tab pager ───────────────────────────────────────────────────
  const { width: windowWidth } = useWindowDimensions();
  const [pagerWidth, setPagerWidth] = useState(windowWidth);
  const pagerRef = useRef<ScrollView>(null);
  const pagerScrollX = useRef(new Animated.Value(0)).current;
  const activeTabIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));
  const activeTabIndexRef = useRef(activeTabIndex);
  activeTabIndexRef.current = activeTabIndex;
  /** Page the pager is currently showing or animating toward. */
  const pagerIndexRef = useRef(activeTabIndex);
  const pagerWidthRef = useRef(pagerWidth);
  const pagerInitialOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const jumpPagerTo = useCallback((index: number, width: number) => {
    pagerIndexRef.current = index;
    pagerWidthRef.current = width;
    pagerScrollX.setValue(index * width);
    pagerRef.current?.scrollTo({ x: index * width, animated: false });
  }, [pagerScrollX]);

  // ── Collapsing hero + floating tabs ───────────────────────────────────────
  // Hero (score / pitch) and the tab capsule float over the pages. Every page
  // scrolls under them and drives one shared value; the hero slides away by up
  // to its own height. Inactive pages are kept at an equivalent offset so a
  // horizontal swipe never makes the hero jump.
  const topBarHeight = useMatchTopBarHeight();
  const [pagerHeight, setPagerHeight] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const heroHeightRef = useRef(0);
  heroHeightRef.current = heroHeight;
  const pageScrollY = useRef(new Animated.Value(0)).current;
  const pageRefs = useRef<Record<string, ScrollView | null>>({});
  const pageOffsetsRef = useRef<Record<string, number>>({});
  const pageMountOffsetsRef = useRef<Record<string, number>>({});
  const pageMountAppliedRef = useRef<Set<string>>(new Set());
  /** Offset of the last page that actually drove the hero (chat never does). */
  const drivingOffsetRef = useRef(0);
  const activeTabKeyRef = useRef<string>(activeTab);
  activeTabKeyRef.current = activeTab;

  const equivalentOffset = useCallback((key: string) => {
    const collapseRange = heroHeightRef.current;
    const driving = drivingOffsetRef.current;
    if (driving < collapseRange) return driving;
    return Math.max(pageOffsetsRef.current[key] ?? 0, collapseRange);
  }, []);

  const syncInactivePages = useCallback(() => {
    for (const [key, ref] of Object.entries(pageRefs.current)) {
      if (!ref || key === activeTabKeyRef.current) continue;
      const target = equivalentOffset(key);
      if (Math.abs(target - (pageOffsetsRef.current[key] ?? 0)) < 1) continue;
      pageOffsetsRef.current[key] = target;
      ref.scrollTo({ y: target, animated: false });
    }
  }, [equivalentOffset]);

  const pageScrollHandlersRef = useRef<Record<string, (...args: any[]) => void>>({});
  const getPageScrollHandler = useCallback((key: string) => {
    let handler = pageScrollHandlersRef.current[key];
    if (!handler) {
      handler = Animated.event([{ nativeEvent: { contentOffset: { y: pageScrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          pageOffsetsRef.current[key] = y;
          if (key === activeTabKeyRef.current) drivingOffsetRef.current = Math.max(0, y);
        },
      });
      pageScrollHandlersRef.current[key] = handler;
    }
    return handler;
  }, [pageScrollY]);

  const onHeroLayout = useCallback((e: LayoutChangeEvent) => {
    setHeroHeight(Math.round(e.nativeEvent.layout.height));
  }, []);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderHeight(Math.round(e.nativeEvent.layout.height));
  }, []);

  const chatTabIndex = tabs.findIndex((tab) => tab.key === 'chats');
  const heroCollapse = useMemo(() => {
    const range = Math.max(heroHeight, 1);
    const scrolled = pageScrollY.interpolate({
      inputRange: [0, range],
      outputRange: [0, range],
      extrapolate: 'clamp',
    });
    if (chatTabIndex < 0 || pagerWidth <= 0) return scrolled;
    // Chat has no scroll of its own to drive the hero, so collapse it fully
    // as the chat page slides into view.
    const chatProximity = pagerScrollX.interpolate({
      inputRange: [(chatTabIndex - 1) * pagerWidth, chatTabIndex * pagerWidth, (chatTabIndex + 1) * pagerWidth],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
    return Animated.add(
      Animated.multiply(scrolled, Animated.subtract(1, chatProximity)),
      Animated.multiply(chatProximity, range),
    );
  }, [heroHeight, pageScrollY, pagerScrollX, chatTabIndex, pagerWidth]);
  const headerTranslateY = useMemo(() => Animated.multiply(heroCollapse, -1), [heroCollapse]);
  const compactHeaderProgress = useMemo(() => {
    const range = Math.max(heroHeight, 1);
    return heroCollapse.interpolate({
      inputRange: [range * 0.55, range],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }, [heroCollapse, heroHeight]);

  const onPagerLayout = useCallback((e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    setPagerHeight(Math.round(e.nativeEvent.layout.height));
    if (width <= 0) return;
    setPagerWidth(width);
    jumpPagerTo(activeTabIndexRef.current, width);
  }, [jumpPagerTo]);

  // Tabs can appear/disappear (info, lineups) or be forced back to events —
  // keep the pager offset pinned to the active tab when that happens.
  useEffect(() => {
    if (!pagerRef.current || pagerWidth <= 0) return;
    if (pagerIndexRef.current === activeTabIndex && pagerWidthRef.current === pagerWidth) return;
    jumpPagerTo(activeTabIndex, pagerWidth);
  }, [activeTabIndex, pagerWidth, jumpPagerTo]);

  const onPagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const width = pagerWidthRef.current;
      if (width <= 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      const key = tabs[index]?.key;
      if (!key) return;
      pagerIndexRef.current = index;
      if (key !== activeTab) handleTabChange(key);
    },
    [tabs, activeTab, handleTabChange],
  );

  const onTabPress = useCallback(
    (key: string) => {
      const index = tabs.findIndex((tab) => tab.key === key);
      if (index < 0) return;
      syncInactivePages();
      pagerIndexRef.current = index;
      pagerRef.current?.scrollTo({ x: index * pagerWidthRef.current, animated: true });
      if (key !== activeTab) handleTabChange(key);
    },
    [tabs, activeTab, handleTabChange, syncInactivePages],
  );

  const onPagerScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: pagerScrollX } } }], { useNativeDriver: true }),
    [pagerScrollX],
  );

  // Warm up the neighbouring tabs so their content is ready mid-swipe.
  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    prefetchedTabsRef.current.clear();
  }, [fixtureId]);
  useEffect(() => {
    if (!fixture) return;
    const id = setTimeout(() => {
      for (const neighbor of [tabs[activeTabIndex - 1], tabs[activeTabIndex + 1]]) {
        if (!neighbor || prefetchedTabsRef.current.has(neighbor.key)) continue;
        prefetchedTabsRef.current.add(neighbor.key);
        loadTabData(neighbor.key);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [activeTabIndex, tabs, fixture, loadTabData]);

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

  // Coach nationality + injuries for the under-pitch Figma sections (selected team).
  useEffect(() => {
    if (activeTab !== 'lineups') return;
    const teamId = fixture?.teams?.[selectedTeamSide]?.id;
    if (!teamId) {
      setLineupInjuries([]);
      setCoachNationality(null);
      return;
    }
    let cancelled = false;
    setLineupInjuries([]);
    setCoachNationality(null);

    (async () => {
      const [injuriesRes, coachesRes] = await Promise.allSettled([
        ApiFootballService.getTeamInjuries(teamId),
        ApiFootballService.getTeamCoaches(teamId),
      ]);
      if (cancelled) return;

      if (injuriesRes.status === 'fulfilled') {
        const all = injuriesRes.value ?? [];
        const forFixture =
          fixtureId > 0 ? all.filter((row) => row.fixture?.id === fixtureId) : [];
        setLineupInjuries(forFixture.length > 0 ? forFixture : all.slice(0, 12));
      }

      if (coachesRes.status === 'fulfilled') {
        const coaches = coachesRes.value ?? [];
        const lineupCoachName =
          lineups
            .find((l) => l.team?.id === teamId)
            ?.coach?.name?.trim()
            .toLowerCase() ?? '';
        const match =
          coaches.find((c) => c.id && lineups.some((l) => l.team?.id === teamId && l.coach?.id === c.id)) ||
          coaches.find((c) => c.name?.trim().toLowerCase() === lineupCoachName) ||
          coaches[0];
        setCoachNationality(match?.nationality?.trim() || null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedTeamSide, fixture?.teams, fixtureId, lineups]);

  // Open a team's 365 profile from the match header. For 365 fixtures the team
  // id already is a 365 competitorId; for API-Football fixtures we pass only the
  // name so the profile resolves the competitor by name.
  const openTeamProfile = useCallback(
    (side: 'home' | 'away') => {
      const team = side === 'home' ? fixture?.teams?.home : fixture?.teams?.away;
      if (!team || (!team.id && !team.name)) return;
      const navParams: Record<string, string> = {};
      const masked = isIsraelSeniorNationalTeam(team.name, team.id, team.logo);
      if (!masked && is365Fixture && team.id) navParams.id = String(team.id);
      if (team.name) navParams.name = getTeamDisplayName(team.name, language, team.id);
      const crest = presentTeamLogo(team.name, team.logo, team.id);
      if (crest) navParams.logo = crest;
      router.push({ pathname: '/team-profile' as any, params: navParams } as any);
    },
    [router, fixture?.teams?.home, fixture?.teams?.away, is365Fixture, language],
  );

  // League pill → competition profile (365 competitionId only).
  const openLeagueProfile = useCallback(() => {
    const league = fixture?.league;
    if (!league) return;
    const competitionId = match365CompetitionId(league.id);
    if (!competitionId) return;
    router.push({
      pathname: '/competition-profile' as any,
      params: {
        id: String(competitionId),
        name: league.name ?? '',
        logo: league.logo ?? '',
        country: league.country ?? '',
      },
    } as any);
  }, [router, fixture?.league]);

  const openStandingTeamProfile = useCallback(
    (row: Standing) => {
      const team = row.team;
      if (!team?.id && !team?.name) return;
      const navParams: Record<string, string> = {};
      const masked = isIsraelSeniorNationalTeam(team.name, team.id, team.logo);
      // Standings on 365 fixtures use 365 competitorIds; otherwise resolve by name.
      if (!masked && is365Fixture && team.id) navParams.id = String(team.id);
      if (team.name) navParams.name = getTeamDisplayName(team.name, language, team.id);
      const crest = presentTeamLogo(team.name, team.logo, team.id);
      if (crest) navParams.logo = crest;
      router.push({ pathname: '/team-profile' as any, params: navParams } as any);
    },
    [router, is365Fixture, language],
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
          placeholder={require('../../assets/images/football.webp')}
        />
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.playerName} numberOfLines={2}>{player.name}</Text>
          <Text style={styles.playerPosition}>{getPositionName(position)}</Text>
        </View>
      </View>
    );
  };

  // Render Events Tab
  const renderMatchInformation = (showAutoUpdate: boolean) => {
    type CrowdRaw = { homePercent?: number; drawPercent?: number; awayPercent?: number; totalVotes?: number };
    const crowdSource = fixture as { _crowdPrediction?: CrowdRaw; crowdPrediction?: CrowdRaw } | null;
    const crowdRaw = crowdSource?._crowdPrediction ?? crowdSource?.crowdPrediction;
    const crowdPercents = [crowdRaw?.homePercent, crowdRaw?.drawPercent, crowdRaw?.awayPercent].map(Number);
    const crowd = crowdPercents.every((value) => Number.isFinite(value))
      ? {
          homePercent: crowdPercents[0],
          drawPercent: crowdPercents[1],
          awayPercent: crowdPercents[2],
          totalVotes: Number(crowdRaw?.totalVotes) || null,
          home: { name: getTeamDisplayName(homeTeamName, language), logo: homeTeamLogo },
          away: { name: getTeamDisplayName(awayTeamName, language), logo: awayTeamLogo },
          title: t.matchDetails.crowdVoteTitle || 'Fan vote results',
          subtitle: t.matchDetails.crowdVoteSubtitle || 'Who will win the match?',
          drawLabel: t.matchDetails.crowdVoteDraw || 'Draw',
          votesUnit: t.matchDetails.crowdVoteUnit || 'votes',
          tapHint: t.matchDetails.crowdVoteTap || 'Tap a card to vote',
          votedHint: t.matchDetails.crowdVoteDone || 'Your vote was recorded successfully',
          lockedHint: t.matchDetails.crowdVoteLocked || 'You cannot vote again',
          voteKey: fixtureId || null,
        }
      : null;

    return (
      <>
        <MatchKickoffHighlights
          info={extractMatchKickoffInfo({ fixture, venue })}
          kickoffTime={kickoffTime}
          rtl={language === 'ar'}
          sectionTitle={t.matchDetails.matchInfo || t.matchDetails.highlightsTitle || 'Match Information'}
          sectionHint={t.matchDetails.stadiumAndCoverage || 'Stadium & coverage'}
          matchTimeLabel={t.matchDetails.kickoffTimeLabel || t.matchDetails.matchTimeLabel || 'Kick-off'}
          autoUpdateTitle={t.matchDetails.highlightsAutoUpdate || 'Details move to Information'}
          autoUpdateHint={
            t.matchDetails.highlightsAutoUpdateHint ||
            'When the first event appears, these details open in a new Information tab.'
          }
          refereeLabel={t.matchDetails.matchRefereeLabel || t.matchDetails.referee || 'Referee'}
          staffLabel={t.matchDetails.matchStaff || 'Officials'}
          stadiumLabel={t.matchDetails.stadiumTag || t.matchDetails.stadium || 'Stadium'}
          capacityLabel={t.matchDetails.capacity || 'Capacity'}
          broadcastLabel={t.matchDetails.broadcastChannel || t.matchDetails.liveBroadcast || 'Broadcast'}
          weatherLabel={t.matchDetails.stadiumWeather || t.matchDetails.weather || 'Weather'}
          kickoffTimezoneHint={t.matchDetails.cairoTimezoneHint || 'Cairo time'}
          broadcastRegionHint={t.matchDetails.broadcastRegionHint || 'Egypt & Middle East'}
          emptyHint={
            isLive()
              ? (t.matchDetails.eventsWaitingLive || 'Waiting for the first event…')
              : (t.matchDetails.beforeMatch || t.matchDetails.eventsBeforeKickoff)
          }
          crowd={crowd}
          showAutoUpdate={showAutoUpdate}
        />
        <MatchTopPlayersCard
          homeCompetitorId={
            is365Fixture ? (form365TeamIds.home ?? fixture?.teams.home.id ?? 0) : 0
          }
          awayCompetitorId={
            is365Fixture ? (form365TeamIds.away ?? fixture?.teams.away.id ?? 0) : 0
          }
          competitionId={match365CompetitionId(fixture?.league?.id) ?? 0}
          homeTeam={{
            id: fixture?.teams.home.id ?? 0,
            name: getTeamDisplayName(homeTeamName, language),
            logo: fixture?.teams.home.logo,
          }}
          awayTeam={{
            id: fixture?.teams.away.id ?? 0,
            name: getTeamDisplayName(awayTeamName, language),
            logo: fixture?.teams.away.logo,
          }}
          rtl={language === 'ar'}
          labels={{
            title: t.matchDetails.topPlayersTitle,
            byPosition: t.matchDetails.topPlayersByPosition || 'By position',
            hint:
              t.matchDetails.topPlayersHint ||
              'Pick a position to compare each team’s top players',
            attack: t.matchDetails.topPlayersAttack,
            midfield: t.matchDetails.topPlayersMidfield,
            defense: t.matchDetails.topPlayersDefense,
            goals: t.matchDetails.topPlayersGoals,
            assists: t.matchDetails.topPlayersAssists,
            rating: t.matchDetails.topPlayersRating,
          }}
          onOpenPlayer={(player, team) =>
            pushPlayerCareer(router, {
              athleteId: player.athleteId,
              name: player.name,
              photo: player.photo,
              teamName: team.name,
              teamLogo: team.logo,
              teamId: team.id,
            })
          }
        />
      </>
    );
  };

  const renderEvents = () => {
    const finished = isFinishedMatch();
    if (!finished && events.length === 0) {
      return (
        <ScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderMatchInformation(true)}
        </ScrollView>
      );
    }
    if (detailsFetching && events.length === 0) {
      return <EventsSkeleton shimmerX={shimmerX} />;
    }
    if (events.length === 0) {
      const live = isLive();
      const totalGoals = (fixture?.goals?.home ?? 0) + (fixture?.goals?.away ?? 0);

      if ((totalGoals > 0) || eventsFeedAvailable === false) {
        return (
          <PullableTabBody>
            <View style={styles.emptyState}>
              <View style={styles.eventsWaitingIcon}>
                <Ionicons name="information-circle-outline" size={36} color={PURPLE_SOFT} />
              </View>
              <Text style={styles.emptyStateText}>
                {t.matchDetails.eventsFeedUnavailable ||
                  'Event details are not provided for this competition'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {live
                  ? (t.matchDetails.eventsUpdatingAuto || 'Updating automatically')
                  : (t.matchDetails.eventsNoneRecorded || t.matchDetails.noEvents)}
              </Text>
            </View>
          </PullableTabBody>
        );
      }

      return (
        <PullableTabBody>
          <View style={styles.emptyState}>
            <Ionicons name="football-outline" size={56} color="#333" />
            <Text style={styles.emptyStateText}>
              {t.matchDetails.eventsNoneRecorded || t.matchDetails.noEvents}
            </Text>
          </View>
        </PullableTabBody>
      );
    }

    const matchClock = fixture?.fixture?.status?.elapsed ?? null;
    // Latest first (top → bottom), so the match reads from the end of play downward.
    const sortedEvents = [...events].sort((a, b) => {
      const ea = a.time?.elapsed ?? 0;
      const eb = b.time?.elapsed ?? 0;
      if (ea !== eb) return eb - ea;
      return (b.time?.extra ?? 0) - (a.time?.extra ?? 0);
    });

    return (
      <ScrollView
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {matchSummary ? (
          <MatchSummaryVideo
            thumbnail={matchSummary.thumbnail}
            url={matchSummary.url || matchSummary.embedUrl}
            playLabel={t.matchDetails.matchSummaryPlay || 'تشغيل ملخص المباراة'}
            onPlay={() => {
              setHighlightPlaybackMeta({
                title: matchSummary.title,
                thumbnailUrl: matchSummary.thumbnail,
              });
              const fallback = (matchSummary.url || matchSummary.embedUrl || '').trim();
              const urls = summaryUrls.length ? summaryUrls : fallback ? [fallback] : [];
              // YouTube → open YouTube app immediately; direct MP4/Streamin → in-app sheet.
              openHighlightPlayback(urls, setHighlightVideoUrls);
            }}
          />
        ) : (
          <MatchMomentumGraph
            events={events}
            fixtureId={fixtureId || fixture?.fixture?.id}
            homeTeamId={fixture?.teams?.home?.id}
            awayTeamId={fixture?.teams?.away?.id}
            homeGoals={fixture?.goals?.home}
            awayGoals={fixture?.goals?.away}
            matchElapsed={matchClock}
            finished={isFinishedMatch()}
            homeTeam={{
              name: getTeamDisplayName(homeTeamName, language),
              logo: homeTeamLogo,
            }}
            awayTeam={{
              name: getTeamDisplayName(awayTeamName, language),
              logo: awayTeamLogo,
            }}
          />
        )}
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>{t.matchDetails.matchEvents}</Text>
          {eventsFeedAvailable === false ? (
            <View style={styles.eventsFeedNotice}>
              <Ionicons name="information-circle-outline" size={16} color={PURPLE_SOFT} />
              <Text style={styles.eventsFeedNoticeText}>
                {t.matchDetails.eventsFeedUnavailableHint ||
                  'Goals are shown from the score only, without player names'}
              </Text>
            </View>
          ) : null}
          {sortedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="football-outline" size={48} color="#333" />
              <Text style={styles.emptyStateText}>{t.matchDetails.noEvents}</Text>
            </View>
          ) : (
            <>
              <MatchEventsTimeline
                events={sortedEvents}
                language={language}
                homeTeamId={form365TeamIds.home ?? fixture?.teams?.home?.id}
                awayTeamId={form365TeamIds.away ?? fixture?.teams?.away?.id}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                homeTeamLogo={homeTeamLogo}
                awayTeamLogo={awayTeamLogo}
                goalForLabel={t.matchDetails.goalFor || 'Goal for {team}'}
                detailsUnavailableLabel={t.matchDetails.eventDetailsUnavailable || 'Details unavailable'}
                halfTimeLabel={t.matchDetails.eventsHalftime || 'Half-time'}
                goalClips={goalClips}
                goalClipScorerLabel={t.matchDetails.goalClipScorer || 'سجل الهدف: {player}'}
                goalClipPlayLabel={t.matchDetails.goalClipPlay || 'Play {player} goal'}
                onPlayClip={(urls, meta) => {
                  setHighlightPlaybackMeta({
                    title: meta?.title ?? null,
                    thumbnailUrl: meta?.thumbnailUrl ?? null,
                  });
                  openHighlightPlayback(urls, setHighlightVideoUrls);
                }}
              />
              <MatchEventsLegend
                language={language}
                labels={{
                  goal: t.matchDetails.goal || 'هدف',
                  ownGoal: t.matchDetails.ownGoal || 'هدف عكسي',
                  substitution: t.matchDetails.substitution || 'تبديل',
                  injurySubstitution: t.matchDetails.injurySubstitution || 'تبديل بسبب إصابة',
                  penalty: t.matchDetails.penalty || 'ركلة جزاء',
                  corner: t.matchDetails.cornerKick || 'ركلة ركنية',
                  var: 'VAR',
                  missedPenalty: t.matchDetails.missedPenalty || 'ركلة جزاء مهدرة',
                  secondYellow: t.matchDetails.secondYellow || 'إنذار ثانٍ',
                  assist: t.matchDetails.assist || 'تمريرة حاسمة',
                }}
              />
            </>
          )}
        </View>
        <HighlightVideoSheet
          visible={highlightVideoUrls.length > 0}
          urls={highlightVideoUrls}
          title={highlightPlaybackMeta.title}
          thumbnailUrl={highlightPlaybackMeta.thumbnailUrl}
          onClose={() => {
            setHighlightVideoUrls([]);
            setHighlightPlaybackMeta({});
          }}
          closeLabel={language === 'ar' ? 'إغلاق' : 'Close'}
        />
      </ScrollView>
    );
  };

  const renderLineups = () => {
    if (lineupsLoading && !hasLineupData(lineups)) {
      return <LineupsSkeleton shimmerX={shimmerX} />;
    }

    // Prefer existing lineup data over a stale refresh error (e.g. after
    // returning from player profile while a background refetch failed).
    if (!hasLineupData(lineups) && lineupsError) {
      return (
        <PullableTabBody>
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
            <Text style={styles.emptyStateText}>{lineupsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLineups}>
              <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
            </TouchableOpacity>
          </View>
        </PullableTabBody>
      );
    }

    if (!hasLineupData(lineups)) {
      // Only keep showing the spinner while auto-retry is actually running:
      // live matches always poll; non-finished matches retry until the cap.
      // Finished matches with no data must fall through to the empty state
      // immediately so the user never gets stuck on an infinite spinner. When the
      // bundle already said the provider has no lineups, skip the spinner entirely —
      // the scheduler keeps checking quietly in the background.
      const stillRetrying =
        lineupsAvailable !== false &&
        lineupFetchAttempts < (isLive() ? MAX_LINEUP_AUTO_RETRIES : 1);
      if (stillRetrying) {
        return (
          <PullableTabBody>
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#A855F7" />
              <Text style={styles.emptyStateSubtext}>
                {t.matchDetails.lineupsLoadingRetry}
              </Text>
            </View>
          </PullableTabBody>
        );
      }
      // Finished matches with no provider data get a clear "missing data" copy;
      // not-yet-started matches keep the "not available yet / retry" wording.
      const subtext = isFinishedMatch()
        ? t.matchDetails.lineupsNoData
        : isPreKickoff()
          ? t.matchDetails.lineupsNotAnnounced
          : t.matchDetails.lineupsUnavailable;
      return (
        <PullableTabBody>
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#333" />
            <Text style={styles.emptyStateText}>{t.matchDetails.noLineups}</Text>
            <Text style={styles.emptyStateSubtext}>{subtext}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLineups}>
              <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
            </TouchableOpacity>
          </View>
        </PullableTabBody>
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
      <View style={[styles.lineupScreen, { backgroundColor: mdIsDark ? '#030303' : mdColors.pageBg }]}>
          {visibleLineups.map((lineup, index) => {
            const startingXI = lineup.startXI || [];
            const substitutes = lineup.substitutes || [];
            const teamId = lineup.team?.id;

            const { pitchPlayers, benchPlayers } = applySubstitutionsToPitch(
              startingXI,
              substitutes,
              events,
              teamId,
            );
            const substitutions = collectLineupSubstitutions(
              startingXI,
              substitutes,
              events,
              teamId,
            );

            const fieldPlayers = sortPlayersForPitch(
              pitchPlayers.map((player) => ({
                ...player,
                photo: resolveLineupPlayerPhoto(
                  player.id,
                  player.photo,
                ) || undefined,
              })),
            );
            // Provider formation when it fits the XI, else derived from positions —
            // never a made-up default that contradicts the pitch.
            const formation = resolveFormationLabel(lineup.formation, fieldPlayers).label;
            const openLineupPlayer = (player: { id?: number; name: string; photo?: string }) => {
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
            };

            return (
              <View key={index} style={styles.lineupScreenBody}>
                <FootballField
                  formation={formation}
                  players={fieldPlayers}
                  onBenchPress={() => setBenchDrawerOpen(true)}
                  benchButtonLabel={t.matchDetails.substitutes}
                  renderTeamToggle={(scale) => (
                    <TeamToggle
                      variant="pill"
                      scale={scale}
                      home={{ name: getTeamDisplayName(homeTeamName, language), logo: homeTeamLogo }}
                      away={{ name: getTeamDisplayName(awayTeamName, language), logo: awayTeamLogo }}
                      value={selectedTeamSide}
                      onChange={setSelectedTeamSide}
                    />
                  )}
                  onPlayerPress={(player) => {
                    if (player.id) {
                      openPlayerProfile(
                        {
                          id: player.id,
                          athleteId: (player as { athleteId?: number }).athleteId,
                          name: player.name,
                          photo: player.photo,
                        },
                        lineup.team,
                      );
                    }
                  }}
                  renderOverlay={({ blurTarget, width, height }) => (
                    <LineupBenchDrawer
                      visible={benchDrawerOpen}
                      onClose={() => setBenchDrawerOpen(false)}
                      width={width}
                      height={height}
                      blurTarget={blurTarget}
                      players={benchPlayers}
                      title={t.matchDetails.substitutes}
                      emptyLabel={t.matchDetails.lineupNoSubstitutes}
                      closeLabel={t.common.close}
                      teamName={getTeamDisplayName(selectedTeamName, language)}
                      teamLogo={selectedTeamSide === 'home' ? homeTeamLogo : awayTeamLogo}
                      rtl={language === 'ar'}
                      resolvePhoto={resolveLineupPlayerPhoto}
                      onPlayerPress={(player) => {
                        setBenchDrawerOpen(false);
                        openLineupPlayer(player);
                      }}
                    />
                  )}
                />

                <LineupBelowSections
                  coach={
                    lineup.coach?.name
                      ? {
                          id: lineup.coach.id,
                          name: lineup.coach.name,
                          photo: lineup.coach.photo,
                          nationality: coachNationality,
                        }
                      : null
                  }
                  teamName={getTeamDisplayName(
                    lineup.team?.name || selectedTeamName,
                    language,
                  )}
                  teamLogo={
                    lineup.team?.logo ||
                    (selectedTeamSide === 'home' ? homeTeamLogo : awayTeamLogo)
                  }
                  substitutions={substitutions}
                  absences={lineupInjuries}
                  rtl={language === 'ar'}
                  language={language}
                  labels={{
                    coach: t.matchDetails.coach,
                    substitutes: t.matchDetails.substitutes,
                    absences: t.matchDetails.absences,
                    emptySubs: t.matchDetails.lineupNoSubstitutes,
                    playersCount: (n) =>
                      (t.matchDetails.lineupPlayersCount || '{n} players').replace(
                        '{n}',
                        String(n),
                      ),
                  }}
                  resolvePhoto={resolveLineupPlayerPhoto}
                  onCoachPress={(coachInfo) => {
                    if (!coachInfo.id) return;
                    router.push({
                      pathname: '/coach-profile' as any,
                      params: {
                        id: String(coachInfo.id),
                        name: coachInfo.name ?? '',
                        photo: coachInfo.photo ?? '',
                        teamName: lineup.team?.name ?? selectedTeamName,
                        teamId: String(lineup.team?.id ?? ''),
                      },
                    } as any);
                  }}
                  onPlayerPress={openLineupPlayer}
                  onAbsencePress={(injury) => {
                    if (!injury.player?.id) return;
                    openPlayerProfile(
                      {
                        id: injury.player.id,
                        name: injury.player.name,
                        photo: injury.player.photo,
                      },
                      lineup.team,
                    );
                  }}
                />

                <LineupBestPlayers
                  players={[...pitchPlayers, ...benchPlayers]}
                  title={t.matchDetails.lineupBestPlayers}
                  rtl={language === 'ar'}
                  resolvePhoto={resolveLineupPlayerPhoto}
                  onPlayerPress={openLineupPlayer}
                />
              </View>
            );
          })}
      </View>
    );
  };

  // Render Statistics Tab
  const renderStatistics = () => {
    const showLiveMatchStats = !isPreKickoff() && hasRichStatistics(statistics);
    const hasAnyMatchStats = statistics.length > 0 || statsFromEvents;

    if (showLiveMatchStats) {
      return (
        <ScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {statsFromEvents ? (
            <Text style={styles.statsPartialNote}>
              {t.matchDetails.statsFromEvents || 'Partial stats derived from match events'}
            </Text>
          ) : null}
          <MatchStatsCompare
            statistics={statistics}
            homeName={getTeamDisplayName(homeTeamName, language)}
            awayName={getTeamDisplayName(awayTeamName, language)}
            homeLogo={homeTeamLogo}
            awayLogo={awayTeamLogo}
          />
        </ScrollView>
      );
    }

    if (!isPreKickoff() && statsError && homeLastFixtures.length === 0 && !recentFormAverages) {
      return (
        <PullableTabBody>
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
            <Text style={styles.emptyStateText}>{statsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryStats}>
              <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
            </TouchableOpacity>
          </View>
        </PullableTabBody>
      );
    }

    const teamHome = {
      id: form365TeamIds.home ?? fixture?.teams.home.id,
      name: homeTeamName,
    };
    const teamAway = {
      id: form365TeamIds.away ?? fixture?.teams.away.id,
      name: awayTeamName,
    };
    const homeSummary = summarizeRecentTeamAverages(homeLastFixtures, teamHome, 4);
    const awaySummary = summarizeRecentTeamAverages(awayLastFixtures, teamAway, 4);
    const recentPlayed = Math.max(
      homeSummary.played,
      awaySummary.played,
      recentFormAverages?.home.games ?? 0,
      recentFormAverages?.away.games ?? 0,
    );

    if (formLoading && recentPlayed === 0) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (recentPlayed > 0) {
      return (
        <ScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <PreMatchRecentStats
            lastN={recentFormAverages?.last ?? 4}
            bannerTitle={
              t.matchDetails.recentAveragesBanner ||
              t.matchDetails.recentFormStatsTitle ||
              'Last 4 matches stats'
            }
            bannerHint={
              t.matchDetails.recentAveragesBannerHint ||
              t.matchDetails.recentFormStatsHint ||
              'These numbers are each team’s recent form.'
            }
            title={t.matchDetails.recentFormStatsTitle || 'Average stats'}
            columnLabel={t.matchDetails.lastNMatchesColumn || 'Last {n} matches'}
            homeName={getTeamDisplayName(homeTeamName, language)}
            awayName={getTeamDisplayName(awayTeamName, language)}
            homeLogo={homeTeamLogo || null}
            awayLogo={awayTeamLogo || null}
            homeScore={homeSummary}
            awayScore={awaySummary}
            enrichment={recentFormAverages}
            labels={{
              goalsScored: t.matchDetails.goalsScoredAvg || 'Goals',
              goalsConceded: t.matchDetails.goalsConcededAvg || 'Goals conceded',
              expectedGoals:
                t.matchDetails.statTypes?.expectedGoals || 'Expected Goals (xG)',
              expectedGoalsAgainst:
                t.matchDetails.expectedGoalsAgainst || 'Expected goals against (xGA)',
              shots: t.matchDetails.shots || t.matchDetails.statTypes?.totalShots || 'Shots',
              shotsOnTarget:
                t.matchDetails.shotsOnGoal || t.matchDetails.statTypes?.shotsOnGoal || 'Shots on target',
              corners: t.matchDetails.corners || t.matchDetails.statTypes?.cornerKicks || 'Corners',
              cards: t.matchDetails.cardsAvg || t.matchDetails.yellowCards || 'Cards',
              penalties:
                t.matchDetails.penaltiesScoredWon || t.matchDetails.statTypes?.penalties || 'Penalties',
              won: t.matchDetails.wonTheMatch || t.teamProfile?.wins || 'Won',
              btts: t.matchDetails.bothTeamsScored || 'Both teams scored',
              over25: t.matchDetails.over25Goals || 'Over 2.5 goals',
              winOrDraw: t.matchDetails.winOrDraw || 'Win or draw',
              cleanSheets: t.teamProfile?.cleanSheets || 'Clean sheets',
              trendsTitle: t.matchDetails.recentTrendsTitle || 'Trends',
              teamIndicators: t.matchDetails.teamIndicatorsTitle || 'Team indicators',
              scoring: t.matchDetails.indicatorScoring || 'Scoring',
              indicatorGoals: t.matchDetails.indicatorGoals || 'Goals',
            }}
          />
        </ScrollView>
      );
    }

    if (!isPreKickoff() && statsLoading && !hasAnyMatchStats) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    return (
      <PullableTabBody>
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
      </PullableTabBody>
    );
  };


  const renderForm = () => {
    if (formLoading && homeLastFixtures.length === 0 && awayLastFixtures.length === 0) {
      return <FormSkeleton shimmerX={shimmerX} />;
    }

    if (formError) {
      return (
        <PullableTabBody>
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
        </PullableTabBody>
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

    const formatH2hMatchDate = (dateStr: string): string => {
      const d = safeParseDate(dateStr);
      if (!d) return '';
      try {
        return d.toLocaleDateString(
          language?.toLowerCase().startsWith('ar') ? 'ar-EG' : 'en-GB',
          { year: 'numeric', month: 'short', day: 'numeric' },
        );
      } catch {
        try {
          return d.toISOString().slice(0, 10);
        } catch {
          return '';
        }
      }
    };

    const h2hMetaLabel = (row: TeamFixture): string => {
      const leagueLabel = getLeagueDisplayName(
        row.league.name,
        language,
        row.league.id,
        undefined,
      );
      const dateLabel = formatH2hMatchDate(row.fixture.date);
      return dateLabel ? `${leagueLabel}  ·  ${dateLabel}` : leagueLabel;
    };

    const selectedLastFixtures =
      selectedTeamSide === 'home' ? homeLastFixtures : awayLastFixtures;

    return (
      <ScrollView
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Head-to-head (direct meetings) — Figma 1896:5276 */}
        <View
          style={[
            styles.formContainer,
            {
              backgroundColor: 'transparent',
              paddingHorizontal: 0,
              paddingTop: 0,
            },
          ]}
        >
          <View style={styles.h2hSectionHeader}>
            <Text style={[styles.h2hBothLink, { color: mdColors.primary }]}>
              {t.matchDetails.headToHeadBothTeams}
            </Text>
            <View style={styles.h2hTitleRow}>
              <Text style={[styles.h2hTitle, { color: mdColors.textPrimary }]}>
                {t.matchDetails.headToHead}
              </Text>
              <ExpoImage
                source={require('../../assets/images/match-form/trophy.svg')}
                style={styles.h2hTrophy}
                contentFit="contain"
              />
            </View>
          </View>
          {h2hFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {h2hFixtures.map((row, index) => (
                <TouchableOpacity
                  key={`h2h-${row.fixture.id}-${index}`}
                  activeOpacity={0.75}
                  onPress={() => openRelatedMatch(row.fixture.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${getTeamDisplayName(row.teams.away.name, language)} ${row.goals.away ?? '-'} - ${row.goals.home ?? '-'} ${getTeamDisplayName(row.teams.home.name, language)}`}
                  style={[
                    styles.h2hCard,
                    {
                      backgroundColor: mdColors.cardBg,
                      borderColor: mdColors.cardBorder,
                      shadowColor: '#4B1FA3',
                      shadowOpacity: mdIsDark ? 0 : 0.22,
                      elevation: mdIsDark ? 0 : 2,
                    },
                  ]}
                >
                  <View style={styles.h2hCardRow}>
                    <View style={styles.h2hTeamSide}>
                      <TeamBadge
                        name={row.teams.away.name}
                        logo={row.teams.away.logo}
                        size={40}
                        color="transparent"
                        highQuality
                      />
                      <Text
                        style={[styles.h2hTeamName, { color: mdColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {getTeamDisplayName(row.teams.away.name, language)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.h2hScoreCapsule,
                        { backgroundColor: mdIsDark ? 'rgba(168,85,247,0.18)' : '#F2EBFC' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.h2hScoreText,
                          { color: mdIsDark ? '#E9D5FF' : '#4B1FA3' },
                        ]}
                      >
                        {row.goals.away ?? '-'} - {row.goals.home ?? '-'}
                      </Text>
                    </View>
                    <View style={[styles.h2hTeamSide, styles.h2hTeamSideEnd]}>
                      <Text
                        style={[styles.h2hTeamName, styles.h2hTeamNameEnd, { color: mdColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {getTeamDisplayName(row.teams.home.name, language)}
                      </Text>
                      <TeamBadge
                        name={row.teams.home.name}
                        logo={row.teams.home.logo}
                        size={40}
                        color="transparent"
                        highQuality
                      />
                    </View>
                  </View>
                  <View style={styles.h2hMetaRow}>
                    <Text style={[styles.h2hMetaText, { color: mdColors.textMuted }]} numberOfLines={1}>
                      {h2hMetaLabel(row)}
                    </Text>
                    <ExpoImage
                      source={require('../../assets/images/match-form/calendar.svg')}
                      style={styles.h2hCalendar}
                      contentFit="contain"
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: mdColors.textSecondary }]}>
                {t.matchDetails.noHeadToHead}
              </Text>
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
        <View
          style={[
            styles.formContainer,
            {
              backgroundColor: mdIsDark ? '#1a1a1a' : mdColors.cardBg,
              borderWidth: mdIsDark ? 0 : 1,
              borderColor: mdColors.cardBorder,
            },
          ]}
        >
          <View style={styles.formHeader}>
            <TeamBadge
              name={selectedTeamSide === 'home' ? homeTeamName : awayTeamName}
              logo={selectedTeamSide === 'home' ? homeTeamLogo : awayTeamLogo}
              size={50}
              color="transparent"
            />
            <Text style={[styles.formTeamName, { color: mdColors.textPrimary }]}>
              {getTeamDisplayName(selectedTeamSide === 'home' ? homeTeamName : awayTeamName, language)}
            </Text>
            <Text style={[styles.formTitle, { color: mdColors.textMuted }]}>
              {t.matchDetails.last5Matches}
            </Text>
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
                  <TouchableOpacity
                    key={`last-${fixture.fixture.id}-${index}`}
                    activeOpacity={0.75}
                    onPress={() => openRelatedMatch(fixture.fixture.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.matchDetails.vs} ${getTeamDisplayName(opponent.name, language)} ${teamScore} - ${opponentScore}`}
                    style={[
                      styles.fixtureCard,
                      {
                        backgroundColor: mdIsDark ? '#252525' : '#F8F5FF',
                        borderWidth: mdIsDark ? 0 : 1,
                        borderColor: mdColors.cardBorder,
                      },
                    ]}
                  >
                    <TeamBadge
                      name={opponent.name}
                      logo={opponent.logo}
                      size={40}
                      color="transparent"
                      highQuality
                    />
                    <View style={styles.fixtureInfo}>
                      <Text style={[styles.fixtureOpponent, { color: mdColors.textPrimary }]} numberOfLines={1}>
                        {t.matchDetails.vs} {getTeamDisplayName(opponent.name, language)}
                      </Text>
                      <Text style={[styles.fixtureLeague, { color: mdColors.textMuted }]}>
                        {getLeagueDisplayName(
                          fixture.league.name,
                          language,
                          fixture.league.id,
                          undefined,
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.fixtureResult,
                        !mdIsDark && result === 'win' && { backgroundColor: '#22c55e' },
                        !mdIsDark && result === 'lose' && { backgroundColor: '#ef4444' },
                        !mdIsDark && result === 'draw' && { backgroundColor: '#f59e0b' },
                        result === 'win' && styles.fixtureWin,
                        result === 'lose' && styles.fixtureLose,
                        result === 'draw' && styles.fixtureDraw,
                      ]}
                    >
                      <Text style={styles.fixtureScore}>{teamScore} - {opponentScore}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: mdColors.textSecondary }]}>
                {t.matchDetails.noPreviousMatches}
              </Text>
            </View>
          )}
        </View>
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
        <PullableTabBody>
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
        </PullableTabBody>
      );
    }

    if (standingsUnavailable || standingsGroups.length === 0) {
      return (
        <PullableTabBody>
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
        </PullableTabBody>
      );
    }

    const renderStandingsTable = (rows: Standing[], keyPrefix: string) => (
      <MatchStandingsTable
        rows={rows}
        keyPrefix={keyPrefix}
        language={language}
        homeRef={{
          id: fixture?.teams?.home?.id,
          name: fixture?.teams?.home?.name,
        }}
        awayRef={{
          id: fixture?.teams?.away?.id,
          name: fixture?.teams?.away?.name,
        }}
        labels={{
          rank: t.matchDetails.standingsRank || '#',
          team: t.matchDetails.team,
          played: t.matchDetails.standingsPlayed,
          goalsFor: t.matchDetails.standingsGoalsFor,
          goalsAgainst: t.matchDetails.standingsGoalsAgainst,
          goalsForShort: t.matchDetails.standingsGoalsForShort,
          goalsAgainstShort: t.matchDetails.standingsGoalsAgainstShort,
          goalDiff: t.matchDetails.standingsGoalDiff,
          goalDiffShort: t.matchDetails.standingsGoalDiffShort,
          points: t.matchDetails.standingsPoints,
          pointsShort: t.matchDetails.standingsPointsShort,
          pointsExplain: t.matchDetails.standingsPointsExplain,
          gdExplain: t.matchDetails.standingsGdExplain,
          formWin: t.matchDetails.standingsFormWin,
          formDraw: t.matchDetails.standingsFormDraw,
          formLoss: t.matchDetails.standingsFormLoss,
        }}
        onPressTeam={openStandingTeamProfile}
      />
    );

    const groupIndex = Math.min(selectedGroupIndex, standingsGroups.length - 1);
    const activeGroup = standingsGroups[groupIndex];
    const isValidGroupName = (group: string) => {
      const trimmed = group.trim();
      return (
        trimmed.length > 0 &&
        trimmed !== 'Table' &&
        trimmed !== 'undefined' &&
        trimmed !== 'Group undefined'
      );
    };
    const showGroupChips =
      standingsGroups.length > 1 &&
      standingsGroups.every((g) => isValidGroupName(g.group));
    const chipLabel = (group: string) => group.replace(/^Group\s+/i, '');

    return (
      <ScrollView
        scrollEnabled={false}
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
          <View style={styles.standingsSection}>
            <View style={styles.standingsTitleRow}>
              <Text style={[styles.standingsTableTitle, { color: mdColors.textPrimary }]}>
                {t.matchDetails.standingsTableTitle || t.matchDetails.standings || 'Standings'}
              </Text>
              <ExpoImage
                source={require('../../assets/images/match-form/trophy.svg')}
                style={styles.standingsTrophy}
                contentFit="contain"
              />
            </View>
            <View
              style={[
                styles.standingsContainer,
                {
                  backgroundColor: 'transparent',
                  padding: 0,
                  borderWidth: 0,
                },
              ]}
            >
              {renderStandingsTable(activeGroup.standings, `${activeGroup.group}-${groupIndex}`)}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  if (loading && !snapshot) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: mdColors.pageBg }]}>
        <StatusBar barStyle={mdColors.statusBar} />
        <View style={{ paddingHorizontal: 20, paddingTop: 100 }}>
          {/* Header skeleton */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: mdColors.skeleton }} />
            <View style={{ flex: 1, marginHorizontal: 16, height: 16, borderRadius: 8, backgroundColor: mdColors.skeleton }} />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: mdColors.skeleton }} />
          </View>
          {/* Score card skeleton */}
          <View style={{ height: 160, borderRadius: 24, backgroundColor: mdColors.skeleton, marginBottom: 16 }} />
          {/* Tabs skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[80, 80, 90, 80, 70, 80].map((w, i) => (
              <View key={i} style={{ width: w, height: 36, borderRadius: 12, backgroundColor: mdColors.skeleton }} />
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
      <View style={[styles.errorContainer, { backgroundColor: mdColors.pageBg }]}>
        <StatusBar barStyle={mdColors.statusBar} />
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: mdColors.pageBg }}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  // No live data, no archive, not loading, no error: show a dedicated empty
  // state instead of an empty header/tabs shell on a dark background.
  if (!fixture && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: mdColors.pageBg }]}>
        <StatusBar barStyle={mdColors.statusBar} backgroundColor={mdColors.pageBg} />
        <MatchDetailsTopBar
          title={t.matchDetails.navTitle || t.matchDetails.title}
          backLabel={t.matchDetails.backToMatches}
          notificationsLabel={t.matchDetails.notifications || 'Notifications'}
          onBack={handleMatchBack}
          onNotifications={handleToggleMatchNotifications}
          isSubscribed={isMatchSubscribed}
          notificationsDisabled={isFinishedMatch()}
          notificationsLoading={matchSubLoading}
        />
        <View style={[styles.errorContainer, { backgroundColor: mdColors.pageBg }]}>
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

  const hasLmtWidget = Boolean(lmtInfo?.widgetUrl);
  // Pitch / Score toggle only while the match is live — same as NS (no toggle).
  // When the match ends, hide LMT controls automatically so only the score header remains.
  const showLmtControls = hasLmtWidget && isLive() && !isFinishedMatch();
  const hasLmt = showLmtControls;
  const showPitch = hasLmt && heroView === 'pitch';
  // Only mount the native WebView while Pitch is visible. Keeping it at height:0
  // on the Score tab lets Android still paint a black surface that clips scorers
  // — especially when the widget reloads at FT / late stoppage.

  const headerStatus = fixture ? (
    ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'].includes(fixture.fixture?.status?.short ?? '') ? 'live'
    : ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(fixture.fixture?.status?.short ?? '') ? 'finished'
    : 'upcoming'
  ) : 'upcoming';

  const scoreHeader = (
    <MatchHeader
      homeTeam={getTeamDisplayName(homeTeamName, language)}
      awayTeam={getTeamDisplayName(awayTeamName, language)}
      homeLogo={homeTeamLogo}
      awayLogo={awayTeamLogo}
      homeScore={fixture?.goals?.home != null ? String(fixture.goals.home) : undefined}
      awayScore={fixture?.goals?.away != null ? String(fixture.goals.away) : undefined}
      status={headerStatus}
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
      clockAnchorKey={fixtureId || undefined}
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
      kickoffStatusLabel={t.matchDetails.kickoffStatus}
      scorers={goalScorers}
      scorersViewMoreLabel={t.matchDetails.scorersViewMore}
      scorersViewLessLabel={t.matchDetails.scorersViewLess}
      onPressHomeTeam={() => openTeamProfile('home')}
      onPressAwayTeam={() => openTeamProfile('away')}
      onPressLeague={
        match365CompetitionId(fixture?.league?.id) ? openLeagueProfile : undefined
      }
    />
  );

  const lmtWidget = hasLmt && isFocused && showPitch ? (
    <View collapsable={false}>
      <MatchLmtWebView
        variant="hero"
        widgetUrl={lmtInfo!.widgetUrl}
        embedUrl={lmtInfo!.embedUrl}
        aspectRatio={lmtInfo!.widgetRatio}
        hideBrand={
          process.env.EXPO_PUBLIC_LMT_HIDE_PITCH_BRAND === 'true' ||
          process.env.EXPO_PUBLIC_LMT_HIDE_PITCH_BRAND === '1'
        }
        brandLogoUrl={process.env.EXPO_PUBLIC_LMT_PITCH_LOGO_URL?.trim() || null}
        // URI fallback only — covers raw 365 VLMT splash if HTML rewrite fails.
        coverBrand
        loadingLabel={t.matchDetails.trackingLoading || 'Loading live pitch…'}
        unavailableLabel={t.matchDetails.trackingUnavailable || 'Live pitch tracking is not provided for this match.'}
        retryLabel={t.matchDetails.retry || t.common.retry}
        expandLabel={t.matchDetails.trackingExpand || 'Wider view'}
        collapseLabel={t.matchDetails.trackingCollapse || 'Close wider view'}
      />
    </View>
  ) : null;

  const renderTabPage = (key: string) => {
    if (key === 'chats') {
      return (
        <View style={[styles.chatPage, { paddingTop: Math.max(0, headerHeight - heroHeight) }]}>
          <MatchChatTab
            fixtureId={fixtureId}
            kickoffAt={fixture?.fixture?.date}
            matchSummary={{
              homeTeam: getTeamDisplayName(homeTeamName, language),
              awayTeam: getTeamDisplayName(awayTeamName, language),
              homeLogo: homeTeamLogo,
              awayLogo: awayTeamLogo,
              homeScore: fixture?.goals?.home,
              awayScore: fixture?.goals?.away,
              league: getLeagueDisplayName(
                leagueName,
                language,
                fixture?.league?.id,
                fixture?.league?.country,
              ),
              statusShort: fixture?.fixture?.status?.short,
              elapsed: fixture?.fixture?.status?.elapsed ?? undefined,
              stoppage: fixture?.fixture?.status?.extra ?? null,
              startTimestamp: fixture ? getPeriodStartTimestamp(fixture) : undefined,
              clockAnchorKey: fixtureId || undefined,
              fixtureDate: fixture?.fixture?.date,
              kickoffStatusLabel: t.matchDetails.kickoffStatus,
              liveLabel: getLocalizedMatchStatus('LIVE', language),
              halftimeLabel: getLocalizedMatchStatus('HT', language),
              finishedLabel: getLocalizedMatchStatus('FT', language),
              statusLabel: fixture?.fixture?.status?.short
                ? fixture.fixture.status.short === 'NS'
                  ? t.matchDetails.kickoffStatus
                  : getLocalizedMatchStatus(fixture.fixture.status.short, language)
                : t.matchDetails.kickoffStatus,
              scorers: goalScorers,
              scorersViewMoreLabel: t.matchDetails.scorersViewMore,
              scorersViewLessLabel: t.matchDetails.scorersViewLess,
            }}
          />
        </View>
      );
    }
    if (pageMountOffsetsRef.current[key] === undefined) {
      const initialY = equivalentOffset(key);
      pageMountOffsetsRef.current[key] = initialY;
      pageOffsetsRef.current[key] = initialY;
    }
    const mountOffset = pageMountOffsetsRef.current[key];
    return (
      <Animated.ScrollView
        ref={(ref: ScrollView | null) => {
          pageRefs.current[key] = ref;
        }}
        style={styles.pageScroll}
        contentContainerStyle={[
          styles.pageScrollContent,
          { paddingTop: headerHeight, minHeight: pagerHeight + heroHeight },
        ]}
        contentOffset={{ x: 0, y: mountOffset }}
        onScroll={getPageScrollHandler(key)}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (mountOffset <= 0 || pageMountAppliedRef.current.has(key)) return;
          pageMountAppliedRef.current.add(key);
          pageRefs.current[key]?.scrollTo({ y: mountOffset, animated: false });
        }}
        refreshControl={detailsPullControl(pullRefreshing, onPullRefresh, headerHeight, mdColors.pageBg)}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        alwaysBounceVertical
        overScrollMode="always"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {key === 'info' && infoTabVisible ? (
            <ScrollView
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {renderMatchInformation(false)}
            </ScrollView>
          ) : null}
          {key === 'events' && renderEvents()}
          {key === 'lineups' && renderLineups()}
          {key === 'stats' && renderStatistics()}
          {key === 'form' && renderForm()}
          {key === 'standings' && renderStandings()}
        </View>
      </Animated.ScrollView>
    );
  };

  if (!pagerInitialOffsetRef.current) {
    pagerInitialOffsetRef.current = { x: activeTabIndex * pagerWidth, y: 0 };
  }
  const pagerInitialOffset = pagerInitialOffsetRef.current;

  const mountedTabKeys = new Set(
    tabs.filter((_, index) => Math.abs(index - activeTabIndex) <= 1).map((tab) => tab.key),
  );
  for (const key of Object.keys(pageMountOffsetsRef.current)) {
    if (mountedTabKeys.has(key)) continue;
    delete pageMountOffsetsRef.current[key];
    pageMountAppliedRef.current.delete(key);
  }

  const compactScore = (
    <MatchCompactScore
      homeTeam={getTeamDisplayName(homeTeamName, language)}
      awayTeam={getTeamDisplayName(awayTeamName, language)}
      homeLogo={homeTeamLogo}
      awayLogo={awayTeamLogo}
      homeScore={fixture?.goals?.home}
      awayScore={fixture?.goals?.away}
      status={headerStatus}
      statusShort={fixture?.fixture?.status?.short}
      elapsed={fixture?.fixture?.status?.elapsed ?? undefined}
      stoppage={fixture?.fixture?.status?.extra ?? null}
      startTimestamp={fixture ? getPeriodStartTimestamp(fixture) : undefined}
      clockAnchorKey={fixtureId || undefined}
      fixtureDate={fixture?.fixture?.date}
      time={kickoffTime}
      statusLabel={
        fixture?.fixture?.status?.short
          ? getLocalizedMatchStatus(fixture.fixture.status.short, language)
          : undefined
      }
      halftimeLabel={getLocalizedMatchStatus('HT', language)}
      finishedLabel={getLocalizedMatchStatus('FT', language)}
      liveLabel={getLocalizedMatchStatus('LIVE', language)}
      vsLabel={t.matchDetails.vs}
      penaltiesShortLabel={getLocalizedMatchStatus('PEN', language)}
    />
  );
  const compactProgress = (
    <MatchCompactProgress
      statusShort={fixture?.fixture?.status?.short}
      elapsed={fixture?.fixture?.status?.elapsed ?? undefined}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: mdColors.pageBg }]}>
      <StatusBar barStyle={mdColors.statusBar} backgroundColor={mdColors.pageBg} />

      <View style={styles.body}>
        <Animated.ScrollView
          ref={pagerRef as any}
          horizontal
          pagingEnabled
          style={styles.pager}
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onPagerScroll}
          onScrollBeginDrag={syncInactivePages}
          onMomentumScrollEnd={onPagerMomentumEnd}
          onLayout={onPagerLayout}
          contentOffset={pagerInitialOffset}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
          bounces={false}
        >
          {tabs.map((tab, index) => (
            <View key={tab.key} style={[styles.pagerPage, { width: pagerWidth }]}>
              {Math.abs(index - activeTabIndex) <= 1 ? renderTabPage(tab.key) : null}
            </View>
          ))}
        </Animated.ScrollView>

        <Animated.View
          pointerEvents="box-none"
          onLayout={onHeaderLayout}
          style={[
            styles.floatingHeader,
            { paddingTop: topBarHeight, transform: [{ translateY: headerTranslateY }] },
          ]}
        >
          <View collapsable={false} onLayout={onHeroLayout} style={[styles.heroBlock, { backgroundColor: mdColors.heroBg }]}>
            {lmtWidget}
            {/* Score header stays mounted across Pitch ↔ Score so the live clock
                anchor does not reset. LMT WebView mounts only while Pitch is shown. */}
            <View
              collapsable={false}
              pointerEvents={showPitch ? 'none' : 'auto'}
              style={showPitch ? styles.scoreHeaderHidden : undefined}
            >
              {scoreHeader}
            </View>

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
          </View>

          <View pointerEvents="box-none" style={styles.floatingTabsWrap}>
            <ModernTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={onTabPress}
              scrollX={pagerScrollX}
              pageWidth={pagerWidth}
              floating
            />
          </View>
        </Animated.View>
      </View>

      <MatchDetailsTopBar
        title={tabs[activeTabIndex]?.label || t.matchDetails.navTitle || t.matchDetails.title || 'The Match'}
        backLabel={t.matchDetails.backToMatches}
        notificationsLabel={t.matchDetails.notifications || 'Notifications'}
        onBack={handleMatchBack}
        onNotifications={handleToggleMatchNotifications}
        isSubscribed={isMatchSubscribed}
        notificationsDisabled={isFinishedMatch()}
        notificationsLoading={matchSubLoading}
        compactContent={compactScore}
        compactFooter={compactProgress}
        collapseProgress={compactHeaderProgress}
        floating
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c051a',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  pager: {
    flex: 1,
  },
  pagerPage: {
    flex: 1,
  },
  chatPage: {
    flex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  heroBlock: {
    backgroundColor: '#0c051a',
  },
  floatingTabsWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  lmtHidden: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  scoreHeaderHidden: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
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
    marginTop: 6,
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
  /** Full-bleed under the tabs: cancels `content` padding so the stadium art spans the screen. */
  lineupScreen: {
    marginHorizontal: -16,
    marginTop: -8,
  },
  lineupScreenBody: {
    paddingBottom: 28,
  },
  substitutesSection: {
    paddingHorizontal: 4,
    marginTop: 16,
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 4,
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
    gap: 14,
  },
  h2hSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
  },
  h2hBothLink: {
    fontSize: 11,
    fontWeight: '600',
  },
  h2hTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  h2hTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  h2hTrophy: {
    width: 24,
    height: 24,
  },
  h2hCard: {
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 81,
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
    gap: 2,
  },
  h2hCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    minHeight: 48,
    gap: 8,
  },
  h2hTeamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  h2hTeamSideEnd: {
    justifyContent: 'flex-end',
  },
  h2hTeamName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  h2hTeamNameEnd: {
    textAlign: 'right',
  },
  h2hScoreCapsule: {
    minWidth: 78,
    height: 29,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  h2hScoreText: {
    fontSize: 20,
    fontWeight: '700',
  },
  h2hMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 16,
  },
  h2hMetaText: {
    fontSize: 10.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  h2hCalendar: {
    width: 15,
    height: 15,
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
    marginTop: 4,
  },
  eventsFeedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  eventsFeedNoticeText: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
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
  standingsSection: {
    marginBottom: 12,
    gap: 12,
  },
  standingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
  },
  standingsTableTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  standingsTrophy: {
    width: 24,
    height: 24,
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

function MatchDetailsScreenWithTheme() {
  return (
    <MatchDetailsThemeProvider>
      <MatchDetailsScreen />
    </MatchDetailsThemeProvider>
  );
}

export default MatchDetailsScreenWithTheme;

