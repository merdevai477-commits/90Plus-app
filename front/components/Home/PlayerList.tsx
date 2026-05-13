import React, { useCallback, useEffect, useState } from 'react';
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
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import Svg, { Polygon } from 'react-native-svg';
import { User } from 'lucide-react-native';
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

// ─── Empty Section — 4 ordered image cards (matches VideoList style) ────────
// Image-led variant: the card is pure canvas for the artwork, no border/tint.
// Cards are rendered in ranking order 1st → 2nd → 3rd → 4th.
// Shared between the fully-empty state and the "partial fill" state where a
// ─── Empty Section — 7 ordered image cards (Player of the week podium) ─────
// Each card is the "ranked slot" artwork. When a real player fills a slot
// we overlay their avatar (in the center ring), country flag (top-left square),
// position (top-right hexagon), and name (bottom) on top of the same artwork.
// When the slot is vacant, the artwork keeps its built-in "Waiting for you!" copy.
const PODIUM_IMAGES = [
  require('../../assets/images/1st.png'),
  require('../../assets/images/2st.png'),
  require('../../assets/images/3st.png'),
  require('../../assets/images/4st.png'),
  require('../../assets/images/5st.png'),
  require('../../assets/images/6st.png'),
  require('../../assets/images/7st.png'),
] as const;

/** Total fixed slots always rendered in the podium row. */
const PODIUM_SLOTS = PODIUM_IMAGES.length;

/** Rank-themed color used for the position hex + accent ring. */
const RANK_ACCENT_COLORS = [
  '#F5C518', // 1st — gold
  '#C0C0C0', // 2nd — silver
  '#CD7F32', // 3rd — bronze
  '#A78BFA', // 4th — purple soft
  '#60A5FA', // 5th — electric blue
  '#34D399', // 6th — mint
  '#F472B6', // 7th — pink
] as const;

interface EmptyPodiumSpec {
  key: string;
  image: import('react-native').ImageSourcePropType;
}

function EmptyPodiumCard({
  spec,
  player,
  rank,
  onPress,
  accessibilityLabel,
}: {
  spec: EmptyPodiumSpec;
  player?: PlayerRow | null;
  rank: number;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const accent = RANK_ACCENT_COLORS[rank - 1] ?? RANK_ACCENT_COLORS[0];
  const occupied = Boolean(player);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.emptyPodiumCard}
    >
      <Image
        source={spec.image}
        resizeMode="cover"
        style={styles.emptyPodiumImage}
      />

      {occupied && player ? (
        <>
          {/* Top-left country flag (reserved square on the artwork) */}
          {player.country ? (
            <View style={styles.podiumFlagSlot}>
              <Text style={styles.podiumFlagText}>{player.country}</Text>
            </View>
          ) : null}

          {/* Top-right hexagon — player position */}
          <View style={styles.podiumPositionHexWrap}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              style={StyleSheet.absoluteFill}
            >
              {/* Regular hexagon centered in the viewBox */}
              <Polygon
                points="50,4 92,27 92,73 50,96 8,73 8,27"
                fill="rgba(5,1,13,0.82)"
                stroke={accent}
                strokeWidth="4"
              />
            </Svg>
            <Text
              style={[styles.podiumPositionText, { color: accent }]}
              numberOfLines={1}
            >
              {player.position}
            </Text>
          </View>

          {/* Center circle — player avatar (no colored ring around it) */}
          <View style={styles.podiumAvatarWrap} pointerEvents="none">
            {player.photoUri ? (
              <Image
                source={{ uri: player.photoUri }}
                style={styles.podiumAvatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.podiumAvatar, styles.podiumAvatarFallback]}>
                <Text style={styles.podiumAvatarInitials}>
                  {(player.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name bar covering the built-in "Waiting for you!" copy.
              Uses LiquidGlass on iOS 26+ and falls back to a BlurView
              elsewhere, giving the pill a true transparent-glass look. */}
          {(() => {
            const NameWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
            const nameWrapperProps = isLiquidGlassSupported
              ? ({ effect: 'clear' as const, interactive: false } as const)
              : ({ intensity: 28, tint: 'dark' as const } as const);
            return (
              <NameWrapper
                {...(nameWrapperProps as any)}
                style={styles.podiumNameSlot}
                pointerEvents="none"
              >
                <Text
                  style={[styles.podiumName, { color: accent }]}
                  numberOfLines={1}
                >
                  {player.name}
                </Text>
              </NameWrapper>
            );
          })()}
        </>
      ) : null}
    </TouchableOpacity>
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
  // Never fall back to hardcoded mock data — use empty array so the
  // race-condition guard below works correctly.
  const data = playersProp ?? [];
  const shimmerX = useShimmer();
  const openRankHub = useCallback(
    () => (onViewAllPress ? onViewAllPress() : router.push('/rank')),
    [onViewAllPress, router],
  );

  // Skeleton only while first-time loading with no cached data.
  // Otherwise always render the 7-slot podium row (real players fill first,
  // remaining slots stay as "Waiting for you!" artwork).
  const showSkeleton = isLoading && data.length === 0;

  return (
    <View style={styles.section}>
      <SectionHeader
        subtitle="Ratings hub"
        title="Player of the week"
        action="View all"
        onAction={openRankHub}
      />
      {showSkeleton ? (
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
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews
        >
          {PODIUM_IMAGES.map((image, i) => {
            const rank = i + 1;
            const player = data[i] ?? null;
            return (
              <EmptyPodiumCard
                key={`rank-${rank}`}
                spec={{ key: `rank-${rank}`, image }}
                player={player}
                rank={rank}
                onPress={
                  player
                    ? () =>
                        onPlayerPress
                          ? onPlayerPress(player)
                          : openRankHub()
                    : openRankHub
                }
                accessibilityLabel={
                  player
                    ? `Rank ${rank}: ${player.name}`
                    : `Rank ${rank} slot — waiting`
                }
              />
            );
          })}
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

  // ── Empty Section — 7 ordered image cards (image-led, same as VideoList) ──
  emptyPodiumCard: {
    width: 155,
    // Force all cards to the same aspect ratio (3:4 = 0.75) matching the
    // 1st/2nd/3rd artwork. Cards 4–7 have a slightly taller source image
    // (0.667) but cover + fixed aspect clips them to the same visual size.
    aspectRatio: 0.75,
    borderRadius: 18,
    backgroundColor: 'transparent',
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyPodiumImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },

  // ── Podium slot overlays (active when the slot is occupied) ──────────────
  // Positions/sizes are translated from a 320×500 design reference down to
  // the actual 155×220 card dimensions.
  //   Scale X = 155/320 = 0.484
  //   Scale Y = 220/500 = 0.440
  podiumFlagSlot: {
    position: 'absolute',
    top:8,
    left:1,       // 20 × 0.484
    width: 49,      // 40 × 0.484 → 19, bumped for readability
    height: 20,     // 28 × 0.44  → 12, bumped for readability
    borderRadius: 1,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumFlagText: {
    fontSize: 16,
    lineHeight: 15,
  },
  // Hexagon badge — drawn as an SVG polygon inside a square viewport.
  podiumPositionHexWrap: {
    position: 'absolute',
    top: 13, // 20 × 0.44
    right:11,     // 20 × 0.484
    width: 25,      // 60 × 0.484
    height: 20,     // 60 × 0.44  → 26, bumped to 30 so hex reads cleanly
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumPositionText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  // Avatar — no colored ring, just a plain circular mask.
  podiumAvatarWrap: {
    position: 'absolute',
    top: 28,        // 80 × 0.44
    left: 1,
    right: 0,
    alignItems: 'center',
  },
  podiumAvatar: {
    width: 58,      // (90 × 2) × 0.484 ≈ 87; tightened to 78 so it fits
    height: 68,     // within the ring slot cleanly on 155×220
    borderRadius: 39,
    backgroundColor: 'rgba(5,1,13,0.6)',
  },
  podiumAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarInitials: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  // Name bar — hides the baked-in "Waiting for you!" copy.
  // Background is transparent because LiquidGlass / BlurView provides the tint.
  podiumNameSlot: {
    position: 'absolute',
    bottom: 18,     // 100 × 0.44
    left: 8,
    right: 8,
    height: 25,     // 50  × 0.44
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(54, 5, 95,00)',
    overflow: 'hidden',
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    // Subtle shadow keeps the colored text readable over the glass blur
    // regardless of the artwork behind it.
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
