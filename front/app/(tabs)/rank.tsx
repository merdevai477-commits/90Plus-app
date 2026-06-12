/**
 * Rank tab screen
 *
 * Aggregates the Rank features:
 * - profile strip (real user data via ProfileCard)
 * - competitions carousel
 * - World Cup news banner (opens 90plus.pro/news)
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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ImageSourcePropType,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompCard from '../../components/rank/CompCard';
import LeaderboardModal, {
  LeaderboardEntry,
} from '../../components/rank/LeaderboardModal';
import PodiumCard from '../../components/rank/PodiumCard';
import ProfileCard from '../../components/rank/ProfileCard';
import RankHeader from '../../components/rank/RankHeader';
import { BoardRowSkeleton, PodiumSkeleton } from '../../components/rank/RankSkeletons';
import WCCard from '../../components/rank/WCCard';
import { APP_BG } from '../../constants/ui';
import { prefetchDailyQuiz } from '../../hooks/useDailyQuiz';
import { useAppShareReward } from '../../hooks/useAppShareReward';
import { useLevelUpCelebrationOnFocus } from '../../hooks/useLevelUpCelebrationOnFocus';
import { useTopPlayers, type TopPlayer, type TopPlayersPeriod } from '../../hooks/useTopPlayers';
import { useTranslation } from '../../src/i18n';
import { formatXpLabel } from '../../src/i18n/formatXp';
import type { Language } from '../../src/i18n/types';
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { useLanguageStore } from '../../src/i18n/store';
import { useScreenFont, useAppFont } from '../../utils/fontSetup';
import { useAuth } from '@clerk/clerk-expo';
import { globalState } from '../../globalState';
import { useQueryClient } from '@tanstack/react-query';

const ACCENT = '#A855F7';
const PROFILE_PLACEHOLDER: ImageSourcePropType = require('../../assets/images/plear 90Plus.png');

interface PodiumSlot {
  rank: number;
  isPlaceholder: boolean;
  username: string;
  name: string;
  xpLabel: string;
  avatar: ImageSourcePropType | string;
  countryFlag: string | null;
  position?: string;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  foot?: string | null;
  clubLogo?: string | null;
  favoriteTeam?: string | null;
}

interface BoardSlot {
  rank: number;
  isPlaceholder: boolean;
  id: string;
  username: string;
  name: string;
  role: string;
  xpLabel: string;
  avatar: string | null;
}

function playerDisplayName(player: TopPlayer, fallback: string): string {
  const name = player.displayName?.trim();
  if (name) return name;
  return fallback;
}

function buildPodiumSlot(
  rank: number,
  player: TopPlayer | undefined,
  emptyName: string,
  language: Language,
): PodiumSlot {
  if (player) {
    return {
      rank,
      isPlaceholder: false,
      username: player.username,
      name: playerDisplayName(player, player.username || emptyName),
      xpLabel: formatXpLabel(player.xp ?? 0, language),
      avatar: player.avatar ?? PROFILE_PLACEHOLDER,
      countryFlag: player.countryFlag ?? null,
      position: player.position,
      age: player.age ?? null,
      heightCm: player.height ?? null,
      weightKg: player.weight ?? null,
      foot: player.preferredFoot ?? null,
      clubLogo: player.clubLogo ?? null,
      favoriteTeam: player.favoriteTeam ?? null,
    };
  }
  return {
    rank,
    isPlaceholder: true,
    username: '',
    name: emptyName,
    xpLabel: formatXpLabel(0, language),
    avatar: PROFILE_PLACEHOLDER,
    countryFlag: null,
  };
}

function buildBoardSlot(
  rank: number,
  player: TopPlayer | undefined,
  emptyName: string,
  emptyHint: string,
  language: Language,
): BoardSlot {
  if (player) {
    return {
      rank,
      isPlaceholder: false,
      id: player.id,
      username: player.username,
      name: playerDisplayName(player, player.username || emptyName),
      role: player.position || emptyHint,
      xpLabel: formatXpLabel(player.xp ?? 0, language),
      avatar: player.avatar,
    };
  }
  return {
    rank,
    isPlaceholder: true,
    id: `empty-${rank}`,
    username: '',
    name: emptyName,
    role: emptyHint,
    xpLabel: formatXpLabel(0, language),
    avatar: null,
  };
}

export default function RankScreen() {
  useScreenFont();
  useLevelUpCelebrationOnFocus();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((s) => s.language);
  // Real weighted font families (Cairo for Arabic, Inter otherwise). `fontWeight`
  // alone doesn't produce true bold for custom fonts on Android — set the
  // explicit weighted family so headings/names render properly bold.
  const fontBold = useAppFont(700);
  const fontExtraBold = useAppFont(800);
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [period, setPeriod] = useState<TopPlayersPeriod>('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const hydrateFeatures = useAppFeaturesStore((s) => s.hydrate);
  const isFocused = useIsFocused();

  const { players, isLoading, isError, refetch } = useTopPlayers({
    limit: 11,
    period,
    enabled: isFocused,
  });

  const realPlayers = useMemo(
    () => players.filter((p) => p.username && !String(p.id).startsWith('empty-')),
    [players],
  );

  const navigateToProfile = useCallback(
    (username: string) => {
      const clean = username.replace(/^@/, '').trim();
      if (!clean) return;
      router.push(`/user/${clean}` as never);
    },
    [router],
  );

  const { loadShareStatus, shareAppAndClaim, shareRewardHint } = useAppShareReward();

  useFocusEffect(
    useCallback(() => {
      void loadShareStatus();
      void hydrateFeatures();
    }, [loadShareStatus, hydrateFeatures]),
  );

  const handleShareApp = useCallback(async () => {
    await shareAppAndClaim(appLanguage === 'en' ? 'en' : 'ar');
  }, [shareAppAndClaim, appLanguage]);

  const handleCompetitionPress = useCallback(
    (id: string) => {
      if (id === '1') {
        router.push({ pathname: '/(tabs)/matches', params: { filter: 'Predictions' } } as never);
      } else if (id === '3') {
        const quizLang = appLanguage === 'en' ? 'en' : 'ar';
        void prefetchDailyQuiz(queryClient, getToken, quizLang);
        router.push('/(tabs)/quiz' as never);
      } else if (id === '4') {
        router.push('/(tabs)/reels' as never);
      } else if (id === '2') {
        void handleShareApp();
      }
    },
    [router, handleShareApp, appLanguage, queryClient, getToken],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleCloseModal = useCallback(() => setIsModalVisible(false), []);

  const handleLeaderboardEntryPress = useCallback(
    (entry: LeaderboardEntry) => {
      setIsModalVisible(false);
      navigateToProfile(entry.username);
    },
    [navigateToProfile],
  );

  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: insets.top + 60,
      paddingBottom: Math.max(insets.bottom, 16) + 88,
    }),
    [insets.top, insets.bottom],
  );

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
        rewardHint: shareRewardHint(),
        img: require('../../assets/images/share.png') as ImageSourcePropType,
      },
    ],
    [t, shareRewardHint],
  );

  // ── Podium (ranks 1, 2, 3 — visual order: 2 → 1 → 3) ──
  const podiumSlots = useMemo<readonly PodiumSlot[]>(() => {
    const find = (rank: number) => players.find(p => p.rank === rank);
    const slot1 = buildPodiumSlot(1, find(1), t.rank.beTheFirst, appLanguage);
    const slot2 = buildPodiumSlot(2, find(2), t.rank.startNow, appLanguage);
    const slot3 = buildPodiumSlot(3, find(3), t.rank.createGlory, appLanguage);
    return [slot2, slot1, slot3] as const;
  }, [players, t, appLanguage]);

  // ── Lower leaderboard (ranks 4, 5) ──
  const lowerSlots = useMemo<readonly BoardSlot[]>(() => {
    return [4, 5].map(rank => {
      const player = players.find(p => p.rank === rank);
      return buildBoardSlot(rank, player, t.rank.emptySlot, t.rank.emptySlotHint, appLanguage);
    });
  }, [players, t, appLanguage]);

  // ── Full Top 11 (padded to 11 entries for the modal) ──
  const top11Entries = useMemo<LeaderboardEntry[]>(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const rank = i + 1;
      const player = players.find(p => p.rank === rank);
      if (player) {
        return {
          rank,
          id: player.id,
          displayName: playerDisplayName(player, player.username || t.rank.emptySlot),
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

  return (
    <View style={s.root}>
      <RankHeader topInset={insets.top} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        contentContainerStyle={scrollContentStyle}
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
            <View style={s.titleRow}>
              <View style={s.trophyIconBox}>
                <Trophy size={20} color="#fff" />
              </View>
              <Text style={[s.pageTitle, { fontFamily: fontExtraBold }]}>{t.rank.competitions.title}</Text>
            </View>
            <Text style={s.pageSub1}>{t.rank.competitions.tagline}</Text>
            <Text style={s.pageSub2}>{t.rank.competitions.subtitle}</Text>
          </View>

          <ProfileCard />
        </View>

        {/* ── Competitions carousel ── */}
        <View style={s.secHead}>
          <Text style={[s.secTitle, { fontFamily: fontExtraBold }]}>{t.rank.allCompetitions}</Text>
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
              onPress={() => handleCompetitionPress(c.id)}
            />
          ))}
        </ScrollView>

        {/* ── World Cup banner ── */}
        <WCCard />

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

          <View style={s.secHead}>
            <Text style={[s.secTitle, { fontFamily: fontExtraBold }]}>{t.rank.topPlayers}</Text>
            <View style={s.periodToggle}>
              {(['weekly', 'monthly'] as const).map(p => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[s.periodBtn, period === p && s.periodBtnActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === p }}
                >
                  <Text style={[s.periodBtnTxt, period === p && s.periodBtnTxtActive]}>
                    {p === 'weekly' ? t.rank.periodWeekly : t.rank.periodMonthly}
                  </Text>
                </Pressable>
              ))}
            </View>
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
            <View style={s.errorCard}>
              <Text style={s.errorText}>{t.rank.errors.loadFailed}</Text>
              <Pressable
                style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.85 }]}
                onPress={() => void refetch()}
                accessibilityRole="button"
              >
                <Text style={s.retryTxt}>{t.rank.errors.retry}</Text>
              </Pressable>
            </View>
          ) : realPlayers.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>{t.rank.emptyLeaderboard}</Text>
              <Text style={s.emptyHint}>{t.rank.emptyLeaderboardHint}</Text>
            </View>
          ) : (
            <>
              {/* Podium */}
              <View style={s.podiumRow}>
                {podiumSlots.map((p, idx) => (
                  <View
                    key={`pod-${p.rank}`}
                    style={
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
                      age={p.age ?? undefined}
                      heightCm={p.heightCm ?? undefined}
                      weightKg={p.weightKg ?? undefined}
                      foot={p.foot ?? undefined}
                      clubLogo={p.clubLogo ?? undefined}
                      favoriteTeam={p.favoriteTeam ?? undefined}
                      isPlaceholder={p.isPlaceholder}
                      onPress={
                        p.username
                          ? () => navigateToProfile(p.username)
                          : undefined
                      }
                    />
                  </View>
                ))}
              </View>

              {/* Lower rows */}
              <View style={s.board}>
                {lowerSlots.map((row, i) => {
                  const RowWrapper = isLiquidGlassSupported
                    ? LiquidGlassView
                    : Platform.OS === 'android'
                    ? View
                    : BlurView;
                  const rowProps = isLiquidGlassSupported
                    ? { effect: 'clear' as const, interactive: true }
                    : Platform.OS === 'android'
                    ? {}
                    : { intensity: 15, tint: 'dark' as const };
                  const rowInner = (
                    <>
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
                        <Text style={[s.boardName, { fontFamily: fontBold }]} numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text style={s.boardRole} numberOfLines={1}>
                          {row.role}
                        </Text>
                      </View>
                      <Text style={[s.boardXp, { fontFamily: fontExtraBold }]}>{row.xpLabel}</Text>
                    </>
                  );

                  if (!row.isPlaceholder && row.username) {
                    return (
                      <Pressable
                        key={row.id}
                        onPress={() => navigateToProfile(row.username)}
                        style={({ pressed }) => [
                          pressed && { opacity: 0.88 },
                          i < lowerSlots.length - 1 && { marginBottom: 8 },
                        ]}
                      >
                        <RowWrapper
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          {...(rowProps as any)}
                          style={[
                            s.boardRowGlass,
                            Platform.OS === 'android' && !isLiquidGlassSupported && s.boardRowGlassAndroid,
                          ]}
                        >
                          {rowInner}
                        </RowWrapper>
                      </Pressable>
                    );
                  }

                  return (
                    <RowWrapper
                      key={row.id}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      {...(rowProps as any)}
                      style={[
                        s.boardRowGlass,
                        Platform.OS === 'android' && !isLiquidGlassSupported && s.boardRowGlassAndroid,
                        i < lowerSlots.length - 1 && { marginBottom: 8 },
                      ]}
                    >
                      {rowInner}
                    </RowWrapper>
                  );
                })}
              </View>
            </>
          )}

          {!isLoading && !isError && realPlayers.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.88}
              style={s.viewAllLeaderboardBtn}
              onPress={() => setIsModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t.rank.viewAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LinearGradient
                colors={['rgba(192,132,252,0.35)', 'rgba(168,85,247,0.22)', 'rgba(124,58,237,0.14)']}
                style={s.viewAllLeaderboardGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[s.viewAllLeaderboardTxt, { fontFamily: fontExtraBold }]}>{t.rank.viewAll}</Text>
                <ChevronRight size={16} color={ACCENT} strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {isModalVisible ? (
        <LeaderboardModal
          visible={isModalVisible}
          onClose={handleCloseModal}
          entries={top11Entries}
          topInset={insets.top}
          currentUserId={globalState.userProfile?.id ?? null}
          onEntryPress={handleLeaderboardEntryPress}
        />
      ) : null}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 14,
  },
  secTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  periodToggle: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 3,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  periodBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.35)',
  },
  periodBtnTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  periodBtnTxtActive: {
    color: '#fff',
  },

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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(241, 241, 241, 0)',
    gap: 12,
  },
  boardRowGlassAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

  emptyCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
    alignItems: 'center',
  },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  viewAllLeaderboardBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    zIndex: 2,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  viewAllLeaderboardGrad: {
    flexDirection: 'row',
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
