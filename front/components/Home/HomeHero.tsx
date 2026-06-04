import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  Pressable,
  ImageBackground,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  GOLD_PRIMARY,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  SCREEN_PADDING_H,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../constants/tokens';
import { useTranslation } from '../../src/i18n';

const AUTOPLAY_MS = 4800;

type Banner = {
  id: string;
  image: ImageSourcePropType;
  kickerKey: 'heroLiveKicker' | 'heroQuizKicker' | 'heroRankKicker';
  titleKey: 'heroLiveTitle' | 'heroQuizTitle' | 'heroRankTitle';
  subtitleKey: 'heroLiveSubtitle' | 'heroQuizSubtitle' | 'heroRankSubtitle';
  ctaKey: 'heroLiveCta' | 'heroQuizCta' | 'heroRankCta';
  route: '/matches' | '/quiz' | '/rank' | '/reels' | '/chat';
  colors: readonly [string, string];
  accent?: string;
};

const BANNER_DEFS: Banner[] = [
  {
    id: 'live',
    image: require('../../assets/images/auth-hero.png'),
    kickerKey: 'heroLiveKicker',
    titleKey: 'heroLiveTitle',
    subtitleKey: 'heroLiveSubtitle',
    ctaKey: 'heroLiveCta',
    route: '/matches',
    colors: ['rgba(239,68,68,0.55)', 'rgba(4,3,12,0.92)'] as const,
    accent: '#fecaca',
  },
  {
    id: 'quiz',
    image: {
      uri: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=75',
    },
    kickerKey: 'heroQuizKicker',
    titleKey: 'heroQuizTitle',
    subtitleKey: 'heroQuizSubtitle',
    ctaKey: 'heroQuizCta',
    route: '/quiz',
    colors: ['rgba(59,130,246,0.45)', 'rgba(4,3,12,0.92)'] as const,
    accent: '#bfdbfe',
  },
  {
    id: 'rank',
    image: {
      uri: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=75',
    },
    kickerKey: 'heroRankKicker',
    titleKey: 'heroRankTitle',
    subtitleKey: 'heroRankSubtitle',
    ctaKey: 'heroRankCta',
    route: '/rank',
    colors: ['rgba(236,72,153,0.4)', 'rgba(4,3,12,0.93)'] as const,
    accent: '#fbcfe8',
  },
];

export function HomeHero() {
  const router = useRouter();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const carouselW = useMemo(
    () => Math.max(280, windowWidth - SCREEN_PADDING_H * 2),
    [windowWidth],
  );

  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pausedByTouchRef = useRef(false);

  const onBannerScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / carouselW);
      setBannerIndex(Math.min(Math.max(0, next), BANNER_DEFS.length - 1));
    },
    [carouselW],
  );

  const goBanner = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ x: i * carouselW, animated: true });
    setBannerIndex(i);
  }, [carouselW]);

  useEffect(() => {
    if (BANNER_DEFS.length <= 1) return;
    const timer = setInterval(() => {
      if (pausedByTouchRef.current) return;
      setBannerIndex((prev) => {
        const next = (prev + 1) % BANNER_DEFS.length;
        scrollRef.current?.scrollTo({ x: next * carouselW, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [carouselW]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bannerBlock}>
        <View style={styles.bannerHeaderRow}>
          <Text style={styles.bannerSectionTitle}>{t.home.heroSpotlight}</Text>
          <Text style={styles.bannerSectionHint}>{t.home.heroAutoSwipe}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          style={{ width: carouselW, alignSelf: 'center' }}
          contentContainerStyle={styles.carouselContent}
          onScrollBeginDrag={() => {
            pausedByTouchRef.current = true;
          }}
          onMomentumScrollEnd={(e) => {
            pausedByTouchRef.current = false;
            onBannerScrollEnd(e);
          }}
        >
          {BANNER_DEFS.map((b) => {
            const title = t.home[b.titleKey];
            return (
              <Pressable
                key={b.id}
                style={[styles.bannerPage, { width: carouselW }]}
                onPress={() => router.push(b.route)}
              >
                <ImageBackground
                  source={b.image}
                  style={styles.bannerImageBg}
                  imageStyle={styles.bannerImage}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(4,3,12,0.25)', ...b.colors]}
                    locations={[0, 0.35, 0.72, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.bannerInner}>
                    <Text style={[styles.bannerKicker, { color: b.accent ?? PURPLE_SOFT }]}>
                      {t.home[b.kickerKey]}
                    </Text>
                    <Text style={styles.bannerTitle}>{title}</Text>
                    <Text style={styles.bannerSubtitle}>{t.home[b.subtitleKey]}</Text>
                    <View style={styles.bannerCtaRow}>
                      <Text style={styles.bannerCta}>{t.home[b.ctaKey]}</Text>
                      <Text style={styles.bannerCtaArrow}>→</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.dots}>
          {BANNER_DEFS.map((b, i) => (
            <TouchableOpacity
              key={b.id}
              hitSlop={10}
              accessibilityLabel={t.home.heroBannerA11y
                .replace('{index}', String(i + 1))
                .replace('{title}', t.home[b.titleKey])}
              onPress={() => goBanner(i)}
              activeOpacity={0.8}
              style={[styles.dot, i === bannerIndex && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.inlineMeta}>
        <View style={styles.metaIcon}>
          <Zap size={13} color="rgba(245,197,24,0.5)" strokeWidth={2.5} />
        </View>
        <Text style={styles.metaTxt}>{t.home.heroWalletHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: SCREEN_PADDING_H,
  },

  bannerBlock: {
    marginBottom: 4,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  bannerSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bannerSectionHint: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
  },
  carouselContent: {
    alignItems: 'stretch',
  },
  bannerPage: {
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  bannerImageBg: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 168,
    justifyContent: 'flex-end',
  },
  bannerImage: {
    borderRadius: 15,
  },
  bannerInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 1,
  },
  bannerKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
    maxWidth: '92%',
  },
  bannerCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerCta: {
    fontSize: 13,
    fontWeight: '800',
    color: GOLD_PRIMARY,
  },
  bannerCtaArrow: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD_PRIMARY,
    marginTop: -1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 18,
    backgroundColor: PURPLE_PRIMARY,
  },

  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
    marginTop: 14,
  },
  metaIcon: { marginTop: 1, opacity: 0.95 },
  metaTxt: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.32)',
    fontWeight: '600',
    textAlign: 'left',
  },
});
