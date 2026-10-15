import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './MatchText';
import { PulsingDot } from './MatchHeader';
import { useMatchStatusLine, type MatchStatusLineInput } from './useMatchStatusLine';
import { LIVE_RED } from '../../constants/tokens';

type MatchCompactScoreProps = MatchStatusLineInput & {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore?: string | number | null;
  awayScore?: string | number | null;
};

type Tone = 'live' | 'halftime' | 'finished' | 'upcoming';

function CompactLogo({ uri }: { uri?: string | null }) {
  if (!uri) return <View style={[styles.logo, styles.logoFallback]} />;
  return (
    <Image source={{ uri }} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} />
  );
}

/** Collapsed scoreboard shown in the top bar once the hero scrolls away. */
export function MatchCompactScore({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  ...statusInput
}: MatchCompactScoreProps) {
  const { isLive, isHalftime, isFinished, isNotPlayed, statusLine } = useMatchStatusLine(statusInput);
  const hasScore = homeScore != null && awayScore != null && !isNotPlayed;
  const tone: Tone = isLive ? 'live' : isHalftime ? 'halftime' : isFinished ? 'finished' : 'upcoming';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.name, styles.nameHome]} numberOfLines={1}>
          {homeTeam}
        </Text>
        <CompactLogo uri={homeLogo} />
        <Text style={[styles.score, !hasScore && styles.scoreVs]} numberOfLines={1}>
          {hasScore ? `${homeScore} - ${awayScore}` : (statusInput.vsLabel || 'VS')}
        </Text>
        <CompactLogo uri={awayLogo} />
        <Text style={[styles.name, styles.nameAway]} numberOfLines={1}>
          {awayTeam}
        </Text>
      </View>
      {statusLine ? (
        <View style={[styles.pill, PILL_TONE[tone]]}>
          {isLive ? <PulsingDot color={LIVE_RED} /> : null}
          <Text style={[styles.pillText, PILL_TEXT_TONE[tone]]} numberOfLines={1}>
            {statusLine}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const EXTRA_TIME_STATUSES = ['ET', 'BT', 'P'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

/** Thin match-progress line for the bottom edge of the collapsed top bar. */
export function MatchCompactProgress({
  statusShort,
  elapsed,
}: {
  statusShort?: string;
  elapsed?: number | null;
}) {
  const short = statusShort || '';
  let fraction: number | null = null;
  let color = LIVE_RED;
  if (FINISHED_STATUSES.includes(short)) {
    fraction = 1;
    color = 'rgba(167,139,250,0.55)';
  } else if (short === 'HT') {
    fraction = 0.5;
    color = '#f59e0b';
  } else if (LIVE_STATUSES.includes(short) && elapsed != null) {
    const total = EXTRA_TIME_STATUSES.includes(short) ? 120 : 90;
    fraction = Math.min(1, Math.max(0, elapsed / total));
  }
  if (fraction == null) return null;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const PILL_TONE = StyleSheet.create({
  live: { backgroundColor: 'rgba(239,68,68,0.16)', borderColor: 'rgba(239,68,68,0.55)' },
  halftime: { backgroundColor: 'rgba(245,158,11,0.16)', borderColor: 'rgba(245,158,11,0.5)' },
  finished: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)' },
  upcoming: { backgroundColor: 'rgba(129,10,242,0.2)', borderColor: 'rgba(129,10,242,0.5)' },
});

const PILL_TEXT_TONE = StyleSheet.create({
  live: { color: '#ff6b6b' },
  halftime: { color: '#fbbf24' },
  finished: { color: '#d1d5db' },
  upcoming: { color: '#c79bff' },
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 6,
  },
  name: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  nameHome: {
    textAlign: 'right',
  },
  nameAway: {
    textAlign: 'left',
  },
  logo: {
    width: 20,
    height: 20,
  },
  logoFallback: {
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.25)',
  },
  score: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  scoreVs: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    height: 15,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 2,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
});
