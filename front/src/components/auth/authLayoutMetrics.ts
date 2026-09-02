/**
 * =============================================================================
 * PRE-LOGIN LAYOUT METRICS
 * =============================================================================
 *
 * Every measurement on the auth screens is a value taken from the Figma frame
 * (node 1015:3722, 448 × 1154) converted to device units at render time.
 *
 * ── WHY THIS FILE EXISTS IN THIS SHAPE ───────────────────────────────────────
 * The screens used to mix two systems: the HERO scaled with screen width while
 * the PANEL (buttons, fields, type, and the 55/48/42/41pt gaps between them)
 * was hard-coded in Figma units. On the 448pt frame those agree; on a real
 * phone they do not, and the disagreement grows at both ends:
 *
 *   iPhone SE (320–375pt)  the hero keeps ~40% of a SHORT screen while the
 *                          panel stays full size, so the Sign Up button is
 *                          pushed hundreds of points below the fold.
 *   iPad / landscape       scale = width/448 is unbounded, so an 834pt-wide
 *                          iPad drew a 727pt-tall hero over a panel whose
 *                          contents stayed phone-sized.
 *
 * So: ONE scale, CLAMPED, applied to everything. `s()` and `f()` mirror
 * utils/responsive.ts — the same convention the whole quiz feature uses — so
 * proportions hold from a 320pt iPhone SE to a tablet without a per-device
 * special case anywhere.
 *
 * ── WHAT YOU CAN CHANGE ──────────────────────────────────────────────────────
 *   FIGMA VALUES ......... FIGMA_AUTH_FRAME
 *   HOW FAR IT SCALES .... AUTH_SCALE_MIN / AUTH_SCALE_MAX
 *   HERO SIZE ............ HERO_MAX_HEIGHT_RATIO / HERO_MIN_HEIGHT_RATIO
 *   PANEL POSITION ....... FIGMA_PANEL_OVERLAP / PANEL_DROP_STEPS
 * =============================================================================
 */

import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/** Figma sign-up screen metrics (node 1015:3722, frame 448×1154). */
export const FIGMA_AUTH_FRAME = {
  width: 448,
  height: 1154,
  heroHeight: 391,
  heroOffsetY: -381.5,
  panelWidth: 408,
  panelHeight: 747,
  panelOffsetY: 160.5,
  panelContentWidth: 368,
  panelHeaderWidth: 314,
  horizontalInset: 20,
  panelPaddingX: 20,
} as const;

/** Hero bottom (391) minus panel top (364) on the Figma frame. */
export const FIGMA_PANEL_OVERLAP = 27;

/** Nudge panel down in "steps" (1 step = 16px on Figma frame). */
export const PANEL_DROP_STEPS = 3;
export const PANEL_STEP_PX = 16;

/**
 * Clamp bounds for the layout scale.
 *
 * Lower bound keeps the smallest iPhone legible and its touch targets at or
 * above the 44pt accessibility minimum: the primary button is 56 design units,
 * and 56 × 0.80 = 45. Upper bound stops a tablet or a landscape phone from
 * inflating a phone layout into a cartoon.
 */
export const AUTH_SCALE_MIN = 0.8;
export const AUTH_SCALE_MAX = 1.1;

/** Fonts scale at a reduced rate so text stays readable at both extremes. */
const FONT_SCALE_DAMPING = 0.5;

/**
 * The hero is an aspect-locked composite, so its height follows the width.
 * These bound the RESULT against the screen's own height, which is what makes
 * the layout hold on phones whose aspect ratio is not the modern ~19.5:9:
 *
 *   • iPhone SE / 8 (16:9) — 391/448 of the width is nearly half of a short
 *     screen, and every point of it pushes the form further down. Capped.
 *   • A very tall or a landscape window — the floor stops the hero collapsing
 *     into a strip that no longer reads as artwork.
 *
 * At the cap the image is centre-cropped by `cover`, which takes from the
 * composite's own top and bottom margins rather than its artwork.
 */
const HERO_MAX_HEIGHT_RATIO = 0.44;
const HERO_MIN_HEIGHT_RATIO = 0.22;

/**
 * Widest the panel column is allowed to get. A phone layout stretched across a
 * tablet leaves 60-character-wide input fields; this keeps the column at a
 * readable width and centres it instead.
 */
export const AUTH_MAX_CONTENT_WIDTH = 520;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface AuthLayoutMetrics {
  /** Multiplier for spacing, sizes and radii. */
  scale: number;
  /** Multiplier for font sizes (damped). */
  fontScale: number;
  /** Figma spacing/size → device units. */
  s: (designValue: number) => number;
  /** Figma font size → device units. */
  f: (designFontSize: number) => number;
  /** Height of the hero artwork, already bounded against the screen. */
  heroHeight: number;
  /** How far the panel rides up over the hero. */
  panelOverlap: number;
  /** Extra downward nudge applied to the panel. */
  panelDropOffset: number;
  /** Gutter between the panel and the screen edge. */
  horizontalInset: number;
  /** Padding inside the panel. */
  panelPaddingX: number;
  /** Width the panel column is laid out at. */
  contentWidth: number;
  width: number;
  height: number;
}

/**
 * Reads live window dimensions, so the layout reacts to rotation, split screen
 * and the keyboard-driven resize Android performs, rather than being fixed at
 * module load.
 */
export function getAuthLayoutMetrics(
  screenWidth: number,
  screenHeight: number,
): AuthLayoutMetrics {
  const contentWidth = Math.min(screenWidth, AUTH_MAX_CONTENT_WIDTH);
  const scale = clamp(contentWidth / FIGMA_AUTH_FRAME.width, AUTH_SCALE_MIN, AUTH_SCALE_MAX);
  const fontScale = 1 + (scale - 1) * FONT_SCALE_DAMPING;

  const s = (value: number) => Math.round(value * scale);
  const f = (value: number) => Math.round(value * fontScale);

  // Aspect-locked to the composite, then bounded against the screen's height.
  const heroFromWidth = (FIGMA_AUTH_FRAME.heroHeight / FIGMA_AUTH_FRAME.width) * screenWidth;
  const heroHeight = clamp(
    heroFromWidth,
    screenHeight * HERO_MIN_HEIGHT_RATIO,
    screenHeight * HERO_MAX_HEIGHT_RATIO,
  );

  return {
    scale,
    fontScale,
    s,
    f,
    heroHeight,
    panelOverlap: FIGMA_PANEL_OVERLAP * scale,
    panelDropOffset: PANEL_DROP_STEPS * PANEL_STEP_PX * scale,
    horizontalInset: FIGMA_AUTH_FRAME.horizontalInset * scale,
    panelPaddingX: FIGMA_AUTH_FRAME.panelPaddingX * scale,
    contentWidth,
    width: screenWidth,
    height: screenHeight,
  };
}

/**
 * The metrics for the screen currently being rendered.
 *
 * Published through context so the panel primitives (fields, buttons, terms
 * row, divider, social row) can size themselves off the SAME scale the shell
 * used, without every screen having to thread a prop through four layers.
 */
const AuthScaleContext = createContext<AuthLayoutMetrics | null>(null);

export const AuthScaleProvider = AuthScaleContext.Provider;

/**
 * Falls back to the unscaled Figma values when a primitive is rendered outside
 * an `AuthScreenShell` (a modal, a test, a screen that has not been migrated).
 * That is the layout these components had before this hook existed, so nothing
 * can regress by being mounted somewhere unexpected.
 */
export function useAuthScale(): AuthLayoutMetrics {
  const fromShell = useContext(AuthScaleContext);
  const { width, height } = useWindowDimensions();
  const fallback = getAuthLayoutMetrics(width, height);
  return fromShell ?? fallback;
}
