/**
 * First screen of خماسي الهدافين, opened from Competitions.
 * The user swipes league portraits, then "كون تشكيلتك" opens that league's five.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import {
  topScorersFiveService,
  type TsfCompetitionKey,
} from '../../services/topScorersFive.service';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../utils/logger';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';

import { TSF_LEAGUE_LOGO } from './assets';
import { TSF_THEME } from './tsfTheme';

const SHOWCASE: readonly TsfCompetitionKey[] = [
  'bundesliga',
  'laliga',
  'pl',
  'seriea',
  'egypt',
  'ligue1',
];

const PORTRAIT: Record<TsfCompetitionKey, number> = {
  bundesliga: require('../../assets/images/top-scorers-five/showcase/bundesliga.png'),
  laliga: require('../../assets/images/top-scorers-five/showcase/laliga.png'),
  pl: require('../../assets/images/top-scorers-five/showcase/pl.png'),
  seriea: require('../../assets/images/top-scorers-five/showcase/seriea.png'),
  egypt: require('../../assets/images/top-scorers-five/showcase/egypt.png'),
  ligue1: require('../../assets/images/top-scorers-five/showcase/ligue1.png'),
};

const BANNER = require('../../assets/images/top-scorers-five/showcase/points-banner.png');

const CREST: Record<TsfCompetitionKey, number> = {
  egypt: TSF_LEAGUE_LOGO.egypt1,
  pl: TSF_LEAGUE_LOGO.pl,
  laliga: TSF_LEAGUE_LOGO.laliga,
  seriea: TSF_LEAGUE_LOGO.seriea,
  bundesliga: TSF_LEAGUE_LOGO.bundesliga,
  ligue1: TSF_LEAGUE_LOGO.ligue1,
};

const ENGLISH: Record<TsfCompetitionKey, string> = {
  bundesliga: 'BUNDESLIGA',
  laliga: 'LALIGA',
  pl: 'PREMIER LEAGUE',
  seriea: 'SERIE A',
  egypt: 'Egyptian Premier League',
  ligue1: 'Ligue 1',
};

function isShowcase(value: string | undefined): value is TsfCompetitionKey {
  return SHOWCASE.includes(value as TsfCompetitionKey);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function wrap(index: number): TsfCompetitionKey {
  const count = SHOWCASE.length;
  return SHOWCASE[((index % count) + count) % count]!;
}

export default function LeagueShowcaseScreen() {
  useScreenFont();
  const router = useRouter();
  const params = useLocalSearchParams<{ league?: string; mode?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useResolvedAppScheme();
  const colors = isDark ? TSF_THEME.dark : TSF_THEME.light;
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const pick = copy.pick;
  const isAr = language === 'ar';
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);

  const initialIndex = useMemo(() => {
    const league = firstParam(params.league);
    const mode = firstParam(params.mode);
    const key = isShowcase(league) ? league : mode === 'egypt' ? 'egypt' : mode === 'europe' ? 'pl' : 'bundesliga';
    return Math.max(0, SHOWCASE.indexOf(key));
  }, [params.league, params.mode]);

  const [index, setIndex] = useState(initialIndex);
  const [points, setPoints] = useState(0);
  const listRef = useRef<FlatList<TsfCompetitionKey>>(null);
  const current = SHOWCASE[index] ?? 'bundesliga';

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const [europe, egypt] = await Promise.all([
          topScorersFiveService.getScore(token, 'europe'),
          topScorersFiveService.getScore(token, 'egypt'),
        ]);
        if (!cancelled) setPoints((europe?.total ?? 0) + (egypt?.total ?? 0));
      } catch (error) {
        logger.warn('[TopScorersFive] total score failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const arabicName = useCallback(
    (key: TsfCompetitionKey) => (key === 'egypt' ? pick.leagues.egypt1 : pick.leagues[key]),
    [pick.leagues],
  );

  const openFormation = useCallback(
    (key: TsfCompetitionKey) => {
      router.push({ pathname: '/top-scorers-five/pick', params: { league: key } });
    },
    [router],
  );

  const renderPage: ListRenderItem<TsfCompetitionKey> = useCallback(
    ({ item }) => {
      const at = SHOWCASE.indexOf(item);
      const previous = wrap(at - 1);
      const next = wrap(at + 1);
      return (
        <View style={{ width, paddingHorizontal: 20 }}>
          <Text style={[styles.arabicLeague, { color: colors.muted, fontFamily: fontRegular }]}>{arabicName(item)}</Text>
          <Text style={[styles.englishLeague, { color: colors.text, fontFamily: fontBold }]}>{ENGLISH[item]}</Text>
          <View style={styles.portraits}>
            <Portrait league={previous} />
            <Portrait league={item} featured />
            <Portrait league={next} />
          </View>
          <View style={styles.hintRow}>
            <Ionicons name="swap-horizontal" size={18} color={colors.purple} />
            <Text style={[styles.hint, { color: colors.muted, fontFamily: fontRegular }]}>{pick.swipeHint}</Text>
          </View>
        </View>
      );
    },
    [arabicName, colors.muted, colors.purple, colors.text, fontBold, fontRegular, pick.swipeHint, width],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fontSemi }]}>{copy.title}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={12}
          style={[styles.back, isAr ? styles.backEnd : styles.backStart]}
        >
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontRegular }]}>{pick.showcaseSubtitle}</Text>

      <View style={styles.banner}>
        <Image source={BANNER} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.bannerCopy}>
          <Text style={[styles.bannerTitle, { fontFamily: fontBold }]}>{pick.pointsBannerTitle}</Text>
          <Text style={[styles.bannerBody, { fontFamily: fontRegular }]}>{pick.pointsBannerBody}</Text>
          <Text style={[styles.bannerPoints, { fontFamily: fontBold }]}>{points.toLocaleString('en-US')}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={SHOWCASE}
        keyExtractor={(item) => item}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        style={[styles.flex, { direction: 'ltr' }]}
        onScrollToIndexFailed={() => undefined}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setIndex(Math.max(0, Math.min(SHOWCASE.length - 1, next)));
        }}
      />

      <View style={styles.dots}>
        {SHOWCASE.map((key, dot) => (
          <View
            key={key}
            style={[styles.dot, { backgroundColor: dot === index ? colors.purple : colors.dot, width: dot === index ? 16 : 6 }]}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={() => openFormation(current)}
        style={[styles.cta, { marginBottom: Math.max(insets.bottom, 16) }]}
        accessibilityRole="button"
        testID="tsf-build-squad"
      >
        <LinearGradient colors={['#7A3BE8', '#6A2BD9']} style={styles.ctaFill}>
          <Text style={[styles.ctaText, { fontFamily: fontBold }]}>{pick.buildSquad}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function Portrait({ league, featured = false }: { league: TsfCompetitionKey; featured?: boolean }) {
  const lightLogo = league === 'pl' || league === 'ligue1' || league === 'egypt';
  return (
    <View style={[styles.portrait, featured ? styles.portraitFeatured : styles.portraitSide]}>
      <Image source={PORTRAIT[league]} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)']} style={StyleSheet.absoluteFill} />
      <Image
        source={CREST[league]}
        style={featured ? styles.badgeLarge : styles.badge}
        contentFit="contain"
        tintColor={lightLogo ? '#FFFFFF' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20 },
  back: { position: 'absolute', top: 4, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backEnd: { right: 12 },
  backStart: { left: 12 },
  subtitle: { textAlign: 'center', fontSize: 13, lineHeight: 20, marginHorizontal: 28, marginBottom: 14 },
  banner: {
    height: 124,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bannerCopy: { alignSelf: 'flex-end', width: '68%', paddingRight: 16, alignItems: 'flex-end', gap: 2 },
  bannerTitle: { color: '#FCFCFC', fontSize: 16, textAlign: 'right' },
  bannerBody: { color: '#F3EDFF', fontSize: 12, textAlign: 'right' },
  bannerPoints: { color: '#FCFCFC', fontSize: 36, lineHeight: 42, textAlign: 'right' },
  arabicLeague: { textAlign: 'center', fontSize: 13, marginTop: 22 },
  englishLeague: { textAlign: 'center', fontSize: 22, letterSpacing: 0.4, marginTop: 2 },
  portraits: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 18,
  },
  portrait: { borderRadius: 16, overflow: 'hidden' },
  portraitSide: { width: 112, height: 148, marginHorizontal: -8 },
  portraitFeatured: { width: 156, height: 196, zIndex: 2, marginHorizontal: -6 },
  badge: { position: 'absolute', right: 8, bottom: 8, width: 34, height: 34 },
  badgeLarge: { position: 'absolute', right: 10, bottom: 10, width: 46, height: 46 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 16 },
  hint: { fontSize: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  dot: { height: 6, borderRadius: 3 },
  cta: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  ctaFill: { height: 52, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 16 },
});
