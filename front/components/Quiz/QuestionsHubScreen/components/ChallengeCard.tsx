/**
 * =============================================================================
 * QUESTIONS HUB — CHALLENGE CARD
 * =============================================================================
 *
 * One tappable card in the "Choose Challenge Type" grid. Tapping it routes to
 * /quiz/[mode] (wired in ../QuestionsHubScreen.tsx → handleModePress).
 *
 * Two silhouettes, both 194pt wide in Figma:
 *   • horizontal — 109 tall, artwork BESIDE the copy  (guess-player, bingo)
 *   • vertical   — 149 tall, artwork ABOVE the copy   (every other mode)
 * Which one a mode uses is decided in ../data.ts → getChallengeLayout().
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   PER-MODE PADDING / ARTWORK SIZE ... CHALLENGE_LAYOUT below
 *   CARD HEIGHT / RADIUS / BORDER ..... ../styles.ts → card.horizontalCard,
 *                                       card.verticalCard, HUB_RADIUS.card
 *   CARD BACKGROUND ................... ../styles.ts → HUB_COLOR.cardBg
 *   TITLE / SUBTITLE / XP TYPE ........ ../styles.ts → card.title / .subtitle /
 *                                       .xpText
 *   XP GRADIENT ....................... ../styles.ts → XP_GRADIENT
 *   PRESS FEEDBACK .................... ACTIVE_OPACITY below
 *   ARTWORK SOURCE .................... ../data.ts → MODE_LOCAL_IMAGE
 * =============================================================================
 */

import React, { memo, useState } from 'react';
import { I18nManager, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import { QuestionsModeArt } from '../../QuestionsModeArt';
import type { Challenge } from '../data';
import type { QuestionModeId } from '../../../../services/questionsModes';
import {
  useQuestionsHubStyles,
  XP_GRADIENT,
  XP_GRADIENT_END,
  XP_GRADIENT_LOCATIONS,
  XP_GRADIENT_START,
} from '../styles';

/** How much the card dims while pressed. */
const ACTIVE_OPACITY = 0.84;

/**
 * PER-MODE LAYOUT OVERRIDES
 *
 * Figma gives every card its own padding and artwork box, so this is a plain
 * lookup keyed by mode id rather than a chain of ternaries — each entry maps
 * 1:1 to that mode's frame in node 1:2.
 *
 * All values are RAW FIGMA UNITS; they are scaled by `s()` below.
 *
 *   card.paddingVertical … top inset of the artwork inside the card
 *   card.paddingRight    … trailing inset
 *   image.width/height   … artwork box
 *   image.marginLeft     … leading inset of the artwork
 *   textMarginLeft       … leading inset of the copy column
 */
type ChallengeLayoutConfig = {
  /** Card side padding — Figma `px-[N]` on the mode's frame. */
  paddingHorizontal: number;
  /** Artwork box. */
  image: { width: number; height: number };
};

const CHALLENGE_LAYOUT: Record<QuestionModeId, ChallengeLayoutConfig> = {
  // Figma Frame 27:287 — px-10, image 81×80
  'guess-player': { paddingHorizontal: 10, image: { width: 81, height: 80 } },
  // Figma Frame 8:31 — px-10, image 81×80
  'football-bingo': { paddingHorizontal: 10, image: { width: 81, height: 80 } },
  // Figma Frame 30:314 — px-16, image 115×66
  'football-grid': { paddingHorizontal: 16, image: { width: 115, height: 66 } },
  // Figma Frame 27:300 — px-16, image 117×66
  'player-connections': { paddingHorizontal: 16, image: { width: 117, height: 66 } },
  // Figma Frame 52:370 — px-16, image 150×56
  'guess-club': { paddingHorizontal: 16, image: { width: 150, height: 56 } },
  // Figma Frame 57:384 — px-22, image 127×56
  'transfer-puzzle': { paddingHorizontal: 22, image: { width: 127, height: 56 } },
  // Figma Frame 57:406 — px-22, image 118×58
  'top10-challenge': { paddingHorizontal: 22, image: { width: 118, height: 58 } },
  // Figma Frame 57:395 — px-22, image 65×64
  'football-quiz': { paddingHorizontal: 22, image: { width: 65, height: 64 } },
};

/**
 * "+50 XP" rendered as gradient-filled text (RN take on background-clip: text).
 *
 * `numberOfLines={1}` on both the mask and the measuring copy keeps the box one
 * line tall, and `card.xpMask` marks it non-shrinking so a long subtitle beside
 * it can never squeeze the reward down to "+1…" or out past the card edge.
 */
function XpGradientText({ style, children }: { style: object; children: string }) {
  const { card } = useQuestionsHubStyles();

  return (
    <MaskedView
      style={card.xpMask}
      maskElement={
        <Text style={style} numberOfLines={1}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={XP_GRADIENT}
        locations={XP_GRADIENT_LOCATIONS}
        start={XP_GRADIENT_START}
        end={XP_GRADIENT_END}
      >
        <Text style={[style, card.xpTextHidden]} numberOfLines={1}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { card, metrics } = useQuestionsHubStyles();
  const { s } = metrics;
  const isRtl = I18nManager.isRTL;
  const isHorizontal = challenge.layout === 'horizontal';
  const layout = CHALLENGE_LAYOUT[challenge.id];

  // If the remote-URI image (from the API's previewImage) fails to load, fall
  // back to the bundled local asset for this mode instead of leaving the card
  // blank.
  const [imageFailed, setImageFailed] = useState(false);
  const isRemoteSource = typeof challenge.imageSource === 'object';
  const resolvedImage =
    isRemoteSource && imageFailed
      ? challenge.fallbackImageSource
      : challenge.imageSource ?? challenge.fallbackImageSource;

  /* Scale the raw Figma overrides to device units. */
  const cardPadding: ViewStyle = { paddingHorizontal: s(layout.paddingHorizontal) };
  const imageSize = { width: s(layout.image.width), height: s(layout.image.height) };

  const art = resolvedImage ? (
    <Image
      source={resolvedImage}
      style={[isHorizontal ? card.horizontalImg : card.verticalImg, imageSize]}
      contentFit="cover"
      transition={140}
      onError={() => setImageFailed(true)}
    />
  ) : (
    // Last-resort vector art so a card is never empty.
    <QuestionsModeArt modeId={challenge.id} size={s(layout.image.width)} />
  );

  return (
    <TouchableOpacity
      onPress={challenge.onPress}
      activeOpacity={ACTIVE_OPACITY}
      style={[card.card, isHorizontal ? card.horizontalCard : card.verticalCard, cardPadding]}
      accessibilityRole="button"
      accessibilityLabel={challenge.title}
    >
      {isHorizontal ? (
        /* ── Horizontal: artwork | (title / subtitle) / XP ───────────────── */
        <>
          <View style={card.horizontalArt}>{art}</View>
          <View style={card.horizontalTextCol}>
            <View style={card.horizontalTitleGroup}>
              <Text style={card.title} numberOfLines={2}>
                {challenge.title}
              </Text>
              <Text style={card.subtitle} numberOfLines={1}>
                {challenge.subtitle}
              </Text>
            </View>
            {challenge.xpReward > 0 ? (
              <XpGradientText style={card.xpText}>{`+${challenge.xpReward} XP`}</XpGradientText>
            ) : null}
          </View>
        </>
      ) : (
        /* ── Vertical: artwork above, then title, then subtitle + XP row ─── */
        <>
          {art}
          <View style={card.verticalTextBlock}>
            {/* Figma Frame 7 on the tall cards is a single 17pt line — wrapping
                to two would push the XP row past the card's fixed 149pt box. */}
            <Text style={card.title} numberOfLines={1}>
              {challenge.title}
            </Text>
            <View style={[card.horizontalSubXpRow, isRtl && card.horizontalSubXpRowRtl]}>
              <Text style={card.subtitle} numberOfLines={1}>
                {challenge.subtitle}
              </Text>
              {challenge.xpReward > 0 ? (
                <XpGradientText style={card.xpText}>{`+${challenge.xpReward} XP`}</XpGradientText>
              ) : null}
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default memo(ChallengeCard);
