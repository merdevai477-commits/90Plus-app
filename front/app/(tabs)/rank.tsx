/**
 * Rank tab screen
 *
 * Aggregates the Rank features:
 * - profile strip (real user data via ProfileCard)
 * - competitions carousel
 * - World Cup countdown banner
 * - Top Players podium + lower leaderboard from `/api/reels/rankings/top-players`
 * - full Top-11 leaderboard modal
 *
 * When the API returns fewer than 11 ranked players, we pad each rank with a
 * styled "empty slot" placeholder so the layout stays stable and the
 * invariant "no fake/external avatars in the UI" is preserved.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  I18nManager,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomNav from './BottomNav';
import CompCard from '../../components/rank/CompCard';
import LeaderboardModal, {
  LeaderboardEntry,
} from '../../components/rank/LeaderboardModal';
import PodiumCard from '../../components/rank/PodiumCard';
import ProfileCard from '../../components/rank/ProfileCard';
import RankHeader from '../../components/rank/RankHeader';
import { BoardRowSkeleton, PodiumSkeleton } from '../../components/rank/RankSkeletons';
import SoonModal from '../../components/rank/SoonModal';
import WCCard from '../../components/rank/WCCard';
import { APP_BG } from '../../constants/ui';
import { useTopPlayers, type TopPlayer } from '../../hooks/useTopPlayers';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';

const ACCENT = '#A855F7';
const PROFILE_PLACEHOLDER: ImageSourcePropType = require('../../assets/images/plear 90Plus.png');

interface PodiumSlot {
  rank: number;
  isPlaceholder: boolean;
  name: string;
  xpLabel: string;
  avatar: ImageSourcePropType | string;
  countryFlag: string | null;
  position?: string;
}

interface BoardSlot {
  rank: number;
  isPlaceholder: boolean;
  id: string;
  name: string;
  role: string;
  xpLabel: string;
  avatar: string | null;
}

function buildPodiumSlot(
  rank: number,
  player: TopPlayer | undefined,
  emptyName: string,
  xpSuffix: string,
): PodiumSlot {
  if (player) {
    return {
      rank,
      isPlaceholder: false,
      name: (player.displayName ?? player.username) || emptyName,
      xpLabel: `${player.xp ?? 0} ${xpSuffix}`,
      avatar: player.avatar ?? PROFILE_PLACEHOLDER,
      countryFlag: player.countryFlag ?? null,
      position: player.position,
    };
  }
  return {
    rank,
    isPlaceholder: true,
    name: emptyName,
    xpLabel: `0 ${xpSuffix}`,
    avatar: PROFILE_PLACEHOLDER,
    countryFlag: null,
  };
}

function buildBoardSlot(
  rank: number,
  player: TopPlayer | undefined,
  emptyName: string,
  emptyHint: string,
  xpSuffix: string,
): BoardSlot {
  if (player) {
    return {
      rank,
      isPlaceholder: false,
      id: player.id,
      name: (player.displayName ?? player.username) || emptyName,
      role: player.position || emptyHint,
      xpLabel: `${player.xp ?? 0} ${xpSuffix}`,
      avatar: player.avatar,
    };
  }
  return {
    rank,
    isPlaceholder: true,
    id: `empty-${rank}`,
    name: emptyName,
    role: emptyHint,
    xpLabel: `0 ${xpSuffix}`,
    avatar: null,
  };
}

export default function RankScreen() {
  useScreenFont();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSoonVisible, setIsSoonVisible] = useState(false);

  const { players, isLoading, isError } = useTopPlayers({
    limit: 11,
    period: 'weekly',
  });

  const competitions = useMemo(
    () => [
      {
        id: '1',
        title: t.rank.competitionNames.kingOfPredictions.title,
        sub: t.rank.competitionNames.kingOfPredictions.sub,
        actionText: t.rank.competitionNames.kingOfPredictions.action,
        img: require('../../assets/images/football.png') as ImageSourcePropType,
      },
      {
        id: '4',
        title: t.rank.competitionNames.engagementHero.title,
        sub: t.rank.competitionNames.engagementHero.sub,
        actionText: t.rank.competitionNames.engagementHero.action,
        img: require('../../assets/images/growth.png') as ImageSourcePropType,
      },
      {
        id: '3',
        title: t.rank.competitionNames.dailyQuiz.title,
        sub: t.rank.competitionNames.dailyQuiz.sub,
        actionText: t.rank.competitionNames.dailyQuiz.action,
        img: require('../../assets/images/daily-quiz.png') as ImageSourcePropType,
      },
      {
        id: '2',
        title: t.rank.competitionNames.shareAndEarn.title,
        sub: t.rank.competitionNames.shareAndEarn.sub,
        actionText: t.rank.competitionNames.shareAndEarn.action,
        img: require('../../assets/images/share.png') as ImageSourcePropType,
      },
    ],
    [t],
  );

  // ── Podium (ranks 1, 2, 3 — visual order: 2 → 1 → 3) ──
  const podiumSlots = useMemo<readonly PodiumSlot[]>(() => {
    const find = (rank: number) => players.find(p => p.rank === rank);
    const slot1 = buildPodiumSlot(1, find(1), t.rank.beTheFirst, t.rank.xpSuffix);
    const slot2 = buildPodiumSlot(2, find(2), t.rank.startNow, t.rank.xpSuffix);
    const slot3 = buildPodiumSlot(3, find(3), t.rank.createGlory, t.rank.xpSuffix);
    return [slot2, slot1, slot3] as const;
  }, [players, t]);

  // ── Lower leaderboard (ranks 4, 5) ──
  const lowerSlots = useMemo<readonly BoardSlot[]>(() => {
    return [4, 5].map(rank => {
      const player = players.find(p => p.rank === rank);
      return buildBoardSlot(rank, player, t.rank.emptySlot, t.rank.emptySlotHint, t.rank.xpSuffix);
    });
  }, [players, t]);

  // ── Full Top 11 (padded to 11 entries for the modal) ──
  const top11Entries = useMemo<LeaderboardEntry[]>(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const rank = i + 1;
      const player = players.find(p => p.rank === rank);
      if (player) {
        return {
          rank,
          id: player.id,
          displayName: (player.displayName ?? player.username) || t.rank.emptySlot,
          username: player.username,
          avatar: player.avatar,
          xp: player.xp ?? 0,
          isPlaceholder: false,
        };
      }
      return {
        rank,
        id: `empty-${rank}`,
        displayName: rank <= 3 ? t.rank.futureChampion : t.rank.emptySlot,
        username: '',
        avatar: null,
        xp: 0,
        isPlaceholder: true,
      };
    });
  }, [players, t]);

  const titleRowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const secHeadDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const viewAllDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

  return (
    <View style={s.root}>
      <RankHeader topInset={insets.top} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: Math.max(insets.bottom, 16) + 88,
        }}
      >
        {/* ── Hero block ── */}
        <View style={s.heroBlock}>
          <Image
            source={require('../../assets/images/90Plus world cup.png')}
            style={s.heroBgTrophy}
            contentFit="contain"
            cachePolicy="memory-disk"
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
            <View style={[s.titleRow, { flexDirection: titleRowDirection }]}>
              <View style={s.trophyIconBox}>
                <Trophy size={20} color="#fff" />
              </View>
              <Text style={s.pageTitle}>{t.rank.competitions.title}</Text>
            </View>
            <Text style={s.pageSub1}>{t.rank.competitions.tagline}</Text>
            <Text style={s.pageSub2}>{t.rank.competitions.subtitle}</Text>
          </View>

          <ProfileCard />
        </View>

        {/* ── Competitions carousel ── */}
        <View style={[s.secHead, { flexDirection: secHeadDirection }]}>
          <Text style={s.secTitle}>{t.rank.allCompetitions}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.hScroll}
        >
          {competitions.map(c => (
            <CompCard
              key={c.id}
              {...c}
              onPress={() => {
                if (c.id === '1') {
                  router.push({
                    pathname: '/matches',
                    params: { filter: 'Predictions' },
                  } as never);
                } else if (c.id === '3') {
                  router.push('/quiz' as never);
                }
              }}
            />
          ))}
        </ScrollView>

        {/* ── World Cup banner ── */}
        <WCCard onPressSoon={() => setIsSoonVisible(true)} />

        {/* ── Top players ── */}
        <View style={s.bottomContentGroup}>
          <View style={s.arenaBgContainerExtended} pointerEvents="none">
            <Image
              source={require('../../assets/images/arena.png')}
              style={s.arenaImgExtended}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['#0A0612', 'transparent', '#0A0612']}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={[s.secHead, { flexDirection: secHeadDirection }]}>
            <Text style={s.secTitle}>{t.rank.topPlayers}</Text>
          </View>

          {isLoading ? (
            <>
              <PodiumSkeleton />
              <View style={s.board}>
                <BoardRowSkeleton />
                <BoardRowSkeleton />
              </View>
            </>
          ) : isError ? (
            // Quietly show an empty leaderboard. The list refetches on tab
            // focus / mount so a manual retry button would just be noise —
            // the user explicitly asked for it to be removed.
            <View style={s.errorCard}>
              <Text style={s.errorText}>{t.rank.errors.loadFailed}</Text>
            </View>
          ) : (
            <>
              {/* Podium */}
              <View style={s.podiumRow}>
                {podiumSlots.map((p, idx) => (
                  <View
                    key={`pod-${p.rank}`}
                    style={
                      // Overlap the outer cards behind the centered #1
                      idx === 0
                        ? { marginEnd: -15 }
                        : idx === podiumSlots.length - 1
                        ? { marginStart: -15 }
                        : null
                    }
                  >
                    <PodiumCard
                      rank={p.rank}
                      name={p.name}
                      xp={p.xpLabel}
                      avatar={p.avatar}
                      countryFlag={p.countryFlag}
                      position={p.position}
                    />
                  </View>
                ))}
              </View>

              {/* Lower rows */}
              <View style={s.board}>
                {lowerSlots.map((row, i) => {
                  const RowWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
                  const rowProps = isLiquidGlassSupported
                    ? { effect: 'clear' as const, interactive: true }
                    : { intensity: 15, tint: 'dark' as const };
                  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

                  return (
                    <RowWrapper
                      key={row.id}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      {...(rowProps as any)}
                      style={[
                        s.boardRowGlass,
                        { flexDirection: rowDirection },
                        i < lowerSlots.length - 1 && { marginBottom: 8 },
                      ]}
                    >
                      <View style={s.rankBadgeSmall}>
                        <Text style={s.boardRank}>{row.rank}</Text>
                      </View>
                      <Image
                        source={row.avatar ? { uri: row.avatar } : PROFILE_PLACEHOLDER}
                        placeholder={PROFILE_PLACEHOLDER}
                        style={s.boardAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.boardName} numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text style={s.boardRole} numberOfLines={1}>
                          {row.role}
                        </Text>
                      </View>
                      <Text style={s.boardXp}>{row.xpLabel}</Text>
                    </RowWrapper>
                  );
                })}
              </View>
            </>
          )}

          <Pressable
            style={({ pressed }) => [s.viewAllLeaderboardBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setIsModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t.rank.viewAll}
          >
            <LinearGradient
              colors={['rgba(168,85,247,0.2)', 'rgba(124,58,237,0.1)']}
              style={[s.viewAllLeaderboardGrad, { flexDirection: viewAllDirection }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.viewAllLeaderboardTxt}>{t.rank.viewAll}</Text>
              <ChevronRight size={16} color={ACCENT} />
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>

      <LeaderboardModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        entries={top11Entries}
        topInset={insets.top}
      />
      <SoonModal visible={isSoonVisible} onClose={() => setIsSoonVisible(false)} />

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },

  heroBlock: { overflow: 'hidden', paddingBottom: 20 },
  heroBgTrophy: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: '90%',
    height: '100%',
    opacity: 0.95,
  },
  heroBgGradLeft: {
    position: 'absolute',
    top: 0,
    start: 0,
    bottom: 0,
    width: '62%',
  },
  heroBgGradBottom: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    height: 100,
  },
  heroText: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, zIndex: 1 },
  titleRow: { alignItems: 'center', gap: 10, marginBottom: 8 },
  trophyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(39, 8, 94, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  pageTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
  pageSub1: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pageSub2: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },

  secHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 14,
  },
  secTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  hScroll: { paddingHorizontal: 16, gap: 12 },

  bottomContentGroup: {
    marginTop: 10,
    paddingTop: 40,
    position: 'relative',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  arenaBgContainerExtended: {
    ...StyleSheet.absoluteFillObject,
  },
  arenaImgExtended: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },

  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },

  board: { paddingHorizontal: 16, marginTop: 10 },
  boardRowGlass: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(241, 241, 241, 0)',
    gap: 12,
  },
  rankBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardRank: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  boardAvatar: { width: 44, height: 44, borderRadius: 22 },
  boardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  boardRole: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  boardXp: { color: ACCENT, fontWeight: '800', fontSize: 14 },

  errorCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    alignItems: 'center',
  },
  errorText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },

  viewAllLeaderboardBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  viewAllLeaderboardGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  viewAllLeaderboardTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
