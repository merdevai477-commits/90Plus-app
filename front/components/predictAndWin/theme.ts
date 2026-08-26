/**
 * Predict & Win (توقع واربح) design tokens.
 *
 * Every value here is taken verbatim from Figma file `X50fmaHSieVpdANUHVi3zL`,
 * node `597:2151`, measured on the **448pt-wide** artboard — which is exactly
 * the app's `DESIGN_WIDTH`, so raw Figma units convert 1:1 through
 * `usePWScale().s()` / `.f()`.
 *
 * Screens: hub `624:4349`, category `658:5475`, wizard steps `666:5768`,
 * `690:1394`, `695:1782`, `696:2115`.
 *
 * Typography: Figma specifies Inter (body) and Changa (wizard field labels).
 * The app ships Cairo (ar) / Inter (en) via `useAppFont()`, so weights are
 * mapped onto that pair rather than adding a third family for one feature.
 */

import type { FlexAlignType, FlexStyle, TextStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { useDesignScale, type DesignScale } from '../../utils/responsive';

// ─── Palette ──────────────────────────────────────────────────────────────────

export const PW = {
  /** Screen background — `bg-[var(--background,#030303)]`. */
  screen: '#030303',
  /** Header bar + tab bar surface. */
  surface: '#0c051a',
  /** Tab bar / info tile border. */
  surfaceBorder: '#1a052d',

  /** Wizard input box gradient (top → bottom) and its border. */
  inputTop: '#0c051a',
  inputBottom: '#07040d',
  inputBorder: '#2b2539',

  /** Category cell gradient + border. */
  cellTop: '#0c051a',
  cellBottom: '#07040d',
  cellBorder: '#1a0b28',

  /** Category / tip icon medallion. */
  medallionTop: '#2b0450',
  medallionBottom: '#120320',
  medallionBorder: '#4b0989',

  /** Selected segmented control + numeric stepper button. */
  controlTop: '#6703c5',
  controlBottom: '#32025f',

  /**
   * Inline dropdown (`Component 22`, `692:1621`) — the match selector's three
   * variants: closed (`692:1620`), open (`692:1618`), selected (`692:1619`).
   */
  dropdownOpenBorder: '#5404a0',
  dropdownRowBorder: '#20162a',
  dropdownSelectedBorder: '#6512b3',
  dropdownTitleTop: '#a44af9',
  dropdownTitleBottom: '#6c05cf',

  /** Active tab pill. */
  tabPillTop: '#650eb8',
  tabPillBottom: '#360961',
  /** Tab bar divider (`Line 15`, 1px round-capped). */
  tabDivider: '#201537',

  /** Wizard field-label accent bar (4×20, round caps). */
  accentTop: '#460BCB',
  accentBottom: '#230665',

  /** Primary CTA (same pair as the app-wide `PG_GRADIENTS.purple`). */
  ctaTop: '#3d0ab3',
  ctaBottom: '#190448',

  /** Hub sort dropdown (`Component 10`). */
  sortTop: '#1a1328',
  sortBottom: '#0c0c0c',

  /** Stepper. */
  stepActiveBg: '#3f0a71',
  stepActiveBorder: '#4a0987',
  stepIdleBg: '#1b1521',
  stepIdleBorder: '#32283b',
  stepIdleText: '#626262',
  railIdle: '#2d2936',
  railFillStart: '#4a0987',
  railFillEnd: '#871aef',
  stepLabelActive: '#7d16df',

  /** Detail card. */
  detailBg: '#06030c',
  detailBorder: '#1a1a1a',
  detailTitle: '#700bd0',
  detailChip: '#0a031a',
  detailChipBorder: '#1b0c26',
  detailSocialBg: '#110c1e',
  detailDeliveryBg: '#170101',
  detailDeliveryBorder: '#310202',
  detailDeliveryOff: '#c73535',
  statBg: 'rgba(26,5,75,0.19)',
  statBorder: 'rgba(186,157,254,0.13)',
  statLabel: '#c8b2fb',
  statValue: '#8351f5',

  /** Delivery badges (Group 67). */
  badgePickupBg: 'rgba(255,255,255,0.06)',
  badgePickupText: '#cdcdcd',
  badgeDeliveryBg: '#030e02',
  badgeDeliveryBorder: '#052b0c',
  badgeDeliveryText: '#1bcb3b',
  badgeNoDeliveryBg: '#310505',
  badgeNoDeliveryBorder: '#4b0804',
  badgeNoDeliveryText: '#c20505',

  /** Text. */
  text: '#FFFFFF',
  textOnCardMuted: '#aaa',
  textSubtitle: '#d2d2d2',
  textCellDesc: '#cbcbcb',
  textTileSub: '#868686',
  textTabIdle: '#9f9c9c',
  textPlaceholder: '#757575',
  textSelect: '#9b9b9b',
  textSegmentIdle: '#5a5a5a',
  textTimeIdle: '#626262',
  textSort: '#b2b2b2',
  textTipBody: '#989797',
  textOptional: '#616161',
  textSubLabel: '#868686',
  textVsTime: '#777',
  divider: '#2d2936',

  /** VS gradient text. */
  vsTop: '#a855f7',
  vsBottom: '#633291',
  /** Outline-button gradient text (تعديل الجائزة). */
  outlineTextTop: '#976bf9',
  outlineTextBottom: '#430bc5',
} as const;

// ─── Gradients (top → bottom / start → end, RN LinearGradient order) ─────────

export const PW_GRADIENTS = {
  input: [PW.inputTop, PW.inputBottom] as const,
  cell: [PW.cellTop, PW.cellBottom] as const,
  medallion: [PW.medallionTop, PW.medallionBottom] as const,
  control: [PW.controlTop, PW.controlBottom] as const,
  tabPill: [PW.tabPillTop, PW.tabPillBottom] as const,
  cta: [PW.ctaTop, PW.ctaBottom] as const,
  sort: [PW.sortTop, PW.sortBottom] as const,
  rail: [PW.railFillStart, PW.railFillEnd] as const,
  accent: [PW.accentTop, PW.accentBottom] as const,
  /** Floating action button — `linear-gradient(90deg, …)` at 0.81 alpha. */
  fab: [
    'rgba(81,7,151,0.81)',
    'rgba(117,10,219,0.81)',
    'rgba(123,11,229,0.81)',
    'rgba(102,9,190,0.81)',
    'rgba(81,7,151,0.81)',
  ] as const,
  fabLocations: [0, 0.28152, 0.49517, 0.68211, 1] as const,
  /**
   * Competition card wash over the prize photo (`650:5290`, 90.25° ≈ horizontal).
   *
   * Figma draws this as
   * `rgba(57,29,114,0) 15.36% → rgb(137,24,244) 54.29% → rgb(6,3,12) 63.11%`
   * composited with `mix-blend-mode: darken`, and that is how it shipped.
   *
   * React Native only honours `mixBlendMode` on Android API 29+
   * (`BlendModeHelper.parseMixBlendMode` returns null below Q) while this app
   * ships `minSdkVersion: 24`. On API 24–28 the property is silently dropped,
   * so the *opaque* stops composited normally instead — a solid purple band
   * from 54% and solid #06030c from 63% — and the prize photo disappeared
   * behind them. "Images don't render on Android" with no error and no
   * reproduction on iOS.
   *
   * The wash is therefore expressed in straight alpha, which every platform and
   * API level composites identically. Stop positions are Figma's, unchanged;
   * the alpha ramp reproduces what `darken` produced on a device that supported
   * it — the photo readable to ~54%, crushed to the card colour by 63%.
   */
  cardWash: [
    'rgba(57,29,114,0)',
    'rgba(87,16,155,0.38)',
    'rgba(6,3,12,0.96)',
    'rgb(6,3,12)',
  ] as const,
  cardWashLocations: [0.15357, 0.54292, 0.63109, 1] as const,
} as const;

// ─── Geometry (raw Figma units on the 448 artboard) ──────────────────────────

/** Horizontal page margin: content is 404 wide inside 448. */
export const PW_GUTTER = 22;
export const PW_CONTENT_W = 404;

export const PW_RADII = {
  tile: 10,
  tabBar: 14,
  cell: 16,
  input: 16,
  detail: 24,
  card: 25,
  chip: 7,
  sort: 8,
  pill: 12,
  badge: 20,
  medallion: 42,
  fab: 53,
  /** Foot of the open inline dropdown (`692:1589`). */
  dropdownFoot: 25,
} as const;

export const PW_HEADER = {
  /** Header bar height below the status bar. */
  height: 66,
  paddingH: 24,
  rowHeight: 38,
  backSize: 38,
  bellSize: 32,
  titleSize: 20,
} as const;

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function usePWFonts() {
  const regular = useAppFont(400);
  const medium = useAppFont(500);
  const semibold = useAppFont(600);
  const bold = useAppFont(700);
  return { regular, medium, semibold, bold };
}

/** 448-artboard scale — shared with the rest of the app. */
export function usePWScale(): DesignScale {
  return useDesignScale();
}

export interface PWDirection {
  isRTL: boolean;
  /** Reading order: `row` in LTR, `row-reverse` in RTL. */
  row: FlexStyle['flexDirection'];
  /** Reverse of the reading order — for rows Figma draws leading-icon-first. */
  rowReverse: FlexStyle['flexDirection'];
  /** Start of the reading order. */
  textAlign: TextStyle['textAlign'];
  /** End of the reading order. */
  textAlignEnd: TextStyle['textAlign'];
  alignStart: FlexAlignType;
  alignEnd: FlexAlignType;
  /**
   * Figma draws this feature in Arabic, so every label is right-aligned and
   * every row is laid out right-to-left. Mirroring on `language` instead of
   * hardcoding it is what makes the English build read left-to-right.
   */
  justifyEnd: FlexStyle['justifyContent'];
}

export function usePWDirection(): PWDirection {
  // `useTranslation().isRTL` is hardcoded `false` app-wide — the rest of the
  // app deliberately stays LTR in Arabic (copy/font only). This feature is
  // the one screen built to Figma's Arabic RTL layout, so it derives its own
  // flag from the language instead of that disabled global one.
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  return {
    isRTL,
    row: isRTL ? 'row-reverse' : 'row',
    rowReverse: isRTL ? 'row' : 'row-reverse',
    textAlign: isRTL ? 'right' : 'left',
    textAlignEnd: isRTL ? 'left' : 'right',
    alignStart: isRTL ? 'flex-end' : 'flex-start',
    alignEnd: isRTL ? 'flex-start' : 'flex-end',
    justifyEnd: isRTL ? 'flex-end' : 'flex-start',
  };
}

/**
 * Width of the 404-wide Figma content column, capped to what the viewport
 * actually offers.
 *
 * `s(404)` alone is 315 on a 320pt device — the scale clamp bottoms out at
 * 0.78 while the viewport keeps shrinking — which left 2.5pt of margin instead
 * of the designed 22 and pushed the tab bar and cards flush to the bezel.
 * `PrizeCategoryGrid` already derived its width this way; every other surface
 * in the feature now shares the same rule.
 */
export function usePWContentWidth(): { contentWidth: number; cardScale: number } {
  const { s, width } = usePWScale();
  const minGutter = Math.max(8, s(12));
  const contentWidth = Math.min(s(PW_CONTENT_W), width - minGutter * 2);
  return { contentWidth, cardScale: contentWidth / PW_CONTENT_W };
}
