import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './MatchText';
import { PulsingDot } from './MatchHeader';
import { useMatchStatusLine, type MatchStatusLineInput } from './useMatchStatusLine';
import { LIVE_RED } from '../../constants/tokens';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';

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
  const sized = with365ImageSize(uri, 96) ?? uri;
  return (
    <Image
      source={{ uri: sized }}
      style={styles.logo}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={sized}
    />
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
  const { isDark } = useMatchDetailsTheme();
  const hasScore = homeScore != null && awayScore != null && !isNotPlayed;
  const tone: Tone = isLive ? 'live' : isHalftime ? 'halftime' : isFinished ? 'finished' : 'upcoming';
  const pillTone = isDark ? PILL_TONE_DARK : PILL_TONE_ON_PURPLE;
  const pillTextTone = isDark ? PILL_TEXT_TONE_DARK : PILL_TEXT_ON_PURPLE;
  const nameColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.88)';
  const scoreColor = '#FFFFFF';

  return (
    <View style={styles.wrap}>
      {/* Same visual order as MatchHeader: away left, home right (Arabic home-on-right). */}
      <View style={styles.row}>
        <Text style={[styles.name, styles.nameAway, { color: nameColor }]} numberOfLines={1}>
          {awayTeam}
        </Text>
        <CompactLogo uri={awayLogo} />
        <Text
          style={[
            styles.score,
            { color: scoreColor },
            !hasScore && { fontSize: 13, color: nameColor },
          ]}
          numberOfLines={1}
        >
          {hasScore ? `${awayScore} - ${homeScore}` : (statusInput.vsLabel || 'VS')}
        </Text>
        <CompactLogo uri={homeLogo} />
        <Text style={[styles.name, styles.nameHome, { color: nameColor }]} numberOfLines={1}>
          {homeTeam}
        </Text>
      </View>
      {statusLine ? (
        <View style={[styles.pill, pillTone[tone]]}>
          {isLive ? <PulsingDot color={LIVE_RED} /> : null}
          <Text style={[styles.pillText, pillTextTone[tone]]} numberOfLines={1}>
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
  const { isDark } = useMatchDetailsTheme();
  const short = statusShort || '';
  let fraction: number | null = null;
  let color = LIVE_RED;
  if (FINISHED_STATUSES.includes(short)) {
    fraction = 1;
    color = isDark ? 'rgba(167,139,250,0.55)' : '#FFFFFF';
  } else if (short === 'HT') {
    fraction = 0.5;
    color = '#f59e0b';
  } else if (LIVE_STATUSES.includes(short) && elapsed != null) {
    const total = EXTRA_TIME_STATUSES.includes(short) ? 120 : 90;
    fraction = Math.min(1, Math.max(0, elapsed / total));
  }
  if (fraction == null) return null;

  return (
    <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)' }]}>
      <View style={[styles.progressFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const PILL_TONE_DARK = StyleSheet.create({
  live: { backgroundColor: 'rgba(239,68,68,0.16)', borderColor: 'rgba(239,68,68,0.55)' },
  halftime: { backgroundColor: 'rgba(245,158,11,0.16)', borderColor: 'rgba(245,158,11,0.5)' },
  finished: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)' },
  upcoming: { backgroundColor: 'rgba(129,10,242,0.2)', borderColor: 'rgba(129,10,242,0.5)' },
});


const PILL_TEXT_TONE_DARK = StyleSheet.create({
  live: { color: '#ff6b6b' },
  halftime: { color: '#fbbf24' },
  finished: { color: '#d1d5db' },
  upcoming: { color: '#c79bff' },
});

/** Minute chip sitting on the purple score capsule. */
const PILL_TONE_ON_PURPLE = StyleSheet.create({
  live: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.45)' },
  halftime: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.45)' },
  finished: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)' },
  upcoming: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)' },
});

const PILL_TEXT_ON_PURPLE = StyleSheet.create({
  live: { color: '#FFFFFF' },
  halftime: { color: '#FFFFFF' },
  finished: { color: '#FFFFFF' },
  upcoming: { color: '#FFFFFF' },
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
    direction: 'ltr',
    alignItems: 'center',
    width: '100%',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  nameAway: {
    textAlign: 'right',
  },
  nameHome: {
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
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
});
