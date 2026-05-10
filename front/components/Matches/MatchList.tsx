import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeInDown, useSharedValue, withRepeat, withTiming, useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import {
  PURPLE_PRIMARY, PURPLE_SOFT, BLUE_PRIMARY,
  LIVE_RED, GOLD_PRIMARY, TEXT_PRIMARY, TEXT_MUTED,
  SCREEN_PADDING_H,
} from '../../constants/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MatchStatus = 'LIVE' | '1ST' | '2ND' | 'HT' | 'FT' | 'UPCOMING';

interface Team { name: string; shortName: string; score: number; }
interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  status: MatchStatus;
  minute?: string;
  stoppageTime?: number;
  league: string;
  kickoff?: string;
}

const matches: Match[] = [
  {
    id: '1',
    homeTeam: { name: 'Manchester United', shortName: 'Man Utd', score: 1 },
    awayTeam: { name: 'Manchester City', shortName: 'Man City', score: 1 },
    status: 'LIVE', minute: '90', stoppageTime: 4, league: 'Premier League',
  },
  {
    id: '2',
    homeTeam: { name: 'Real Madrid', shortName: 'Real Madrid', score: 2 },
    awayTeam: { name: 'Barcelona', shortName: 'Barcelona', score: 1 },
    status: '2ND', minute: "78'", league: 'La Liga',
  },
  {
    id: '4',
    homeTeam: { name: 'PSG', shortName: 'PSG', score: 0 },
    awayTeam: { name: 'Bayern', shortName: 'Bayern', score: 1 },
    status: 'FT', league: 'Champions League',
  },
  {
    id: '5',
    homeTeam: { name: 'Juventus', shortName: 'Juventus', score: 0 },
    awayTeam: { name: 'Inter', shortName: 'Inter', score: 0 },
    status: 'UPCOMING', kickoff: '21:00', league: 'Serie A',
  },
];

function useShimmer() {
  const shimmerX = useSharedValue(-SCREEN_WIDTH);
  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(SCREEN_WIDTH, { duration: 1200, easing: Easing.linear }), -1, false
    );
  }, []);
  return shimmerX;
}

function SkeletonMatchCard({ shimmerX }: { shimmerX: ReturnType<typeof useSharedValue<number>> }) {
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  return (
    <View style={styles.skeletonCard}>
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 16 }]}>
        <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: 120, height: '100%' }}
          />
        </Animated.View>
      </Animated.View>
      <View style={styles.skeletonTopRow}>
        <View style={[styles.skeletonLine, { width: 60, height: 8 }]} />
        <View style={[styles.skeletonLine, { width: 40, height: 8 }]} />
      </View>
      <View style={styles.skeletonMiddle}>
        <View style={styles.skeletonCircle} />
        <View style={styles.skeletonScoreBlock}>
          <View style={[styles.skeletonLine, { width: 30, height: 40, borderRadius: 6 }]} />
          <View style={[styles.skeletonLine, { width: 20, height: 8 }]} />
          <View style={[styles.skeletonLine, { width: 30, height: 40, borderRadius: 6 }]} />
        </View>
        <View style={styles.skeletonCircle} />
      </View>
      <View style={[styles.skeletonLine, { width: '60%', height: 8, alignSelf: 'center' }]} />
    </View>
  );
}

function PulsingDot({ color = LIVE_RED }: { color?: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />
  );
}

function TeamAvatar({ name }: { name: string }) {
  return (
    <View style={styles.teamAvatar}>
      <Text style={styles.teamAvatarText}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function MatchCard({ match, index, onOpenHub }: { match: Match; index: number; onOpenHub: () => void }) {
  const [starred, setStarred] = useState(false);
  const { homeTeam, awayTeam, status, minute, stoppageTime, league, kickoff } = match;
  const isLive = status === 'LIVE' || status === '1ST' || status === '2ND' || status === 'HT';
  const isUpcoming = status === 'UPCOMING';
  const isStoppage = isLive && !!stoppageTime;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(14)}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onOpenHub}
        accessibilityRole="button"
        accessibilityLabel={`Open match hub: ${homeTeam.shortName} vs ${awayTeam.shortName}`}
        style={[styles.card, isLive && styles.cardLive, isStoppage && styles.cardStoppage]}
      >
        {isLive ? (
          <LinearGradient
            colors={isStoppage ? [LIVE_RED, LIVE_RED] : [PURPLE_PRIMARY, BLUE_PRIMARY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
        ) : (
          <View style={[styles.accentBar, {
            backgroundColor: isUpcoming ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)',
          }]} />
        )}

        <View style={styles.cardTop}>
          <Text style={styles.leagueText}>{league}</Text>
          {isLive ? (
            <View style={[styles.liveMinuteContainer, styles.liveMinuteBorder]}>
              <Text style={[styles.minuteText, isStoppage && { color: LIVE_RED }]}>
                {minute}{!stoppageTime && "'"}
                {stoppageTime ? <Text style={styles.stoppageInline}> +{stoppageTime}</Text> : null}
              </Text>
              <PulsingDot color={LIVE_RED} />
            </View>
          ) : status === 'FT' ? (
            <View style={styles.ftBadge}><Text style={styles.ftText}>FT</Text></View>
          ) : (
            <Text style={styles.kickoffText}>{kickoff}</Text>
          )}
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <TeamAvatar name={homeTeam.shortName} />
            <Text style={styles.teamName} numberOfLines={1}>{homeTeam.shortName}</Text>
          </View>
          <View style={styles.scoreArea}>
            {isUpcoming ? (
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.kickoffLarge}>{kickoff}</Text>
              </View>
            ) : (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNum}>{homeTeam.score}</Text>
                <View style={styles.scoreSep}>
                  <Text style={[styles.sepMinute, {
                    color: isLive ? (isStoppage ? LIVE_RED : PURPLE_SOFT) : 'rgba(255,255,255,0.2)',
                  }]}>
                    {isLive ? (stoppageTime ? `+${stoppageTime}` : minute) : '–'}
                  </Text>
                  {isLive && (
                    <LinearGradient
                      colors={isStoppage ? [LIVE_RED, LIVE_RED] : [PURPLE_PRIMARY, BLUE_PRIMARY]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.liveBar}
                    />
                  )}
                </View>
                <Text style={styles.scoreNum}>{awayTeam.score}</Text>
              </View>
            )}
          </View>
          <View style={styles.teamCol}>
            <TeamAvatar name={awayTeam.shortName} />
            <Text style={styles.teamName} numberOfLines={1}>{awayTeam.shortName}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <TouchableOpacity
            onPress={() => setStarred(s => !s)}
            activeOpacity={0.7}
            hitSlop={12}
            style={styles.watchlistBtn}
            accessibilityLabel={starred ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Star
              size={17}
              color={starred ? GOLD_PRIMARY : 'rgba(255,255,255,0.28)'}
              fill={starred ? GOLD_PRIMARY : 'transparent'}
              strokeWidth={starred ? 0 : 2}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyMatchCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyCardGlow} />
      <View style={styles.emptyRingOuter} />
      <View style={styles.emptyRingMiddle} />
      <View style={styles.emptyRingInner}>
        <Text style={styles.emptyCardDash}>—</Text>
      </View>
      <Text style={styles.emptyCardTitle}>No matches right now</Text>
      <Text style={styles.emptyCardSub}>Pull down to refresh</Text>
      <View style={styles.emptyChip}>
        <Text style={styles.emptyChipText}>Swipe for more fixtures</Text>
      </View>
    </View>
  );
}

function EmptySection() {
  return (
    <View style={styles.emptySection}>
      <View style={styles.emptySectionGlow} />
      <View style={styles.emptySectionIconWrap}>
        <View style={styles.emptySectionRing2} />
        <View style={styles.emptySectionRing1} />
        <View style={styles.emptySectionIconBox}>
          <Text style={styles.emptySectionGlyph}>Cal</Text>
        </View>
      </View>
      <Text style={styles.emptySectionTitle}>No matches</Text>
      <Text style={styles.emptySectionSub}>Nothing scheduled{'\n'}Pull down to refresh</Text>
      <View style={styles.emptySectionDivider} />
      <View style={styles.emptySectionChip}>
        <Text style={styles.emptySectionChipText}>Pull to refresh</Text>
      </View>
    </View>
  );
}

interface MatchListProps {
  isLoading?: boolean;
}

export function MatchList({ isLoading = false }: MatchListProps) {
  const router = useRouter();
  const hasMatches = matches.length > 0;
  const shimmerX = useShimmer();
  const openMatchesHub = () => router.push('/matches' as any);

  return (
    <View style={styles.section}>
      <SectionHeader
        subtitle="Live & fixtures"
        title="Important matches"
        action="View all"
        onAction={openMatchesHub}
      />
      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          <SkeletonMatchCard shimmerX={shimmerX} />
          <SkeletonMatchCard shimmerX={shimmerX} />
        </ScrollView>
      ) : hasMatches ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={300 + 12}
          snapToAlignment="start"
          removeClippedSubviews
        >
          {matches.map((m, i) => (
            <MatchCard key={m.id} match={m} index={i} onOpenHub={openMatchesHub} />
          ))}
          <EmptyMatchCard />
        </ScrollView>
      ) : (
        <EmptySection />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 0 },
  scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 4, gap: 12 },

  skeletonCard: {
    width: 300, height: 160, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0, overflow: 'hidden', padding: 14, gap: 12, justifyContent: 'space-between',
  },
  shimmerStrip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  skeletonLine: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
  skeletonTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonMiddle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  skeletonCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  skeletonScoreBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  card: {
    width: 300, borderRadius: 16,
    backgroundColor: 'rgba(18,12,28,0.98)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', flexShrink: 0,
    shadowColor: '#fff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 0,
  },
  cardLive: {
    shadowColor: PURPLE_PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8, borderColor: 'rgba(124,58,237,0.2)',
  },
  cardStoppage: {
    shadowColor: LIVE_RED, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, borderColor: 'rgba(239,68,68,0.25)',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },

  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  leagueText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  liveMinuteContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveMinuteBorder: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.06)',
  },
  minuteText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '700' },
  stoppageInline: { color: LIVE_RED, fontSize: 11, fontWeight: '900' },
  ftBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  ftText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  kickoffText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '600' },

  teamsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  teamAvatarText: { color: PURPLE_SOFT, fontSize: 13, fontWeight: '800' },
  teamName: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '600', textAlign: 'center', maxWidth: 90 },

  scoreArea: { alignItems: 'center', justifyContent: 'center', minWidth: 110 },
  vsContainer: { alignItems: 'center', gap: 4 },
  vsText: { color: 'rgba(255,255,255,0.25)', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  kickoffLarge: { color: PURPLE_SOFT, fontSize: 13, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreNum: {
    color: TEXT_PRIMARY, fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 42,
    textShadowColor: 'rgba(255,255,255,0.15)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  scoreSep: { alignItems: 'center', gap: 4 },
  sepMinute: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  liveBar: { width: 28, height: 2, borderRadius: 1 },

  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  watchlistBtn: { padding: 4 },

  emptyCard: {
    width: 300, height: 160, borderRadius: 16,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', borderStyle: 'dashed',
    backgroundColor: 'rgba(10,7,18,0.95)', flexShrink: 0, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20,
  },
  emptyCardGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(59,130,246,0.08)' },
  emptyRingOuter: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', borderStyle: 'dashed' },
  emptyRingMiddle: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.15)' },
  emptyRingInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  emptyCardDash: { fontSize: 18, color: 'rgba(167,139,250,0.45)', fontWeight: '300' },
  emptyCardTitle: { color: 'rgba(167,139,250,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  emptyCardSub: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  emptyChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.3)' },
  emptyChipText: { color: 'rgba(96,165,250,0.7)', fontSize: 11, fontWeight: '600' },

  emptySection: {
    marginHorizontal: SCREEN_PADDING_H, paddingVertical: 44, paddingHorizontal: 24,
    alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(10,7,18,0.95)',
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', borderStyle: 'dashed', overflow: 'hidden', gap: 6,
  },
  emptySectionGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(76,29,149,0.12)', top: -60 },
  emptySectionIconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptySectionRing2: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.15)', borderStyle: 'dashed' },
  emptySectionRing1: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)' },
  emptySectionIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  emptySectionGlyph: { fontSize: 11, fontWeight: '800', color: 'rgba(167,139,250,0.55)', letterSpacing: 1.2 },
  emptySectionTitle: { color: 'rgba(167,139,250,0.8)', fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginTop: 2 },
  emptySectionSub: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptySectionDivider: { width: 40, height: 0.5, backgroundColor: 'rgba(124,58,237,0.25)', marginVertical: 10 },
  emptySectionChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)' },
  emptySectionChipText: { color: 'rgba(167,139,250,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
