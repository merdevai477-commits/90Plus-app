import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp } from 'lucide-react-native';

import { CommunityFeedList } from '../../components/community/CommunityFeedList';
import { CommunityHeader, useCommunityHeaderOffset } from '../../components/community/CommunityHeader';
import { ComposerCard } from '../../components/community/ComposerCard';
import { TAB_BAR_HEIGHT } from '../../components/navigation/liquidGlassTabBar.constants';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import {
  usePrefetchCommunityFeed,
  useTrendingHashtags,
  type CommunityFeedSource,
} from '../../hooks/community/useCommunityFeed';
import { CommunityThemeProvider, useCommunityTheme } from '../../hooks/useCommunityTheme';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';

const LATEST_FEED: CommunityFeedSource = { kind: 'feed', sort: 'latest' };

function TrendingChips({ isAr, fontFamily, label }: { isAr: boolean; fontFamily: string; label: string }) {
  const router = useRouter();
  const { colors } = useCommunityTheme();
  const { data } = useTrendingHashtags();
  if (!data?.length) return null;
  return (
    <View style={styles.trending}>
      <View style={[styles.trendingTitle, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <TrendingUp size={16} color={colors.accentSoft} />
        <Text style={[styles.trendingLabel, { fontFamily, color: colors.text }]}>{label}</Text>
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
            style={[
              styles.chip,
              { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
              isAr && { transform: [{ scaleX: -1 }] },
            ]}
          >
            <Text style={[styles.chipText, { fontFamily, color: colors.accentSoft }]}>#{h.tag}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function CommunityScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const { colors } = useCommunityTheme();
  const me = useCommunityMe();
  const headerOffset = useCommunityHeaderOffset();
  usePrefetchCommunityFeed(true);
  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), semibold: getAppFont(600, language) }),
    [language],
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
      </View>
    ),
    [fonts, isAr, me.avatar, me.displayName, me.username, router, s],
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/matches');
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.screen }]}>
      <StatusBar barStyle={colors.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
      <CommunityHeader
        title={s.title}
        fontFamily={fonts.semibold}
        onBack={onBack}
        onBell={() => router.push('/notifications')}
      />
      <CommunityFeedList
        source={LATEST_FEED}
        header={header}
        showPending
        topPadding={headerOffset}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + 108}
      />
    </View>
  );
}

export default function CommunityScreen() {
  return (
    <CommunityThemeProvider>
      <CommunityScreenInner />
    </CommunityThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
