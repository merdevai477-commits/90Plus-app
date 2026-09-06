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
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiFootballService, { TeamStatistics, TeamFixture, FixtureEvent, Fixture, Lineup, Standing } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName, getLocalizedMatchStatus, getLocalizedStatType, getLocalizedEventLabel } from '../../utils/i18nHelpers';
import { prefetchFootballTranslations } from '../../src/stores/footballTranslationStore';
import { collectUniqueStrings } from '../../utils/footballNamePrefetch';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { TeamToggle } from '../../components/match-details/TeamToggle';
import { MatchDetailsTopBar } from '../../components/match-details/MatchDetailsTopBar';
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
import { FootballField } from '../../components/match-details/FootballField';
import { MatchStandingsTable } from '../../components/match-details/MatchStandingsTable';
import { MatchEventIcon, getMatchEventColor } from '../../components/match-details/MatchEventIcon';
import { MatchMomentumGraph } from '../../components/match-details/MatchMomentumGraph';
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
import { isAbortError } from '../../utils/isAbortError';
import { findLocalPreviewFixture } from '../../utils/findLocalPreviewFixture';
import {
  hasApiStatistics,
  hasRichStatistics,
} from '../../utils/matchStatsFallback';
import { hasLineupData, isAuthoritativeLineupData, pickBetterLineups, shouldShowLineupsTab } from '../../utils/matchLineupsFallback';
import { addBreadcrumb, captureMessage } from '../../services/sentry.service';
import { resolveFormationLabel, sortPlayersForPitch } from '../../utils/lineupGrid';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import {
  buildScores365CoachPhotoUrl,
  with365ImageSize,
} from '../../utils/scores365AthletePhoto';
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
import { safeParseDate, safeToISOString } from '../../utils/safeDate';
import { fixturesToTeamFixtures } from '../../utils/scores365Adapters';
import { summarizeRecentTeamAverages, type RecentFormAveragesPayload } from '../../utils/recentTeamFormStats';

const { width, height } = Dimensions.get('window');

const LIVE_MATCH_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] as const;
const EMPTY_EVENTS: FixtureEvent[] = [];
const EMPTY_STATISTICS: TeamStatistics[] = [];
const EMPTY_LINEUPS: Lineup[] = [];
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
  const isFocused = useIsFocused();
  const { getToken } = useAuth();
  const { t, language, translate } = useTranslation();
  const params = useLocalSearchParams() as unknown as MatchDetailsParams;
  const shimmerX = useShimmer();
  const translationsReady = Boolean(t?.matchDetails);

  const [activeTab, setActiveTab] = useState<'lineups' | 'stats' | 'form' | 'events' | 'standings' | 'chats'>('events');

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
  const homeTeamLogo = fixture?.teams?.home?.logo ?? '';
  const awayTeamLogo = fixture?.teams?.away?.logo ?? '';
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
      name: e.player?.name ?? '',
      minute: formatMinute(e.time?.elapsed, e.time?.extra),
    });
    // Score-delta goals carry no scorer; the header list would show blank rows.
    const isGoal = (e: FixtureEvent) =>
      e.type === 'Goal' && e.detail !== 'Missed Penalty' && !e._synthetic && !!e.player?.name;
    return {
      home: events.filter((e) => isGoal(e) && e.team?.id === homeId).map(toScorer),
      away: events.filter((e) => isGoal(e) && e.team?.id === awayId).map(toScorer),
    };
  }, [events, fixture?.teams?.home?.id, fixture?.teams?.away?.id]);

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
    (playerId: number, photo?: string | null) => {
      const raw = playerPhotoUrl(
        playerId,
        photo,
        is365Fixture ? { source: '365' } : undefined,
      );
      return with365ImageSize(raw, 64) ?? raw ?? '';
    },
    [is365Fixture],
  );

  const resolveCoachPhoto = useCallback(
    (coachId: number | null | undefined, photo?: string | null) => {
      const raw = photo?.trim()
        ? photo.trim()
        : is365Fixture && coachId
          ? buildScores365CoachPhotoUrl(coachId, 68)
          : '';
      if (!raw) return '';
      return with365ImageSize(raw, 64) ?? raw;
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

  // Cap exhausted — surface in Sentry once per fixture (the previous effect fired on
  // every render after the cap: 121 warnings from one device in 85 minutes).
  useEffect(() => {
    if (lineupFetchAttempts < MAX_LINEUP_AUTO_RETRIES) return;
    if (isAuthoritativeLineupData(lineups)) return;
    if (lineupCapReportedForRef.current === fixtureId) return;
    lineupCapReportedForRef.current = fixtureId;
    captureMessage(
      `[MatchDetails] lineups retry cap (${MAX_LINEUP_AUTO_RETRIES}) fixture=${fixtureId}`,
      'warning',
    );
  }, [lineupFetchAttempts, lineups, fixtureId]);

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

  // When Events tab is empty, kick one focused ingest — ongoing updates come from
  // useLiveFixture focused sync (events included). Avoid a second 8s poller.
  useEffect(() => {
    if (activeTab !== 'events' || !fixtureId || events.length > 0) return;
    if (isFinishedMatch()) return;
    void useLiveFixtureStore.getState().fetchAndIngestFast(fixtureId, { includeEvents: true });
  }, [activeTab, fixtureId, events.length, isFinishedMatch]);

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

  useEffect(() => {
    if (activeTab !== 'lineups' || !fixture) return;
    void loadVenueIfNeeded();
  }, [activeTab, fixture?.fixture?.id, loadVenueIfNeeded]);

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
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as any);
    switch (tab) {
      case 'lineups':
        loadLineupsIfNeeded();
        void loadVenueIfNeeded();
        break;
      case 'stats':     loadStatsIfNeeded(); break;
      case 'form':      loadFormIfNeeded(); break;
      case 'standings': loadStandingsIfNeeded(); break;
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

  // Open a team's 365 profile from the match header. For 365 fixtures the team
  // id already is a 365 competitorId; for API-Football fixtures we pass only the
  // name so the profile resolves the competitor by name.
  const openTeamProfile = useCallback(
    (side: 'home' | 'away') => {
      const team = side === 'home' ? fixture?.teams?.home : fixture?.teams?.away;
      if (!team || (!team.id && !team.name)) return;
      const navParams: Record<string, string> = {};
      if (is365Fixture && team.id) navParams.id = String(team.id);
      if (team.name) navParams.name = team.name;
      if (team.logo) navParams.logo = team.logo;
      router.push({ pathname: '/team-profile' as any, params: navParams } as any);
    },
    [router, fixture?.teams?.home, fixture?.teams?.away, is365Fixture],
  );

  const openStandingTeamProfile = useCallback(
    (row: Standing) => {
      const team = row.team;
      if (!team?.id && !team?.name) return;
      const navParams: Record<string, string> = {};
      if (team.id) navParams.id = String(team.id);
      if (team.name) navParams.name = team.name;
      if (team.logo) navParams.logo = team.logo;
      router.push({ pathname: '/team-profile' as any, params: navParams } as any);
    },
    [router],
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
      const totalGoals = (fixture?.goals?.home ?? 0) + (fixture?.goals?.away ?? 0);

      // Goals on the board but nothing to list: the provider has no event feed for this
      // competition. Say so instead of spinning on "waiting for the first event" forever.
      // Live matches rely on the backend verdict (a feed can lag the score by a minute).
      if ((finished && totalGoals > 0) || ((live || finished) && eventsFeedAvailable === false)) {
        return (
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
        );
      }

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

    const matchClock = fixture?.fixture?.status?.elapsed ?? null;
    const sortedEvents = [...events].sort((a, b) => {
      const ea = a.time?.elapsed ?? 0;
      const eb = b.time?.elapsed ?? 0;
      if (ea !== eb) return ea - eb;
      return (a.time?.extra ?? 0) - (b.time?.extra ?? 0);
    });

    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
          ) : sortedEvents.map((event, index) => {
            const homeTeamId = fixture?.teams?.home?.id;
            const isHomeTeam = homeTeamId != null
              ? event.team.id === homeTeamId
              : event.team.name.toLowerCase().includes(homeTeamName.toLowerCase()) ||
                homeTeamName.toLowerCase().includes(event.team.name.toLowerCase());

            const eventColor = getMatchEventColor(event.type, event.detail);
            const isSubstitution = event.type === 'subst';
            const isSynthetic = event._synthetic === true;
            const minuteKnown = !isSynthetic || event._minuteKnown !== false;

            return (
              <View
                key={`${event.time.elapsed}-${event.type}-${event.player?.id ?? index}`}
                style={[
                  styles.eventCard,
                  isHomeTeam ? styles.eventHome : styles.eventAway,
                ]}
              >
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>
                    {minuteKnown ? `${event.time.elapsed}'` : '—'}
                  </Text>
                  {minuteKnown && !!event.time.extra && (
                    <Text style={styles.eventExtraTime}>{`+${event.time.extra}'`}</Text>
                  )}
                </View>

                <View style={[styles.eventIcon, { backgroundColor: `${eventColor}20` }]}>
                  <MatchEventIcon type={event.type} detail={event.detail} size={20} />
                </View>

                <View style={styles.eventDetails}>
                  {isSynthetic ? (
                    <>
                      <Text style={styles.eventPlayer}>
                        {(t.matchDetails.goalFor || 'Goal for {team}').replace(
                          '{team}',
                          getTeamDisplayName(event.team.name, language),
                        )}
                      </Text>
                      <Text style={styles.eventSyntheticTag}>
                        {t.matchDetails.eventDetailsUnavailable || 'Details unavailable'}
                      </Text>
                    </>
                  ) : isSubstitution ? (
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
  const renderMatchInfoCard = () => {
    const venueData = venue || {
      id: fixture?.fixture.venue?.id,
      name: fixture?.fixture.venue?.name,
      city: fixture?.fixture.venue?.city,
      address: null as string | null,
      country: null as string | null,
      capacity: null as number | null,
      surface: null as string | null,
      image: null as string | null,
    };
    const stadiumName = venueData.name || fixture?.fixture.venue?.name;
    const referee = fixture?.fixture?.referee;
    const capacity = venueData.capacity;
    const hasAny = Boolean(stadiumName || referee || capacity || venueData.city);

    if (!hasAny && !venueLoading) return null;

    const rows: Array<{
      key: string;
      label: string;
      value: string;
      icon: React.ComponentProps<typeof Ionicons>['name'];
    }> = [];

    if (stadiumName) {
      rows.push({
        key: 'stadium',
        label: t.matchDetails.stadium || 'Stadium',
        value: [stadiumName, venueData.city].filter(Boolean).join(' · '),
        icon: 'business-outline',
      });
    }
    if (capacity) {
      rows.push({
        key: 'attendance',
        label: t.matchDetails.attendance || 'Attendance',
        value: capacity.toLocaleString(),
        icon: 'people-outline',
      });
    }
    if (referee) {
      rows.push({
        key: 'referee',
        label: t.matchDetails.referee || 'Referee',
        value: referee,
        icon: 'flag-outline',
      });
    }

    if (rows.length === 0) {
      if (venueLoading) {
        return (
          <View style={styles.matchInfoCard}>
            <ActivityIndicator size="small" color="#A855F7" />
          </View>
        );
      }
      return null;
    }

    return (
      <View style={styles.matchInfoCard}>
        <Text style={styles.matchInfoTitle}>
          {t.matchDetails.matchInfo || 'Match Information'}
        </Text>
        {rows.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.matchInfoRow,
              index < rows.length - 1 && styles.matchInfoRowBorder,
            ]}
          >
            <View style={styles.matchInfoValueWrap}>
              <Ionicons name={row.icon} size={16} color="#a78bfa" />
              <Text style={styles.matchInfoValue} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
            <Text style={styles.matchInfoLabel}>{row.label}</Text>
          </View>
        ))}
      </View>
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
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{lineupsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryLineups}>
            <Text style={styles.retryButtonText}>{t.matchDetails.retry}</Text>
          </TouchableOpacity>
        </View>
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
        : isPreKickoff()
          ? t.matchDetails.lineupsNotAnnounced
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
        style={{ flex: 1 }}
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
            const startingXI = lineup.startXI || [];
            const substitutes = lineup.substitutes || [];
            const teamId = lineup.team?.id;

            const { pitchPlayers, benchPlayers } = applySubstitutionsToPitch(
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

            return (
              <View key={index} style={styles.teamLineupContainer}>
                <View style={styles.teamHeader}>
                  <TeamBadge name={lineup.team.name} logo={lineup.team.logo} size={60} color="transparent" />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName} numberOfLines={2}>
                      {getTeamDisplayName(lineup.team.name, language)}
                    </Text>
                    {formation ? (
                      <Text style={styles.formationText}>
                        {t.matchDetails.formation}: {formation}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.coachBlock}>
                    {(() => {
                      const coachUri = resolveCoachPhoto(
                        lineup.coach?.id,
                        lineup.coach?.photo,
                      );
                      return coachUri ? (
                        <CachedAthletePhoto
                          uri={coachUri}
                          size={48}
                          recyclingKey={lineup.coach?.id ?? coachUri}
                        />
                      ) : (
                        <View style={styles.coachPhotoPlaceholder}>
                          <Ionicons name="person" size={22} color="#888" />
                        </View>
                      );
                    })()}
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
                          <CachedAthletePhoto
                            uri={resolveLineupPlayerPhoto(player.id, player.photo)}
                            size={28}
                            recyclingKey={player.id}
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

                {renderMatchInfoCard()}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Statistics Tab
  const renderStatistics = () => {
    const showLiveMatchStats = !isPreKickoff() && hasRichStatistics(statistics);
    const hasAnyMatchStats = statistics.length > 0 || statsFromEvents;

    if (showLiveMatchStats) {
      return (
        <ScrollView
          style={{ flex: 1 }}
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
            language={language}
            title={
              t.matchDetails.statsComparison ||
              t.matchDetails.statistics ||
              'Statistics Comparison'
            }
            possessionLabelLines={[
              t.matchDetails.possessionLine1 || 'Possession',
              t.matchDetails.possessionLine2 || '',
            ]}
            dangerousAttacksLabelLines={[
              t.matchDetails.dangerousAttacksLine1 || 'Dangerous',
              t.matchDetails.dangerousAttacksLine2 || 'Attacks',
            ]}
            attacksLabel={
              t.matchDetails.statTypes?.attacks || 'Attacks'
            }
          />
        </ScrollView>
      );
    }

    if (!isPreKickoff() && statsError && homeLastFixtures.length === 0 && !recentFormAverages) {
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
          style={{ flex: 1 }}
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
            homeScore={homeSummary}
            awayScore={awaySummary}
            enrichment={recentFormAverages}
            labels={{
              goalsScored: t.matchDetails.goalsScoredAvg || t.matchDetails.goalsFor || 'Goals scored',
              goalsConceded:
                t.matchDetails.goalsConcededAvg || t.matchDetails.goalsAgainst || 'Goals conceded',
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
            }}
          />
        </ScrollView>
      );
    }

    if (!isPreKickoff() && statsLoading && !hasAnyMatchStats) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

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
        style={{ flex: 1 }}
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
          rank: '#',
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
        style={{ flex: 1 }}
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
        <MatchDetailsTopBar
          title={t.matchDetails.navTitle || t.matchDetails.title}
          backLabel={t.matchDetails.backToMatches}
          notificationsLabel={t.matchDetails.notifications || 'Notifications'}
          onBack={() => router.push('/(tabs)/matches' as any)}
          onNotifications={handleToggleMatchNotifications}
          isSubscribed={isMatchSubscribed}
          notificationsDisabled={isFinishedMatch()}
          notificationsLoading={matchSubLoading}
        />
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
    { key: 'events', label: t.matchDetails.eventsShort || t.matchDetails.events, icon: 'football' as const },
    { key: 'stats', label: t.matchDetails.statistics, icon: 'stats-chart' as const },
    ...(showLineupsTab
      ? [{ key: 'lineups', label: t.matchDetails.lineupsShort || t.matchDetails.lineups, icon: 'people' as const }]
      : []),
    { key: 'chats', label: t.matchDetails.chats || 'Chats', icon: 'chatbubbles' as const },
    { key: 'form', label: t.matchDetails.form, icon: 'trending-up' as const },
    { key: 'standings', label: t.matchDetails.standings || 'Table', icon: 'list' as const },
  ];
  const tabs = baseTabs;

  const hasLmtWidget = Boolean(lmtInfo?.widgetUrl);
  // Pitch / Score toggle only while the match is live — same as NS (no toggle).
  // When the match ends, hide LMT controls automatically so only the score header remains.
  const showLmtControls = hasLmtWidget && isLive() && !isFinishedMatch();
  const hasLmt = showLmtControls;
  const showPitch = hasLmt && heroView === 'pitch';
  // Only mount the native WebView while Pitch is visible. Keeping it at height:0
  // on the Score tab lets Android still paint a black surface that clips scorers
  // — especially when the widget reloads at FT / late stoppage.

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
      onPressHomeTeam={() => openTeamProfile('home')}
      onPressAwayTeam={() => openTeamProfile('away')}
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
        coverBrand={false}
        loadingLabel={t.matchDetails.trackingLoading || 'Loading live pitch…'}
        unavailableLabel={t.matchDetails.trackingUnavailable || 'Live pitch tracking is not provided for this match.'}
        retryLabel={t.matchDetails.retry || t.common.retry}
        expandLabel={t.matchDetails.trackingExpand || 'Wider view'}
        collapseLabel={t.matchDetails.trackingCollapse || 'Close wider view'}
      />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0c051a" />

      <MatchDetailsTopBar
        title={t.matchDetails.navTitle || t.matchDetails.title || 'The Match'}
        backLabel={t.matchDetails.backToMatches}
        notificationsLabel={t.matchDetails.notifications || 'Notifications'}
        onBack={() => router.push('/(tabs)/matches' as any)}
        onNotifications={handleToggleMatchNotifications}
        isSubscribed={isMatchSubscribed}
        notificationsDisabled={isFinishedMatch()}
        notificationsLoading={matchSubLoading}
      />

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

      <ModernTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === 'chats' ? (
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
          }}
        />
      ) : (
        <View style={styles.content}>
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'lineups' && renderLineups()}
          {activeTab === 'stats' && renderStatistics()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'standings' && renderStandings()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c051a',
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
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  matchInfoCard: {
    marginTop: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 12, 28, 0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  matchInfoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  matchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  matchInfoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  matchInfoLabel: {
    color: '#cfcfcf',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 0,
  },
  matchInfoValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchInfoValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
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
  eventSyntheticTag: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 2,
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

