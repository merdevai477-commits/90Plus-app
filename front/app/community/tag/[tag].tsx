import React, { useCallback, useMemo, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hash } from 'lucide-react-native';

import { CommunityFeedList } from '../../../components/community/CommunityFeedList';
import { CommunityHeader, useCommunityHeaderOffset } from '../../../components/community/CommunityHeader';
import { fillTemplate, formatCount } from '../../../components/community/format';
import { CommunityThemeProvider, useCommunityTheme } from '../../../hooks/useCommunityTheme';
import { useTranslation } from '../../../src/i18n';
import { getAppFont } from '../../../utils/fontSetup';

function CommunityTagScreenInner() {
  const { tag: rawTag } = useLocalSearchParams<{ tag: string }>();
  const tag = String(rawTag ?? '').replace(/^#/, '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const { colors } = useCommunityTheme();
  const [count, setCount] = useState<number | undefined>(undefined);
  const headerOffset = useCommunityHeaderOffset();

  const source = useMemo(() => ({ kind: 'tag' as const, tag }), [tag]);
  const semibold = getAppFont(600, language);
  const regular = getAppFont(400, language);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/community');
  }, [router]);

  const header = (
    <View style={[styles.hero, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
      <View style={[styles.badge, { backgroundColor: colors.chipBg, borderColor: colors.chipBorder }]}>
        <Hash size={26} color={colors.accentSoft} />
      </View>
      <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start', gap: 2 }}>
        <Text style={[styles.tag, { fontFamily: semibold, color: colors.textStrong }]} numberOfLines={1}>
          #{tag}
        </Text>
        {count !== undefined && (
          <Text style={[styles.count, { fontFamily: regular, color: colors.muted }]}>
            {fillTemplate(s.postsCount, { count: formatCount(count) })}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.screen }]}>
      <StatusBar barStyle={colors.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
      <CommunityHeader title={`#${tag}`} fontFamily={semibold} onBack={onBack} onBell={() => router.push('/notifications')} />
      <CommunityFeedList
        source={source}
        header={header}
        onPostsCount={setCount}
        topPadding={headerOffset}
        bottomPadding={insets.bottom + 24}
      />
    </View>
  );
}

export default function CommunityTagScreen() {
  return (
    <CommunityThemeProvider>
      <CommunityTagScreenInner />
    </CommunityThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  badge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tag: {
    fontSize: 22,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
  },
});
