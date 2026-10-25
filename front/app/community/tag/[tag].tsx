import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hash } from 'lucide-react-native';

import { CommunityFeedList } from '../../../components/community/CommunityFeedList';
import { CommunityHeader, useCommunityHeaderOffset } from '../../../components/community/CommunityHeader';
import { fillTemplate, formatCount } from '../../../components/community/format';
import { C } from '../../../components/community/theme';
import { useTranslation } from '../../../src/i18n';
import { getAppFont } from '../../../utils/fontSetup';

export default function CommunityTagScreen() {
  const { tag: rawTag } = useLocalSearchParams<{ tag: string }>();
  const tag = String(rawTag ?? '').replace(/^#/, '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
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
      <View style={styles.badge}>
        <Hash size={26} color={C.accentSoft} />
      </View>
      <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start', gap: 2 }}>
        <Text style={[styles.tag, { fontFamily: semibold }]} numberOfLines={1}>
          #{tag}
        </Text>
        {count !== undefined && (
          <Text style={[styles.count, { fontFamily: regular }]}>
            {fillTemplate(s.postsCount, { count: formatCount(count) })}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.screen,
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
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
  },
  tag: {
    color: C.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
  count: {
    color: C.muted,
    fontSize: 13,
  },
});
