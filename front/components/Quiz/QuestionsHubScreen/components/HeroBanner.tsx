/**
 * =============================================================================
 * QUESTIONS HUB — COIN PILL + HERO BANNER
 * =============================================================================
 *
 * Figma: "Group 2" (coin cluster, 91 × 39 @ 335,95) and "Frame 5" (hero card,
 * 404 × 152 @ 22,172) inside node 1:2.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   HERO IMAGE FILE ........ HERO_IMAGE below  (front/assets/images/…)
 *   HERO SCRIM ............. HERO_SCRIM_COLORS / HERO_SCRIM_LOCATIONS
 *   HERO COPY TEXT ......... ../data.ts → getQuestionsHubCopy()
 *   HERO COPY STYLING ...... ../styles.ts → heroKicker / heroTitleText /
 *                            heroTitleXp / heroSubtitle
 *   HERO SIZE & RADIUS ..... ../styles.ts → heroCard
 *   FLAME ICON SIZE ........ FLAME_ICON_SIZE below
 *   COIN PILL SHAPE ........ ../styles.ts → streakBadge / streakPill
 * =============================================================================
 */

import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import {
  HERO_XP_GRADIENT,
  HERO_XP_GRADIENT_END,
  HERO_XP_GRADIENT_LOCATIONS,
  HERO_XP_GRADIENT_START,
  useQuestionsHubStyles,
} from '../styles';
import { QuizFlameIcon } from '../../QuizFlameIcon';
import { QUIZ_FIGMA_XP_GRAD, QUIZ_FIGMA_XP_GRAD_LOCATIONS } from '../../quiz.constants';
import { useLanguageStore } from '../../../../src/i18n/store';
import type { QuestionsHubCopy } from '../data';

/**
 * HERO ARTWORK — swap this require() to change the banner image.
 * The file is 2988 × 1280 with the neon "?" on the right third and near-black
 * on the left, which is why the copy sits on the leading edge.
 */
const HERO_IMAGE = require('../../../../assets/images/questions-frame.png');

/** Scrim painted over the artwork so the copy always reads. Leading → trailing. */
const HERO_SCRIM_COLORS = ['rgba(3,3,3,0.92)', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0)'] as const;
const HERO_SCRIM_LOCATIONS = [0, 0.45, 1] as const;

/** Flame glyph inside the circular coin badge. Figma: 32 inside a 39 circle. */
const FLAME_ICON_SIZE = 32;

/* -------------------------------------------------------------------------- */
/* Gradient text helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Coin count — vertical purple gradient with a black stroke behind it. */
function StreakGradientText({ children }: { children: string }) {
  const { hub } = useQuestionsHubStyles();

  return (
    <MaskedView
      style={hub.streakPillTextMask}
      maskElement={
        <Text style={hub.streakPillText} numberOfLines={1}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={QUIZ_FIGMA_XP_GRAD}
        locations={QUIZ_FIGMA_XP_GRAD_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={[hub.streakPillText, hub.streakPillTextHidden]} numberOfLines={1}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** The oversized "XP" in the hero headline — diagonal gradient + purple bloom. */
function HeroXpGradientText({ children }: { children: string }) {
  const { hub } = useQuestionsHubStyles();

  return (
    <MaskedView
      style={hub.heroTitleXpMask}
      maskElement={
        <Text style={hub.heroTitleXp} numberOfLines={1}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={HERO_XP_GRADIENT}
        locations={HERO_XP_GRADIENT_LOCATIONS}
        start={HERO_XP_GRADIENT_START}
        end={HERO_XP_GRADIENT_END}
      >
        <Text style={[hub.heroTitleXp, hub.heroTitleXpHidden]} numberOfLines={1}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

/* -------------------------------------------------------------------------- */
/* Banner                                                                     */
/* -------------------------------------------------------------------------- */

function HeroBanner({
  coins,
  copy,
  onPressCoins,
}: {
  coins: number;
  copy: QuestionsHubCopy;
  /** Optional tap handler for the coin pill. */
  onPressCoins?: () => void;
}) {
  const { hub } = useQuestionsHubStyles();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === 'ar';

  return (
    <>
      {/* ── Coin / streak cluster ───────────────────────────────────────── */}
      <View style={hub.avatarRow}>
        <View style={hub.streakBadge}>
          <QuizFlameIcon size={FLAME_ICON_SIZE} />
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          style={hub.streakPill}
          onPress={onPressCoins}
          disabled={!onPressCoins}
          accessibilityRole="button"
          accessibilityLabel={`${coins}`}
        >
          <StreakGradientText>{coins.toLocaleString()}</StreakGradientText>
        </TouchableOpacity>
      </View>

      {/* ── Hero card ───────────────────────────────────────────────────── */}
      <View style={hub.heroCard}>
        {/* Layer 1: artwork */}
        <Image
          source={HERO_IMAGE}
          style={hub.heroCardImage}
          contentFit="cover"
          contentPosition="right center"
          // `transition` keeps the fade-in from flashing white on cold start.
          transition={160}
          // Placeholder colour while decoding, so the card is never blank.
          placeholderContentFit="cover"
          recyclingKey="questions-hero"
        />

        {/* Layer 2: legibility scrim */}
        <LinearGradient
          colors={HERO_SCRIM_COLORS}
          locations={HERO_SCRIM_LOCATIONS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={hub.heroScrim}
          pointerEvents="none"
        />

        {/* Layer 3: copy */}
        <View style={hub.heroCardOverlay}>
          <View style={hub.heroTextBlock}>
            {/* Hero kicker — "Test Your Knowledge" */}
            <Text style={hub.heroKicker} numberOfLines={1}>
              {copy.heroKicker}
            </Text>

            {/*
              Hero title — "Earn XP Points" / "واربح نقاط XP".
              The gradient "XP" sits INLINE with the plain words, so the order
              flips by language:
                ar → [XP] واربح نقاط        (XP on the left, as in Figma)
                en → Earn [XP] Points
              Edit the words themselves in ../data.ts → getQuestionsHubCopy().
            */}
            <View style={hub.heroTitleRow}>
              {isRtl ? <HeroXpGradientText>XP</HeroXpGradientText> : null}

              <Text style={hub.heroTitleText} numberOfLines={1}>
                {copy.heroTitleStart}
              </Text>

              {isRtl ? null : <HeroXpGradientText>XP</HeroXpGradientText>}

              {copy.heroTitleEnd ? (
                <Text style={hub.heroTitleText} numberOfLines={1}>
                  {copy.heroTitleEnd}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Hero subtitle */}
          <Text style={hub.heroSubtitle} numberOfLines={2}>
            {copy.heroSubtitle}
          </Text>
        </View>
      </View>
    </>
  );
}

export default memo(HeroBanner);
