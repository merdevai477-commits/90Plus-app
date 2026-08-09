/**
 * Responsive scaling helpers.
 *
 * All quiz/questions screens are designed on a 448pt-wide artboard
 * (Figma "iPhone 14 Plus - 3", node 231:73). Every measurement taken from
 * Figma is expressed in those design units and converted at render time so
 * the layout holds its proportions from iPhone SE (320pt) up to tablets.
 */

import { useWindowDimensions } from 'react-native';

/** Width of the Figma artboard every design measurement is relative to. */
export const DESIGN_WIDTH = 448;

/**
 * Clamp bounds for the layout scale.
 * - Lower bound keeps small phones (iPhone SE / 320pt) legible instead of
 *   shrinking touch targets below the 44pt accessibility minimum.
 * - Upper bound stops tablets from blowing the layout up to cartoon size.
 */
const MIN_SCALE = 0.78;
const MAX_SCALE = 1.12;

/** Fonts scale at a reduced rate so text stays readable at both extremes. */
const FONT_SCALE_DAMPING = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface DesignScale {
  /** Multiplier for spacing, sizes and radii. */
  scale: number;
  /** Multiplier for font sizes (damped). */
  fontScale: number;
  /** Convert a Figma spacing/size value to device units. */
  s: (designValue: number) => number;
  /** Convert a Figma font size to device units. */
  f: (designFontSize: number) => number;
  width: number;
  height: number;
}

/**
 * Reads live window dimensions so the layout reacts to rotation, foldables
 * and split-screen rather than being fixed at module load.
 */
export function useDesignScale(): DesignScale {
  const { width, height } = useWindowDimensions();

  const scale = clamp(width / DESIGN_WIDTH, MIN_SCALE, MAX_SCALE);
  const fontScale = 1 + (scale - 1) * FONT_SCALE_DAMPING;

  return {
    scale,
    fontScale,
    s: (designValue: number) => Math.round(designValue * scale),
    f: (designFontSize: number) => Math.round(designFontSize * fontScale),
    width,
    height,
  };
}
