import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomNav from './BottomNav';
import CompCard from '../../components/rank/CompCard';
import LeaderboardModal from '../../components/rank/LeaderboardModal';
import PodiumCard from '../../components/rank/PodiumCard';
import ProfileCard from '../../components/rank/ProfileCard';
import RankHeader from '../../components/rank/RankHeader';
import SoonModal from '../../components/rank/SoonModal';
import WCCard from '../../components/rank/WCCard';
import { APP_BG } from '../../constants/ui';
import { useScreenFont } from '../../utils/fontSetup';

// ─── Colors ───────────────────────────────────────────────────────────────────
const ACCENT = '#A855F7';

// ─── Static Data ──────────────────────────────────────────────────────────────
const COMPETITIONS = [
  {
    id: '1',
    title: 'King of Predictions',
    sub: 'Predict matches and be the best!',
    actionText: 'Predict Now',
    img: require('../../assets/images/football.png'),
  },
  {
    id: '4',
    title: 'Engagement Hero',
    sub: 'Post your reels and lead the interaction charts!',
    actionText: 'Post Now',
    img: require('../../assets/images/growth.png'),
  },
  {
    id: '3',
    title: 'Daily Quiz',
    sub: 'Answer daily questions and win points!',
    actionText: 'Test Now',
    img: require('../../assets/images/daily-quiz.png'),
  },
  {
    id: '2',
    title: 'Share & Earn',
    sub: 'Share the app and climb the rankings!',
    actionText: 'Share Now',
    img: require('../../assets/images/share.png'),
  },
];

const PODIUM = [
  { rank: 2, name: 'Start Now!', xp: '-- XP', avatar: require('../../assets/images/plear 90Plus.png') },
  { rank: 1, name: 'Be the First!', xp: '-- XP', avatar: require('../../assets/images/plear 90Plus.png') },
  { rank: 3, name: 'Create Glory!', xp: '-- XP', avatar: require('../../assets/images/plear 90Plus.png') },
];

const LOWER = [
  { rank: 4, name: 'Empty Slot', role: 'Challenge to appear here', xp: '-- XP', avatar: 'https://i.pravatar.cc/150?u=4' },
  { rank: 5, name: 'Empty Slot', role: 'Challenge to appear here', xp: '-- XP', avatar: 'https://i.pravatar.cc/150?u=5' },
];

const TOP_11 = Array.from({ length: 11 }, (_, i) => ({
  rank: i + 1,
  name: i < 3 ? 'Future Champion' : `Player #${i + 1}`,
  xp: '-- XP',
  avatar: `https://i.pravatar.cc/150?u=${i + 1}`,
}));

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RankScreen() {
  useScreenFont();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSoonVisible, setIsSoonVisible] = useState(false);

  return (
    <View style={s.root}>
      {/* Floating Header */}
      <RankHeader topInset={insets.top} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: Math.max(insets.bottom, 16) + 88,
        }}
      >
        {/* ── Hero Block ── */}
        <View style={s.heroBlock}>
          <Image
            source={require('../../assets/images/90Plus world cup.png')}
            style={s.heroBgTrophy}
            resizeMode="contain"
          />
          <LinearGradient
            colors={['#030008', '#030008', 'rgba(3,0,8,0.0)', 'transparent']}
            style={s.heroBgGradLeft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,6,18,0.55)', '#0A0612']}
            style={s.heroBgGradBottom}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <View style={s.heroText}>
            <View style={s.titleRow}>
              <View style={s.trophyIconBox}>
                <Trophy size={20} color="#fff" fill="#fff" />
              </View>
              <Text style={s.pageTitle}>Competitions</Text>
            </View>
            <Text style={s.pageSub1}>Play. Compete. Win.</Text>
            <Text style={s.pageSub2}>Join challenges and climb the ranks!</Text>
          </View>

          <ProfileCard />
        </View>

        {/* ── All Competitions ── */}
        <View style={s.secHead}>
          <Text style={s.secTitle}>All Competitions</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.hScroll}
        >
          {COMPETITIONS.map(c => (
            <CompCard
              key={c.id}
              {...c}
              onPress={() => {
                if (c.id === '1') router.push({ pathname: '/matches', params: { filter: 'Predictions' } } as any);
                else if (c.id === '3') router.push('/quiz' as any);
              }}
            />
          ))}
        </ScrollView>

        {/* ── World Cup Countdown ── */}
        <WCCard onPressSoon={() => setIsSoonVisible(true)} />

        {/* ── Top Players & Leaderboard ── */}
        <View style={s.bottomContentGroup}>
          {/* Arena background */}
          <View style={s.arenaBgContainerExtended}>
            <Image
              source={require('../../assets/images/arena.png')}
              style={s.arenaImgExtended}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['#0A0612', 'transparent', '#0A0612']}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={s.secHead}>
            <Text style={s.secTitle}>Top Players</Text>
          </View>

          {/* Podium */}
          <View style={s.podiumRow}>
            {PODIUM.map(p => <PodiumCard key={p.rank} {...p} />)}
          </View>

          {/* Lower leaderboard rows */}
          <View style={s.board}>
            {LOWER.map((p, i) => {
              const RowWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
              const rowProps = isLiquidGlassSupported
                ? { effect: 'clear' as const, interactive: true }
                : { intensity: 15, tint: 'dark' as const };

              return (
                <RowWrapper
                  key={p.rank}
                  {...(rowProps as any)}
                  style={[s.boardRowGlass, i < LOWER.length - 1 && { marginBottom: 8 }]}
                >
                  <View style={s.rankBadgeSmall}>
                    <Text style={s.boardRank}>{p.rank}</Text>
                  </View>
                  <Image source={{ uri: p.avatar }} style={s.boardAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.boardName}>{p.name}</Text>
                    <Text style={s.boardRole}>{p.role}</Text>
                  </View>
                  <Text style={s.boardXp}>{p.xp}</Text>
                </RowWrapper>
              );
            })}
          </View>

          {/* View All button */}
          <TouchableOpacity
            style={s.viewAllLeaderboardBtn}
            onPress={() => setIsModalVisible(true)}
          >
            <LinearGradient
              colors={['rgba(168,85,247,0.2)', 'rgba(124,58,237,0.1)']}
              style={s.viewAllLeaderboardGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.viewAllLeaderboardTxt}>VIEW ALL</Text>
              <ChevronRight size={16} color={ACCENT} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modals ── */}
      <LeaderboardModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        entries={TOP_11}
        topInset={insets.top}
      />
      <SoonModal
        visible={isSoonVisible}
        onClose={() => setIsSoonVisible(false)}
      />

      <BottomNav />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },

  heroBlock: { overflow: 'hidden', paddingBottom: 20 },
  heroBgTrophy: {
    position: 'absolute', top: 0, right: 0,
    width: '90%', height: '100%', opacity: 0.95,
  },
  heroBgGradLeft: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: '62%',
  },
  heroBgGradBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
  },
  heroText: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, zIndex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  trophyIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(39, 8, 94, 0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  pageTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
  pageSub1: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  pageSub2: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },

  secHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 28, marginBottom: 14,
  },
  secTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  hScroll: { paddingLeft: 16, paddingRight: 8, gap: 12 },

  bottomContentGroup: {
    marginTop: 10, paddingTop: 40, position: 'relative', paddingBottom: 20, overflow: 'hidden',
  },
  arenaBgContainerExtended: {
    position: 'absolute', top: -100, left: '0%', right: '0%', bottom: -110, zIndex: -1,
  },
  arenaImgExtended: { width: '120%', height: '115%', top: -200, opacity: 0.5 },

  podiumRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    marginTop: 10, marginBottom: 20, gap: -15,
  },

  board: { paddingHorizontal: 16, marginTop: 10 },
  boardRowGlass: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(241, 241, 241, 0)', gap: 12,
  },
  rankBadgeSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(168, 85, 247, 0.2)', justifyContent: 'center', alignItems: 'center',
  },
  boardRank: { color: '#888', fontSize: 16, fontWeight: '700', width: 24, textAlign: 'center' },
  boardAvatar: { width: 44, height: 44, borderRadius: 22 },
  boardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  boardRole: { color: '#555', fontSize: 12, marginTop: 2 },
  boardXp: { color: ACCENT, fontWeight: '800', fontSize: 14 },

  viewAllLeaderboardBtn: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  viewAllLeaderboardGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
  },
  viewAllLeaderboardTxt: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
