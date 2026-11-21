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

import { useMemo } from 'react';
import type { FlexAlignType, FlexStyle, TextStyle } from 'react-native';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
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

  /** Sponsor prize page (`1311:17041`). */
  spPageBg: '#0b0518',
  spPanel: '#160c2d',
  spPillText: '#c58bfc',
  spPillBorder: 'rgba(79,48,143,0.39)',
  spChipText: '#d7affe',
  spStoreDesc: '#a1a1a1',
  spTileBorder: 'rgba(186,157,254,0.13)',
  spTileBody: '#bababa',
  spDay: '#999999',
  spTime: '#e0e0e0',
  spAction: '#d7d7d7',

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
  /**
   * Hub CTA after the user has entered — "في انتظار الفائز".
   * Yellow pair from the pending-sponsor pill (`IconCtaLoading`).
   */
  waitingCta: ['#F5E427', '#C4A800'] as const,
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
  /** Sponsor page pills: "جائزة مقدمة من المتجر" runs right→left, "توقع برعاية" bottom→top. */
  spPillPrize: ['rgba(62,12,176,0.36)', 'rgba(139,92,246,0.36)'] as const,
  spPillPrizeLocations: [0.05185, 1] as const,
  spPillSponsor: ['rgba(62,12,176,0.14)', 'rgba(139,92,246,0.14)'] as const,
  spTile: ['rgba(139,92,246,0.11)', 'rgba(81,54,144,0.11)'] as const,
  spCta: ['#8b5cf6', '#2e146a'] as const,
  tip: ['#1a0b28', '#0c051a'] as const,
} as const;

// ─── Light palette (Figma `X50fmaHSieVpdANUHVi3zL` light screens) ─────────────

const PW_LIGHT = {
  screen: '#f9f6fe',
  surface: '#FFFFFF',
  surfaceBorder: '#f3edff',

  inputTop: '#FFFFFF',
  inputBottom: '#FFFFFF',
  inputBorder: 'rgba(106,43,217,0.18)',

  cellTop: '#FFFFFF',
  cellBottom: '#FFFFFF',
  cellBorder: 'rgba(106,43,217,0.12)',

  medallionTop: '#f5eeff',
  medallionBottom: '#ede4ff',
  medallionBorder: 'rgba(106,43,217,0.35)',

  controlTop: '#6a2bd9',
  controlBottom: '#4b1fa3',

  dropdownOpenBorder: 'rgba(106,43,217,0.45)',
  dropdownRowBorder: '#f3edff',
  dropdownSelectedBorder: '#6a2bd9',
  dropdownTitleTop: '#6a2bd9',
  dropdownTitleBottom: '#4b1fa3',

  tabPillTop: '#6a2bd9',
  tabPillBottom: '#4b1fa3',
  tabDivider: '#f3edff',

  accentTop: '#6a2bd9',
  accentBottom: '#4b1fa3',

  ctaTop: '#6a2bd9',
  ctaBottom: '#4b1fa3',

  sortTop: '#f3edff',
  sortBottom: '#f3edff',

  stepActiveBg: '#6a2bd9',
  stepActiveBorder: '#6a2bd9',
  stepIdleBg: '#f3edff',
  stepIdleBorder: '#f3edff',
  stepIdleText: '#626262',
  railIdle: '#f3edff',
  railFillStart: '#6a2bd9',
  railFillEnd: '#4b1fa3',
  stepLabelActive: '#6a2bd9',

  detailBg: '#FFFFFF',
  detailBorder: 'rgba(106,43,217,0.08)',
  detailTitle: '#4b1fa3',
  detailChip: '#f8f7ff',
  detailChipBorder: '#f3edff',
  detailSocialBg: '#f8f7ff',
  detailDeliveryBg: '#fff0f5',
  detailDeliveryBorder: '#ffdbe6',
  detailDeliveryOff: '#c73535',
  statBg: '#f3edff',
  statBorder: 'rgba(106,43,217,0.14)',
  statLabel: '#6b7280',
  statValue: '#6a2bd9',

  spPageBg: '#f9f6fe',
  spPanel: '#FFFFFF',
  spPillText: '#4b1fa3',
  spPillBorder: 'rgba(106,43,217,0.2)',
  spChipText: '#6a2bd9',
  spStoreDesc: '#6b7280',
  spTileBorder: 'rgba(106,43,217,0.12)',
  spTileBody: '#6b7280',
  spDay: '#9ca3af',
  spTime: '#24104e',
  spAction: '#4b1fa3',

  badgePickupBg: '#f8f7ff',
  badgePickupText: '#6b7280',
  badgeDeliveryBg: '#ebfaf0',
  badgeDeliveryBorder: '#d2f5e1',
  badgeDeliveryText: '#1a8f3a',
  badgeNoDeliveryBg: '#fff0f5',
  badgeNoDeliveryBorder: '#ffdbe6',
  badgeNoDeliveryText: '#c20505',

  text: '#24104e',
  textOnCardMuted: '#6b7280',
  textSubtitle: '#6b7280',
  textCellDesc: '#6b7280',
  textTileSub: '#6b7280',
  textTabIdle: '#9ca3af',
  textPlaceholder: '#9ca3af',
  textSelect: '#6b7280',
  textSegmentIdle: '#9ca3af',
  textTimeIdle: '#9ca3af',
  textSort: '#4b1fa3',
  textTipBody: '#6b7280',
  textOptional: '#9ca3af',
  textSubLabel: '#6b7280',
  textVsTime: '#6b7280',
  divider: '#f3edff',

  vsTop: '#6a2bd9',
  vsBottom: '#4b1fa3',
  outlineTextTop: '#6a2bd9',
  outlineTextBottom: '#4b1fa3',
} satisfies Record<keyof typeof PW, string>;

export type PWGradientsSet = {
  [K in keyof typeof PW_GRADIENTS]: (typeof PW_GRADIENTS)[K];
};

function buildLightGradients(): PWGradientsSet {
  return {
    input: [PW_LIGHT.inputTop, PW_LIGHT.inputBottom],
    cell: [PW_LIGHT.cellTop, PW_LIGHT.cellBottom],
    medallion: [PW_LIGHT.medallionTop, PW_LIGHT.medallionBottom],
    control: [PW_LIGHT.controlTop, PW_LIGHT.controlBottom],
    tabPill: [PW_LIGHT.tabPillTop, PW_LIGHT.tabPillBottom],
    cta: [PW_LIGHT.ctaTop, PW_LIGHT.ctaBottom],
    sort: [PW_LIGHT.sortTop, PW_LIGHT.sortBottom],
    rail: [PW_LIGHT.railFillStart, PW_LIGHT.railFillEnd],
    accent: [PW_LIGHT.accentTop, PW_LIGHT.accentBottom],
    waitingCta: PW_GRADIENTS.waitingCta,
    fab: ['#6a2bd9', '#4b1fa3'],
    fabLocations: PW_GRADIENTS.fabLocations,
    cardWash: [
      'rgba(106,43,217,0)',
      'rgba(106,43,217,0.06)',
      'rgba(249,246,254,0.55)',
      'rgba(255,255,255,0.92)',
    ],
    cardWashLocations: PW_GRADIENTS.cardWashLocations,
    spPillPrize: ['rgba(106,43,217,0.12)', 'rgba(139,92,246,0.08)'],
    spPillPrizeLocations: PW_GRADIENTS.spPillPrizeLocations,
    spPillSponsor: ['rgba(106,43,217,0.06)', 'rgba(139,92,246,0.04)'],
    spTile: ['rgba(243,237,255,0.9)', 'rgba(248,247,255,0.9)'],
    spCta: [PW_LIGHT.ctaTop, PW_LIGHT.ctaBottom],
    tip: ['#f3edff', '#f3edff'],
  } as unknown as PWGradientsSet;
}

export type PWTheme = typeof PW & {
  isDark: boolean;
  blurTint: 'light' | 'dark';
  statusBarStyle: 'light' | 'dark';
  ink: string;
  primary: string;
  darkPrimary: string;
  muted: string;
  pale: string;
  white: string;
  headerBorder: string;
  overlay: string;
  modalBg: string;
  modalBorder: string;
  sortChipBorder: string;
  tipBg: string;
  cardShadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  tileShadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  metricViews: { bg: string; border: string; value: string; label: string };
  metricParticipants: { bg: string; border: string; value: string; label: string };
  metricCorrect: { bg: string; border: string; value: string; label: string };
  metricWrong: { bg: string; border: string; value: string; label: string };
  winnerRowBg: string;
  winnerRowBorder: string;
  correctChipBg: string;
  correctChipText: string;
  gradients: PWGradientsSet;
};

function darkThemeExtras(): Omit<
  PWTheme,
  keyof typeof PW | 'gradients'
> & { gradients: PWGradientsSet } {
  return {
    isDark: true,
    blurTint: 'dark',
    statusBarStyle: 'light',
    ink: '#FFFFFF',
    primary: '#A855F7',
    darkPrimary: '#3d0ab3',
    muted: '#9B8FB0',
    pale: '#1a0b28',
    white: '#FFFFFF',
    headerBorder: 'rgba(255,255,255,0.05)',
    overlay: 'rgba(4,1,10,0.72)',
    modalBg: '#080512',
    modalBorder: 'rgba(222,191,252,0.39)',
    sortChipBorder: PW.medallionBorder,
    tipBg: '#1a0b28',
    cardShadow: {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    tileShadow: {
      shadowColor: '#000',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    metricViews: { bg: '#050010', border: '#120330', value: '#D4D4D4', label: '#4F4F52' },
    metricParticipants: { bg: '#050010', border: '#120330', value: '#D4D4D4', label: '#4F4F52' },
    metricCorrect: { bg: '#050010', border: '#120330', value: '#D4D4D4', label: '#4F4F52' },
    metricWrong: { bg: '#050010', border: '#120330', value: '#D4D4D4', label: '#4F4F52' },
    winnerRowBg: '#0A0514',
    winnerRowBorder: '#140F1F',
    correctChipBg: 'rgba(74,191,69,0.15)',
    correctChipText: '#4ABF45',
    gradients: { ...PW_GRADIENTS, tip: PW_GRADIENTS.tip ?? ['#1a0b28', '#0c051a'] },
  };
}

function lightThemeExtras(): Omit<
  PWTheme,
  keyof typeof PW | 'gradients'
> & { gradients: PWGradientsSet } {
  return {
    isDark: false,
    blurTint: 'light',
    statusBarStyle: 'dark',
    ink: '#24104e',
    primary: '#6a2bd9',
    darkPrimary: '#4b1fa3',
    muted: '#6b7280',
    pale: '#f3edff',
    white: '#FFFFFF',
    headerBorder: '#f3edff',
    overlay: 'rgba(36,16,78,0.45)',
    modalBg: '#FFFFFF',
    modalBorder: 'rgba(106,43,217,0.12)',
    sortChipBorder: '#4b1fa3',
    tipBg: '#f3edff',
    cardShadow: {
      shadowColor: '#6a2bd9',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    tileShadow: {
      shadowColor: '#6a2bd9',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    metricViews: { bg: '#f5eeff', border: '#e6d4ff', value: '#4b1fa3', label: '#6b7280' },
    metricParticipants: { bg: '#eef3ff', border: '#d9e5ff', value: '#4b1fa3', label: '#6b7280' },
    metricCorrect: { bg: '#ebfaf0', border: '#d2f5e1', value: '#1a8f3a', label: '#6b7280' },
    metricWrong: { bg: '#fff0f5', border: '#ffdbe6', value: '#c20505', label: '#6b7280' },
    winnerRowBg: '#FFFFFF',
    winnerRowBorder: '#f3edff',
    correctChipBg: '#ebfaf0',
    correctChipText: '#1a8f3a',
    gradients: buildLightGradients(),
  };
}

/** Resolved palette + gradients for the current color scheme. */
export function getPWTheme(isDark: boolean): PWTheme {
  const colors = isDark ? ({ ...PW } as typeof PW) : PW_LIGHT;
  const extras = isDark ? darkThemeExtras() : lightThemeExtras();
  return { ...colors, ...extras } as PWTheme;
}

export function usePWTheme(): PWTheme {
  const { isDark } = useResolvedAppScheme();
  return useMemo(() => getPWTheme(isDark), [isDark]);
}

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
