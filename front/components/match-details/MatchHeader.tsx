import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  formatMatchTime,
  isLiveStoppage,
  resolveLiveMinuteLabel,
  resolveLiveSecondsLabel,
} from '../../components/Matches/leagueApiUtils';
import { useSecondTick } from '../../hooks/useSecondTick';
import { useAnchoredPeriodStart } from '../../hooks/useAnchoredPeriodStart';
import {
  LIVE_RED,
  TEXT_PRIMARY,
} from '../../constants/tokens';

interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: string;
  awayScore?: string;
  status: string;
  league: string;
  date: string;
  time: string;
  /** ISO kickoff — preferred over `time` when available */
  fixtureDate?: string;
  /** Period start timestamp (seconds) — real API periods only when known. */
  startTimestamp?: number;
  /** Stable key for the ticking clock (fixture id) — survives Pitch/Score remounts. */
  clockAnchorKey?: string | number;
  /** API-Football short status (1H, 2H, HT, FT, NS, ...). */
  statusShort?: string;
  /** Live elapsed minute from API. */
  elapsed?: number | null;
  /** Stoppage time minutes (when API supplies extra time). */
  stoppage?: number | null;
  /** Localized status label for finished/special states (AET, Pens, Cancelled…). */
  statusLabel?: string;
  /** Penalty shootout tally (after/ during penalties). */
  penaltyHome?: number | string | null;
  penaltyAway?: number | string | null;
  /** Localized short labels (fall back to English when not supplied). */
  halftimeLabel?: string;
  finishedLabel?: string;
  vsLabel?: string;
  liveLabel?: string;
  penaltiesShortLabel?: string;
  /** Localized “kick-off / start of match” line for not-started fixtures. */
  kickoffStatusLabel?: string;
  /** Goal scorers shown under the crests (Figma scoreboard). */
  scorers?: {
    home: Array<{ name: string; minute: string }>;
    away: Array<{ name: string; minute: string }>;
  };
  /** Tapping a team (logo + name) opens its 365 profile when provided. */
  onPressHomeTeam?: () => void;
  onPressAwayTeam?: () => void;
}

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
/** Terminal states with no meaningful score/live indicator. */
const NOT_PLAYED_STATUSES = ['CANC', 'PST', 'ABD', 'AWD', 'WO', 'TBD'];
/** Halted-but-resumable states — keep the score, drop the live pulse. */
const PAUSED_STATUSES = ['SUSP'];

function PulsingDot({ color = LIVE_RED }: { color?: string }): React.ReactElement {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 800 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]}
    />
  );
}

function TeamLogo({ name, uri }: { name: string; uri?: string }): React.ReactElement {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.teamLogoImg}
        contentFit="contain"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={uri}
      />
    );
  }
  return (
    <View style={styles.teamAvatar}>
      <Text style={styles.teamAvatarText}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  status,
  league,
  time,
  fixtureDate,
  statusShort,
  elapsed,
  stoppage,
  startTimestamp,
  clockAnchorKey,
  statusLabel,
  penaltyHome,
  penaltyAway,
  halftimeLabel = 'HT',
  finishedLabel = 'FT',
  vsLabel = 'VS',
  liveLabel = 'LIVE',
  penaltiesShortLabel = 'Pens',
  kickoffStatusLabel,
  scorers,
  onPressHomeTeam,
  onPressAwayTeam,
}) => {
  const short = statusShort || '';
  const isHalftime = short === 'HT';
  const isNotPlayed = NOT_PLAYED_STATUSES.includes(short);
  const isPaused = PAUSED_STATUSES.includes(short);
  const isLive =
    !isNotPlayed &&
    !isPaused &&
    (LIVE_STATUSES.includes(short) || (status === 'live' && !isHalftime));
  const isFinished =
    !isNotPlayed &&
    (FINISHED_STATUSES.includes(short) || (status === 'finished' && !isPaused));
  const isStoppage = isLive && isLiveStoppage(short, elapsed, stoppage);
  const hasPenaltyScore =
    penaltyHome != null &&
    penaltyAway != null &&
    String(penaltyHome).length > 0 &&
    String(penaltyAway).length > 0;
  // Badge text for finished/paused/not-played states (falls back to English).
  const finishedBadgeText =
    statusLabel ||
    (short === 'AET' ? 'AET' : short === 'PEN' ? penaltiesShortLabel : finishedLabel);
  const specialBadgeText = statusLabel || short || '—';

  const kickoffTime = useMemo(() => {
    if (fixtureDate) return formatMatchTime(fixtureDate);
    return time || '--:--';
  }, [fixtureDate, time]);

  // Tick every second only while a live match is in normal play (not stoppage,
  // HT, or a paused/terminal state) so the seconds clock animates smoothly.
  const clockActive = isLive && !isStoppage && !isHalftime;
  useSecondTick(clockActive);

  // Prefer API periods; otherwise synthesize once and keep ticking so minutes
  // can advance between slow API elapsed updates (Scores365 has null periods).
  const anchoredStart = useAnchoredPeriodStart(
    clockAnchorKey,
    short,
    elapsed,
    startTimestamp,
  );

  // Computed every render (the second-tick forces a re-render) so the MM:SS
  // clock advances. Falls back to the minute-only label outside normal play.
  const secondsLabel = clockActive
    ? resolveLiveSecondsLabel(short, elapsed, {
        startTimestamp: anchoredStart,
        extra: stoppage,
      })
    : undefined;
  const minuteLabel =
    secondsLabel ??
    resolveLiveMinuteLabel(short, elapsed, {
      startTimestamp: anchoredStart,
      extra: stoppage,
    }) ??
    (isLive ? short || liveLabel : '');

  const statusLine = isLive
    ? minuteLabel
    : isFinished
    ? finishedBadgeText
    : isHalftime
    ? halftimeLabel
    : isNotPlayed || isPaused
    ? specialBadgeText
    : (kickoffStatusLabel || kickoffTime || vsLabel);

  const homeScorers = scorers?.home?.filter((s) => s.name) ?? [];
  const awayScorers = scorers?.away?.filter((s) => s.name) ?? [];
  const showScorers = homeScorers.length > 0 || awayScorers.length > 0;

  return (
    <LinearGradient
      colors={['#0c051a', '#07040d']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.wrap, isStoppage && styles.wrapStoppage]}
    >
      <View style={styles.teamsRow}>
        <TouchableOpacity
          style={styles.teamCol}
          onPress={onPressHomeTeam}
          disabled={!onPressHomeTeam}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <TeamLogo name={homeTeam} uri={homeLogo} />
          <Text style={styles.teamName} numberOfLines={2}>
            {homeTeam}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoreArea}>
          {league ? (
            <LinearGradient
              colors={['rgba(95,13,173,0.55)', 'rgba(42,6,75,0.55)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.leaguePill}
            >
              <Text style={styles.leaguePillText} numberOfLines={1}>
                {league}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.leaguePillSpacer} />
          )}

          {isNotPlayed ? (
            <Text style={styles.notPlayedLabel} numberOfLines={2}>
              {specialBadgeText}
            </Text>
          ) : (
            <Text style={styles.scoreNum}>
              {`${homeScore || '0'} - ${awayScore || '0'}`}
            </Text>
          )}

          <View style={styles.statusRow}>
            {isLive ? <PulsingDot color={isStoppage ? LIVE_RED : LIVE_RED} /> : null}
            <Text
              style={[
                styles.statusLine,
                isLive && styles.statusLive,
                isStoppage && styles.statusStoppage,
              ]}
              numberOfLines={1}
            >
              {statusLine}
            </Text>
          </View>
          {hasPenaltyScore ? (
            <Text style={styles.penaltyLine} numberOfLines={1}>
              {`(${String(penaltyHome)} - ${String(penaltyAway)} ${
                statusLabel && short !== 'FT' ? statusLabel : penaltiesShortLabel
              })`}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.teamCol}
          onPress={onPressAwayTeam}
          disabled={!onPressAwayTeam}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <TeamLogo name={awayTeam} uri={awayLogo} />
          <Text style={styles.teamName} numberOfLines={2}>
            {awayTeam}
          </Text>
        </TouchableOpacity>
      </View>

      {showScorers ? (
        <View style={styles.scorersRow}>
          <View style={styles.scorersCol}>
            {homeScorers.map((s, i) => (
              <View key={`h-${s.name}-${s.minute}-${i}`} style={styles.scorerLine}>
                <Text style={styles.scorerName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Ionicons name="football" size={14} color="#c3c3c3" />
                <Text style={styles.scorerMinute}>{s.minute}</Text>
              </View>
            ))}
          </View>
          <View style={styles.scorersDivider} />
          <View style={styles.scorersCol}>
            {awayScorers.map((s, i) => (
              <View key={`a-${s.name}-${s.minute}-${i}`} style={styles.scorerLine}>
                <Text style={styles.scorerName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Ionicons name="football" size={14} color="#c3c3c3" />
                <Text style={styles.scorerMinute}>{s.minute}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#53198a',
  },
  wrapStoppage: {
    borderBottomColor: 'rgba(239,68,68,0.45)',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamLogoImg: { width: 90, height: 90 },
  teamAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: { color: '#b363ff', fontSize: 18, fontWeight: '800' },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 118,
  },
  scoreArea: { alignItems: 'center', justifyContent: 'space-between', minWidth: 112, gap: 6 },
  leaguePill: {
    height: 30,
    minWidth: 96,
    maxWidth: 130,
    paddingHorizontal: 10,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: '#370565',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaguePillSpacer: { height: 28 },
  leaguePillText: {
    color: '#b363ff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreNum: {
    color: TEXT_PRIMARY,
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 50,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLine: {
    color: '#b7b7b7',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusLive: { color: '#c4b5fd' },
  statusStoppage: { color: LIVE_RED },
  notPlayedLabel: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  penaltyLine: {
    color: '#b363ff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  scorersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
    gap: 16,
  },
  scorersCol: {
    flex: 1,
    gap: 10,
  },
  scorersDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  scorerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scorerName: {
    flexShrink: 1,
    color: '#c3c3c3',
    fontSize: 12,
    fontWeight: '600',
  },
  scorerMinute: {
    color: '#c3c3c3',
    fontSize: 12,
    fontWeight: '600',
  },
});
