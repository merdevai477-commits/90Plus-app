/**
 * Fan 1-X-2 vote (365 "Who will win?") — header, three equal tiles, split bar, footer.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './MatchText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export type CrowdVoteChoice = 'home' | 'draw' | 'away';

const VOTE_STORAGE_PREFIX = 'match-crowd-vote:';

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
  /** Fixture id; the user's single vote is remembered per match under this key. */
  voteKey?: string | number | null;
};

type Props = MatchCrowdVoteData & { rtl: boolean };

const TONE: Record<CrowdVoteChoice, { color: string; soft: string; gradient: [string, string] }> = {
  home: { color: '#A855F7', soft: 'rgba(168,85,247,0.14)', gradient: ['#B46CFF', '#7C3AED'] },
  draw: { color: '#94A3B8', soft: 'rgba(148,163,184,0.12)', gradient: ['#A8B3C4', '#64748B'] },
  away: { color: '#3B82F6', soft: 'rgba(59,130,246,0.14)', gradient: ['#60A5FA', '#2563EB'] },
};

const CHOICES: CrowdVoteChoice[] = ['home', 'draw', 'away'];
const CHOICE_MARK: Record<CrowdVoteChoice, string> = { home: '1', draw: 'X', away: '2' };

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

function Crest({ team }: { team: CrowdVoteTeam }) {
  const [failed, setFailed] = useState(false);
  if (team.logo && !failed) {
    return (
      <Image
        source={{ uri: team.logo }}
        style={styles.crest}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={team.logo}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.crest, styles.crestFallback]}>
      <Text style={styles.crestFallbackText}>{team.name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function DrawMark() {
  return (
    <View style={[styles.crest, styles.drawMark]}>
      <Text style={styles.drawMarkText}>X</Text>
    </View>
  );
}

function VoteTile({
  choice,
  media,
  name,
  percent,
  votes,
  votesUnit,
  leading,
  selected,
  locked,
  dimmed,
  onPress,
}: {
  choice: CrowdVoteChoice;
  media: React.ReactNode;
  name: string;
  percent: number;
  votes: number | null;
  votesUnit: string;
  leading: boolean;
  selected: boolean;
  locked: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const tone = TONE[choice];
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${percent}%`}
      accessibilityState={{ selected, disabled: locked }}
      style={({ pressed }) => [
        styles.tile,
        selected && { borderColor: tone.color, backgroundColor: tone.soft },
        dimmed && styles.tileDimmed,
        pressed && styles.tilePressed,
      ]}
    >
      {selected ? (
        <LinearGradient
          colors={[tone.soft, 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.tileTop}>
        <LinearGradient
          colors={tone.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.markChip}
        >
          <Text style={styles.markChipText}>{CHOICE_MARK[choice]}</Text>
        </LinearGradient>
        {selected ? (
          <View style={[styles.checkBadge, { backgroundColor: tone.color }]}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {media}

      <Text style={styles.tileName} numberOfLines={2}>
        {name}
      </Text>

      <Text style={[styles.percent, leading && { color: tone.color }]}>
        {percent}
        <Text style={[styles.percentSign, leading && { color: tone.color }]}>%</Text>
      </Text>

      {votes != null ? (
        <Text style={styles.tileVotes} numberOfLines={1}>
          {`${formatVotes(votes)} ${votesUnit}`}
        </Text>
      ) : null}
    </Pressable>
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
  votedHint = 'Your vote is in',
  rtl,
  voteKey = null,
}: Props) {
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
  const shownTotal = counts ? Math.round(countsSum) : null;

  const maxPercent = Math.max(percents.home, percents.draw, percents.away);
  const leaders = CHOICES.filter((key) => percents[key] === maxPercent);
  const leader = maxPercent > 0 && leaders.length === 1 ? leaders[0] : null;

  const locked = myVote != null;
  const textAlign = rtl ? 'right' : 'left';

  const tileMedia: Record<CrowdVoteChoice, React.ReactNode> = {
    home: <Crest team={home} />,
    draw: <DrawMark />,
    away: <Crest team={away} />,
  };
  const tileName: Record<CrowdVoteChoice, string> = {
    home: home.name,
    draw: drawLabel,
    away: away.name,
  };

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(124,58,237,0.20)', 'rgba(59,130,246,0.06)', 'rgba(8,7,25,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, rtl && styles.rowReverse]}>
        <LinearGradient
          colors={['#A855F7', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Ionicons name="stats-chart" size={16} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { textAlign }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.oddsPill}>
          <Text style={styles.oddsPillText}>1X2</Text>
        </View>
      </View>

      <View style={styles.tiles}>
        {CHOICES.map((choice) => (
          <VoteTile
            key={choice}
            choice={choice}
            media={tileMedia[choice]}
            name={tileName[choice]}
            percent={percents[choice]}
            votes={counts ? counts[choice] : null}
            votesUnit={votesUnit}
            leading={leader === choice}
            selected={myVote === choice}
            locked={locked}
            dimmed={locked && myVote !== choice}
            onPress={() => castVote(choice)}
          />
        ))}
      </View>

      <View style={styles.bar}>
        {CHOICES.filter((choice) => percents[choice] > 0).map((choice) => (
          <LinearGradient
            key={choice}
            colors={TONE[choice].gradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.barSegment, { flex: percents[choice] }]}
          />
        ))}
      </View>

      <View style={[styles.footer, rtl && styles.rowReverse]}>
        {shownTotal != null ? (
          <View style={[styles.footerItem, rtl && styles.rowReverse]}>
            <Ionicons name="people" size={14} color="rgba(255,255,255,0.55)" />
            <Text style={styles.footerText} numberOfLines={1}>
              {`${formatVotes(shownTotal)} ${votesUnit}`}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View style={[styles.footerItem, rtl && styles.rowReverse]}>
          <Ionicons
            name={locked ? 'checkmark-circle' : 'hand-left-outline'}
            size={14}
            color={locked ? '#4ADE80' : 'rgba(255,255,255,0.55)'}
          />
          <Text style={[styles.footerText, locked && styles.footerTextDone]} numberOfLines={1}>
            {locked ? votedHint : tapHint}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    backgroundColor: '#0C0A1F',
    padding: 16,
    gap: 16,
    overflow: 'hidden',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  oddsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  oddsPillText: {
    color: '#DDD6FE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    overflow: 'hidden',
  },
  tileDimmed: {
    opacity: 0.6,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  tileTop: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 20,
  },
  markChip: {
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crest: {
    width: 46,
    height: 46,
  },
  crestFallback: {
    borderRadius: 23,
    backgroundColor: 'rgba(168,85,247,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestFallbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  drawMark: {
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: 'rgba(148,163,184,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawMarkText: {
    color: '#CBD5E1',
    fontSize: 18,
    fontWeight: '800',
  },
  tileName: {
    alignSelf: 'stretch',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    minHeight: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  percent: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  percentSign: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '700',
  },
  tileVotes: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    gap: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  barSegment: {
    height: '100%',
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  footerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  footerTextDone: {
    color: '#4ADE80',
  },
});
