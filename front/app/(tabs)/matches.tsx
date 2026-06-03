import { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { Bell, ChevronDown, Calendar, Ticket, X, ChevronLeft, ChevronRight, CalendarCheck2, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { FlashList } from '@shopify/flash-list';
import BottomNav from './BottomNav';
import { TEXT_PRIMARY, PURPLE_PRIMARY } from '../../constants/tokens';
import { APP_BG } from '../../constants/ui';
import { useMatchesData } from '../../hooks/useMatchesData';
import { PredictionsService, PredictionApiError } from '../../services/predictions.service';
import { toastManager } from '../../services/toastManager';
import { cacheService } from '../../services/cacheService';
import { predictionsMapKey, predictionsTicketsKey } from '../../services/predictionsCacheKeys';
import { offlineQueue } from '../../src/services/offlineQueue';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from '../../src/i18n';
import { MatchSubscriptionsService } from '../../services/matchSubscriptions.service';
import { MatchFavoritesStorage } from '../../src/storage/matchFavorites.storage';
import { useScreenFont } from '../../utils/fontSetup';
import { useMatchEventsMonitor } from '../../src/hooks/useMatchEventsMonitor';
import type { Match } from '../../components/Matches/matchCardUtils';
import { CountryAccordion } from '../../components/Matches/CountryAccordion';
import type { CountryGroup } from '../../hooks/useMatchesData';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { FeatureInfoModal } from '../../components/common/FeatureInfoModal';
import { WorldCupLockedModal } from '../../components/Matches/WorldCupLockedModal';
import { useWorldCupMatches } from '../../hooks/useWorldCupMatches';
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { getWorldCupTimeLeft } from '../../constants/worldCup';

type UserPredictionEntry = {
  type: 'home' | 'draw' | 'away';
  isCorrect?: boolean | null;
  coinsWon?: number;
};

function normalizePredictedMap(
  raw: Record<string, unknown> | null | undefined,
): Record<string, UserPredictionEntry> {
  if (!raw) return {};
  const out: Record<string, UserPredictionEntry> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (value === 'home' || value === 'draw' || value === 'away') {
      out[id] = { type: value, isCorrect: null };
    } else if (value && typeof value === 'object' && 'type' in value) {
      const entry = value as UserPredictionEntry;
      if (entry.type === 'home' || entry.type === 'draw' || entry.type === 'away') {
        out[id] = {
          type: entry.type,
          isCorrect: entry.isCorrect ?? null,
          coinsWon: entry.coinsWon,
        };
      }
    }
  }
  return out;
}

// Top 5 European leagues' countries — these accordions start expanded by default.
const TOP5_COUNTRIES: ReadonlySet<string> = new Set(['England', 'Spain', 'Italy', 'France', 'Germany']);

// Convert a Match (from useMatchesData) into the Fixture shape used by MatchRow.
// Single source of truth for this mapping — used both in the legacy `groups`
// memo and in the new country-grouped renderer.
function matchToFixture(m: Match): Fixture {
  return {
    id: m.id,
    home: m.homeTeam?.name || 'Home',
    away: m.awayTeam?.name || 'Away',
    homeLogo: m.homeTeam?.logo || '',
    awayLogo: m.awayTeam?.logo || '',
    homeScore: m.score?.home ?? 0,
    awayScore: m.score?.away ?? 0,
    status: mapStatus(m.status),
    minute: m.minute,
    live: m.status === 'live',
    time: m.time,
    leagueName: m.league?.name,
    leagueLogo: m.league?.logo,
    matchDate: m.fixtureDate,
  };
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Stable separator components — declared at module scope so they keep the
// same identity across renders. Inline arrow components on FlashList
// invalidate cell types on every render and tank performance.
const ITEM_SEPARATOR_8 = () => <View style={{ height: 8 }} />;
const ITEM_SEPARATOR_10 = () => <View style={{ height: 10 }} />;

const FILTERS = ['All', 'Live', 'Upcoming', 'WorldCup', 'Finished', 'Predictions'] as const;

/** Local midnight — calendar/filter sync uses device timezone. */
function startOfLocalDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Pick the tab that matches a calendar day (past → Finished, future → Upcoming, today → All). */
function filterForCalendarDay(day: Date): (typeof FILTERS)[number] {
  const t = startOfLocalDay(day).getTime();
  const today = startOfLocalDay().getTime();
  if (t < today) return 'Finished';
  if (t > today) return 'Upcoming';
  return 'All';
}

// Translation keys for the filter tab labels. Kept in lock-step with FILTERS
// above — if a filter is added here, add its label key in locales/*.ts.
const FILTER_LABEL_KEYS: Record<(typeof FILTERS)[number], string> = {
  All: 'matches.tabs.all',
  Live: 'matches.tabs.live',
  Upcoming: 'matches.tabs.upcoming',
  WorldCup: 'matches.tabs.worldCup',
  Finished: 'matches.tabs.finished',
  Predictions: 'matches.tabs.predictions',
};

// Country values the API returns for international competitions. Anything in
// this set gets pulled OUT of the country accordions on All/Live/Upcoming/
// Finished and shown only inside the dedicated "International" tab.
const INTL_COUNTRIES: ReadonlySet<string> = new Set([
  'World',
  'Europe',
  'Africa',
  'South-America',
  'South America',
  'North-America',
  'North America',
  'Asia',
  'Oceania',
]);

// Map API match status to display status
function mapStatus(status: string): 'LIVE' | 'FT' | 'UPCOMING' {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'FT';
  return 'UPCOMING';
}

type Fixture = {
  id: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number;
  awayScore: number;
  status: 'LIVE' | 'FT' | 'UPCOMING';
  minute?: string;
  live?: boolean;
  time?: string;
  leagueName?: string;
  leagueLogo?: string;
  matchDate?: string;
};

type LeagueGroup = {
  id: string;
  league: string;
  leagueLogo: string;
  fixtures: Fixture[];
};

// Prediction visual tokens — one source of truth.
const PRED_COLORS = {
  home: {
    base: 'rgba(59,130,246,0.9)',
    soft: 'rgba(59,130,246,0.6)',
    gradient: ['rgba(59,130,246,0.55)', 'rgba(37,99,235,0.25)'] as const,
    glow: '#3b82f6',
  },
  draw: {
    base: 'rgba(156,163,175,0.9)',
    soft: 'rgba(156,163,175,0.6)',
    gradient: ['rgba(156,163,175,0.55)', 'rgba(107,114,128,0.25)'] as const,
    glow: '#9ca3af',
  },
  away: {
    base: 'rgba(239,68,68,0.9)',
    soft: 'rgba(239,68,68,0.6)',
    gradient: ['rgba(239,68,68,0.55)', 'rgba(220,38,38,0.25)'] as const,
    glow: '#ef4444',
  },
} as const;

type PredictionKind = 'home' | 'draw' | 'away';

const PredictionButton = memo(function PredictionButton({
  label,
  isActive,
  onPress,
  kind,
  disabled,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  kind: PredictionKind;
  disabled?: boolean;
}) {
  const palette = PRED_COLORS[kind];
  return (
    <TouchableOpacity
      style={[
        styles.predBtn,
        isActive && {
          borderColor: palette.soft,
          transform: [{ scale: 1.03 }],
          shadowColor: palette.glow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 12,
          elevation: 10,
        },
        disabled && !isActive && { opacity: 0.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: 10, overflow: 'hidden' }]}>
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            {...({
              style: StyleSheet.absoluteFill,
              tint: 'rgba(20,15,30,0.65)',
              effect: 'clear',
            } as any)}
          />
        ) : (
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {isActive && (
          <LinearGradient
            colors={palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      <Text
        style={[
          styles.predBtnTxt,
          isActive && {
            color: '#fff',
            textShadowColor: palette.glow,
            textShadowRadius: 10,
            textShadowOffset: { width: 0, height: 0 },
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const MatchRow = memo(function MatchRow({
  fixture,
  showPreds,
  onPredict,
  submittingId,
  predictedMatches,
  isSubscribed,
  isSubscribing,
  onToggleSubscription,
  onOpenDetails,
}: {
  fixture: Fixture;
  showPreds: boolean;
  onPredict: (fixtureId: string, type: 'home' | 'draw' | 'away') => void;
  submittingId: string | null;
  predictedMatches: Record<string, UserPredictionEntry>;
  isSubscribed: boolean;
  isSubscribing: boolean;
  onToggleSubscription: (fixture: Fixture, subscribe: boolean) => void;
  onOpenDetails: (fixture: Fixture) => void;
}) {
  const predictionEntry = predictedMatches[fixture.id];
  const existingPrediction = predictionEntry?.type ?? null;
  const isSubmitting = submittingId === fixture.id;
  const { translate: t, language } = useTranslation();
  const homeName = getTeamDisplayName(fixture.home, language);
  const awayName = getTeamDisplayName(fixture.away, language);

  // Bell works for upcoming (kickoff reminder) and live (goal/event alerts via FavoriteMatch).
  // Disabled only for finished matches.
  const canSubscribe = fixture.status !== 'FT';

  return (
    <View style={styles.rowWrapCol}>
      <View style={styles.rowWrap}>
        {/* Tapping anywhere on the team/score area opens match-details.
            The bell button is intentionally OUTSIDE this Touchable so it
            doesn't navigate when the user only wanted to subscribe. */}
        <TouchableOpacity
          style={styles.rowBody}
          activeOpacity={0.75}
          onPress={() => onOpenDetails(fixture)}
        >
          <View style={styles.teamCol}>
            <View style={styles.logoStub}>
              {fixture.homeLogo ? (
                <Image
                  source={{ uri: fixture.homeLogo }}
                  style={styles.teamLogo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.logoInitials}>
                  <Text style={styles.logoInitialsTxt}>{(homeName || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamTxt} numberOfLines={1}>{homeName}</Text>
          </View>
          <View style={styles.scoreCol}>
            {fixture.status === 'UPCOMING' ? (
              <View style={styles.upcomingBadgeWrap}><Text style={styles.upcomingBadge}>{t('matches.status.upcoming')}</Text></View>
            ) : fixture.live ? <Text style={styles.liveBadge}>{t('matches.status.live')}</Text> : <Text style={styles.ftBadge}>{t('matches.status.finished')}</Text>}

            {fixture.status === 'UPCOMING' ? (
              <Text
                style={styles.timeTxt}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {fixture.time}
              </Text>
            ) : (
              <Text style={styles.scoreTxt} numberOfLines={1} adjustsFontSizeToFit>
                {fixture.homeScore}<Text style={styles.scoreDash}>-</Text>{fixture.awayScore}
              </Text>
            )}
            <Text style={styles.minuteTxt}>{fixture.minute ?? ''}</Text>
          </View>
          <View style={styles.teamCol}>
            <View style={styles.logoStub}>
              {fixture.awayLogo ? (
                <Image
                  source={{ uri: fixture.awayLogo }}
                  style={styles.teamLogo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.logoInitials}>
                  <Text style={styles.logoInitialsTxt}>{(awayName || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamTxt} numberOfLines={1}>{awayName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowIcon}
          activeOpacity={0.7}
          onPress={() => canSubscribe && onToggleSubscription(fixture, !isSubscribed)}
          disabled={!canSubscribe || isSubscribing}
          hitSlop={8}
        >
          {isSubscribing ? (
            <ActivityIndicator size="small" color="#fbbf24" />
          ) : (
            <Bell
              size={17}
              color={isSubscribed ? '#fbbf24' : canSubscribe ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)'}
              fill={isSubscribed ? '#fbbf24' : 'transparent'}
            />
          )}
        </TouchableOpacity>
      </View>

      {showPreds && fixture.status === 'UPCOMING' && (
        <View style={styles.predWrap}>
          <View style={styles.predTitleRow}>
            <Text style={styles.predTitle}>
              {existingPrediction ? t('matches.prediction.yourPrediction') : t('matches.prediction.title')}
            </Text>
            {isSubmitting && (
              <ActivityIndicator size="small" color={PURPLE_PRIMARY} style={styles.predTitleSpinner} />
            )}
          </View>
          <View style={styles.predButtons}>
            <PredictionButton
              label={homeName}
              kind="home"
              isActive={existingPrediction === 'home'}
              onPress={() => onPredict(fixture.id, 'home')}
              disabled={!!existingPrediction || isSubmitting}
            />
            <PredictionButton
              label={t('matches.prediction.drawLabel')}
              kind="draw"
              isActive={existingPrediction === 'draw'}
              onPress={() => onPredict(fixture.id, 'draw')}
              disabled={!!existingPrediction || isSubmitting}
            />
            <PredictionButton
              label={awayName}
              kind="away"
              isActive={existingPrediction === 'away'}
              onPress={() => onPredict(fixture.id, 'away')}
              disabled={!!existingPrediction || isSubmitting}
            />
          </View>
        </View>
      )}

      {showPreds && fixture.status === 'FT' && predictionEntry && (
        <View style={styles.predWrap}>
          <Text style={styles.predTitle}>
            {t('matches.prediction.yourPrediction')}:{' '}
            {existingPrediction === 'home'
              ? homeName
              : existingPrediction === 'away'
                ? awayName
                : t('matches.prediction.drawLabel')}
          </Text>
          {predictionEntry.isCorrect === true ? (
            <Text style={styles.predResultWin}>
              ✓ {t('predictions.correctPrediction')} (+10 XP)
            </Text>
          ) : predictionEntry.isCorrect === false ? (
            <Text style={styles.predResultLoss}>
              ✗ {t('predictions.wrongPrediction')}
            </Text>
          ) : (
            <Text style={styles.predResultPending}>
              {t('profile.pendingPredictions')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

// ─── League All Matches Modal ─────────────────────────────────────────────────
function LeagueAllMatchesModal({
  group,
  visible,
  onClose,
  filter,
  onPredict,
  submittingId,
  predictedMatches,
  subscribedFixtures,
  subscribingFixtureId,
  onToggleSubscription,
  onOpenDetails,
}: {
  group: LeagueGroup | null;
  visible: boolean;
  onClose: () => void;
  filter: string;
  onPredict: (fixtureId: string, type: 'home' | 'draw' | 'away') => void;
  submittingId: string | null;
  predictedMatches: Record<string, UserPredictionEntry>;
  subscribedFixtures: ReadonlySet<string>;
  subscribingFixtureId: string | null;
  onToggleSubscription: (fixture: Fixture, subscribe: boolean) => void;
  onOpenDetails: (fixture: Fixture) => void;
}) {
  const { language } = useTranslation();
  if (!group) return null;
  const localizedLeagueName = getLeagueDisplayName(group.league, language);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Full-screen iOS-style blur backdrop */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : 'dark'}
        style={StyleSheet.absoluteFill}
      />
      {/* Tap outside to close */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

      {/* Bottom sheet */}
      <View style={styles.allMatchesSheetWrap}>
        <View style={styles.allMatchesSheet}>
          {/* Sheet glass surface */}
          {isLiquidGlassSupported ? (
            <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(8,4,18,0.92)', effect: 'regular' } as any)} />
          ) : (
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          {/* Subtle purple top glow */}
          <LinearGradient
            colors={['rgba(168,85,247,0.18)', 'transparent']}
            style={[StyleSheet.absoluteFill, { height: 120 }]}
            pointerEvents="none"
          />
          {/* Drag handle */}
          <View style={styles.sheetHandle} />
          {/* Sheet header */}
          <View style={styles.allMatchesHeader}>
            <View style={styles.leagueLeft}>
              {group.leagueLogo ? (
                <Image source={{ uri: group.leagueLogo }} style={styles.allMatchesLeagueLogo} contentFit="contain" cachePolicy="memory-disk" transition={0} />
              ) : null}
              <Text style={styles.allMatchesTitle}>{localizedLeagueName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.allMatchesClose} activeOpacity={0.7}>
              <X size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          {/* All fixtures */}
          <View style={styles.allMatchesListWrap}>
            <FlashList
              data={group.fixtures}
              keyExtractor={f => f.id}
              renderItem={({ item }) => (
                <MatchRow
                  fixture={item}
                  showPreds={filter === 'Predictions'}
                  onPredict={onPredict}
                  submittingId={submittingId}
                  predictedMatches={predictedMatches}
                  isSubscribed={subscribedFixtures.has(item.id)}
                  isSubscribing={subscribingFixtureId === item.id}
                  onToggleSubscription={onToggleSubscription}
                  onOpenDetails={onOpenDetails}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── League Card ──────────────────────────────────────────────────────────────
const PREVIEW_COUNT = 2; // max fixtures shown before "View All"

const LeagueCard = memo(function LeagueCard({
  group,
  filter,
  onPredict,
  submittingId,
  predictedMatches,
  subscribedFixtures,
  subscribingFixtureId,
  onToggleSubscription,
  onOpenDetails,
}: {
  group: LeagueGroup;
  filter: string;
  onPredict: (fixtureId: string, type: 'home' | 'draw' | 'away') => void;
  submittingId: string | null;
  predictedMatches: Record<string, UserPredictionEntry>;
  subscribedFixtures: ReadonlySet<string>;
  subscribingFixtureId: string | null;
  onToggleSubscription: (fixture: Fixture, subscribe: boolean) => void;
  onOpenDetails: (fixture: Fixture) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { translate: t, language } = useTranslation();
  const localizedLeagueName = getLeagueDisplayName(group.league, language);
  const hasMore = group.fixtures.length > PREVIEW_COUNT;
  const previewFixtures = hasMore ? group.fixtures.slice(0, PREVIEW_COUNT) : group.fixtures;

  return (
    <View>
      <View style={styles.leagueCard}>
        {/* Header — tap to toggle accordion */}
        <TouchableOpacity
          style={styles.leagueHead}
          activeOpacity={0.7}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <View style={styles.leagueLeft}>
            <View style={styles.leagueLogoWrap}>
              {group.leagueLogo ? (
                <Image
                  source={{ uri: group.leagueLogo }}
                  style={styles.leagueLogo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : null}
            </View>
            <Text style={styles.leagueTitle}>{localizedLeagueName}</Text>
          </View>
          <View style={styles.leagueRight}>
            <View style={styles.matchCountBadge}>
              <Text style={styles.matchCountTxt}>{group.fixtures.length}</Text>
            </View>
            <ChevronDown
              size={16}
              color="rgba(255,255,255,0.45)"
              style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded content */}
        {isExpanded && (
          <View>
            {previewFixtures.map((fixture, i) => (
              <MatchRow
                key={fixture.id ?? `f-${i}`}
                fixture={fixture}
                showPreds={filter === 'Predictions'}
                onPredict={onPredict}
                submittingId={submittingId}
                predictedMatches={predictedMatches}
                isSubscribed={subscribedFixtures.has(fixture.id)}
                isSubscribing={subscribingFixtureId === fixture.id}
                onToggleSubscription={onToggleSubscription}
                onOpenDetails={onOpenDetails}
              />
            ))}
            {hasMore && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.viewAllBtn}
                onPress={() => setShowAll(true)}
              >
                <Text style={styles.viewAllTxt}>
                  {t('matches.screen.viewAll').replace('{{count}}', String(group.fixtures.length))}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Full list modal — iOS-style blur bottom sheet */}
      <LeagueAllMatchesModal
        group={showAll ? group : null}
        visible={showAll}
        onClose={() => setShowAll(false)}
        filter={filter}
        onPredict={onPredict}
        submittingId={submittingId}
        predictedMatches={predictedMatches}
        subscribedFixtures={subscribedFixtures}
        subscribingFixtureId={subscribingFixtureId}
        onToggleSubscription={onToggleSubscription}
        onOpenDetails={onOpenDetails}
      />
    </View>
  );
});

export default function MatchesHubScreenV2() {
  useScreenFont();
  useMatchEventsMonitor();
  const params = useLocalSearchParams();
  const initialFilter = (params.filter as typeof FILTERS[number]) || 'All';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => startOfLocalDay());
  const [showTicketsInfo, setShowTicketsInfo] = useState(false);
  const [showMatchesInfo, setShowMatchesInfo] = useState(false);
  const [showWorldCupLocked, setShowWorldCupLocked] = useState(false);
  const worldCupEnabled = useAppFeaturesStore((s) => s.worldCupEnabled);
  const worldCupLocked = useAppFeaturesStore((s) => s.worldCupLocked);
  const worldCupLeagueId = useAppFeaturesStore((s) => s.leagueId);
  const unlockAtMs = useAppFeaturesStore((s) => s.unlockAtMs);
  const featuresRevision = useAppFeaturesStore((s) => s.revision);
  const hydrateFeatures = useAppFeaturesStore((s) => s.hydrate);
  // selectedDate is the ground truth; the calendar grid derives everything
  // else from it (month length, highlighted cell, etc.).
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const { t: tObj, translate: t } = useTranslation();

  // Clerk's getToken returns a NEW function reference on every render — store
  // it in a ref so effects don't re-fire on every parent re-render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    void hydrateFeatures(true);
    const id = setInterval(() => {
      const left = getWorldCupTimeLeft(Date.now(), unlockAtMs);
      const nearUnlock = left.days === 0 && left.hours === 0 && left.mins < 5;
      if (nearUnlock || (left.days === 0 && left.hours === 0 && left.mins === 0 && left.secs === 0)) {
        void hydrateFeatures(true);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [hydrateFeatures, unlockAtMs]);

  // Tickets (remaining predictions)
  const [ticketsRemaining, setTicketsRemaining] = useState<number>(10);
  // Map of matchId -> prediction type already submitted
  const [predictedMatches, setPredictedMatches] = useState<Record<string, UserPredictionEntry>>({});
  // Which match is currently being submitted
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Bell (match-start push) subscription state
  const [subscribedFixtures, setSubscribedFixtures] = useState<Set<string>>(() => new Set());
  const [subscribingFixtureId, setSubscribingFixtureId] = useState<string | null>(null);

  // Real matches data from backend
  const { groupedMatches, countryGroups, matches, loading, error, isDataStale, refetch } = useMatchesData(selectedDate);

  const wcTabActive = filter === 'WorldCup' && worldCupEnabled;
  const {
    matches: worldCupMatches,
    loading: worldCupLoading,
    error: worldCupError,
    refetch: refetchWorldCup,
  } = useWorldCupMatches(selectedDate, wcTabActive, worldCupLeagueId);

  // Modal state for "View All" league sheet (shared by both LeagueCard and CountryAccordion).
  const [viewAllLeagueId, setViewAllLeagueId] = useState<string | null>(null);

  // ─── Instant hydration from local cache ────────────────────────────────────
  // Cache keys are SCOPED TO userId so a logout→login on the same device
  // never leaks another user's predictions. When userId is absent we skip
  // the cache entirely instead of falling back to a shared key.
  const PRED_CACHE_KEY = useMemo(
    () => (userId ? predictionsMapKey(userId) : null),
    [userId],
  );
  const TICKETS_CACHE_KEY = useMemo(
    () => (userId ? predictionsTicketsKey(userId) : null),
    [userId],
  );

  // Clear in-memory state when the signed-in user changes. Prevents visual
  // leakage between the previous user's predictions and the new user's
  // (empty until the server sync completes).
  useEffect(() => {
    setPredictedMatches({});
    setTicketsRemaining(10);
  }, [userId]);

  useEffect(() => {
    if (!PRED_CACHE_KEY || !TICKETS_CACHE_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const [cachedMap, cachedTickets] = await Promise.all([
          cacheService.get<Record<string, unknown>>(PRED_CACHE_KEY),
          cacheService.get<number>(TICKETS_CACHE_KEY),
        ]);
        if (cancelled) return;
        if (cachedMap) setPredictedMatches(normalizePredictedMap(cachedMap as Record<string, unknown>));
        if (typeof cachedTickets === 'number') setTicketsRemaining(cachedTickets);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [PRED_CACHE_KEY, TICKETS_CACHE_KEY]);

  // Load tickets count and existing predictions on mount (server sync)
  useEffect(() => {
    if (!PRED_CACHE_KEY || !TICKETS_CACHE_KEY) return;
    const loadPredictionsData = async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const [remaining, userPreds] = await Promise.all([
          PredictionsService.getRemainingPredictions(token),
          PredictionsService.getUserPredictions(token),
        ]);
        setTicketsRemaining(remaining.remaining);
        // Build map of matchId -> predictionType from existing predictions
        const map: Record<string, UserPredictionEntry> = {};
        Object.entries(userPreds.predictionsMap).forEach(([matchId, pred]) => {
          map[matchId] = {
            type: pred.prediction.type,
            isCorrect: pred.isCorrect ?? null,
            coinsWon: pred.coinsWon,
          };
        });
        setPredictedMatches(map);
        // Persist reconciled state — 24h TTL covers a full ticket cycle.
        cacheService.set(PRED_CACHE_KEY, map, 24 * 60 * 60 * 1000).catch(() => {});
        cacheService.set(TICKETS_CACHE_KEY, remaining.remaining, 24 * 60 * 60 * 1000).catch(() => {});
      } catch {
        // silently fail — cached values stay visible
      }
    };
    loadPredictionsData();
  }, [PRED_CACHE_KEY, TICKETS_CACHE_KEY]);

  // Reset bell state when the signed-in user changes.
  useEffect(() => {
    setSubscribedFixtures(new Set());
  }, [userId]);

  // Hydrate bell state from the backend on mount / userId change.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const ids = await MatchSubscriptionsService.listIds(token);
        if (cancelled) return;
        setSubscribedFixtures(new Set(Array.from(ids).map((n) => String(n))));
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (params.filter && FILTERS.includes(params.filter as any)) {
      const f = params.filter as typeof FILTERS[number];
      if (f === 'WorldCup' && worldCupLocked && !worldCupEnabled) {
        setShowWorldCupLocked(true);
        return;
      }
      if (f === 'Live') {
        setSelectedDate(startOfLocalDay());
      }
      setFilter(f);
    }
  }, [params.filter, worldCupEnabled, worldCupLocked]);

  // Live tab always shows today's fixtures — snap calendar back when selected.
  const handleFilterPress = useCallback((f: (typeof FILTERS)[number]) => {
    if (f === 'WorldCup' && worldCupLocked && !worldCupEnabled) {
      setShowWorldCupLocked(true);
      return;
    }
    if (f === 'Live') {
      setSelectedDate(startOfLocalDay());
    }
    setFilter(f);
  }, [worldCupEnabled, worldCupLocked]);

  const handleCalendarDayPress = useCallback((day: number) => {
    const next = new Date(calendarViewDate);
    next.setDate(day);
    next.setHours(0, 0, 0, 0);
    setSelectedDate(next);
    setShowCalendar(false);
    setFilter(filterForCalendarDay(next));
  }, [calendarViewDate]);

  const openCalendar = useCallback(() => {
    setCalendarViewDate(new Date(selectedDate));
    setShowCalendar(true);
  }, [selectedDate]);

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarViewDate((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }, []);

  const goToTodayInCalendar = useCallback(() => {
    const today = startOfLocalDay();
    setCalendarViewDate(today);
    setSelectedDate(today);
    setShowCalendar(false);
    setFilter(filterForCalendarDay(today));
  }, []);

  // Convert groupedMatches from hook to LeagueGroup format for the UI
  const groups = useMemo((): LeagueGroup[] => {
    const allGroups: LeagueGroup[] = groupedMatches.map(g => ({
      id: String(g.leagueId),
      league: g.leagueName,
      leagueLogo: g.leagueLogo || '',
      fixtures: g.matches.map(matchToFixture),
    }));

    // Apply filter
    if (filter === 'Live') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.live) })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'Upcoming') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.status === 'UPCOMING') })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'Predictions') {
      return allGroups.map(g => ({
        ...g,
        fixtures: g.fixtures.filter(f =>
          f.status === 'UPCOMING' || (f.status === 'FT' && predictedMatches[f.id]),
        ),
      })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'Finished') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.status === 'FT') })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'All') {
      return allGroups
        .map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.status !== 'FT') }))
        .filter(g => g.fixtures.length > 0);
    }
    return allGroups;
  }, [groupedMatches, filter, predictedMatches]);

  // Filter helper applied to a Match list. Mirrors the per-fixture predicates
  // used in the legacy `groups` memo so both views stay perfectly in sync.
  const matchPassesFilter = useCallback(
    (m: Match): boolean => {
      if (filter === 'Live') return m.status === 'live';
      if (filter === 'Upcoming') {
        return m.status !== 'live' && m.status !== 'finished';
      }
      if (filter === 'Predictions') {
        if (m.status === 'live') return false;
        if (m.status === 'finished') return Boolean(predictedMatches[m.id]);
        return m.status !== 'finished';
      }
      if (filter === 'Finished') return m.status === 'finished';
      if (filter === 'All') return m.status !== 'finished';
      return true;
    },
    [filter, predictedMatches],
  );

  // Country → League hierarchy after filtering. Drops empty leagues and
  // empty countries so the accordion list only renders sections with data.
  // International competitions (World/Europe/Africa/...) are pulled out and
  // shown in their own tab — keeps the country list clean and country-only.
  const filteredCountryGroups = useMemo<CountryGroup[]>(() => {
    return countryGroups
      .filter(cg => !INTL_COUNTRIES.has(cg.country))
      .map(cg => {
        const leagues = cg.leagues
          .map(l => ({ ...l, matches: l.matches.filter(matchPassesFilter) }))
          .filter(l => l.matches.length > 0);
        return { ...cg, leagues };
      })
      .filter(cg => cg.leagues.length > 0);
  }, [countryGroups, matchPassesFilter]);

  // International competitions stay in country accordions on other tabs.
  // World Cup has its own dedicated tab fed by the backend WC endpoint.

  const worldCupLeagueGroups = useMemo<LeagueGroup[]>(() => {
    if (worldCupMatches.length === 0) return [];
    const sample = worldCupMatches[0];
    return [{
      id: String(sample.league?.id ?? worldCupLeagueId),
      league: sample.league?.name ?? 'World Cup',
      leagueLogo: sample.league?.logo ?? '',
      fixtures: worldCupMatches.map(matchToFixture),
    }];
  }, [worldCupMatches, worldCupLeagueId]);

  const wcTabLocked = worldCupLocked && !worldCupEnabled;

  // Handle prediction submission
  //
  // Flow:
  //  1. Check ticket count (local state) — show warning toast if 0
  //  2. Check if already predicted — silent no-op
  //  3. Optimistic UI update: mark predicted + decrement ticket count
  //  4. Fire instant top toast so user sees confirmation immediately
  //  5. Persist to AsyncStorage (user-scoped) so the state survives restarts
  //  6. Offline? enqueue for later and return. Online? call the backend.
  //  7. On failure, match by error CODE (not string) and roll back.
  const handlePredict = useCallback(async (fixtureId: string, type: 'home' | 'draw' | 'away') => {
    if (ticketsRemaining <= 0) {
      toastManager.showWarning(
        t('matches.prediction.noTicketsTitle'),
        t('matches.prediction.noTicketsMessage'),
        { position: 'top' },
      );
      return;
    }
    if (predictedMatches[fixtureId]) return; // already predicted — no-op

    // Find fixture details BEFORE optimistic update (used for both API + toast)
    let fixtureDetails: Fixture | undefined;
    const fromList = matches.find(m => m.id === fixtureId);
    if (fromList) {
      fixtureDetails = matchToFixture(fromList);
    } else {
      for (const g of groups) {
        const found = g.fixtures.find(f => f.id === fixtureId);
        if (found) { fixtureDetails = found; break; }
      }
    }

    // Build next state (for persistence) and apply optimistic updates.
    const nextMap: Record<string, UserPredictionEntry> = {
      ...predictedMatches,
      [fixtureId]: { type, isCorrect: null },
    };
    const nextTickets = Math.max(0, ticketsRemaining - 1);

    setPredictedMatches(nextMap);
    setTicketsRemaining(nextTickets);
    setSubmittingId(fixtureId);

    // Instant top toast — user sees confirmation in the same frame they tap.
    const predictedSide =
      type === 'home' ? fixtureDetails?.home || t('matches.prediction.homeLabelFallback')
      : type === 'away' ? fixtureDetails?.away || t('matches.prediction.awayLabelFallback')
      : t('matches.prediction.drawLabel');
    toastManager.showSuccess(
      t('matches.prediction.savedTitle'),
      t('matches.prediction.savedMessage')
        .replace('{{side}}', predictedSide)
        .replace('{{count}}', String(nextTickets)),
      { position: 'top', duration: 2200 },
    );

    // Persist immediately so a cold restart keeps the same visual state.
    // Only when we have a userId — never write under a shared key.
    if (PRED_CACHE_KEY && TICKETS_CACHE_KEY) {
      cacheService.set(PRED_CACHE_KEY, nextMap, 24 * 60 * 60 * 1000).catch(() => {});
      cacheService.set(TICKETS_CACHE_KEY, nextTickets, 24 * 60 * 60 * 1000).catch(() => {});
    }

    // If we're offline, enqueue the mutation and skip the network roundtrip.
    // useOfflineSync will replay it when connectivity returns.
    const netState = await NetInfo.fetch().catch(() => null);
    const isOnline = netState?.isConnected === true && netState?.isInternetReachable !== false;
    if (!isOnline) {
      if (userId) {
        await offlineQueue.enqueue({
          type: 'PREDICTION',
          payload: {
            userId,
            apiMatchId: fixtureId,
            predictionType: type,
            homeTeam: fixtureDetails?.home || '',
            awayTeam: fixtureDetails?.away || '',
            homeTeamLogo: fixtureDetails?.homeLogo,
            awayTeamLogo: fixtureDetails?.awayLogo,
            matchDate: fixtureDetails?.matchDate || new Date().toISOString(),
            leagueName: fixtureDetails?.leagueName,
          },
        }).catch(() => {});
      }
      toastManager.showInfo(
        t('offlineQueue.queuedTitle'),
        t('offlineQueue.queuedMessage'),
        { position: 'top', duration: 2500 },
      );
      setSubmittingId(null);
      return;
    }

    try {
      const token = await getToken();
      if (!token) throw new PredictionApiError('E002', 'Not authenticated', 401);

      await PredictionsService.submitPrediction(token, {
        apiMatchId: fixtureId,
        predictionType: type,
        homeTeam: fixtureDetails?.home || '',
        awayTeam: fixtureDetails?.away || '',
        homeTeamLogo: fixtureDetails?.homeLogo,
        awayTeamLogo: fixtureDetails?.awayLogo,
        matchDate: fixtureDetails?.matchDate || new Date().toISOString(),
        leagueName: fixtureDetails?.leagueName,
      });
      // Server accepted — nothing more to do, UI already reflects success.
    } catch (err) {
      // Prefer structured codes from PredictionApiError; fall back to a
      // synthetic 'E010' for unexpected error shapes (network/timeout).
      const apiErr = err instanceof PredictionApiError ? err : null;
      const code = apiErr?.code ?? 'E010';

      // E005 = server already has a matching prediction. UI is already in the
      // correct state from the optimistic update — leave it as-is.
      if (code === 'E005') return;

      // Network-level failure *after* passing the NetInfo check — treat like
      // offline and queue it. Happens on flaky connections.
      if (code === 'E010' && userId) {
        await offlineQueue.enqueue({
          type: 'PREDICTION',
          payload: {
            userId,
            apiMatchId: fixtureId,
            predictionType: type,
            homeTeam: fixtureDetails?.home || '',
            awayTeam: fixtureDetails?.away || '',
            homeTeamLogo: fixtureDetails?.homeLogo,
            awayTeamLogo: fixtureDetails?.awayLogo,
            matchDate: fixtureDetails?.matchDate || new Date().toISOString(),
            leagueName: fixtureDetails?.leagueName,
          },
        }).catch(() => {});
        toastManager.showInfo(
          t('offlineQueue.queuedTitle'),
          t('offlineQueue.queuedMessage'),
          { position: 'top', duration: 2500 },
        );
        return;
      }

      // Anything else — roll back the optimistic update and revert cache.
      const rolledBack: Record<string, UserPredictionEntry> = { ...predictedMatches };
      setPredictedMatches(rolledBack);
      setTicketsRemaining(ticketsRemaining);
      if (PRED_CACHE_KEY && TICKETS_CACHE_KEY) {
        cacheService.set(PRED_CACHE_KEY, rolledBack, 24 * 60 * 60 * 1000).catch(() => {});
        cacheService.set(TICKETS_CACHE_KEY, ticketsRemaining, 24 * 60 * 60 * 1000).catch(() => {});
      }

      // E006 = rate limit (daily prediction limit reached)
      if (code === 'E006') {
        toastManager.showWarning(
          t('matches.prediction.dailyLimitTitle'),
          t('matches.prediction.dailyLimitMessage'),
          { position: 'top' },
        );
      } else {
        toastManager.showError(
          t('matches.prediction.submitFailedTitle'),
          apiErr?.message || t('matches.prediction.submitFailedMessage'),
          { position: 'top' },
        );
      }
    } finally {
      setSubmittingId(null);
    }
  }, [ticketsRemaining, predictedMatches, groups, getToken, userId, PRED_CACHE_KEY, TICKETS_CACHE_KEY, t]);

  // Toggle match-start push notification for a fixture (the bell icon).
  // Optimistic: flip the bell immediately, roll back on API failure.
  const handleToggleSubscription = useCallback(
    async (fixture: Fixture, subscribe: boolean) => {
      if (!userId) {
        toastManager.showWarning(
          t('matches.bell.signInRequired'),
          t('matches.bell.signInRequiredMessage'),
          { position: 'top' },
        );
        return;
      }
      if (fixture.status === 'FT') return;

      setSubscribingFixtureId(fixture.id);

      // Optimistic toggle
      setSubscribedFixtures((prev) => {
        const next = new Set(prev);
        if (subscribe) next.add(fixture.id);
        else next.delete(fixture.id);
        return next;
      });

      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        if (subscribe) {
          await MatchSubscriptionsService.subscribe(token, {
            fixtureId: fixture.id,
            matchTime: fixture.matchDate || new Date().toISOString(),
            homeTeam: fixture.home,
            awayTeam: fixture.away,
            homeTeamLogo: fixture.homeLogo,
            awayTeamLogo: fixture.awayLogo,
            leagueName: fixture.leagueName,
          });
          await MatchFavoritesStorage.addFavorite(String(fixture.id));
          toastManager.showSuccess(
            t('matches.bell.subscribedTitle'),
            t('matches.bell.subscribedMessage'),
            { position: 'top', duration: 2000 },
          );
        } else {
          await MatchSubscriptionsService.unsubscribe(token, fixture.id);
          await MatchFavoritesStorage.removeFavorite(String(fixture.id));
          toastManager.showInfo(
            t('matches.bell.unsubscribedTitle'),
            t('matches.bell.unsubscribedMessage'),
            { position: 'top', duration: 1800 },
          );
        }
      } catch (err) {
        // Roll back the optimistic toggle on failure.
        setSubscribedFixtures((prev) => {
          const next = new Set(prev);
          if (subscribe) next.delete(fixture.id);
          else next.add(fixture.id);
          return next;
        });
        toastManager.showError(
          t('matches.bell.errorTitle'),
          t('matches.bell.errorMessage'),
          { position: 'top' },
        );
      } finally {
        setSubscribingFixtureId(null);
      }
    },
    [userId, getToken, t],
  );

  // Open the full match-details screen for a fixture. Mirrors the params
  // shape used everywhere else in the app (Home.tsx, team-profile.tsx) so
  // match-details.tsx finds exactly what it expects:
  //   - fixtureId is the only field actually used to fetch real data
  //     (events, lineups, statistics, fixture details, standings, venue)
  //   - the rest are display-only fallbacks for the header before the API
  //     responses come back.
  const handleOpenMatchDetails = useCallback(
    (fixture: Fixture) => {
      router.push({
        pathname: '/(tabs)/match-details',
        params: {
          fixtureId: fixture.id,
          homeTeam: fixture.home,
          awayTeam: fixture.away,
          homeLogo: fixture.homeLogo || '',
          awayLogo: fixture.awayLogo || '',
          homeScore: fixture.status === 'UPCOMING' ? '' : String(fixture.homeScore),
          awayScore: fixture.status === 'UPCOMING' ? '' : String(fixture.awayScore),
          league: fixture.leagueName || '',
          leagueLogo: fixture.leagueLogo || '',
          date: fixture.matchDate
            ? new Date(fixture.matchDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          time: fixture.time || '',
          status:
            fixture.status === 'LIVE' ? 'live'
            : fixture.status === 'FT' ? 'finished'
            : 'upcoming',
        },
      });
    },
    [router],
  );

  // Stable per-match renderer used by CountryAccordion. Matches the
  // existing MatchRow look exactly — same predictions + bell behavior
  // wired through. Memoized so identity stays stable across re-renders
  // unless one of its dependencies actually changes.
  const renderCountryMatchCard = useCallback(
    (match: Match): React.ReactNode => {
      const fixture = matchToFixture(match);
      return (
        <MatchRow
          fixture={fixture}
          showPreds={filter === 'Predictions'}
          onPredict={handlePredict}
          submittingId={submittingId}
          predictedMatches={predictedMatches}
          isSubscribed={subscribedFixtures.has(fixture.id)}
          isSubscribing={subscribingFixtureId === fixture.id}
          onToggleSubscription={handleToggleSubscription}
          onOpenDetails={handleOpenMatchDetails}
        />
      );
    },
    [
      filter,
      handlePredict,
      submittingId,
      predictedMatches,
      subscribedFixtures,
      subscribingFixtureId,
      handleToggleSubscription,
      handleOpenMatchDetails,
    ],
  );

  // Open the full-list bottom sheet for a league when the user taps
  // "View All" inside a CountryAccordion. Reuses the same modal that
  // LeagueCard already drives, so behavior stays identical.
  const handleViewAllLeague = useCallback((leagueId: number) => {
    setViewAllLeagueId(String(leagueId));
  }, []);

  // The currently-open "View All" league (resolved from `groups` so the
  // modal renders in the LeagueGroup shape it already expects).
  const viewAllLeagueGroup = useMemo<LeagueGroup | null>(() => {
    if (!viewAllLeagueId) return null;
    return groups.find(g => g.id === viewAllLeagueId) ?? null;
  }, [viewAllLeagueId, groups]);

  // ─── Calendar grid (driven by selectedDate — always in sync) ──────────────
  // `calendarGrid` is the array of cells to render. Each cell is either a
  // day number (1..daysInMonth) or `null` for a leading blank so the first
  // day lands under the correct weekday column.
  const calendarGrid = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Native JS Date.getDay: 0=Sunday..6=Saturday.
    // Arabic calendars traditionally start the week on Saturday; everyone
    // else we render Sunday-first. Convert native 0..6 into offset within
    // the rendered week.
    const firstDayNative = new Date(year, month, 1).getDay();
    const weekStartsOn = tObj.matches?.screen?.weekStartsOn === 'saturday' ? 6 : 0;
    const offset = (firstDayNative - weekStartsOn + 7) % 7;

    const cells: Array<number | null> = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calendarViewDate, tObj.matches?.screen?.weekStartsOn]);

  // Week-day labels in the correct order for the current locale.
  const weekDayLabels = useMemo(() => {
    const base: readonly string[] = tObj.matches?.screen?.weekDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // The keys in locales are stored Mon-first (Mon..Sun). Reorder so the
    // first element matches the locale's week start (Sunday-first or
    // Saturday-first for Arabic).
    const weekStartsOn = tObj.matches?.screen?.weekStartsOn === 'saturday' ? 'Sat'
      : tObj.matches?.screen?.weekStartsOn === 'monday' ? 'Mon'
      : 'Sun';
    // Build a Sunday-first canonical order mapped to the Mon-first base.
    // base order = [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    // indexes:      0    1    2    3    4    5    6
    const byKey: Record<string, string> = {
      Mon: base[0], Tue: base[1], Wed: base[2], Thu: base[3], Fri: base[4], Sat: base[5], Sun: base[6],
    };
    const order = weekStartsOn === 'Sat' ? ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      : weekStartsOn === 'Mon' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return order.map((k) => byKey[k]);
  }, [tObj.matches?.screen?.weekDays, tObj.matches?.screen?.weekStartsOn]);

  const calendarMonthLabel = useMemo(() => {
    try {
      return calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return `${calendarViewDate.getMonth() + 1}/${calendarViewDate.getFullYear()}`;
    }
  }, [calendarViewDate]);

  const isCalendarDaySelected = useCallback(
    (day: number) =>
      selectedDate.getDate() === day
      && selectedDate.getMonth() === calendarViewDate.getMonth()
      && selectedDate.getFullYear() === calendarViewDate.getFullYear(),
    [selectedDate, calendarViewDate],
  );

  const headerRight = useMemo(() => {
    const isEmpty = ticketsRemaining <= 0;
    const iconColor = isEmpty ? '#1a1a1a' : '#d8b4fe';
    const iconShadowColor = isEmpty ? 'transparent' : '#a855f7';
    const gradientColors = isEmpty
      ? (['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.0)'] as const)
      : (['rgba(168,85,247,0.15)', 'transparent'] as const);

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTicketsInfo(true)}>
        <View style={styles.ticketsOuter}>
          <View style={styles.ticketsInner}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(255,255,255,0.00)', effect: 'clear' } as any)} />
            ) : (
              <BlurView intensity={0} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
            <View style={{ shadowColor: iconShadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: isEmpty ? 0 : 0.8, shadowRadius: 8, elevation: isEmpty ? 0 : 4 }}>
              <Ticket size={18} color={iconColor} />
            </View>
            <Text style={[styles.ticketsTxt, isEmpty && styles.ticketsTxtEmpty]}>{ticketsRemaining}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [ticketsRemaining]);

  const FloatingHeader = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  // Filter chips + calendar button. Reused by every FlashList branch below.
  // Memoized so the header doesn't re-mount on unrelated state changes.
  const listHeaderNode = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll} style={{ flex: 1, marginRight: 10 }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const showLock = f === 'WorldCup' && wcTabLocked;
            return (
              <TouchableOpacity key={f} onPress={() => handleFilterPress(f)} activeOpacity={0.85} style={[styles.tabChip, active && styles.tabChipActive]}>
                {isLiquidGlassSupported ? (
                  <LiquidGlassView {...({ style: [StyleSheet.absoluteFill, { borderRadius: 11 }], tint: 'rgba(20,15,30,0.65)', effect: 'clear' } as any)} />
                ) : (
                  <BlurView intensity={25} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
                )}
                {active && (
                  <LinearGradient colors={['rgba(168,85,247,0.7)', 'rgba(147,51,234,0.4)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
                )}
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{t(FILTER_LABEL_KEYS[f])}</Text>
                {showLock ? <Lock size={11} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} style={{ marginStart: 4 }} /> : null}
                {f === 'Live' && !active && <View style={styles.liveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.calendarBtn} onPress={openCalendar} activeOpacity={0.7}>
          {isLiquidGlassSupported ? (
            <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(20,15,30,0.65)', effect: 'clear' } as any)} />
          ) : (
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <Calendar size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
      {isDataStale && matches.length > 0 ? (
        <TouchableOpacity style={styles.staleBanner} onPress={() => void refetch()} activeOpacity={0.85}>
          <Text style={styles.staleBannerTxt}>{t('matches.screen.staleData') || 'Scores may be outdated — tap to refresh'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ), [filter, t, handleFilterPress, isDataStale, matches.length, refetch, wcTabLocked]);

  const listLoading = filter === 'WorldCup' && worldCupEnabled ? worldCupLoading : loading;
  const listError = filter === 'WorldCup' && worldCupEnabled ? worldCupError : error;
  const listRefetch = filter === 'WorldCup' && worldCupEnabled ? refetchWorldCup : refetch;

  const listEmptyNode = useMemo(() => {
    if (listLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
          <Text style={styles.loadingTxt}>{t('matches.screen.loading')}</Text>
        </View>
      );
    }
    if (listError) {
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTxt}>⚠️ {listError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={listRefetch} activeOpacity={0.7}>
            <Text style={styles.retryTxt}>{t('matches.screen.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTxt}>{t('matches.screen.noMatchesFound')}</Text>
      </View>
    );
  }, [listLoading, listError, listRefetch, t]);

  return (
    <View style={{ flex: 1, backgroundColor: APP_BG }}>
      <FloatingHeader
        {...(isLiquidGlassSupported ? { effect: 'clear', tint: 'rgba(5,1,13,0.1)' } as any : { intensity: 15, tint: 'dark' })}
        style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, 10) + 10 }]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowMatchesInfo(true)}
            accessibilityRole="button"
            accessibilityLabel={t('matchesInfo.title')}
            style={styles.logoPillSmall}
          >
            <Text style={styles.logo90Small}>90</Text>
            <View style={styles.plusChipSmall}>
              <Text style={styles.logoPlusSmall}>PLUS</Text>
            </View>
          </TouchableOpacity>
          <Text
            style={styles.headerTitleTxt}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {t('matches.screen.title')}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {headerRight}
      </FloatingHeader>

      <FeatureInfoModal
        visible={showMatchesInfo}
        onClose={() => setShowMatchesInfo(false)}
        icon={<CalendarCheck2 size={30} color="#d8b4fe" />}
        title={t('matchesInfo.title')}
        bullets={[t('matchesInfo.rule1'), t('matchesInfo.rule2'), t('matchesInfo.rule3')]}
        hype={t('matchesInfo.hype')}
        gotItLabel={t('matchesInfo.gotIt')}
      />
      {/* FlashList — virtualized, JS-thread friendly, no nested scroll.
          Three rendering modes:
            - Predictions: legacy LeagueGroup flow (every league + prediction buttons)
            - International: LeagueCard per international competition (no
              country layer — taps a competition → expands → shows matches)
            - Default (All/Live/Upcoming/Finished): Country → League accordions */}
      {filter === 'Predictions' ? (
        <FlashList
          data={filteredCountryGroups}
          keyExtractor={cg => cg.country}
          renderItem={({ item }) => (
            <CountryAccordion
              countryGroup={item}
              renderMatchCard={renderCountryMatchCard}
              onViewAllLeague={handleViewAllLeague}
              defaultExpanded={TOP5_COUNTRIES.has(item.country)}
            />
          )}
          drawDistance={250}
          ItemSeparatorComponent={ITEM_SEPARATOR_8}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: Math.max(insets.top, 10) + 60 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderNode}
          ListEmptyComponent={listEmptyNode}
        />
      ) : filter === 'WorldCup' ? (
        <FlashList
          data={worldCupLeagueGroups}
          keyExtractor={g => g.id}
          renderItem={({ item }) => (
            <LeagueCard
              group={item}
              filter={filter}
              onPredict={handlePredict}
              submittingId={submittingId}
              predictedMatches={predictedMatches}
              subscribedFixtures={subscribedFixtures}
              subscribingFixtureId={subscribingFixtureId}
              onToggleSubscription={handleToggleSubscription}
              onOpenDetails={handleOpenMatchDetails}
            />
          )}
          ItemSeparatorComponent={ITEM_SEPARATOR_10}
          drawDistance={250}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: Math.max(insets.top, 10) + 60 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderNode}
          ListEmptyComponent={listEmptyNode}
        />
      ) : (
        <FlashList
          data={filteredCountryGroups}
          keyExtractor={cg => cg.country}
          renderItem={({ item }) => (
            <CountryAccordion
              countryGroup={item}
              renderMatchCard={renderCountryMatchCard}
              onViewAllLeague={handleViewAllLeague}
              defaultExpanded={TOP5_COUNTRIES.has(item.country)}
            />
          )}
          // Smaller draw distance keeps fewer cells in memory while
          // scrolling fast, which matters because each country can mount
          // a chunk of leagues + match rows when expanded.
          drawDistance={250}
          ItemSeparatorComponent={ITEM_SEPARATOR_8}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: Math.max(insets.top, 10) + 60 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderNode}
          ListEmptyComponent={listEmptyNode}
        />
      )}

      {/* "View All" league bottom sheet — driven by CountryAccordion taps. */}
      <LeagueAllMatchesModal
        group={viewAllLeagueGroup}
        visible={!!viewAllLeagueGroup}
        onClose={() => setViewAllLeagueId(null)}
        filter={filter}
        onPredict={handlePredict}
        submittingId={submittingId}
        predictedMatches={predictedMatches}
        subscribedFixtures={subscribedFixtures}
        subscribingFixtureId={subscribingFixtureId}
        onToggleSubscription={handleToggleSubscription}
        onOpenDetails={handleOpenMatchDetails}
      />


      <WorldCupLockedModal
        visible={showWorldCupLocked}
        onClose={() => setShowWorldCupLocked(false)}
      />

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={[styles.modalOverlay, Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowCalendar(false)} activeOpacity={1} />
          <View style={styles.calendarModalOuter}>
            <View style={styles.calendarModalInner}>
              {isLiquidGlassSupported ? (
                <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular' } as any)} />
              ) : (
                <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.calHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calTitle}>{t('matches.screen.selectDate')}</Text>
                  <View style={styles.calMonthNavRow}>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() => shiftCalendarMonth(-1)}
                      accessibilityLabel={t('matches.screen.prevMonth')}
                    >
                      <ChevronLeft size={22} color="#E9D5FF" />
                    </TouchableOpacity>
                    <Text style={styles.calMonthLabel}>{calendarMonthLabel}</Text>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() => shiftCalendarMonth(1)}
                      accessibilityLabel={t('matches.screen.nextMonth')}
                    >
                      <ChevronRight size={22} color="#E9D5FF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.calHeaderActions}>
                  <TouchableOpacity style={styles.calTodayBtn} onPress={goToTodayInCalendar}>
                    <Text style={styles.calTodayTxt}>{t('matches.screen.today')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCalendar(false)}>
                    <Text style={styles.calClose}>{t('matches.screen.done')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.calBody}>
                {weekDayLabels.map((d, i) => (
                  <Text key={`wd-${i}`} style={styles.calDayName}>{d}</Text>
                ))}
                {calendarGrid.map((day, idx) => {
                  if (day === null) {
                    return <View key={`blank-${idx}`} style={styles.calDay} />;
                  }
                  const isSelected = isCalendarDaySelected(day);
                  return (
                    <TouchableOpacity
                      key={`d-${day}`}
                      style={[styles.calDay, isSelected && styles.calDayActive]}
                      onPress={() => handleCalendarDayPress(day)}
                    >
                      {isSelected && (
                        <LinearGradient colors={['rgba(168,85,247,0.9)', 'rgba(126,34,206,0.6)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                      )}
                      <Text style={[styles.calDayTxt, isSelected && { color: '#fff', textShadowColor: 'rgba(255,255,255,0.5)', textShadowRadius: 10 }]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tickets Info Modal */}
      <Modal visible={showTicketsInfo} transparent animationType="fade">
        <View style={[styles.modalOverlay, Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowTicketsInfo(false)} activeOpacity={1} />
          <View style={styles.ticketsInfoModalOuter}>
            <View style={styles.ticketsInfoModalInner}>
              {isLiquidGlassSupported ? (
                <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular' } as any)} />
              ) : (
                <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={['rgba(168,85,247,0.15)', 'rgba(0,0,0,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.infoIconWrap}>
                <View style={{ shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 }}>
                  <Ticket size={32} color="#d8b4fe" />
                </View>
              </View>
              <Text style={styles.infoTitle}>{t('matches.tickets.sheetTitle')}</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>{t('matches.tickets.rule1')}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>{t('matches.tickets.rule2')}</Text>
              </View>
              <TouchableOpacity style={styles.infoBtn} onPress={() => setShowTicketsInfo(false)} activeOpacity={0.8}>
                <LinearGradient colors={['#a855f7', '#7e22ce']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Text style={styles.infoBtnTxt}>{t('matches.tickets.gotIt')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoPillSmall: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 5,
  },
  logo90Small: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  plusChipSmall: { backgroundColor: PURPLE_PRIMARY, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  logoPlusSmall: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  headerTitleTxt: { flexShrink: 0, color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  listHeader: { marginBottom: 4 },
  staleBanner: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  staleBannerTxt: { color: '#fcd34d', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tabsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 24 },
  tabsScroll: { gap: 8, paddingRight: 6 },
  ticketsOuter: { shadowColor: '#000000ff', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  ticketsInner: { height: 40, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(84, 13, 151, 0)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, overflow: 'hidden' },
  ticketsTxt: { color: '#e9d5ff', fontSize: 16, fontWeight: '800', textShadowColor: '#a855f7', textShadowRadius: 8, zIndex: 1 },
  ticketsTxtEmpty: { color: '#1a1a1a', textShadowColor: 'transparent' },
  calendarBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tabChip: {
    minWidth: 62, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, overflow: 'hidden', flexDirection: 'row', gap: 6,
  },
  tabChipActive: { borderColor: 'rgba(167,139,250,0.55)' },
  tabTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700', zIndex: 1 },
  tabTxtActive: { color: '#fff' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  filterBtn: {
    width: 42, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueCard: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12,10,20,0.85)', overflow: 'hidden',
  },
  // All-matches bottom sheet
  allMatchesSheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  allMatchesSheet: {
    // Explicit height (not maxHeight) so the inner FlashList has a known
    // layout box. Android/FlashList collapses to 0 otherwise.
    height: SCREEN_HEIGHT * 0.82,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
    overflow: 'hidden',
    width: '100%',
    // Opaque fallback for Android where the expo-blur intensity isn't a full
    // frosted glass — keeps the sheet readable.
    backgroundColor: Platform.OS === 'android' ? 'rgba(15,8,28,0.96)' : 'transparent',
    // iOS shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 30,
  },
  // Wrapper that gives the FlashList a concrete flex:1 container. Without
  // this the list renders 0px tall and the sheet looks empty.
  allMatchesListWrap: { flex: 1, zIndex: 1 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  allMatchesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  allMatchesLeagueLogo: { width: 28, height: 28, marginRight: 10 },
  allMatchesTitle: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  allMatchesClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Match count badge
  matchCountBadge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
  },
  matchCountTxt: { color: '#d8b4fe', fontSize: 12, fontWeight: '800' },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  leagueHead: {
    height: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  leagueLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  leagueLogoWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueLogo: { width: 22, height: 22 },
  leagueTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  leagueRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leagueLive: { color: PURPLE_PRIMARY, fontSize: 14, fontWeight: '700' },
  rowWrap: {
    minHeight: 116, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8,
  },
  teamCol: { width: '34%', alignItems: 'center', gap: 8 },
  logoStub: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  logoInitials: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitialsTxt: { color: '#A78BFA', fontSize: 11, fontWeight: '800' },
  teamLogo: { width: 34, height: 34 },
  teamTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '600', maxWidth: '100%' },
  scoreCol: { width: '32%', minWidth: 88, alignItems: 'center', flexShrink: 0 },
  liveBadge: { color: '#ef4444', fontSize: 11, fontWeight: '900', backgroundColor: 'rgba(239,68,68,0.14)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  ftBadge: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '800' },
  scoreTxt: {
    marginTop: 6, color: '#fff', fontSize: 38, lineHeight: 40, fontWeight: '900',
    letterSpacing: -1, fontVariant: ['tabular-nums'],
  },
  scoreDash: { color: 'rgba(255,255,255,0.45)' },
  minuteTxt: { marginTop: 3, color: PURPLE_PRIMARY, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  viewAllBtn: { height: 46, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  viewAllTxt: { color: PURPLE_PRIMARY, fontSize: 15, fontWeight: '800' },
  rowWrapCol: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  upcomingBadgeWrap: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  upcomingBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  timeTxt: {
    marginTop: 6,
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 56,
    writingDirection: 'ltr',
  },
  predWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 6 },
  predTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  predTitleSpinner: { marginLeft: 4 },
  predTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  predResultWin: { color: '#22c55e', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  predResultLoss: { color: '#ef4444', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  predResultPending: { color: '#f59e0b', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  predButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  predBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  predBtnTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '800', textAlign: 'center', zIndex: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  calendarModalOuter: { width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 35, elevation: 20 },
  calendarModalInner: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', padding: 24 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, zIndex: 1, gap: 12 },
  calTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  calMonthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  calNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  calMonthLabel: { color: '#E9D5FF', fontSize: 14, fontWeight: '700', minWidth: 130, textAlign: 'center' },
  calHeaderActions: { alignItems: 'flex-end', gap: 10 },
  calTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  calTodayTxt: { color: '#D8B4FE', fontSize: 13, fontWeight: '700' },
  calClose: { color: PURPLE_PRIMARY, fontSize: 16, fontWeight: '700' },
  calBody: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%', zIndex: 1 },
  calDayName: { width: '12%', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  calDay: { width: '12%', height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  calDayActive: { borderColor: 'rgba(168,85,247,0.5)', borderWidth: 1 },
  calDayTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600', zIndex: 1 },
  ticketsInfoModalOuter: { width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 35, elevation: 20 },
  ticketsInfoModalInner: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)', overflow: 'hidden', padding: 24, alignItems: 'center' },
  infoIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  infoTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 12, gap: 10, paddingRight: 10 },
  infoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a855f7', marginTop: 7 },
  infoText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, flex: 1 },
  infoBtn: { width: '100%', height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  infoBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Loading / Error / Empty
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errorWrap: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  errorTxt: { color: 'rgba(255,100,100,0.8)', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)' },
  retryTxt: { color: '#d8b4fe', fontSize: 14, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 15 },
});
