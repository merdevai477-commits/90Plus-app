/**
 * =============================================================================
 * SHARE & WIN — DESIGN TOKENS & STYLESHEET
 * =============================================================================
 *
 * A 1:1 port of Figma node 109:470 ("iPhone 14 Plus - 2", 448pt artboard,
 * 22pt side gutters ⇒ 404pt content column).
 *
 * Every number below is the RAW FIGMA VALUE, converted to device units at
 * render time by `useDesignScale()` (utils/responsive.ts) — the same contract
 * the Questions hub uses. That keeps proportions from iPhone SE (320pt) up to
 * tablets. So:
 *
 *      ✅  write `s(404)` — the Figma width
 *      ❌  don't write `404` — fixed pixels break small phones
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE TO CHANGE WHAT — quick index
 * ─────────────────────────────────────────────────────────────────────────────
 *   COLOURS ................. SW_COLOR
 *   GRADIENTS ............... SW_GRADIENT
 *   CARD SHELL .............. `card` (bg + border + radius 25, shared by the
 *                             wheel / weekly / share cards)
 *   HERO .................... `heroWrap`, `heroTitle*`, `heroSubtitle*`
 *   LUCKY WHEEL ............. `wheel*` + WHEEL_GEOMETRY
 *   COUNTDOWN ............... `countdownBox`, `countdownValue`, `countdownLabel`
 *   LEADERBOARD ROWS ........ `boardRow*`, ROW_TIERS
 *   PRIZES .................. `prize*`, `dot*`
 *   SHARE CARD .............. `linkRow`, `socialTile`, `hintRow`
 *   STICKY STATS BAR ........ `statsBar*`
 *   LAST WINNER ............. `winner*`
 * =============================================================================
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useDesignScale, type DesignScale } from '../../utils/responsive';
import { getAppFont } from '../../utils/fontSetup';
import { useLanguageStore } from '../../src/i18n/store';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. COLOUR TOKENS
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SW_COLOR = {
  /** Page background — Figma frame fill `--background`. */
  screen: '#030303',
  /** Card fill shared by the wheel / weekly / share cards. */
  cardBg: '#080613',
  /** 1px card border. */
  cardBorder: 'rgba(223,192,252,0.39)',

  /** "شارك" in the hero title. */
  heroAccent: '#6B11D4',
  /** Body copy grey used across subtitles. */
  bodyGrey: '#BBBBBB',
  /** Secondary label grey (countdown labels, "ينتهي بعد"). */
  labelGrey: '#D2D2D2',
  /** Link + hint row text. */
  fieldText: '#E2E2E2',

  /** Primary purple — countdown digits, XP suffixes. */
  purple: '#831DE5',
  /** Leader score purple (rank 1). */
  purpleBright: '#963FE9',
  /** Runner-up score tint. */
  scoreTint: '#EBDCFA',

  /** Leaderboard rank-1 row fill. */
  rowLeadBg: '#05010E',
  /** Leaderboard rows 2..n fill. */
  rowBg: '#030303',
  rowLeadBorder: 'rgba(255,255,255,0.1)',
  rowBorder: 'rgba(255,255,255,0.15)',

  /** Countdown / social tile borders. */
  tileBorder: 'rgba(255,255,255,0.1)',

  /** "View full ranking" pill. */
  ctaBg: 'rgba(24,14,48,0.2)',
  ctaBorder: 'rgba(255,255,255,0.04)',

  /** Prize card borders. */
  prizeActiveBorder: '#7419CC',
  prizeIdleBorder: '#3A3A3A',

  /** Sticky stats bar. */
  statsBg: 'rgba(26,5,75,0.19)',
  statsBorder: 'rgba(186,157,254,0.13)',
  statsLabel: '#C8B2FB',
  statsFriends: '#8351F5',

  /** Last-winner card. */
  winnerShadow: '#3A0C66',
  winnerMeta: '#7A7A7A',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. GRADIENTS — [colors, locations] pairs for expo-linear-gradient
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SW_GRADIENT = {
  /** Countdown + social tile fill: #080613 → #030009, top to bottom. */
  tile: ['#080613', '#030009'] as const,
  /** Wheel centre button: 179.72deg #b772f8 → #6309b9 51.6% → #1d0336. */
  wheelButton: ['#B772F8', '#6309B9', '#1D0336'] as const,
  /** Disabled wheel button keeps the same value range but reads as inactive. */
  wheelButtonDisabled: ['#655C75', '#3A3346', '#1B1724'] as const,
  wheelButtonLocations: [0.0024, 0.5164, 0.9976] as const,
  /** Active carousel dot. */
  dotActive: ['#7419CC', '#3A0C66'] as const,
  /** Idle carousel dot. */
  dotIdle: ['#726F74', '#333333'] as const,
  /** Purple text gradient used for XP values and the stats bar numbers. */
  purpleText: ['#7419CC', '#3A0C66'] as const,
  /** Hero "نقاط / XP" gradient — #9e78f7 → #460bcb. */
  heroXp: ['#9E78F7', '#460BCB'] as const,
  /** Last-winner scrim: rgba(113,113,113,.33) 18.97% → rgba(0,0,0,.8) 68.58%. */
  winnerScrim: ['rgba(113,113,113,0.33)', 'rgba(0,0,0,0.86)'] as const,
  winnerScrimLocations: [0.1897, 0.6858] as const,
} as const;

export const SW_RADIUS = {
  card: 25,
  tile: 16,
  row: 16,
  hint: 12,
  statsBar: 18,
  dot: 29,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. LUCKY WHEEL GEOMETRY (Figma node 128:686)
 * The wheel is a 419.177 square. Everything inside is positioned from its
 * top-left, exactly as Figma lays it out.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const WHEEL_GEOMETRY = {
  /** Outer layout box of the whole wheel assembly. */
  box: 419.177,
  /** Purple ring, offset (31, 30) inside the box. */
  ring: { size: 359, left: 31, top: 30 },
  /** Both segment groups are 322 squares centred in the box, rotated 22°. */
  segment: { size: 322, rotation: 22 },
  /** Centre button — outer bezel then the gradient face. */
  hubOuter: { size: 107, left: 155.59, top: 150.59, radius: 68, border: 5 },
  hubInner: { size: 98, left: 160.59, top: 155.59, radius: 68, border: 3 },
  /**
   * Pointer. Figma lays it out as a 35×48.125 box, but the exported SVG is
   * 43×56.125 because its drop-shadow bleeds outside (inset -6.23% / -11.43%).
   * We render the asset at its natural size and shift it back so the *shape*
   * still lands on the layout box.
   */
  pointer: {
    width: 35,
    height: 48.125,
    left: 192,
    top: 14,
    assetWidth: 43,
    assetHeight: 56.125,
  },
  /**
   * Rim glow dots. Same story: an 11pt layout box, a 34.8pt asset whose glow
   * extends ~108% past every edge. Drawing the asset into 11pt would shrink
   * the visible dot to ~2pt, so it is drawn at 34.8 and re-centred.
   */
  dot: { size: 11, assetSize: 34.8 },
} as const;

/**
 * The eight XP prize labels, at their exact Figma offsets inside the wheel box.
 * `gradient: true` renders the "XP" suffix with the silver→indigo gradient the
 * two top segments use; the rest are flat purple.
 */
export const WHEEL_PRIZES = [
  { value: '100', left: 191.59, top: 80.59, gradient: true },
  { value: '250', left: 271.59, top: 107.59, gradient: false },
  { value: '75', left: 310.59, top: 185.59, gradient: false },
  { value: '300', left: 266.59, top: 270.59, gradient: false },
  { value: '500', left: 190.59, top: 295.59, gradient: false },
  { value: '50', left: 117.59, top: 269.59, gradient: false },
  { value: '300', left: 75.59, top: 185.59, gradient: false },
  { value: '150', left: 107.59, top: 107.59, gradient: true },
] as const;

/**
 * Rim dots, resolved to absolute offsets inside the wheel box. Figma nests them
 * several groups deep under 135:73 (itself at +43/+14), so each value below is
 * that chain summed.
 */
export const WHEEL_DOTS = [
  { left: 289, top: 51 }, // 134:728
  { left: 366, top: 136 }, // 134:734
  { left: 367, top: 270 }, // 134:744
  { left: 296, top: 354 }, // 134:764
  { left: 126, top: 361 }, // 134:759
  { left: 46, top: 277 }, // 134:775
  { left: 43, top: 138 }, // 134:785
  { left: 125, top: 48 }, // 134:795
] as const;

/**
 * The five leaderboard tiers from Figma. Rank 1 gets the lit row; every row
 * below steps down in opacity, medal size, avatar size and type size, and from
 * rank 4 the medal is replaced by a plain rank number.
 */
export const ROW_TIERS = [
  { opacity: 1, medal: 32, avatar: 38, name: 20, score: 22, lead: true },
  { opacity: 0.8, medal: 30, avatar: 36, name: 18, score: 20, lead: false },
  { opacity: 0.65, medal: 28, avatar: 34, name: 16, score: 18, lead: false },
  { opacity: 0.4, medal: 0, avatar: 34, name: 16, score: 18, lead: false },
  { opacity: 0.2, medal: 0, avatar: 34, name: 16, score: 18, lead: false },
] as const;

/** Tier for any rank, clamped to the last (dimmest) style. */
export function rowTier(index: number) {
  return ROW_TIERS[Math.min(index, ROW_TIERS.length - 1)];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. STYLESHEET
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ShareWinStyles {
  sw: ReturnType<typeof buildStyles>;
  metrics: DesignScale;
}

function buildStyles(scale: DesignScale, language: string) {
  const { s, f } = scale;
  const font = (weight: 400 | 500 | 600 | 700 | 800) => getAppFont(weight, language);

  return StyleSheet.create({
    /* ── Screen shell ──────────────────────────────────────────────────── */
    root: {
      flex: 1,
      backgroundColor: SW_COLOR.screen,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      alignItems: 'center',
    },

    /* ── Hero (node 119:625) — left 74, top 100, width 300, gap 16 ─────── */
    heroWrap: {
      width: s(300),
      alignItems: 'center',
      gap: s(16),
      marginTop: s(12),
    },
    heroTitle: {
      fontFamily: font(700),
      fontSize: f(32),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    heroTitleAccent: {
      color: SW_COLOR.heroAccent,
    },
    heroSubtitleGroup: {
      width: '100%',
      alignItems: 'center',
      gap: s(8),
    },
    heroSubtitle: {
      fontFamily: font(400),
      fontSize: f(16),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },
    heroPerShareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    heroPerShareLead: {
      fontFamily: font(400),
      fontSize: f(16),
      color: SW_COLOR.bodyGrey,
    },
    heroPerShareValue: {
      fontFamily: font(600),
      fontSize: f(18),
    },

    /* ── Shared card shell (nodes 135:76 / 147:312 / 163:154) ──────────── */
    card: {
      width: s(404),
      backgroundColor: SW_COLOR.cardBg,
      borderWidth: 1,
      borderColor: SW_COLOR.cardBorder,
      borderRadius: s(SW_RADIUS.card),
      alignItems: 'center',
    },
    cardTitle: {
      fontFamily: font(700),
      fontSize: f(28),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontFamily: font(400),
      fontSize: f(16),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },

    /* ── Lucky wheel card (node 135:76) — py 24, gap 4 ─────────────────── */
    /* Card top offsets below are the measured Figma gaps between sections:
       hero→wheel 24, wheel→weekly 24, weekly→prizes 38, prizes→share 38,
       share→winner 38. */
    wheelCard: {
      paddingVertical: s(24),
      gap: s(4),
      marginTop: s(24),
    },
    wheelHeader: {
      width: s(159),
      alignItems: 'center',
      gap: s(4),
    },
    wheelBox: {
      width: s(WHEEL_GEOMETRY.box),
      height: s(WHEEL_GEOMETRY.box),
    },
    /**
     * The rotating layer. Ring, segments, prize labels and rim dots all live
     * inside it; the pointer and hub sit outside so they stay put while it
     * spins — exactly how a real wheel is built.
     */
    wheelRotor: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: s(WHEEL_GEOMETRY.box),
      height: s(WHEEL_GEOMETRY.box),
    },
    wheelRing: {
      position: 'absolute',
      left: s(WHEEL_GEOMETRY.ring.left),
      top: s(WHEEL_GEOMETRY.ring.top),
      width: s(WHEEL_GEOMETRY.ring.size),
      height: s(WHEEL_GEOMETRY.ring.size),
    },
    wheelSegmentLayer: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: s(WHEEL_GEOMETRY.box),
      height: s(WHEEL_GEOMETRY.box),
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelSegment: {
      width: s(WHEEL_GEOMETRY.segment.size),
      height: s(WHEEL_GEOMETRY.segment.size),
    },
    wheelPrizeLabel: {
      position: 'absolute',
      alignItems: 'center',
    },
    wheelPrizeValue: {
      fontFamily: font(500),
      fontSize: f(20),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    wheelPrizeXp: {
      fontFamily: font(500),
      fontSize: f(20),
      color: SW_COLOR.purple,
      textAlign: 'center',
    },
    /**
     * Pointer wrapper. Drawn at the asset's natural size and re-centred on its
     * 35×48.125 Figma box (the SVG is larger because its glow bleeds out).
     *
     * `transformOrigin` puts the pivot at the pointer's TOP centre, so when it
     * gets flicked by a passing segment it swings from its mount like a real
     * peg rather than spinning about its middle.
     */
    wheelPointer: {
      position: 'absolute',
      left: s(
        WHEEL_GEOMETRY.pointer.left -
          (WHEEL_GEOMETRY.pointer.assetWidth - WHEEL_GEOMETRY.pointer.width) / 2,
      ),
      top: s(
        WHEEL_GEOMETRY.pointer.top -
          (WHEEL_GEOMETRY.pointer.assetHeight - WHEEL_GEOMETRY.pointer.height) / 2,
      ),
      width: s(WHEEL_GEOMETRY.pointer.assetWidth),
      height: s(WHEEL_GEOMETRY.pointer.assetHeight),
      transformOrigin: 'top center',
      // Figma renders the glow with an SVG filter; native SVG decoders drop
      // filters, so it is reproduced here as a platform shadow.
      shadowColor: '#9B57F7',
      shadowOpacity: 0.9,
      shadowRadius: s(6),
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    wheelPointerImage: {
      width: '100%',
      height: '100%',
    },
    /** Same re-centring for the rim dots (11pt box, 34.8pt asset). */
    wheelDot: {
      position: 'absolute',
      width: s(WHEEL_GEOMETRY.dot.assetSize),
      height: s(WHEEL_GEOMETRY.dot.assetSize),
      shadowColor: '#9B57F7',
      shadowOpacity: 0.9,
      shadowRadius: s(4),
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    wheelHubOuter: {
      position: 'absolute',
      left: s(WHEEL_GEOMETRY.hubOuter.left),
      top: s(WHEEL_GEOMETRY.hubOuter.top),
      width: s(WHEEL_GEOMETRY.hubOuter.size),
      height: s(WHEEL_GEOMETRY.hubOuter.size),
      borderRadius: s(WHEEL_GEOMETRY.hubOuter.radius),
      borderWidth: s(WHEEL_GEOMETRY.hubOuter.border),
      borderColor: '#0A011F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelHubOuterDisabled: {
      opacity: 0.52,
      borderColor: 'rgba(120, 117, 128, 0.72)',
    },
    wheelHubInner: {
      position: 'absolute',
      left: s(WHEEL_GEOMETRY.hubInner.left),
      top: s(WHEEL_GEOMETRY.hubInner.top),
      width: s(WHEEL_GEOMETRY.hubInner.size),
      height: s(WHEEL_GEOMETRY.hubInner.size),
      borderRadius: s(WHEEL_GEOMETRY.hubInner.radius),
      borderWidth: s(WHEEL_GEOMETRY.hubInner.border),
      borderColor: '#DDBCFC',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    wheelHubInnerDisabled: {
      opacity: 0.58,
      borderColor: 'rgba(182, 177, 193, 0.55)',
    },
    /** Gradient face of the hub, behind the pressable label. */
    wheelHubFill: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    wheelHubFillDisabled: {
      opacity: 0.82,
    },
    /** Fills the hub so the whole disc is the tap target, not just the text. */
    wheelHubPressable: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelHubPressableDisabled: {
      opacity: 0.9,
    },
    wheelHubLabel: {
      fontFamily: font(700),
      fontSize: f(18),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    /** Spinning, or already spun today. */
    wheelHubLabelDisabled: {
      color: 'rgba(224, 220, 231, 0.65)',
      opacity: 0.78,
    },
    wheelFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
    },
    wheelFooterText: {
      fontFamily: font(500),
      fontSize: f(17),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },

    /* ── Weekly ranking card (node 147:312) — gap 18 ───────────────────── */
    weeklyCard: {
      // Figma node 147:312 fixes the card at 667pt tall with its content
      // vertically centred — keep the height, not a padding approximation.
      height: s(667),
      justifyContent: 'center',
      gap: s(18),
      marginTop: s(24),
    },
    weeklyInner: {
      width: '100%',
      alignItems: 'center',
      gap: s(16),
    },
    weeklyHeader: {
      width: '100%',
      alignItems: 'center',
      gap: s(24),
    },
    weeklyTitleGroup: {
      width: s(216),
      alignItems: 'center',
      gap: s(8),
    },
    weeklyEndsIn: {
      fontFamily: font(400),
      fontSize: f(18),
      color: SW_COLOR.labelGrey,
      textAlign: 'center',
    },

    /* Countdown (node 140:95) — four 86×90 tiles, gap 8 */
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
    },
    countdownBox: {
      width: s(86),
      height: s(90),
      borderRadius: s(SW_RADIUS.tile),
      borderWidth: 1,
      borderColor: SW_COLOR.tileBorder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(2),
      overflow: 'hidden',
    },
    countdownValue: {
      fontFamily: font(600),
      fontSize: f(27),
      color: SW_COLOR.purple,
      textAlign: 'center',
    },
    countdownLabel: {
      fontFamily: font(400),
      fontSize: f(18),
      color: SW_COLOR.labelGrey,
      textAlign: 'center',
    },

    /* Leaderboard list (node 147:294) — width 371, gap 8 */
    boardList: {
      width: s(371),
      gap: s(8),
    },
    boardRow: {
      height: s(58),
      borderRadius: s(SW_RADIUS.row),
      borderWidth: 1,
      paddingHorizontal: s(20),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    boardRowLead: {
      backgroundColor: SW_COLOR.rowLeadBg,
      borderColor: SW_COLOR.rowLeadBorder,
      shadowColor: 'rgba(70,5,132,0.25)',
      shadowOpacity: 1,
      shadowRadius: s(2.8),
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    boardRowRest: {
      backgroundColor: SW_COLOR.rowBg,
      borderColor: SW_COLOR.rowBorder,
    },
    boardRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(16),
      flexShrink: 1,
    },
    /** Ranks 4+ swap the medal for a number and widen the gap to 30. */
    boardRowLeftNumbered: {
      gap: s(30),
    },
    boardRankNumber: {
      fontFamily: font(400),
      fontSize: f(16),
      color: SW_COLOR.white,
      textAlign: 'center',
      minWidth: s(14),
    },
    boardIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
      flexShrink: 1,
    },
    boardAvatar: {
      borderRadius: s(19),
      backgroundColor: '#1A1030',
    },
    boardName: {
      fontFamily: font(400),
      color: SW_COLOR.white,
      flexShrink: 1,
    },
    boardScoreGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexShrink: 0,
      paddingLeft: s(8),
      gap: s(4),
    },
    boardScoreValue: {
      fontFamily: font(400),
      color: SW_COLOR.white,
    },
    boardScoreXp: {
      fontFamily: font(600),
      fontSize: f(16),
      color: SW_COLOR.purple,
      flexShrink: 0,
    },
    boardEmpty: {
      fontFamily: font(400),
      fontSize: f(15),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
      paddingVertical: s(24),
    },

    /* "View full ranking" pill (node 147:295) — 370×60 */
    fullRankingCta: {
      width: s(370),
      height: s(60),
      borderRadius: s(SW_RADIUS.tile),
      borderWidth: 1,
      borderColor: SW_COLOR.ctaBorder,
      backgroundColor: SW_COLOR.ctaBg,
      paddingHorizontal: s(20),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(12),
    },
    fullRankingText: {
      fontFamily: font(600),
      fontSize: f(14),
      color: SW_COLOR.white,
      textAlign: 'center',
    },

    /* ── Weekly prizes (node 161:79) — gap 24 ──────────────────────────── */
    prizesSection: {
      width: s(448),
      alignItems: 'center',
      gap: s(24),
      marginTop: s(38),
    },
    prizesHeader: {
      width: s(313),
      alignItems: 'center',
      gap: s(8),
    },
    prizesTitleRow: {
      width: s(320),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    prizesRule: {
      width: s(52),
      height: s(10),
    },
    prizesTitle: {
      fontFamily: font(700),
      fontSize: f(24),
      color: SW_COLOR.white,
      textAlign: 'center',
      width: s(216),
    },
    prizesSubtitle: {
      fontFamily: font(400),
      fontSize: f(18),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },
    prizesCarousel: {
      height: s(208),
      justifyContent: 'center',
      gap: s(20),
      width: '100%',
    },
    prizesTrackContent: {
      paddingHorizontal: s(22),
      gap: s(12),
      alignItems: 'center',
    },
    prizeCard: {
      width: s(127),
      height: s(165),
      borderRadius: s(SW_RADIUS.tile),
      borderWidth: 1,
      paddingHorizontal: s(10),
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    prizeCardActive: {
      borderColor: SW_COLOR.prizeActiveBorder,
      paddingVertical: s(11),
      shadowColor: 'rgba(70,11,203,0.5)',
      shadowOpacity: 1,
      shadowRadius: s(9.1),
      shadowOffset: { width: 0, height: 1 },
      elevation: 8,
    },
    prizeCardIdle: {
      borderColor: SW_COLOR.prizeIdleBorder,
      paddingVertical: s(13),
    },
    prizeImage: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: s(SW_RADIUS.tile),
    },
    prizeCopy: {
      alignItems: 'center',
      gap: s(4),
      width: '100%',
    },
    prizeCopyIdle: {
      opacity: 0.5,
    },
    prizeTitle: {
      fontFamily: font(600),
      fontSize: f(15),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    prizeSubtitle: {
      fontFamily: font(400),
      fontSize: f(11),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(5),
      width: '100%',
    },
    dot: {
      width: s(17),
      height: s(6),
      borderRadius: s(SW_RADIUS.dot),
      overflow: 'hidden',
    },

    /* ── Share card (node 163:154) — gap 24 ────────────────────────────── */
    shareCard: {
      // Figma node 163:154 — 389pt tall, content vertically centred.
      height: s(389),
      justifyContent: 'center',
      gap: s(24),
      marginTop: s(38),
    },
    shareHeader: {
      width: s(221),
      alignItems: 'center',
      gap: s(8),
    },
    shareTitleRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(2),
    },
    shareBody: {
      width: s(371),
      gap: s(12),
    },
    linkRow: {
      height: s(58),
      borderRadius: s(SW_RADIUS.row),
      borderWidth: 1,
      borderColor: SW_COLOR.rowBorder,
      backgroundColor: SW_COLOR.rowBg,
      opacity: 0.8,
      paddingHorizontal: s(20),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s(8),
    },
    linkText: {
      fontFamily: font(400),
      fontSize: f(16),
      color: SW_COLOR.fieldText,
      textAlign: 'center',
      flexShrink: 1,
    },
    socialsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(9),
    },
    socialTile: {
      width: s(86),
      height: s(90),
      borderRadius: s(SW_RADIUS.tile),
      borderWidth: 1,
      borderColor: SW_COLOR.tileBorder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(4),
      overflow: 'hidden',
    },
    socialIcon: {
      width: s(38),
      height: s(38),
    },
    socialLabel: {
      fontFamily: font(600),
      fontSize: f(12),
      color: SW_COLOR.labelGrey,
      textAlign: 'center',
    },
    hintRow: {
      minHeight: s(45),
      borderRadius: s(SW_RADIUS.hint),
      borderWidth: 1,
      borderColor: SW_COLOR.rowBorder,
      backgroundColor: SW_COLOR.rowBg,
      paddingVertical: s(10),
      paddingHorizontal: s(14),
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(10),
    },
    hintText: {
      flex: 1,
      fontFamily: font(400),
      fontSize: f(13),
      lineHeight: f(18),
      color: SW_COLOR.fieldText,
    },
    hintEmphasis: {
      fontFamily: font(600),
      color: SW_COLOR.purpleBright,
    },
    hintGift: {
      width: s(20),
      height: s(20),
      flexShrink: 0,
    },

    /* ── Last winner (node 196:111) — gap 24 ───────────────────────────── */
    winnerSection: {
      width: s(404),
      alignItems: 'center',
      gap: s(24),
      marginTop: s(38),
    },
    winnerTitleRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
    },
    winnerTitle: {
      fontFamily: font(700),
      fontSize: f(24),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    winnerCard: {
      width: s(404),
      height: s(227),
      borderRadius: s(SW_RADIUS.card),
      paddingHorizontal: s(28),
      paddingVertical: s(33),
      justifyContent: 'space-between',
      overflow: 'hidden',
      shadowColor: SW_COLOR.winnerShadow,
      shadowOpacity: 1,
      shadowRadius: s(10.1),
      shadowOffset: { width: 0, height: 1 },
      elevation: 10,
    },
    winnerTopRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    winnerIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(12),
    },
    winnerNameCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: s(2),
    },
    winnerName: {
      fontFamily: font(600),
      fontSize: f(18),
      color: SW_COLOR.white,
      textAlign: 'right',
    },
    winnerMeta: {
      fontFamily: font(400),
      fontSize: f(12),
      color: SW_COLOR.winnerMeta,
      textAlign: 'right',
    },
    winnerAvatar: {
      width: s(48),
      height: s(48),
      borderRadius: s(24),
      backgroundColor: '#1A1030',
    },
    winnerStoryRow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(4),
      borderBottomWidth: 1,
      borderBottomColor: SW_COLOR.black,
    },
    winnerStoryText: {
      fontFamily: font(600),
      fontSize: f(12),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    winnerEmpty: {
      fontFamily: font(400),
      fontSize: f(15),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
      paddingHorizontal: s(24),
    },

    /* ── Stats bar (node 186:108) — the LAST CONTENT SECTION, not a footer.
     *
     * Figma places it at x=22, y=2615, 404×85 on a 2811pt artboard: same
     * gutter and column as every card above it, 44pt below the last-winner
     * section (which ends at 2571). The `bottom-[111px]` in the Figma export
     * is measured from the bottom of that tall scrolling artboard — it is not
     * a pin. So it scrolls with the page and ends it naturally.
     * ─────────────────────────────────────────────────────────────────── */
    statsBar: {
      width: s(404),
      height: s(85),
      marginTop: s(44),
      borderRadius: s(SW_RADIUS.statsBar),
      borderWidth: 1,
      borderColor: SW_COLOR.statsBorder,
      backgroundColor: SW_COLOR.statsBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
      overflow: 'hidden',
    },
    statsCol: {
      alignItems: 'center',
      gap: s(4),
    },
    statsLabel: {
      fontFamily: font(400),
      fontSize: f(10),
      color: SW_COLOR.statsLabel,
      textAlign: 'center',
    },
    statsValue: {
      fontFamily: font(600),
      fontSize: f(18),
      textAlign: 'center',
    },
    statsFriendsValue: {
      color: SW_COLOR.statsFriends,
    },
    statsIcon: {
      width: s(21),
      height: s(21),
    },
    statsDivider: {
      width: 1,
      height: s(29.004),
    },
    statsXpBadge: {
      width: s(26),
      height: s(26),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsXpBadgeText: {
      fontFamily: font(700),
      fontSize: f(7),
      textAlign: 'center',
    },

    /* ── Full leaderboard page ─────────────────────────────────────────────
     * Same 371pt row column and row styling as the top-5 card, so the two
     * surfaces read as one board rather than two designs.
     * ─────────────────────────────────────────────────────────────────── */
    lbHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: s(22),
      paddingBottom: s(16),
    },
    lbHeaderTitles: {
      flexShrink: 1,
      gap: s(4),
    },
    lbTitle: {
      fontFamily: font(700),
      fontSize: f(24),
      color: SW_COLOR.white,
    },
    lbSubtitle: {
      fontFamily: font(400),
      fontSize: f(13),
      color: SW_COLOR.bodyGrey,
    },
    lbCloseButton: {
      width: s(36),
      height: s(36),
      alignItems: 'center',
      justifyContent: 'center',
    },

    /**
     * Fixed top bar (not in the scroll) so the way back to Rank never scrolls
     * off. This route has no native header and no tab bar.
     */
    pageHeader: {
      width: '100%',
      minHeight: s(48),
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 40,
    },
    pageBackButton: {
      width: s(44),
      height: s(44),
      borderRadius: s(22),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    lbListContent: {
      width: s(371),
      alignSelf: 'center',
    },
    lbFooter: {
      paddingVertical: s(20),
      alignItems: 'center',
    },
    lbFooterText: {
      fontFamily: font(400),
      fontSize: f(13),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },
    lbSkeletonList: {
      width: s(371),
      alignSelf: 'center',
      gap: s(8),
    },
    lbSkeletonRow: {
      height: s(58),
      borderRadius: s(SW_RADIUS.row),
    },
    /** Pinned self-position bar at the bottom of the ranking page. */
    lbMineBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: s(10),
      paddingHorizontal: s(22),
      gap: s(6),
      backgroundColor: 'rgba(3,3,3,0.94)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
    },
    lbMineLabel: {
      fontFamily: font(400),
      fontSize: f(11),
      color: SW_COLOR.statsLabel,
    },
    /** Current-user emphasis, applied on top of the normal row treatment. */
    boardRowMine: {
      borderColor: SW_COLOR.prizeActiveBorder,
      backgroundColor: 'rgba(116,25,204,0.14)',
    },
    boardAvatarMine: {
      borderWidth: 1,
      borderColor: SW_COLOR.prizeActiveBorder,
    },

    /* ── States ────────────────────────────────────────────────────────── */
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(32),
      gap: s(12),
    },
    stateTitle: {
      fontFamily: font(700),
      fontSize: f(20),
      color: SW_COLOR.white,
      textAlign: 'center',
    },
    stateBody: {
      fontFamily: font(400),
      fontSize: f(15),
      color: SW_COLOR.bodyGrey,
      textAlign: 'center',
    },
    stateButton: {
      marginTop: s(8),
      paddingHorizontal: s(28),
      paddingVertical: s(12),
      borderRadius: s(SW_RADIUS.tile),
      borderWidth: 1,
      borderColor: SW_COLOR.cardBorder,
      backgroundColor: SW_COLOR.cardBg,
    },
    stateButtonText: {
      fontFamily: font(600),
      fontSize: f(15),
      color: SW_COLOR.white,
    },
    /** Skeleton block used while the payload loads. */
    skeleton: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: s(SW_RADIUS.tile),
    },
  });
}

/** Scaled stylesheet + the raw metrics, for components needing `s()` inline. */
export function useShareWinStyles(): ShareWinStyles {
  const metrics = useDesignScale();
  const language = useLanguageStore((state) => state.language);

  const sw = useMemo(() => buildStyles(metrics, language), [metrics, language]);

  return { sw, metrics };
}
