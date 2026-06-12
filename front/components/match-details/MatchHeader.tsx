import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { formatLiveMinuteDisplay } from '../../components/Matches/leagueApiUtils';
import {
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  BLUE_PRIMARY,
  LIVE_RED,
  TEXT_PRIMARY,
  TEXT_MUTED,
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
  /** Period start timestamp (seconds). Currently unused — minute comes from `elapsed`. */
  startTimestamp?: number;
  /** API-Football short status (1H, 2H, HT, FT, NS, ...). */
  statusShort?: string;
  /** Live elapsed minute from API. */
  elapsed?: number | null;
  /** Stoppage time minutes (when API supplies extra time). */
  stoppage?: number | null;
}

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

// ─── Pulsing live dot — identical to Home card ────────────────────────────
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

// ─── Team logo (with initials fallback) ──────────────────────────────────
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
  statusShort,
  elapsed,
  stoppage,
  startTimestamp,
}) => {
  const short = statusShort || '';
  const isHalftime = short === 'HT';
  const isLive =
    LIVE_STATUSES.includes(short) || (status === 'live' && !isHalftime);
  const isFinished = FINISHED_STATUSES.includes(short) || status === 'finished';
  const isUpcoming = !isLive && !isFinished && !isHalftime;
  const isStoppage = isLive && !!stoppage && stoppage > 0;

  const [periodMinute, setPeriodMinute] = useState<number | null>(null);

  useEffect(() => {
    if (!isLive || !startTimestamp) {
      setPeriodMinute(null);
      return;
    }
    const compute = () => {
      const now = Math.floor(Date.now() / 1000);
      const start =
        startTimestamp > 1_000_000_000_000
          ? Math.floor(startTimestamp / 1000)
          : startTimestamp;
      let diffMin = Math.max(0, Math.floor((now - start) / 60));
      if (short === '2H') diffMin += 45;
      if (short === 'ET') diffMin += 90;
      setPeriodMinute(diffMin);
    };
    compute();
    const id = setInterval(compute, 5_000);
    return () => clearInterval(id);
  }, [isLive, startTimestamp, short]);

  const effectiveElapsed = useMemo(() => {
    if (elapsed == null) return periodMinute;
    if (periodMinute == null) return elapsed;
    return Math.max(elapsed, periodMinute);
  }, [elapsed, periodMinute]);

  const minuteLabel = (() => {
    if (isHalftime) return 'HT';
    if (!isLive) return '';
    const formatted = formatLiveMinuteDisplay(short, effectiveElapsed);
    if (formatted) return formatted;
    if (short === '1H') return "1'";
    if (short === '2H') return "46'";
    return short || 'LIVE';
  })();

  const sepText = isLive
    ? isStoppage
      ? `+${stoppage}`
      : minuteLabel
    : isFinished
    ? 'FT'
    : isHalftime
    ? 'HT'
    : '–';

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.card,
          isLive && styles.cardLive,
          isStoppage && styles.cardStoppage,
        ]}
      >
        {/* Left accent bar — matches Home card */}
        {isLive ? (
          <LinearGradient
            colors={
              isStoppage
                ? ([LIVE_RED, LIVE_RED] as const)
                : ([PURPLE_PRIMARY, BLUE_PRIMARY] as const)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
        ) : (
          <View
            style={[
              styles.accentBar,
              {
                backgroundColor: isUpcoming
                  ? 'rgba(124,58,237,0.4)'
                  : 'rgba(255,255,255,0.1)',
              },
            ]}
          />
        )}

        {/* Top row: league + status pill */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.leagueText} numberOfLines={1}>
              {league}
            </Text>
          </View>

          {isLive ? (
            <View style={[styles.liveMinuteContainer, styles.liveMinuteBorder]}>
              <Text style={[styles.minuteText, isStoppage && { color: LIVE_RED }]}>
                {minuteLabel}
                {isStoppage ? (
                  <Text style={styles.stoppageInline}> +{stoppage}</Text>
                ) : null}
              </Text>
              <PulsingDot color={LIVE_RED} />
            </View>
          ) : isHalftime ? (
            <View style={styles.htBadge}>
              <Text style={styles.htText}>HT</Text>
            </View>
          ) : isFinished ? (
            <View style={styles.ftBadge}>
              <Text style={styles.ftText}>FT</Text>
            </View>
          ) : (
            <Text style={styles.kickoffText}>{time}</Text>
          )}
        </View>

        {/* Teams + score */}
        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <TeamLogo name={homeTeam} uri={homeLogo} />
            <Text style={styles.teamName} numberOfLines={1}>
              {homeTeam}
            </Text>
          </View>

          <View style={styles.scoreArea}>
            {isUpcoming ? (
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.kickoffLarge}>{time}</Text>
              </View>
            ) : (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNum}>{homeScore || '0'}</Text>
                <View style={styles.scoreSep}>
                  <Text
                    style={[
                      styles.sepMinute,
                      {
                        color: isLive
                          ? isStoppage
                            ? LIVE_RED
                            : PURPLE_SOFT
                          : 'rgba(255,255,255,0.3)',
                      },
                    ]}
                  >
                    {sepText}
                  </Text>
                  {isLive ? (
                    <LinearGradient
                      colors={
                        isStoppage
                          ? ([LIVE_RED, LIVE_RED] as const)
                          : ([PURPLE_PRIMARY, BLUE_PRIMARY] as const)
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.liveBar}
                    />
                  ) : null}
                </View>
                <Text style={styles.scoreNum}>{awayScore || '0'}</Text>
              </View>
            )}
          </View>

          <View style={styles.teamCol}>
            <TeamLogo name={awayTeam} uri={awayLogo} />
            <Text style={styles.teamName} numberOfLines={1}>
              {awayTeam}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Styles — mirrors front/components/home/MatchList.tsx MatchCard ─────────
const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(18,12,28,0.98)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardLive: {
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  cardStoppage: {
    shadowColor: LIVE_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },

  // Top row
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  leagueText: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  liveMinuteContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveMinuteBorder: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.3)',
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  minuteText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '700' },
  stoppageInline: { color: LIVE_RED, fontSize: 11, fontWeight: '900' },
  ftBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ftText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  htBadge: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  htText: { color: '#F5C518', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  kickoffText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '600' },

  // Teams row
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 8,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamLogoImg: { width: 56, height: 56 },
  teamAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: { color: PURPLE_SOFT, fontSize: 14, fontWeight: '800' },
  teamName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 110,
  },

  // Score area
  scoreArea: { alignItems: 'center', justifyContent: 'center', minWidth: 130 },
  vsContainer: { alignItems: 'center', gap: 4 },
  vsText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
  },
  kickoffLarge: { color: PURPLE_SOFT, fontSize: 14, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreNum: {
    color: TEXT_PRIMARY,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 48,
    textShadowColor: 'rgba(255,255,255,0.15)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  scoreSep: { alignItems: 'center', gap: 4 },
  sepMinute: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  liveBar: { width: 32, height: 2, borderRadius: 1 },
});
