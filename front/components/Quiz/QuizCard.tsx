/**
 * QuizCard — the Football Quiz question block, Figma node 238:374.
 *
 * The question text is drawn INSIDE the artwork card, pinned to its bottom over
 * a dark scrim (Figma 288:326 / 288:321) — there is no separate heading above
 * the image on this screen. Below it come the 64pt gradient choice rows with
 * the letter badge on the copy's leading edge.
 *
 * Every measurement is the raw Figma value scaled by `useDesignScale()`, and
 * the answer rows grow rather than truncate, so a long player or club name is
 * always fully readable on any device.
 *
 * JUDGMENT CALL: `hideImageUntilReveal` / mystery-slot behaviour (guess_player /
 * logo / stadium question types not yet revealed) is preserved — it is real
 * product logic, not a visual mismatch. Figma's frame only draws the "revealed"
 * state of a normal question. When there is no image at all, the card is
 * omitted and the question is rendered on its own.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Lightbulb, User } from 'lucide-react-native';

import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useDesignScale } from '../../utils/responsive';
import { GameAnswerOption, GameAnswerOptionList } from './GameAnswerOption';
import { MOTION } from './gameMotion';
import { GAME_COLOR } from './gameChrome';
import type { OptionKey, QuizImageLayout, QuizOption } from './quiz.constants';

/** Figma 288:326 — 404 × 272 artwork card. */
const IMAGE_ASPECT_RATIO = 404 / 272;

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (w: 400 | 500 | 600 | 700 | 800) => getAppFont(w, language);
  const isRtl = language === 'ar';
  const textAlign = isRtl ? ('right' as const) : ('left' as const);

  return StyleSheet.create({
    card: { width: '100%' },

    /* ── Artwork card — Figma 288:326 ─────────────────────────────────── */
    imageCard: {
      width: '100%',
      aspectRatio: IMAGE_ASPECT_RATIO,
      borderRadius: s(25),
      overflow: 'hidden',
      marginBottom: s(48),
      justifyContent: 'flex-end',
      backgroundColor: GAME_COLOR.tileSurface,
      // Figma drop-shadow 0 2px 15.2px rgba(95,0,185,0.4).
      shadowColor: 'rgba(95,0,185,0.4)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: s(15.2),
      elevation: 8,
    },
    image: { ...StyleSheet.absoluteFillObject },
    /** Multiply scrim so the question stays readable over any artwork. */
    imageScrim: { ...StyleSheet.absoluteFillObject },
    imageOverlayQuestion: {
      paddingHorizontal: s(24),
      paddingBottom: s(12),
      fontFamily: font(600),
      fontSize: f(21),
      lineHeight: f(28),
      color: GAME_COLOR.textPrimary,
      textAlign,
    },

    /* ── No-artwork fallbacks ─────────────────────────────────────────── */
    questionOnlyBlock: { width: '100%', marginBottom: s(48) },
    questionOnlyText: {
      fontFamily: font(600),
      fontSize: f(21),
      lineHeight: f(28),
      color: GAME_COLOR.textPrimary,
      textAlign,
    },
    mysterySlot: {
      width: '100%',
      aspectRatio: IMAGE_ASPECT_RATIO,
      borderRadius: s(25),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      backgroundColor: GAME_COLOR.tileSurface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
      marginBottom: s(48),
      paddingHorizontal: s(24),
    },
    mysteryLabel: {
      fontFamily: font(700),
      fontSize: f(12),
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
    },

    /* ── Hint ─────────────────────────────────────────────────────────── */
    hintBanner: {
      width: '100%',
      flexDirection: isRtl ? 'row' : 'row-reverse',
      alignItems: 'flex-start',
      gap: s(8),
      padding: s(10),
      marginBottom: s(16),
      borderRadius: s(12),
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(250,204,21,0.35)',
    },
    hintBannerText: {
      flex: 1,
      fontFamily: font(600),
      fontSize: f(13),
      lineHeight: f(18),
      color: '#FDE68A',
      textAlign,
    },

    /* ── Answer rows live in ./GameAnswerOption (shared by every mode) ── */
    submittingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
      paddingVertical: s(6),
    },
    submittingText: {
      fontFamily: font(600),
      fontSize: f(13),
      color: 'rgba(255,255,255,0.65)',
    },
  });
}

type QuizCardStyles = ReturnType<typeof createStyles>;

function useQuizCardStyles(): QuizCardStyles {
  const { scale, fontScale } = useDesignScale();
  const { language } = useTranslation();
  return useMemo(() => createStyles(scale, fontScale, language), [scale, fontScale, language]);
}

interface QuizCardProps {
  question: string;
  questionType?: string;
  imageUrl?: string | null;
  revealImageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  options: QuizOption[];
  selectedKey: OptionKey | null;
  onSelectOption: (key: OptionKey) => void;
  answerRevealed?: boolean;
  isCorrect?: boolean | null;
  correctKey?: OptionKey | null;
  disableOptions?: boolean;
  isSubmitting?: boolean;
  hintText?: string | null;
  /** "Ask the crowd" result, keyed by option key. Omit to show nothing. */
  statPercentByKey?: Record<string, number>;
}

function QuizCardInner({
  question,
  questionType = 'normal',
  imageUrl,
  revealImageUrl = null,
  imageLayout,
  options,
  selectedKey,
  onSelectOption,
  answerRevealed = false,
  isCorrect = null,
  correctKey = null,
  disableOptions = false,
  isSubmitting = false,
  hintText = null,
  statPercentByKey,
}: QuizCardProps) {
  const { t } = useTranslation();
  const styles = useQuizCardStyles();
  const { s } = useDesignScale();

  const isGuessPlayer = questionType === 'guess_player';
  const hideImageUntilReveal =
    isGuessPlayer || questionType === 'logo' || questionType === 'stadium';
  const effectiveImageUrl = answerRevealed
    ? revealImageUrl?.trim() || imageUrl?.trim() || null
    : hideImageUntilReveal
      ? null
      : imageUrl?.trim() || null;
  const hasImageUrl = Boolean(effectiveImageUrl);
  const showMysterySlot = isGuessPlayer && !answerRevealed;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [effectiveImageUrl]);

  return (
    <View style={styles.card}>
      {showMysterySlot ? (
        <View style={styles.mysterySlot}>
          <User size={s(56)} color={GAME_COLOR.accent} strokeWidth={1.5} />
          <Text style={styles.mysteryLabel}>{t.quiz.guessPlayerHidden}</Text>
          {/* The artwork is withheld in this state, so the question has to be
              readable here. Bounded so it can't overflow the fixed-ratio slot. */}
          <Text style={styles.questionOnlyText} numberOfLines={4}>
            {question}
          </Text>
        </View>
      ) : hasImageUrl && !imageLoadFailed ? (
        <View style={styles.imageCard}>
          <Image
            source={{ uri: effectiveImageUrl! }}
            style={styles.image}
            /*
             * `imageLayout` is the API's own hint about the artwork and was
             * being ignored, so a 1:1 crest or headshot got cropped top and
             * bottom to fill the 404×272 frame. A 'square' image is now
             * CONTAINED (whole image, letterboxed on the card surface) and
             * anything else keeps the Figma photo treatment — `cover`.
             */
            contentFit={imageLayout === 'square' ? 'contain' : 'cover'}
            // Shared image fade — ./gameMotion keeps every mode's artwork
            // arriving at the same speed.
            transition={MOTION.duration.image}
            cachePolicy="memory-disk"
            onError={() => setImageLoadFailed(true)}
          />
          <LinearGradient
            colors={['rgba(245,245,245,0)', 'rgba(0,0,0,0.82)']}
            locations={[0.307, 0.607]}
            style={styles.imageScrim}
            pointerEvents="none"
          />
          <Text style={styles.imageOverlayQuestion} numberOfLines={3}>
            {question}
          </Text>
        </View>
      ) : (
        <View style={styles.questionOnlyBlock}>
          <Text style={styles.questionOnlyText}>{question}</Text>
        </View>
      )}

      {hintText ? (
        <View style={styles.hintBanner}>
          <Lightbulb size={s(16)} color="#FACC15" />
          <Text style={styles.hintBannerText}>{hintText}</Text>
        </View>
      ) : null}

      {/*
        The SHARED answer stack and rows — ./GameAnswerOption, the very same
        component Guess The Player, Guess The Club, Transfer Puzzle and Player
        Connections render. Football Quiz no longer keeps its own copy, so the
        shape, border, radius, fill, type, padding, spacing, selected state and
        correct/wrong markers are identical across every mode by construction.
      */}
      <GameAnswerOptionList>
        {isSubmitting ? (
          <View style={styles.submittingRow}>
            <ActivityIndicator size="small" color={GAME_COLOR.accent} />
            <Text style={styles.submittingText}>{t.quiz.submittingAnswer}</Text>
          </View>
        ) : null}
        {options.map((opt) => (
          <GameAnswerOption
            key={opt.key}
            label={opt.text}
            letter={opt.key}
            selected={selectedKey === opt.key}
            revealed={answerRevealed}
            correct={answerRevealed && correctKey === opt.key}
            wrong={answerRevealed && selectedKey === opt.key && isCorrect === false}
            disabled={disableOptions}
            statPercent={statPercentByKey?.[opt.key]}
            onPress={() => onSelectOption(opt.key)}
          />
        ))}
      </GameAnswerOptionList>
    </View>
  );
}

export const QuizCard = React.memo(QuizCardInner);
