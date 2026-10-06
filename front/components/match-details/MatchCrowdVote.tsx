/**
 * Fan 1-X-2 vote (365 "Who will win?") — Figma 1347:18834 header + three cards.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const ICON = {
  barChart: require('../../assets/images/match-vote/bar-chart.svg'),
  arrowHome: require('../../assets/images/match-vote/arrow-home.svg'),
  arrowAway: require('../../assets/images/match-vote/arrow-away.svg'),
  users: require('../../assets/images/match-vote/users-small.svg'),
  drawCross: require('../../assets/images/match-vote/draw-cross.svg'),
};

export type CrowdVoteTeam = { name: string; logo?: string | null };

type Props = {
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
  rtl: boolean;
};

type Tone = {
  bg: string;
  border: string;
  glow: string;
  pill: [string, string];
};

const TONE_HOME: Tone = {
  bg: '#0B0518',
  border: '#A855F7',
  glow: 'rgba(168,85,247,0.46)',
  pill: ['#A855F7', '#633291'],
};
const TONE_DRAW: Tone = {
  bg: '#0A0A0A',
  border: '#767676',
  glow: 'rgba(104,104,104,0.46)',
  pill: ['#888888', '#222222'],
};
const TONE_AWAY: Tone = {
  bg: '#0B0518',
  border: '#8B5CF6',
  glow: 'rgba(139,92,246,0.46)',
  pill: ['#8B5CF6', '#513690'],
};

function formatVotes(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

function Crest({ team }: { team: CrowdVoteTeam }) {
  if (team.logo) {
    return (
      <Image
        source={{ uri: team.logo }}
        style={styles.crest}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={team.logo}
      />
    );
  }
  return (
    <View style={[styles.crest, styles.crestFallback]}>
      <Text style={styles.crestFallbackText}>{team.name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function VoteCard({
  tone,
  media,
  name,
  percent,
  trend,
  arrow,
  votes,
  votesUnit,
  choice,
  rtl,
}: {
  tone: Tone;
  media: React.ReactNode;
  name: string;
  percent: number;
  trend: 'up' | 'down' | null;
  arrow?: number;
  votes: number | null;
  votesUnit: string;
  choice: string;
  rtl: boolean;
}) {
  const cardStyle: ViewStyle = {
    backgroundColor: tone.bg,
    borderColor: tone.border,
    boxShadow: `inset 0px 0px 18px 0px ${tone.glow}`,
  };
  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.cardTeam}>
        {media}
        <Text style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {name}
        </Text>
      </View>

      <View style={styles.percentRow}>
        <Text style={styles.percent}>{`${Math.round(percent)}%`}</Text>
        {trend && arrow != null ? (
          <Image
            source={arrow}
            style={[styles.arrow, trend === 'down' && styles.arrowDown]}
            contentFit="contain"
          />
        ) : null}
      </View>

      {votes != null ? (
        <View style={[styles.votesRow, !rtl && styles.rowReverse]}>
          <Text style={styles.votes} numberOfLines={1}>
            {`${formatVotes(votes)} ${votesUnit}`}
          </Text>
          <Image source={ICON.users} style={styles.votesIcon} contentFit="contain" />
        </View>
      ) : null}

      <LinearGradient
        colors={tone.pill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.choicePill}
      >
        <Text style={styles.choiceText}>{choice}</Text>
      </LinearGradient>
    </View>
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
  rtl,
}: Props) {
  const total = totalVotes != null && totalVotes > 0 ? totalVotes : null;
  const votesFor = (pct: number) => (total != null ? (total * pct) / 100 : null);
  const homeTrend = homePercent === awayPercent ? null : homePercent > awayPercent ? 'up' : 'down';
  const awayTrend = homePercent === awayPercent ? null : awayPercent > homePercent ? 'up' : 'down';

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <View style={[styles.headerCopy, rtl ? styles.alignEnd : styles.alignStart]}>
          <View style={[styles.titleRow, rtl && styles.rowReverse]}>
            <Image source={ICON.barChart} style={styles.titleIcon} contentFit="contain" />
            <Text
              style={[styles.title, { textAlign: rtl ? 'right' : 'left' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {title}
            </Text>
          </View>
          <Text style={[styles.subtitle, { textAlign: rtl ? 'right' : 'left' }]}>{subtitle}</Text>
        </View>
        <LinearGradient
          colors={['#A855F7', '#633291']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.oddsPill}
        >
          <Text style={styles.oddsPillText}>1 X 2</Text>
        </LinearGradient>
      </View>

      <View style={styles.cards}>
        <VoteCard
          tone={TONE_HOME}
          media={<Crest team={home} />}
          name={home.name}
          percent={homePercent}
          trend={homeTrend}
          arrow={ICON.arrowHome}
          votes={votesFor(homePercent)}
          votesUnit={votesUnit}
          choice="1"
          rtl={rtl}
        />
        <VoteCard
          tone={TONE_DRAW}
          media={<Image source={ICON.drawCross} style={styles.crest} contentFit="contain" />}
          name={drawLabel}
          percent={drawPercent}
          trend={null}
          votes={votesFor(drawPercent)}
          votesUnit={votesUnit}
          choice="X"
          rtl={rtl}
        />
        <VoteCard
          tone={TONE_AWAY}
          media={<Crest team={away} />}
          name={away.name}
          percent={awayPercent}
          trend={awayTrend}
          arrow={ICON.arrowAway}
          votes={votesFor(awayPercent)}
          votesUnit={votesUnit}
          choice="2"
          rtl={rtl}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  titleIcon: {
    width: 24,
    height: 24,
  },
  title: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9A9A9A',
    fontSize: 16,
    fontWeight: '500',
  },
  oddsPill: {
    minWidth: 78,
    height: 26,
    borderRadius: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oddsPillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  cards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  card: {
    flex: 1,
    minHeight: 215,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 13,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardTeam: {
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
  },
  crest: {
    width: 58,
    height: 58,
  },
  crestFallback: {
    borderRadius: 29,
    backgroundColor: 'rgba(168,85,247,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percent: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
  },
  arrow: {
    width: 24,
    height: 24,
  },
  arrowDown: {
    transform: [{ rotate: '180deg' }],
  },
  votesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  votes: {
    color: '#A5A5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  votesIcon: {
    width: 16,
    height: 16,
  },
  choicePill: {
    alignSelf: 'stretch',
    height: 25,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
});
