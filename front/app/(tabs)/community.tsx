import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp } from 'lucide-react-native';

import { CommunityFeedList } from '../../components/community/CommunityFeedList';
import { CommunityHeader } from '../../components/community/CommunityHeader';
import { ComposerCard } from '../../components/community/ComposerCard';
import { C } from '../../components/community/theme';
import { TAB_BAR_HEIGHT } from '../../components/navigation/liquidGlassTabBar.constants';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import { useTrendingHashtags } from '../../hooks/community/useCommunityFeed';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';

const FEED_SOURCE = { kind: 'feed' } as const;

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
  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), semibold: getAppFont(600, language) }),
    [language],
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/matches');
  }, [router]);

  const header = (
    <View style={styles.listHeader}>
      <ComposerCard
        isAr={isAr}
        avatar={me.avatar}
        name={me.displayName || me.username}
        placeholder={s.composerPlaceholder}
        writeLabel={s.writePost}
        photoLabel={s.addPhoto}
        fonts={fonts}
        onWrite={() => router.push('/community/compose')}
        onPhoto={() => router.push({ pathname: '/community/compose', params: { photo: '1' } })}
      />
      <TrendingChips isAr={isAr} fontFamily={fonts.semibold} label={s.trending} />
    </View>
  );

  return (
    <View style={styles.root}>
      <CommunityHeader
        title={s.title}
        fontFamily={fonts.semibold}
        onBack={onBack}
        onBell={() => router.push('/notifications')}
      />
      <CommunityFeedList
        source={FEED_SOURCE}
        header={header}
        showPending
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + 36}
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
});
