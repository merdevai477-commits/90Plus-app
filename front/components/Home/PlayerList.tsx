import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  type ImageErrorEventData,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Award } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import {
  GOLD_PRIMARY,
  SCREEN_PADDING_H,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../constants/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PlayerRow = {
  id: number;
  name: string;
  team: string;
  country: string;
  position: string;
  positionColor: string;
  weeklyRating: string;
  overallRating: string;
  borderColor: string;
  /** Portrait crop — stock athletic shots for roster-style cards */
  photoUri: string;
};

const players: PlayerRow[] = [
  {
    id: 1,
    name: 'Haaland',
    team: 'Man City',
    country: 'NOR',
    position: 'ST',
    positionColor: '#FF7A3D',
    weeklyRating: '9.12',
    overallRating: '9.40',
    borderColor: '#FF7A3D',
    photoUri:
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=400&h=520&q=80',
  },
  {
    id: 2,
    name: 'Mbappé',
    team: 'Real Madrid',
    country: 'FRA',
    position: 'LW',
    positionColor: '#11998E',
    weeklyRating: '8.81',
    overallRating: '9.10',
    borderColor: '#11998E',
    photoUri:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=400&h=520&q=80',
  },
  {
    id: 4,
    name: 'De Bruyne',
    team: 'Man City',
    country: 'BEL',
    position: 'CM',
    positionColor: '#8E54E9',
    weeklyRating: '7.01',
    overallRating: '9.10',
    borderColor: '#8E54E9',
    photoUri:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&h=520&q=80',
  },
  {
    id: 5,
    name: 'Saka',
    team: 'Arsenal',
    country: 'ENG',
    position: 'RW',
    positionColor: '#F5576C',
    weeklyRating: '7.81',
    overallRating: '8.70',
    borderColor: '#F5576C',
    photoUri:
      'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=400&h=520&q=80',
  },
  {
    id: 6,
    name: 'Pedri',
    team: 'Barcelona',
    country: 'ESP',
    position: 'CM',
    positionColor: '#11998E',
    weeklyRating: '7.54',
    overallRating: '8.80',
    borderColor: '#11998E',
    photoUri:
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=400&h=520&q=80',
  },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[parts.length - 1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Shared shimmer ───────────────────────────────────────────────────────────
function useShimmer() {
  const shimmerX = useSharedValue(-SCREEN_WIDTH);
  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(SCREEN_WIDTH, { duration: 1200, easing: Easing.linear }), -1, false
    );
  }, []);
  return shimmerX;
}

// ─── Skeleton Player Card ─────────────────────────────────────────────────────
function SkeletonPlayerCard({ shimmerX }: { shimmerX: ReturnType<typeof useSharedValue<number>> }) {
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  return (
    <View style={styles.skeletonCard}>
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 18 }]}>
        <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: 80, height: '100%' }}
          />
        </Animated.View>
      </Animated.View>
      <View style={styles.skeletonTopRow}>
        <View style={[styles.skeletonLine, { flex: 1, height: 28, borderRadius: 8 }]} />
      </View>
      <View style={styles.skeletonPhoto} />
      <View style={{ gap: 5, alignItems: 'stretch', width: '100%', paddingTop: 8 }}>
        <View style={[styles.skeletonLine, { width: '75%', height: 9, alignSelf: 'center' }]} />
        <View style={[styles.skeletonLine, { width: '55%', height: 7, alignSelf: 'center' }]} />
        <View style={[styles.skeletonLine, { width: 36, height: 18, borderRadius: 6, alignSelf: 'center', marginTop: 4 }]} />
      </View>
    </View>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, onOpenRank }: { player: PlayerRow; onOpenRank: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);

  const onImageError = (_e: NativeSyntheticEvent<ImageErrorEventData>) => {
    setPhotoFailed(true);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={onOpenRank}
      accessibilityRole="button"
      accessibilityLabel={`Open rankings: ${player.name}`}
    >
      <View style={[styles.statsBar, { borderColor: `${player.borderColor}33` }]}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Week</Text>
          <Text style={[styles.statValue, { color: player.borderColor }]}>{player.weeklyRating}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Season</Text>
          <Text style={[styles.statValue, { color: GOLD_PRIMARY }]}>{player.overallRating}</Text>
        </View>
      </View>

      <View style={styles.photoShell}>
        {!photoFailed ? (
          <>
            <Image
              source={{ uri: player.photoUri }}
              style={styles.photo}
              resizeMode="cover"
              onError={onImageError}
            />
            <LinearGradient
              colors={['transparent', 'rgba(6,5,14,0.25)', 'rgba(6,5,14,0.92)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.photoAccent, { backgroundColor: player.borderColor }]} />
          </>
        ) : (
          <View style={[styles.photoFallback, { borderColor: `${player.borderColor}44` }]}>
            <LinearGradient
              colors={[`${player.borderColor}22`, 'rgba(255,255,255,0.04)']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.photoFallbackInitials, { color: player.borderColor }]}>
              {initialsFromName(player.name)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.teamRow}>
          <Text style={[styles.countryPlain, { color: player.borderColor }]}>{player.country}</Text>
          <Text style={styles.teamDot}>·</Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {player.team}
          </Text>
        </View>
        <View style={[styles.positionBadge, { backgroundColor: `${player.positionColor}18`, borderColor: `${player.positionColor}44` }]}>
          <Text style={[styles.positionText, { color: player.positionColor }]}>{player.position}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty Player Card — premium (3 shown when no data) ──────────────────────
function EmptyPlayerCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.statsBarMuted}>
        <View style={[styles.statCell, { opacity: 0.45 }]}>
          <Text style={styles.statLabel}>Week</Text>
          <Text style={[styles.statValue, { color: TEXT_MUTED }]}>—</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <View style={[styles.statCell, { opacity: 0.45 }]}>
          <Text style={styles.statLabel}>Season</Text>
          <Text style={[styles.statValue, { color: TEXT_MUTED }]}>—</Text>
        </View>
      </View>
      <View style={styles.emptyPhotoShell}>
        <User size={28} color="rgba(167,139,250,0.28)" strokeWidth={2} />
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.emptyCardName}>—</Text>
        <Text style={styles.emptyCardTeam} numberOfLines={1}>Slot open</Text>
        <View style={styles.emptyPositionBadge}>
          <Text style={styles.emptyPositionText}>?</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Empty Section — premium 3-ring pattern ──────────────────────────────────
function EmptySection() {
  return (
    <View style={styles.emptySection}>
      <View style={styles.emptySectionGlow} />
      <View style={styles.emptySectionIconWrap}>
        <View style={styles.emptySectionRing2} />
        <View style={styles.emptySectionRing1} />
        <View style={styles.emptySectionIconBox}>
          <Award size={22} color="rgba(167,139,250,0.55)" strokeWidth={2} />
        </View>
      </View>
      <Text style={styles.emptySectionTitle}>No players ranked this week</Text>
      <Text style={styles.emptySectionSub}>Rankings refresh every Monday</Text>
      <View style={styles.emptySectionDivider} />
      <View style={styles.emptySectionChip}>
        <Text style={styles.emptySectionChipText}>Ratings refresh every Monday</Text>
      </View>
    </View>
  );
}

// ─── Player List ──────────────────────────────────────────────────────────────
export type PlayerListItem = PlayerRow;

interface PlayerListProps {
  isLoading?: boolean;
  players?: PlayerListItem[];
  onPlayerPress?: (player: PlayerListItem) => void;
  onViewAllPress?: () => void;
}

export function PlayerList({ isLoading = false, players: playersProp, onPlayerPress, onViewAllPress }: PlayerListProps) {
  const router = useRouter();
  const data = playersProp ?? players;
  const hasPlayers = data.length > 0;
  const shimmerX = useShimmer();
  const openRankHub = () => (onViewAllPress ? onViewAllPress() : router.push('/rank'));

  return (
    <View style={styles.section}>
      <SectionHeader
        subtitle="Ratings hub"
        title="Players of the week"
        action="View all"
        onAction={openRankHub}
      />
      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          <SkeletonPlayerCard shimmerX={shimmerX} />
          <SkeletonPlayerCard shimmerX={shimmerX} />
          <SkeletonPlayerCard shimmerX={shimmerX} />
        </ScrollView>
      ) : hasPlayers ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews
        >
          {data.map(p => (
            <PlayerCard key={p.id} player={p} onOpenRank={() => onPlayerPress ? onPlayerPress(p) : openRankHub()} />
          ))}
          {/* Empty slot */}
          <EmptyPlayerCard />
        </ScrollView>
      ) : (
        // Show 3 empty cards when API returns no players
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <EmptyPlayerCard />
          <EmptyPlayerCard />
          <EmptyPlayerCard />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
/** Portrait strip — fixed height so footer (name / country / badge) is never clipped */
const CARD_PHOTO_H = 108;

const styles = StyleSheet.create({
  section: { marginBottom: 0 },
  scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 10, gap: 14 },

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonCard: {
    width: 140,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
    padding: 8,
    overflow: 'hidden',
    gap: 0,
  },
  shimmerStrip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  skeletonLine: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
  skeletonTopRow: { flexDirection: 'row', width: '100%', marginBottom: 8, gap: 8 },
  skeletonPhoto: {
    width: '100%',
    height: CARD_PHOTO_H,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 2,
  },

  // ── Player Card ───────────────────────────────────────────────────────────
  card: {
    width: 140,
    borderRadius: 18,
    backgroundColor: 'rgba(12,10,22,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
    padding: 8,
    overflow: 'hidden',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  statsBarMuted: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,58,237,0.18)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  statCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth },
  statLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.38)',
    marginBottom: 2,
  },
  statValue: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  photoShell: {
    width: '100%',
    height: CARD_PHOTO_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  photo: { width: '100%', height: '100%' },
  photoAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoFallbackInitials: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  cardFooter: {
    paddingTop: 8,
    paddingBottom: 2,
    alignItems: 'center',
    gap: 4,
  },
  playerName: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    maxWidth: '100%',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
  countryPlain: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  teamDot: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700' },
  teamName: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  positionBadge: {
    marginTop: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  positionText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },

  // ── Empty Player Card ─────────────────────────────────────────────────────
  emptyCard: {
    width: 140,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,58,237,0.22)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(8,6,16,0.98)',
    flexShrink: 0,
    padding: 8,
  },
  emptyPhotoShell: {
    width: '100%',
    height: CARD_PHOTO_H,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,58,237,0.22)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(124,58,237,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardName: { color: 'rgba(255,255,255,0.22)', fontSize: 14, fontWeight: '800' },
  emptyCardTeam: { color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: '600' },
  emptyPositionBadge: {
    marginTop: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,58,237,0.22)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  emptyPositionText: { color: 'rgba(167,139,250,0.35)', fontSize: 9.5, fontWeight: '800' },

  // ── Empty Section — premium ───────────────────────────────────────────────
  emptySection: {
    marginHorizontal: SCREEN_PADDING_H, paddingVertical: 44, paddingHorizontal: 24,
    alignItems: 'center', borderRadius: 20,
    backgroundColor: 'rgba(10,7,18,0.95)',
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)',
    borderStyle: 'dashed', overflow: 'hidden', gap: 6,
  },
  emptySectionGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(76,29,149,0.12)', top: -60,
  },
  emptySectionIconWrap: {
    width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptySectionRing2: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.15)', borderStyle: 'dashed',
  },
  emptySectionRing1: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.15)',
  },
  emptySectionIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptySectionTitle: {
    color: 'rgba(167,139,250,0.8)', fontSize: 16, fontWeight: '700',
    letterSpacing: -0.2, marginTop: 2,
  },
  emptySectionSub: {
    color: 'rgba(255,255,255,0.25)', fontSize: 12,
    textAlign: 'center', lineHeight: 18,
  },
  emptySectionDivider: {
    width: 40, height: 0.5,
    backgroundColor: 'rgba(124,58,237,0.25)', marginVertical: 10,
  },
  emptySectionChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)',
  },
  emptySectionChipText: {
    color: 'rgba(167,139,250,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.3,
  },
});
