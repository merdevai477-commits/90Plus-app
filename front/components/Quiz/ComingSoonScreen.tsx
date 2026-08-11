/**
 * =============================================================================
 * COMING SOON
 * =============================================================================
 *
 * Stand-in for a game mode that isn't finished yet. Currently used by the
 * Top 10 Challenge (front/app/quiz/[mode].tsx).
 *
 * It keeps the game shell — the same header, the same background, the same back
 * navigation — and replaces ONLY the unfinished content, so the mode still
 * feels like part of the app instead of a dead end.
 *
 * ── CUSTOMIZE ────────────────────────────────────────────────────────────────
 *   ARTWORK ....... pass `artwork` (a require() handle); the caller picks it
 *   COPY .......... pass `title` / `subtitle`, or rely on the defaults
 *   CHROME ........ ./gameChrome.tsx
 * =============================================================================
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useDesignScale } from '../../utils/responsive';
import { GAME_COLOR, GAME_LAYOUT, GameScreenHeader } from './gameChrome';
import { GlobalQuizStats } from './GlobalQuizStats';

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (w: 400 | 500 | 600 | 700 | 800) => getAppFont(w, language);

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: GAME_COLOR.background },
    gutter: { paddingHorizontal: s(GAME_LAYOUT.gutter) },
    /** Everything below the header is centred on the remaining space. */
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(24),
      paddingBottom: s(48),
    },
    /**
     * Artwork sits in a soft purple halo so the screen still reads as part of
     * the game set rather than an error page.
     */
    artworkHalo: {
      width: '68%',
      aspectRatio: 1,
      maxWidth: s(300),
      borderRadius: s(300),
      alignItems: 'center',
      justifyContent: 'center',
    },
    artwork: { width: '76%', height: '76%' },
    copy: { alignItems: 'center', gap: s(8), width: '100%' },
    title: {
      fontFamily: font(700),
      fontSize: f(28),
      lineHeight: f(36),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: font(400),
      fontSize: f(16),
      lineHeight: f(24),
      color: GAME_COLOR.textMuted,
      textAlign: 'center',
      // Keeps the sentence to a comfortable measure on tablets.
      maxWidth: s(320),
    },
  });
}

export default function ComingSoonScreen({
  headerTitle,
  artwork,
  title,
  subtitle,
}: {
  /** Mode name shown in the shared game header. */
  headerTitle: string;
  artwork?: ImageSourcePropType;
  title?: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useTranslation();
  const { scale, fontScale, s } = useDesignScale();

  const styles = useMemo(
    () => createStyles(scale, fontScale, language),
    [scale, fontScale, language],
  );

  const heading = title ?? (language === 'ar' ? 'قريبًا' : 'Coming Soon');
  const body =
    subtitle ??
    (language === 'ar' ? 'هذه اللعبة قيد التطوير حاليًا.' : 'This game is currently under development.');

  return (
    <View style={[styles.root, styles.gutter, { paddingTop: insets.top + s(GAME_LAYOUT.contentTop) }]}>
      <GameScreenHeader
        title={headerTitle}
        onBack={() => router.back()}
        stats={<GlobalQuizStats />}
        backAccessibilityLabel={language === 'ar' ? 'رجوع' : 'Back'}
      />

      <View style={[styles.body, { paddingBottom: insets.bottom + s(48) }]}>
        {artwork ? (
          <LinearGradient
            colors={['rgba(95,0,185,0.28)', 'rgba(95,0,185,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.artworkHalo}
          >
            <Image source={artwork} style={styles.artwork} contentFit="contain" transition={180} />
          </LinearGradient>
        ) : null}

        <View style={styles.copy}>
          <Text style={styles.title} accessibilityRole="header">
            {heading}
          </Text>
          <Text style={styles.subtitle}>{body}</Text>
        </View>
      </View>
    </View>
  );
}
