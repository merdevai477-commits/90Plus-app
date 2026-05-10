import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Heart, Film } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useSharedValue, withRepeat, withTiming, useAnimatedStyle,
  Easing, withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import { PURPLE_SOFT, SCREEN_PADDING_H } from '../../constants/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const videos = [
  {
    id: 1,
    title: 'Night games under the floodlights',
    views: '2.4M',
    likes: '145K',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=78',
  },
  {
    id: 2,
    title: 'Grass-level matchday ambience',
    views: '1.8M',
    likes: '98K',
    thumbnail: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=78',
  },
  {
    id: 4,
    title: 'Stadium build-up on kickoff weekend',
    views: '3.1M',
    likes: '210K',
    thumbnail: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=800&q=78',
  },
  {
    id: 5,
    title: 'Training-ground rhythms',
    views: '1.2M',
    likes: '86K',
    thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647059886c4?auto=format&fit=crop&w=800&q=78',
  },
];

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

// ─── Skeleton Video Card ──────────────────────────────────────────────────────
function SkeletonVideoCard({ shimmerX }: { shimmerX: ReturnType<typeof useSharedValue<number>> }) {
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  return (
    <View style={styles.skeletonCard}>
      {/* Thumbnail shimmer */}
      <View style={styles.skeletonThumb}>
        <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 12 }]}>
          <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ width: 80, height: '100%' }}
            />
          </Animated.View>
        </Animated.View>
      </View>
      {/* Text lines */}
      <View style={{ gap: 4, marginTop: 6 }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 8 }]} />
        <View style={[styles.skeletonLine, { width: '70%', height: 8 }]} />
      </View>
    </View>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({ video, index, onOpen }: { video: VideoListItem; index: number; onOpen?: () => void }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (onOpen) { onOpen(); } else { router.push('/reels'); }
    scale.value = withSpring(0.95, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 15 });
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(14)}
      style={[styles.card, animStyle]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <View style={styles.thumbnail}>
          <Image source={{ uri: video.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={[StyleSheet.absoluteFill, { top: '40%' }]} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={[StyleSheet.absoluteFill, { bottom: '70%' }]} />

          {/* Play button — blue+purple gradient border */}
          <View style={styles.playBtnOuter}>
            <LinearGradient
              colors={['rgba(59,130,246,0.5)', 'rgba(124,58,237,0.5)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.playBtnGradientBorder}
            >
              <View style={styles.playBtnInner}>
                <Play size={12} color="#fff" fill="#fff" />
              </View>
            </LinearGradient>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statsLeft}>
              <Play size={8} color="rgba(255,255,255,0.75)" fill="rgba(255,255,255,0.75)" />
              <Text style={styles.statText}>{video.views}</Text>
            </View>
            <TouchableOpacity onPress={() => setLiked(l => !l)} activeOpacity={0.7} style={styles.likeBtn}>
              <Heart size={9} color={liked ? PURPLE_SOFT : 'rgba(255,255,255,0.72)'} fill={liked ? PURPLE_SOFT : 'none'} />
              <Text style={[styles.statText, liked && { color: PURPLE_SOFT }]}>{video.likes}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={2}>
        {video.title}
      </Text>
    </Animated.View>
  );
}

// ─── Empty Video Card — premium ───────────────────────────────────────────────
function EmptyVideoCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyCardGlow} />
      {/* 3 rings */}
      <View style={styles.emptyRingOuter} />
      <View style={styles.emptyRingMiddle} />
      <View style={styles.emptyRingInner}>
        <Film size={18} color="rgba(167,139,250,0.45)" strokeWidth={2} />
      </View>
      <Text style={styles.emptyCardTitle}>No clip</Text>
      <Text style={styles.emptyCardSub}>Soon</Text>
    </View>
  );
}

// ─── Empty Section ────────────────────────────────────────────────────────────
function EmptySection() {
  return (
    <View style={styles.emptySection}>
      <View style={styles.emptySectionGlow} />
      <View style={styles.emptySectionIconWrap}>
        <View style={styles.emptySectionRing2} />
        <View style={styles.emptySectionRing1} />
        <View style={styles.emptySectionIconBox}>
          <Film size={22} color="rgba(167,139,250,0.55)" strokeWidth={2} />
        </View>
      </View>
      <Text style={styles.emptySectionTitle}>No reels yet</Text>
      <Text style={styles.emptySectionSub}>Nothing published{'\n'}Check back soon</Text>
      <View style={styles.emptySectionDivider} />
      <View style={styles.emptySectionChip}>
        <Text style={styles.emptySectionChipText}>Enable notifications for new drops</Text>
      </View>
    </View>
  );
}

// ─── Video List ───────────────────────────────────────────────────────────────
export interface VideoListItem {
  id: number | string;
  title: string;
  views: string;
  likes: string;
  thumbnail: string;
}

interface VideoListProps {
  isLoading?: boolean;
  videos?: VideoListItem[];
  onVideoPress?: (videoId: string) => void;
  onViewAllPress?: () => void;
}

export function VideoList({ isLoading = false, videos: videosProp, onVideoPress, onViewAllPress }: VideoListProps) {
  const router = useRouter();
  const data = videosProp ?? videos;
  const hasVideos = data.length > 0;
  const shimmerX = useShimmer();
  const openReelsHub = () => (onViewAllPress ? onViewAllPress() : router.push('/reels'));

  return (
    <View style={styles.section}>
      <SectionHeader
        subtitle="Curated clips"
        title="Trending reels"
        action="View all"
        onAction={openReelsHub}
      />
      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          <SkeletonVideoCard shimmerX={shimmerX} />
          <SkeletonVideoCard shimmerX={shimmerX} />
          <SkeletonVideoCard shimmerX={shimmerX} />
        </ScrollView>
      ) : hasVideos ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews
        >
          {data.map((v, i) => <VideoCard key={String(v.id)} video={v} index={i} onOpen={() => onVideoPress?.(String(v.id))} />)}
          <EmptyVideoCard />
        </ScrollView>
      ) : (
        <EmptySection />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  section: { marginBottom: 0 },
  scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 4, gap: 12 },

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonCard: { width: 155, flexShrink: 0 },
  skeletonThumb: {
    width: 155, height: 104, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  shimmerStrip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  skeletonLine: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },

  // ── Video Card ────────────────────────────────────────────────────────────
  card: { width: 155, flexShrink: 0 },
  thumbnail: {
    width: 155, height: 104,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
    // Inset highlight — lifts the card visually
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
  },

  // Play button with gradient border
  playBtnOuter: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -18, marginLeft: -18,
    width: 36, height: 36, borderRadius: 18,
  },
  playBtnGradientBorder: {
    width: 36, height: 36, borderRadius: 18,
    padding: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnInner: {
    flex: 1, width: '100%', borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow: {
    position: 'absolute', bottom: 6, left: 7, right: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statsLeft: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: 'rgba(255,255,255,0.82)', fontSize: 9, fontWeight: '700' },
  title: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
    lineHeight: 15,
    letterSpacing: -0.1,
  },

  // ── Empty Video Card ──────────────────────────────────────────────────────
  emptyCard: {
    width: 155, height: 104,
    borderRadius: 12,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(10,7,18,0.95)',
    flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    gap: 5, overflow: 'hidden',
  },
  emptyCardGlow: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  emptyRingOuter: {
    position: 'absolute', width: 64, height: 64, borderRadius: 32,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', borderStyle: 'dashed',
  },
  emptyRingMiddle: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.12)',
  },
  emptyRingInner: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyCardTitle: { color: 'rgba(167,139,250,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  emptyCardSub: { color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '500' },

  // ── Empty Section ─────────────────────────────────────────────────────────
  emptySection: {
    marginHorizontal: SCREEN_PADDING_H, paddingVertical: 44, paddingHorizontal: 24,
    alignItems: 'center', borderRadius: 20,
    backgroundColor: 'rgba(10,7,18,0.95)',
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)',
    borderStyle: 'dashed', overflow: 'hidden', gap: 6,
  },
  emptySectionGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(76,29,149,0.12)', top: -50,
  },
  emptySectionIconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptySectionRing2: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.15)', borderStyle: 'dashed',
  },
  emptySectionRing1: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)',
  },
  emptySectionIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptySectionTitle: { color: 'rgba(167,139,250,0.8)', fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginTop: 2 },
  emptySectionSub: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptySectionDivider: { width: 40, height: 0.5, backgroundColor: 'rgba(124,58,237,0.25)', marginVertical: 10 },
  emptySectionChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)',
  },
  emptySectionChipText: { color: 'rgba(167,139,250,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
