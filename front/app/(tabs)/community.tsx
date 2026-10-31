import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowDownUp, ChevronDown, Clock, Flame, Heart, MessageCircle, TrendingUp } from 'lucide-react-native';

import { ActionMenu } from '../../components/community/ActionMenu';
import { CommunityFeedList } from '../../components/community/CommunityFeedList';
import { CommunityHeader, useCommunityHeaderOffset } from '../../components/community/CommunityHeader';
import { ComposerCard } from '../../components/community/ComposerCard';
import { C } from '../../components/community/theme';
import { TAB_BAR_HEIGHT } from '../../components/navigation/liquidGlassTabBar.constants';
import { usePublishStore } from '../../hooks/community/publishQueue';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import {
  usePrefetchCommunityFeed,
  useTrendingHashtags,
  type CommunityFeedSource,
} from '../../hooks/community/useCommunityFeed';
import type { CommunityFeedSort } from '../../services/community.api';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';

const SORT_OPTIONS: readonly CommunityFeedSort[] = ['latest', 'top', 'likes', 'comments'];

function SortIcon({ sort }: { sort: CommunityFeedSort }) {
  const props = { size: 18, color: C.accentSoft, strokeWidth: 2.2 };
  if (sort === 'top') return <Flame {...props} />;
  if (sort === 'likes') return <Heart {...props} />;
  if (sort === 'comments') return <MessageCircle {...props} />;
  return <Clock {...props} />;
}

function FeedSortButton({
  isAr,
  fontFamily,
  label,
  title,
  onPress,
}: {
  isAr: boolean;
  fontFamily: string;
  label: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${label}`}
      style={({ pressed }) => [
        styles.sortBtn,
        { flexDirection: isAr ? 'row-reverse' : 'row', alignSelf: isAr ? 'flex-end' : 'flex-start' },
        pressed && styles.sortBtnPressed,
      ]}
    >
      <ArrowDownUp size={15} color={C.accentSoft} strokeWidth={2.4} />
      <Text style={[styles.sortLabel, { fontFamily }]}>{label}</Text>
      <ChevronDown size={15} color={C.muted} strokeWidth={2.4} />
    </Pressable>
  );
}

function TrendingChips({ isAr, fontFamily, label }: { isAr: boolean; fontFamily: string; label: string }) {
  const router = useRouter();
  const { data } = useTrendingHashtags();
  if (!data?.length) return null;
  return (
    <View style={styles.trending}>
      <View style={[styles.trendingTitle, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <TrendingUp size={16} color={C.accentSoft} />
        <Text style={[styles.trendingLabel, { fontFamily }]}>{label}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={isAr ? { transform: [{ scaleX: -1 }] } : undefined}
      >
        {data.map((h) => (
          <Pressable
            key={h.tag}
            onPress={() => router.push({ pathname: '/community/tag/[tag]', params: { tag: h.tag } })}
            style={[styles.chip, isAr && { transform: [{ scaleX: -1 }] }]}
          >
            <Text style={[styles.chipText, { fontFamily }]}>#{h.tag}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const me = useCommunityMe();
  const headerOffset = useCommunityHeaderOffset();
  usePrefetchCommunityFeed(true);
  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), semibold: getAppFont(600, language) }),
    [language],
  );

  const [sort, setSort] = useState<CommunityFeedSort>('latest');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const source = useMemo<CommunityFeedSource>(() => ({ kind: 'feed', sort }), [sort]);
  const openSortMenu = useCallback(() => setSortMenuOpen(true), []);

  // A freshly published post (ghost first, then the real one) only lands in the
  // latest feed, so jump back there whenever a new post starts publishing.
  const pendingCount = usePublishStore((st) => st.pending.length);
  const prevPendingCount = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPendingCount.current) setSort('latest');
    prevPendingCount.current = pendingCount;
  }, [pendingCount]);

  const sortItems = useMemo(
    () =>
      SORT_OPTIONS.map((key) => ({
        key,
        label: s.feedSort[key],
        icon: <SortIcon sort={key} />,
        selected: key === sort,
        onPress: () => {
          if (key === sort) return;
          void Haptics.selectionAsync();
          setSort(key);
        },
      })),
    [s, sort],
  );

  const header = useMemo(
    () => (
      <View style={styles.listHeader}>
        <ComposerCard
          isAr={isAr}
          avatar={me.avatar}
          name={me.displayName || me.username}
          placeholder={s.composerPlaceholder}
          writeLabel={s.writePost}
          photoLabel={s.addPhoto}
          pollLabel={s.pollType}
          fonts={fonts}
          onWrite={() => router.push('/community/compose')}
          onPhoto={() => router.push({ pathname: '/community/compose', params: { photo: '1' } })}
          onPoll={() => router.push({ pathname: '/community/compose', params: { poll: '1' } })}
          onAvatarPress={() => router.push('/(tabs)/profile' as never)}
        />
        <TrendingChips isAr={isAr} fontFamily={fonts.semibold} label={s.trending} />
        <FeedSortButton
          isAr={isAr}
          fontFamily={fonts.semibold}
          label={s.feedSort[sort]}
          title={s.feedSort.title}
          onPress={openSortMenu}
        />
      </View>
    ),
    [fonts, isAr, me.avatar, me.displayName, me.username, openSortMenu, router, s, sort],
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/matches');
  }, [router]);

  return (
    <View style={styles.root}>
      <CommunityHeader
        title={s.title}
        fontFamily={fonts.semibold}
        onBack={onBack}
        onBell={() => router.push('/notifications')}
      />
      <CommunityFeedList
        source={source}
        header={header}
        showPending={sort === 'latest'}
        topPadding={headerOffset}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + 36}
      />
      <ActionMenu
        visible={sortMenuOpen}
        title={s.feedSort.title}
        items={sortItems}
        cancelLabel={s.cancel}
        onClose={() => setSortMenuOpen(false)}
        fontFamily={fonts.semibold}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.screen,
  },
  listHeader: {
    paddingTop: 16,
    gap: 14,
    marginBottom: 14,
  },
  trending: {
    gap: 10,
  },
  trendingTitle: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  trendingLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chips: {
    gap: 8,
    paddingHorizontal: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  chipText: {
    color: C.accentSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  sortBtn: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(183,154,248,0.18)',
  },
  sortBtnPressed: {
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  sortLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
