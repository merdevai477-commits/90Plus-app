/**
 * =============================================================================
 * THE ANSWER OPTION — one row, shared by every question mode
 * =============================================================================
 *
 * Figma 288:292 (Football Quiz) · 241:500 (Transfer Puzzle) · 285:1781 (Player
 * Connections) all draw the SAME row, and this is it:
 *
 *   [ ○ ]  label                                    [ crest ]  [ A ]
 *          muted example line
 *
 * Football Quiz used to carry its own copy of this row (QuizCard) while the
 * other six modes used another (QuestionsModeScreen). The two were written to
 * the same Figma values, so they matched — until one of them was edited. Both
 * now render THIS component, so they cannot drift again: shape, border, radius,
 * fill, type, padding, spacing, the selected / correct / wrong states, the
 * marker glyphs and the pressed feedback are defined once, here.
 *
 * ── WHAT YOU CAN CHANGE ──────────────────────────────────────────────────────
 *   ROW SHAPE / BORDER / PADDING ... styles.row
 *   SELECTED / CORRECT / WRONG ..... styles.rowSelected · rowCorrect · rowWrong
 *   LABEL + EXAMPLE TYPE ........... styles.label · styles.example
 *   LETTER BADGE ................... styles.letterBadge · styles.letterText
 *   SELECTION RING ................. styles.marker · styles.markerFill
 *   ROW SPACING .................... styles.list (GameAnswerOptionList)
 * =============================================================================
 */

import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { useLanguageStore } from '../../src/i18n/store';
import { getAppFont } from '../../utils/fontSetup';
import { useDesignScale, type DesignScale } from '../../utils/responsive';
import { CrestSlot } from './QuestionsModeBoards';
import { GAME_COLOR, GameGradientText } from './gameChrome';
import { GamePressable, usePulse } from './gameMotion';

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (w: 400 | 500 | 600 | 700 | 800) => getAppFont(w, language);
  const isRtl = language === 'ar';
  const textAlign = isRtl ? ('right' as const) : ('left' as const);

  return StyleSheet.create({
    /** Vertical rhythm between rows — Figma 12pt. */
    list: { width: '100%', gap: s(12) },

    /**
     * `minHeight`, not `height`: a long club or player name has to wrap and
     * grow the row rather than be clipped or ellipsised.
     */
    row: {
      minHeight: s(64),
      flexDirection: isRtl ? 'row' : 'row-reverse',
      alignItems: 'center',
      gap: s(12),
      paddingHorizontal: s(24),
      paddingVertical: s(12),
      borderRadius: s(16),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
    },
    /** Figma gives a row with the muted second line a taller minimum. */
    rowWithExample: { minHeight: s(76) },
    rowSelected: { borderColor: GAME_COLOR.accent },
    rowCorrect: { borderColor: GAME_COLOR.correct },
    rowWrong: { borderColor: GAME_COLOR.wrong },

    /** Figma "Ellipse 25" — a 24pt ring on the leading edge. */
    marker: {
      width: s(24),
      height: s(24),
      borderRadius: s(12),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerFill: {
      width: s(12),
      height: s(12),
      borderRadius: s(6),
      backgroundColor: GAME_COLOR.accent,
    },
    markerWrong: { color: GAME_COLOR.wrong, fontSize: f(14), fontWeight: '900' as const },

    /** Copy + badge, filling the space the marker leaves. */
    trailing: {
      flex: 1,
      flexDirection: isRtl ? 'row' : 'row-reverse',
      alignItems: 'center',
      gap: s(12),
    },
    textBlock: { flex: 1, gap: s(2) },
    label: {
      fontFamily: font(500),
      fontSize: f(19),
      lineHeight: f(24),
      color: GAME_COLOR.textPrimary,
      textAlign,
    },
    /** Figma node 285:1807 — the muted "e.g. …" line. */
    example: {
      fontFamily: font(400),
      fontSize: f(12),
      lineHeight: f(16),
      color: GAME_COLOR.textExample,
      textAlign,
    },
    /** Club crest on a Transfer Puzzle row — Figma 241:533 (35 × 48 box). */
    crest: { width: s(38), height: s(46) },

    /**
     * "Ask the crowd" percentage — no Figma node of its own (the lifeline was
     * shipped locked/disabled), so it borrows the row's existing accent purple
     * and sits where the crest/letter badge does: a fixed-width trailing
     * chip that doesn't reflow the label or shrink the touch target.
     */
    statPercent: {
      minWidth: s(42),
      fontFamily: font(700),
      fontSize: f(15),
      lineHeight: f(20),
      color: GAME_COLOR.accent,
      textAlign: 'center',
    },

    /** The 42×42 letter tile — Figma 288:297 / 240:434. */
    letterBadge: {
      width: s(42),
      height: s(42),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: GAME_COLOR.accent,
      backgroundColor: GAME_COLOR.tileSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letterText: {
      fontFamily: font(600),
      fontSize: f(20),
      lineHeight: f(26),
      color: GAME_COLOR.accent,
      textAlign: 'center' as const,
    },
  });
}

type AnswerStyles = ReturnType<typeof createStyles>;

/** Styles are a pure function of (scale, language) — cache to avoid rebuilds. */
const styleCache = new Map<string, AnswerStyles>();

export function useAnswerOptionStyles(): { styles: AnswerStyles; metrics: DesignScale } {
  const metrics = useDesignScale();
  const language = useLanguageStore((state) => state.language);
  const { scale, fontScale } = metrics;
  const cacheKey = `${Math.round(scale * 1000)}-${language}`;

  const styles = useMemo(() => {
    const cached = styleCache.get(cacheKey);
    if (cached) return cached;
    const created = createStyles(scale, fontScale, language);
    styleCache.set(cacheKey, created);
    return created;
  }, [cacheKey, scale, fontScale, language]);

  return { styles, metrics };
}

/** The stack the rows live in — owns the 12pt gap so every mode matches. */
export function GameAnswerOptionList({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { styles } = useAnswerOptionStyles();
  return <View style={[styles.list, style as ViewStyle]}>{children}</View>;
}

export interface GameAnswerOptionProps {
  label: string;
  /** Muted second line under the label. */
  example?: string;
  /** Letter badge ("A" / "أ"). Omit for a crest-led row. */
  letter?: string;
  crestUrl?: string;
  showCrest?: boolean;
  selected: boolean;
  /** The answer key is out in the open — locks the row and drives the colours. */
  revealed?: boolean;
  correct?: boolean;
  wrong?: boolean;
  /** Defaults to `revealed`; pass explicitly to lock a row while submitting. */
  disabled?: boolean;
  /**
   * "Ask the crowd" percentage for this option — omit to show nothing.
   * Rendered in the trailing chip slot; never affects selection or the
   * marker/letter, and never appears unless the crowd lifeline was used.
   */
  statPercent?: number;
  onPress: () => void;
}

/**
 * ONE answer row. Which glyph the marker shows:
 *   not selected ........ empty ring
 *   selected, hidden .... filled purple dot
 *   selected, correct ... green check
 *   selected, wrong ..... red ×
 */
export function GameAnswerOption({
  label,
  example,
  letter,
  crestUrl,
  showCrest = false,
  selected,
  revealed = false,
  correct = false,
  wrong = false,
  disabled,
  statPercent,
  onPress,
}: GameAnswerOptionProps) {
  const { styles, metrics } = useAnswerOptionStyles();
  const isDisabled = disabled ?? revealed;

  /*
   * MOTION (shared — ./gameMotion):
   *  • held down → the row squeezes 2% under a slight dim, the same feedback
   *    every tappable surface in the Questions flow gives.
   *  • marked correct or wrong → one short beat, so the verdict registers
   *    without a flashing or bouncing row.
   * Both are transform/opacity only: the row's size, spacing and hit area are
   * exactly what the stylesheet says at every moment.
   */
  const verdictPulse = usePulse(revealed && (correct || wrong), {
    enabled: revealed && (correct || wrong),
  });

  return (
    <GamePressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={[label, example, typeof statPercent === 'number' ? `${statPercent}%` : null]
        .filter(Boolean)
        .join('. ')}
      accessibilityState={{ selected, disabled: isDisabled }}
    >
      <Animated.View style={verdictPulse}>
        <LinearGradient
          colors={[...GAME_COLOR.rowGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.row,
            example ? styles.rowWithExample : null,
            selected && !revealed ? styles.rowSelected : null,
            correct ? styles.rowCorrect : null,
            wrong ? styles.rowWrong : null,
          ]}
        >
          <View style={styles.marker}>
            {selected ? (
              revealed ? (
                correct ? (
                  <Check size={metrics.s(14)} color={GAME_COLOR.correct} strokeWidth={3} />
                ) : (
                  <Text style={styles.markerWrong}>×</Text>
                )
              ) : (
                <View style={styles.markerFill} />
              )
            ) : null}
          </View>

          <View style={styles.trailing}>
            <View style={styles.textBlock}>
              <Text style={styles.label}>{label}</Text>
              {example ? <Text style={styles.example}>{example}</Text> : null}
            </View>

            {showCrest ? (
              <CrestSlot
                url={crestUrl}
                label={label}
                style={styles.crest}
                fontSize={metrics.f(15)}
              />
            ) : null}

            {typeof statPercent === 'number' ? (
              <Text style={styles.statPercent} numberOfLines={1}>
                {statPercent}%
              </Text>
            ) : null}

            {letter ? (
              <View style={styles.letterBadge}>
                {/* Figma 240:434 — gradient-filled letter, #a855f7 → #633291. */}
                <GameGradientText
                  value={letter}
                  style={styles.letterText}
                  colors={[GAME_COLOR.accent, GAME_COLOR.accentDeep]}
                />
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>
    </GamePressable>
  );
}
