/**
 * Fan 1-X-2 vote (365 "Who will win?") — Figma 1700:12127.
 * Light card: option tiles + percent labels above a split bar + footer.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Text } from './MatchText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

export type CrowdVoteChoice = 'home' | 'draw' | 'away';

const VOTE_STORAGE_PREFIX = 'match-crowd-vote:';
const CHART_ICON = require('../../assets/images/match-vote/voting-chart.svg');

const INK = '#24104E';
const MUTED = '#6B7280';
const BORDER = '#EADFFC';
const TRACK = '#E9D5FF';
const PRIMARY = '#6A2BD9';
const PRIMARY_DEEP = '#381773';
const HOME_BAR: [string, string] = ['#A855F7', '#6A2BD9'];
const AWAY_BAR: [string, string] = ['#456FC7', '#2D4D94'];
const DRAW_BAR = '#8791A3';

function isVoteChoice(value: unknown): value is CrowdVoteChoice {
  return value === 'home' || value === 'draw' || value === 'away';
}

export type CrowdVoteTeam = { name: string; logo?: string | null };

export type MatchCrowdVoteData = {
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  totalVotes?: number | null;
  home: CrowdVoteTeam;
  away: CrowdVoteTeam;
  title: string;
  subtitle: string;
  drawLabel: string;
  votesUnit: string;
  tapHint?: string;
  votedHint?: string;
  lockedHint?: string;
  /** Fixture id; the user's single vote is remembered per match under this key. */
  voteKey?: string | number | null;
};

type Props = MatchCrowdVoteData & { rtl: boolean };

const CHOICES: CrowdVoteChoice[] = ['home', 'draw', 'away'];

function formatVotes(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

/** Largest-remainder rounding so the three shown percentages always add up to 100. */
function roundToHundred(values: Record<CrowdVoteChoice, number>): Record<CrowdVoteChoice, number> {
  const safe = CHOICES.map((key) => Math.max(0, Number.isFinite(values[key]) ? values[key] : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { home: 0, draw: 0, away: 0 };
  const scaled = safe.map((v) => (v / sum) * 100);
  const floored = scaled.map(Math.floor);
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floored[i] += 1;
    remaining -= 1;
  }
  return { home: floored[0], draw: floored[1], away: floored[2] };
}

function Crest({
  team,
  size,
  selected,
  isDark,
}: {
  team: CrowdVoteTeam;
  size: number;
  selected: boolean;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (team.logo && !failed) {
    return (
      <Image
        source={{ uri: team.logo }}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={team.logo}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={[
        styles.crestFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: selected
            ? 'rgba(255,255,255,0.22)'
            : isDark
              ? 'rgba(167,139,250,0.22)'
              : 'rgba(106,43,217,0.12)',
        },
      ]}
    >
      <Text style={[styles.crestFallbackText, selected && styles.crestFallbackTextSelected]}>
        {team.name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function VoteTile({
  media,
  name,
  selected,
  locked,
  dimmed,
  isDark,
  onPress,
}: {
  media: React.ReactNode;
  name: string;
  selected: boolean;
  locked: boolean;
  dimmed: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const idleBorder = isDark ? 'rgba(167,139,250,0.28)' : BORDER;
  const idleBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const nameColor = selected ? '#FFFFFF' : isDark ? '#FFFFFF' : INK;

  return (
    <View
      style={[
        styles.tile,
        {
          borderColor: selected ? 'transparent' : idleBorder,
          backgroundColor: selected ? 'transparent' : idleBg,
        },
        dimmed && styles.tileDimmed,
        pressed && styles.tilePressed,
        !isDark && styles.tileShadow,
      ]}
    >
      {selected ? (
        <LinearGradient
          colors={[PRIMARY, PRIMARY_DEEP]}
          start={{ x: 0.85, y: 0 }}
          end={{ x: 0.15, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : !isDark ? (
        <LinearGradient
          colors={['#FFFFFF', '#FCF9FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ selected, disabled: locked }}
        style={styles.tileInner}
      >
        {media}
        <Text style={[styles.tileName, { color: nameColor }]} numberOfLines={2}>
          {name}
        </Text>
      </Pressable>
    </View>
  );
}

function BarSegment({
  choice,
  flex,
}: {
  choice: CrowdVoteChoice;
  flex: number;
}) {
  if (flex <= 0) return null;
  if (choice === 'draw') {
    return <View style={[styles.barSegment, { flex, backgroundColor: DRAW_BAR }]} />;
  }
  const colors = choice === 'home' ? HOME_BAR : AWAY_BAR;
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.barSegment, { flex }]}
    />
  );
}

export function MatchCrowdVote({
  homePercent,
  drawPercent,
  awayPercent,
  totalVotes,
  home,
  away,
  title,
  subtitle,
  drawLabel,
  votesUnit,
  tapHint = 'Tap a card to vote',
  votedHint = 'Your vote was recorded successfully',
  lockedHint = 'You cannot vote again',
  rtl,
  voteKey = null,
}: Props) {
  const { colors, isDark } = useMatchDetailsTheme();
  const storageKey =
    voteKey != null && String(voteKey) !== '' && String(voteKey) !== '0'
      ? `${VOTE_STORAGE_PREFIX}${voteKey}`
      : null;
  const [myVote, setMyVote] = useState<CrowdVoteChoice | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
    setMyVote(null);
    if (!storageKey) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (cancelled || !isVoteChoice(stored)) return;
        lockedRef.current = true;
        setMyVote(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const castVote = useCallback(
    (choice: CrowdVoteChoice) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setMyVote(choice);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      if (storageKey) void AsyncStorage.setItem(storageKey, choice).catch(() => undefined);
    },
    [storageKey],
  );

  const total = totalVotes != null && totalVotes > 0 ? totalVotes : null;
  const baseCounts =
    total != null
      ? {
          home: (total * homePercent) / 100,
          draw: (total * drawPercent) / 100,
          away: (total * awayPercent) / 100,
        }
      : null;
  const counts =
    baseCounts && myVote ? { ...baseCounts, [myVote]: baseCounts[myVote] + 1 } : baseCounts;
  const countsSum = counts ? counts.home + counts.draw + counts.away : 0;
  const rawPercents =
    counts && myVote && countsSum > 0
      ? counts
      : { home: homePercent, draw: drawPercent, away: awayPercent };
  const percents = roundToHundred(rawPercents);
  const shownTotal = counts ? Math.round(countsSum) : total;

  const locked = myVote != null;
  const headerSubtitle = locked ? votedHint : subtitle;
  const footerStatus = locked ? lockedHint : tapHint;
  const textAlign = rtl ? 'right' : 'left';
  const rowDir = rtl ? ('row-reverse' as const) : ('row' as const);

  const ink = isDark ? colors.textPrimary : INK;
  const muted = isDark ? colors.textMuted : MUTED;
  const cardBorder = isDark ? colors.cardBorder : BORDER;
  const cardBg = isDark ? colors.elevatedBg : '#FFFFFF';
  const iconWell = isDark ? colors.primaryMuted : '#F4EEFF';

  const tileMedia: Record<CrowdVoteChoice, React.ReactNode> = {
    home: (
      <Crest team={home} size={myVote === 'home' ? 60 : 49} selected={myVote === 'home'} isDark={isDark} />
    ),
    draw: null,
    away: (
      <Crest team={away} size={myVote === 'away' ? 60 : 49} selected={myVote === 'away'} isDark={isDark} />
    ),
  };
  const tileName: Record<CrowdVoteChoice, string> = {
    home: home.name,
    draw: drawLabel,
    away: away.name,
  };

  const footerParts = [
    shownTotal != null ? `${formatVotes(shownTotal)} ${votesUnit}` : null,
    footerStatus,
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: cardBorder,
          backgroundColor: cardBg,
        },
        !isDark && styles.cardShadow,
      ]}
    >
      {!isDark ? (
        <LinearGradient
          colors={['#FFFFFF', '#FCFAFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.block}>
        <View style={[styles.header, { flexDirection: rowDir }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: ink, textAlign }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: muted, textAlign }]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: iconWell }]}>
            <Image source={CHART_ICON} style={styles.chartIcon} contentFit="contain" />
          </View>
        </View>

        {/* Same order as the match header: home, draw, away. Do not mirror in Arabic. */}
        <View style={styles.tiles}>
          {CHOICES.map((choice) => (
            <VoteTile
              key={choice}
              media={tileMedia[choice]}
              name={tileName[choice]}
              selected={myVote === choice}
              locked={locked}
              dimmed={locked && myVote !== choice}
              isDark={isDark}
              onPress={() => castVote(choice)}
            />
          ))}
        </View>
      </View>

      <View style={styles.results}>
        <View style={styles.percentRow}>
          {CHOICES.map((choice) => (
            <Text
              key={choice}
              style={[styles.percentLabel, { color: ink }]}
              numberOfLines={1}
            >
              {`${percents[choice]}%`}
            </Text>
          ))}
        </View>

        <View style={[styles.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : TRACK }]}>
          <View style={styles.barFill}>
            {CHOICES.map((choice) => (
              <BarSegment key={choice} choice={choice} flex={percents[choice]} />
            ))}
          </View>
        </View>

        <Text style={[styles.footer, { color: muted }]} numberOfLines={1}>
          {footerParts.join('  •  ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 16,
    gap: 16,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 13,
    elevation: 4,
  },
  block: {
    gap: 12,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartIcon: {
    width: 19,
    height: 19,
  },
  tiles: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
    height: 113,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileShadow: {
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  tileInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 0,
  },
  tileDimmed: {
    opacity: 0.55,
  },
  tilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  crestFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestFallbackText: {
    color: INK,
    fontSize: 15,
    fontWeight: '700',
  },
  crestFallbackTextSelected: {
    color: '#FFFFFF',
  },
  tileName: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    minHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  results: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  percentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  percentLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    width: '100%',
    height: 13,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  barSegment: {
    height: '100%',
  },
  footer: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
});
