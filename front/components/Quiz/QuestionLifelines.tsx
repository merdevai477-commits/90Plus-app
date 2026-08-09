/**
 * =============================================================================
 * QUESTION LIFELINES — the three hexagon power-ups above the confirm button
 * =============================================================================
 *
 * A 1:1 port of Figma component "Frame 174" (node 385:378 / 385:380), the
 * action bar that replaced the old "Need a hint?" row on every question screen.
 *
 *   ┌ 69 ┐   76   ┌ 69 ┐   76   ┌ 69 ┐
 *   │50:50│       │  ⟳  │       │ 👥 │      ← hexagon, fill #0A0213,
 *   └──▣──┘       └──▣──┘       └──▣──┘        2pt stroke #633291 → #0B0221
 *      ▲ badge pill, bottom-anchored
 *
 * Two badge variants exist in Figma:
 *   Default  (385:378) — 25 × 25 circle, 12pt, the REMAINING USE COUNT
 *   Variant2 (385:380) — 45 × 25 pill,    9pt, the XP COST ("-10 Xp")
 * `LifelineBadgeKind` picks between them.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   HEXAGON FILL / STROKE ..... HEX_FILL, HEX_STROKE
 *   GLYPH COLOUR .............. GLYPH_GRADIENT
 *   BADGE CHROME .............. styles.badge / .badgeWide / BADGE_*
 *   SIZES / GAP ............... LIFELINE_SIZE, LIFELINE_GAP (raw Figma units)
 *   WHICH LIFELINES SHOW ...... the caller — see QuestionsModeScreen → ActionBar
 * =============================================================================
 */

import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { useDesignScale } from '../../utils/responsive';
import { getAppFont } from '../../utils/fontSetup';
import { useLanguageStore } from '../../src/i18n/store';

/* ═══════════════════════════════════════════════════════════════════════════
 * TOKENS — raw Figma units, scaled through useDesignScale() at render time.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Hexagon box. Figma node 384:336 — 69 × 69. */
export const LIFELINE_SIZE = 69;
/** Space between two hexagons. Figma node 385:376 — gap 76. */
export const LIFELINE_GAP = 76;

const HEX_FILL = '#0A0213';
/** Hexagon stroke, top → bottom (Figma paint0_linear). */
const HEX_STROKE = ['#633291', '#0B0221'] as const;
/** Glyph + "50:50" fill, top → bottom (Figma paint1_linear). */
const GLYPH_GRADIENT = ['#A855F7', '#5A1B95'] as const;

const BADGE_SURFACE = '#0A0213';
const BADGE_BORDER = '#120335';
const BADGE_TEXT = '#CA98FA';

/**
 * The hexagon outline, in the 69 × 69 design space (Figma "Polygon 1").
 * Exported verbatim from the Figma SVG so the corner radii match.
 */
const HEX_PATH =
  'M33 2.02051C33.9282 1.48468 35.0718 1.48468 36 2.02051L61.8779 16.9609C62.8061 17.4968 63.3779 18.4878 63.3779 19.5596V49.4404C63.3779 50.5122 62.8061 51.5032 61.8779 52.0391L36 66.9795C35.0718 67.5153 33.9282 67.5153 33 66.9795L7.12207 52.0391C6.19387 51.5032 5.62207 50.5122 5.62207 49.4404V19.5596C5.62207 18.4878 6.19387 17.4968 7.12207 16.9609L33 2.02051Z';

/** "ci:arrows-reload-01" — swap the current question. */
const GLYPH_RELOAD =
  'M32.75 37.4992L26 34.6867L27.125 43.1242M26.6559 29.6276C27.2868 28.0666 28.3429 26.7138 29.7042 25.7231C31.0655 24.7324 32.6775 24.1434 34.3568 24.023C36.0362 23.9027 37.7156 24.2558 39.2043 25.0423C40.693 25.8288 41.9312 27.0171 42.7783 28.4722M43.3453 36.3708C42.7145 37.9321 41.6584 39.2851 40.2969 40.2761C38.9355 41.267 37.3234 41.8562 35.6438 41.9765C32.75 41.9765 31.3949 41.2735 30.7958 40.9569C29.3069 40.1702 26.8649 36.2765 26.0179 34.8212';

/** "fa-solid:users" — ask the crowd. */
const GLYPH_USERS =
  'M24.5 33.5C26.1547 33.5 27.5 32.1547 27.5 30.5C27.5 28.8453 26.1547 27.5 24.5 27.5C22.8453 27.5 21.5 28.8453 21.5 30.5C21.5 32.1547 22.8453 33.5 24.5 33.5ZM45.5 33.5C47.1547 33.5 48.5 32.1547 48.5 30.5C48.5 28.8453 47.1547 27.5 45.5 27.5C43.8453 27.5 42.5 28.8453 42.5 30.5C42.5 32.1547 43.8453 33.5 45.5 33.5ZM47 35H44C43.175 35 42.4297 35.3328 41.8859 35.8719C43.775 36.9078 45.1156 38.7781 45.4062 41H48.5C49.3297 41 50 40.3297 50 39.5V38C50 36.3453 48.6547 35 47 35ZM35 35C37.9016 35 40.25 32.6516 40.25 29.75C40.25 26.8484 37.9016 24.5 35 24.5C32.0984 24.5 29.75 26.8484 29.75 29.75C29.75 32.6516 32.0984 35 35 35ZM38.6 36.5H38.2109C37.2359 36.9688 36.1531 37.25 35 37.25C33.8469 37.25 32.7687 36.9688 31.7891 36.5H31.4C28.4187 36.5 26 38.9188 26 41.9V43.25C26 44.4922 27.0078 45.5 28.25 45.5H41.75C42.9922 45.5 44 44.4922 44 43.25V41.9C44 38.9188 41.5812 36.5 38.6 36.5ZM28.1141 35.8719C27.5703 35.3328 26.825 35 26 35H23C21.3453 35 20 36.3453 20 38V39.5C20 40.3297 20.6703 41 21.5 41H24.5891C24.8844 38.7781 26.225 36.9078 28.1141 35.8719Z';

/** Which glyph sits inside the hexagon. `fifty` draws text instead of a path. */
export type LifelineGlyph = 'fifty' | 'reload' | 'users';

/** `count` → 25pt circle with a number. `cost` → 45pt pill with "-10 Xp". */
export type LifelineBadgeKind = 'count' | 'cost';

export interface Lifeline {
  id: string;
  glyph: LifelineGlyph;
  /** Text inside the bottom badge — a remaining count, or an XP cost. */
  badgeLabel: string;
  badgeKind: LifelineBadgeKind;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

/* -------------------------------------------------------------------------- */

/** Gradient-filled text (RN stand-in for CSS `background-clip: text`). */
function GradientLabel({ style, children }: { style: object; children: string }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient
        colors={GLYPH_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={[style, hidden.text]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const hidden = StyleSheet.create({ text: { opacity: 0 } });

function LifelineButton({ lifeline }: { lifeline: Lifeline }) {
  const { s, f } = useDesignScale();
  const language = useLanguageStore((state) => state.language);
  const size = s(LIFELINE_SIZE);
  const font = (weight: 400 | 500 | 600) => getAppFont(weight, language);

  const isWide = lifeline.badgeKind === 'cost';

  return (
    <TouchableOpacity
      onPress={lifeline.onPress}
      disabled={lifeline.disabled}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(lifeline.disabled) }}
      accessibilityLabel={lifeline.accessibilityLabel}
      style={[
        styles.item,
        // +3 so the badge, which hangs 3pt below the hexagon, is not clipped.
        { width: size, height: size + s(3) },
        lifeline.disabled && styles.itemDisabled,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 69 69" fill="none">
        <Defs>
          <SvgLinearGradient
            id="lifelineHexStroke"
            x1="35"
            y1="-4"
            x2="34.5"
            y2="69"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={HEX_STROKE[0]} />
            <Stop offset="1" stopColor={HEX_STROKE[1]} />
          </SvgLinearGradient>
          <SvgLinearGradient
            id="lifelineGlyph"
            x1="35"
            y1="23"
            x2="35"
            y2="45.5"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={GLYPH_GRADIENT[0]} />
            <Stop offset="1" stopColor={GLYPH_GRADIENT[1]} />
          </SvgLinearGradient>
        </Defs>

        <Path d={HEX_PATH} fill={HEX_FILL} stroke="url(#lifelineHexStroke)" strokeWidth={2} />

        {lifeline.glyph === 'reload' ? (
          <Path
            d={GLYPH_RELOAD}
            stroke="url(#lifelineGlyph)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {lifeline.glyph === 'users' ? <Path d={GLYPH_USERS} fill="url(#lifelineGlyph)" /> : null}
      </Svg>

      {/* "50:50" is set as text rather than a path — Figma node 385:342. */}
      {lifeline.glyph === 'fifty' ? (
        <View style={[styles.glyphTextWrap, { width: size, height: size }]} pointerEvents="none">
          <GradientLabel style={{ fontFamily: font(600), fontSize: f(15), textAlign: 'center' }}>
            50:50
          </GradientLabel>
        </View>
      ) : null}

      {/* Bottom badge — remaining uses, or the XP cost. */}
      <View
        style={[
          styles.badge,
          {
            width: s(isWide ? 45 : 25),
            height: s(25),
            borderRadius: s(26),
            // Figma: count badge hangs 3pt below the hexagon, cost badge 0.5pt.
            bottom: isWide ? s(2.5) : 0,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: font(isWide ? 500 : 400),
            fontSize: f(isWide ? 9 : 12),
            color: BADGE_TEXT,
          }}
          numberOfLines={1}
        >
          {lifeline.badgeLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function QuestionLifelines({ lifelines }: { lifelines: Lifeline[] }) {
  const { s } = useDesignScale();

  return (
    <View style={[styles.row, { gap: s(LIFELINE_GAP) }]}>
      {lifelines.map((lifeline) => (
        <LifelineButton key={lifeline.id} lifeline={lifeline} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    alignItems: 'center',
  },
  itemDisabled: { opacity: 0.45 },
  glyphTextWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BADGE_SURFACE,
    borderWidth: 1,
    borderColor: BADGE_BORDER,
  },
});

export default memo(QuestionLifelines);
