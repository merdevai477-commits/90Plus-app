/**
 * =============================================================================
 * QUESTIONS HUB — DESIGN TOKENS & STYLESHEET
 * =============================================================================
 *
 * A 1:1 port of Figma node 1:2 ("iPhone 14 Plus - 1", 448pt artboard,
 * 22pt side gutters ⇒ 404pt content column).
 *
 * Every number below is the RAW FIGMA VALUE. It is converted to device units
 * at render time by `useDesignScale()` (utils/responsive.ts), so the layout
 * keeps its proportions from iPhone SE (320pt) up to tablets. That means:
 *
 *      ✅  write `s(152)` — the Figma height
 *      ❌  don't write `152` — that would be fixed-pixel and break on small
 *          phones
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE TO CHANGE WHAT — quick index
 * ─────────────────────────────────────────────────────────────────────────────
 *   COLOURS ................. HUB_COLOR (top of this file)
 *   RADII / BORDERS ......... HUB_RADIUS, HUB_COLOR.cardBorder
 *   GRADIENTS ............... HUB_SCREEN_GRADIENT, HERO_XP_GRADIENT
 *   SCREEN BACKGROUND ....... `root` + `scroll`
 *   STREAK / COIN PILL ...... `streakBadge`, `streakPill`, `streakPillText`
 *   HERO IMAGE .............. `heroCard`, `heroCardImage`
 *   HERO COPY ............... `heroKicker`, `heroTitleText`, `heroTitleXp`,
 *                             `heroSubtitle`
 *   SECTION HEADING ......... `sectionHead`, `sectionTitle`, `sectionRule`
 *   CARD GRID SPACING ....... `modeRow` (gap + gutters)
 *   CARD SIZE / SHAPE ....... card.card / card.horizontalCard /
 *                             card.verticalCard
 *   CARD TYPOGRAPHY ......... card.title / card.subtitle
 *   STATS STRIP ............. `summaryStrip`, `summaryLabel`, `summaryValue`
 *   LEVEL / STAR BADGES ..... `levelSection`, `footerIconBadge`
 * =============================================================================
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useDesignScale, type DesignScale } from '../../../utils/responsive';
import { getAppFont } from '../../../utils/fontSetup';
import { useLanguageStore } from '../../../src/i18n/store';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. COLOUR TOKENS
 * Change a colour here and it updates everywhere on the hub.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const HUB_COLOR = {
  /** Page background. Figma frame fill. */
  screen: '#030303',
  /** Challenge card fill. */
  cardBg: '#030008',
  /** Challenge card 1px border. */
  cardBorder: 'rgba(190,165,246,0.40)',
  /** Hero card 1px border — Figma node 6:17. */
  heroBorder: 'rgba(190,165,246,0.20)',
  /** Coin/streak pill + badge fill. */
  pillSurface: '#05010E',
  /** Coin pill outer stroke. */
  pillBorder: '#000000',
  /** Purple glow behind the coin pill. */
  pillGlow: 'rgba(92,20,202,0.58)',

  textPrimary: '#FFFFFF',
  /** Hero kicker line. */
  textKicker: '#E7E7E7',
  /** Card subtitle. */
  textMuted: '#BFBFBF',
  /** Stats strip label. Figma nodes 18:15 / 18:20 / 18:23. */
  textStatLabel: '#C8B2FB',
  /** Stats strip value. */
  textStatValue: '#8351F5',

  /** Stats strip fill + border. */
  statsBg: 'rgba(26,5,75,0.19)',
  statsBorder: 'rgba(186,157,254,0.13)',
  /** Vertical hairline between stats. */
  divider: 'rgba(255,255,255,0.30)',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. SHAPE TOKENS  (raw Figma values — scaled at render time)
 * ═══════════════════════════════════════════════════════════════════════════ */

export const HUB_RADIUS = {
  hero: 18,
  card: 12,
  stats: 18,
  /** Card artwork corners. */
  cardImage: 8,
} as const;

/** Side gutter. Figma content column = 448 − (2 × 22) = 404. */
export const HUB_GUTTER = 22;
/** Horizontal space between two cards in a row. */
export const GRID_GAP = 16;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. GRADIENTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Page backdrop, top → bottom. */
export const HUB_SCREEN_GRADIENT: [string, string, string] = ['#05010D', '#090316', '#05010D'];

/**
 * Big "XP" word inside the hero. Figma node 6:14 —
 * linear-gradient(226.5deg, #4803B1 26.5%, #E2D3FD 44%, #2B077E 61%).
 * 226.5° ≈ a diagonal running bottom-left → top-right.
 */
export const HERO_XP_GRADIENT: [string, string, string] = ['#4803B1', '#E2D3FD', '#2B077E'];
export const HERO_XP_GRADIENT_LOCATIONS: [number, number, number] = [0.2646, 0.4403, 0.6115];
export const HERO_XP_GRADIENT_START = { x: 0.05, y: 1 };
export const HERO_XP_GRADIENT_END = { x: 0.95, y: 0 };
/** Purple bloom behind the hero "XP". Figma text-shadow 0 0 7.3px #4e05bf. */
export const HERO_XP_GLOW = '#4E05BF';

/* Legacy aliases — kept so older imports keep compiling. */
export const CARD_RADIUS = HUB_RADIUS.hero;
export const CARD_BG = HUB_COLOR.cardBg;
export const CARD_BORDER = HUB_COLOR.cardBorder;

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. STYLESHEET FACTORY
 * `s()` scales spacing/sizes, `f()` scales font sizes (damped).
 * ═══════════════════════════════════════════════════════════════════════════ */

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);

  /**
   * Figma is drawn in Arabic (RTL). In English the same blocks should read
   * left-to-right, so alignment is derived rather than hardcoded.
   */
  const isRtl = language === 'ar';
  const alignLead = isRtl ? ('flex-end' as const) : ('flex-start' as const);
  const textAlign = isRtl ? ('right' as const) : ('left' as const);

  /**
   * Figma specifies Changa (an Arabic display face). The app ships Cairo for
   * Arabic and Inter for Latin, so `getAppFont` resolves to whichever is
   * actually loaded. CUSTOMIZE: to introduce Changa, register it in
   * app/_layout.tsx → useFonts and map it in utils/fontSetup.ts.
   */
  const font = (weight: 400 | 500 | 600 | 700 | 800) => getAppFont(weight, language);

  const hub = StyleSheet.create({
    /* ── Screen shell ──────────────────────────────────────────────────────
     * NOTE: `root` used to be #FFFFFF and `scroll` carried borderRadius: 50.
     * Those came from the Figma *device mockup* frame, not the app — they
     * produced a white bar and rounded corners on real devices. Both removed.
     */
    root: {
      flex: 1,
      backgroundColor: HUB_COLOR.screen,
    },
    scroll: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      flexGrow: 1,
    },

    /* ── Coin / streak cluster — Figma "Group 2" (91 × 39 @ x 335, y 95) ──
     * The pill slides 17pt under the circular badge to create the notch.
     * CUSTOMIZE: badge size → streakBadge.width/height + QuizFlameIcon size
     *            in components/HeroBanner.tsx
     */
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: s(38),
      marginRight: s(HUB_GUTTER),
    },
    streakBadge: {
      width: s(39),
      height: s(39),
      flexShrink: 0,
      borderRadius: s(39) / 2,
      borderWidth: 1,
      borderColor: HUB_COLOR.pillBorder,
      backgroundColor: HUB_COLOR.pillSurface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    streakPill: {
      minWidth: s(74),
      height: s(37),
      /**
       * Figma "Group 2" is 91 wide: the badge starts at the group's leading
       * edge and the 74pt pill starts 17 in, so the two overlap by 39 − 17 = 22.
       * (This used to be −17, which made the cluster 96 wide and pushed the
       * coin count off the design's grid.)
       */
      marginLeft: -s(22),
      paddingTop: s(4),
      paddingRight: s(23),
      paddingBottom: s(5),
      paddingLeft: s(33),
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      borderTopRightRadius: s(48),
      borderBottomRightRadius: s(48),
      borderWidth: 1,
      borderColor: HUB_COLOR.pillBorder,
      backgroundColor: HUB_COLOR.pillSurface,
      // Purple bloom — iOS shadow* / Android elevation.
      shadowColor: HUB_COLOR.pillGlow,
      shadowOpacity: 1,
      shadowOffset: { width: 0, height: 0 },
      // Figma drop-shadow 0 0 4.3px rgba(92,20,202,0.58).
      shadowRadius: s(4.3),
      elevation: 8,
    },
    streakPillText: {
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(19),
      color: HUB_COLOR.textPrimary,
      textAlign: 'center',
    },
    /** MaskedView needs a measured box, otherwise the gradient text collapses. */
    streakPillTextMask: {
      minWidth: s(30),
      height: f(19),
      justifyContent: 'center',
    },
    streakPillTextStroke: { color: '#000000' },
    streakPillTextHidden: { opacity: 0 },

    /* ── Hero card — Figma "Frame 5" (404 × 152 @ x 22, y 172) ────────────
     * Structure: artwork fills the card, copy sits on top, vertically
     * centred and pinned to the leading edge with 19pt inset.
     *
     * CUSTOMIZE
     *   image file ....... components/HeroBanner.tsx → require('questions-frame.png')
     *   card height ...... heroCard.height
     *   corner radius .... HUB_RADIUS.hero
     *   copy inset ....... heroCardOverlay.paddingHorizontal
     *   copy width ....... heroTextBlock.width  (Figma: 153)
     */
    heroCard: {
      height: s(152),
      marginHorizontal: s(HUB_GUTTER),
      marginBottom: s(41),
      borderRadius: s(HUB_RADIUS.hero),
      borderWidth: 1,
      borderColor: HUB_COLOR.heroBorder,
      backgroundColor: HUB_COLOR.screen,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    /**
     * Absolutely-positioned artwork layer.
     * Explicit width/height ('100%') rather than StyleSheet.absoluteFill —
     * expo-image needs a resolved box to lay out, and the previous
     * absoluteFillObject spread left it unsized on some Android builds, which
     * is why the hero rendered as a plain black card.
     */
    heroCardImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    /** Dark scrim so the copy stays legible over the artwork. */
    heroScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    heroCardOverlay: {
      paddingHorizontal: s(19),
      justifyContent: 'center',
    },
    /** Figma node 6:16 — fixed 153pt column, lines hugging the leading edge. */
    heroTextBlock: {
      width: s(153),
      gap: s(3),
      alignItems: alignLead,
    },
    heroKicker: {
      fontFamily: font(400),
      fontSize: f(14),
      lineHeight: f(20),
      color: HUB_COLOR.textKicker,
      textAlign,
      width: '100%',
    },
    /**
     * "واربح نقاط XP" / "Earn XP Points". Height locked to Figma 30.
     * Word ORDER is decided in components/HeroBanner.tsx so English reads
     * "Earn XP Points" rather than "XP Earn Points".
     */
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(4),
      height: s(30),
      width: '100%',
      justifyContent: alignLead,
    },
    heroTitleText: {
      fontFamily: font(700),
      fontSize: f(24),
      lineHeight: f(30),
      color: HUB_COLOR.textPrimary,
      textAlign,
    },
    heroTitleXpMask: {
      height: s(38),
      justifyContent: 'center',
    },
    heroTitleXp: {
      fontFamily: font(500),
      fontSize: f(36),
      lineHeight: f(38),
      // Glow — Figma text-shadow 0 0 7.3px #4e05bf.
      textShadowColor: HERO_XP_GLOW,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: s(7),
    },
    heroTitleXpHidden: { opacity: 0 },
    heroSubtitle: {
      // Figma node 13:16 — 8pt gap between the title block and this line.
      marginTop: s(8),
      fontFamily: font(400),
      fontSize: f(12),
      lineHeight: f(18),
      color: HUB_COLOR.textPrimary,
      textAlign,
    },

    /* ── Section heading — Figma "Frame 6" (142 × 37 @ x 282, y 365) ──────
     * Title + a 30pt vertical rule, hugging the trailing edge, 24pt in.
     * Mirrors for English so the heading sits on the left.
     */
    sectionHead: {
      flexDirection: isRtl ? 'row' : 'row-reverse',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: alignLead,
      gap: s(12),
      marginLeft: s(24),
      marginRight: s(24),
      marginBottom: s(39),
    },
    sectionTitle: {
      fontFamily: font(600),
      // Figma node 7:14 — 20pt (was redrawn down from 24 after the first port).
      fontSize: f(20),
      lineHeight: f(37),
      color: HUB_COLOR.textPrimary,
    },
    sectionTitleRtl: { textAlign: 'right' },
    /**
     * The purple tick on the heading's leading side — Figma node 7:16 is a 4pt
     * round-capped stroke with a #460BCB → #230665 vertical gradient, not the
     * 1pt white hairline this used to draw.
     */
    sectionRule: {
      width: s(4),
      height: s(30),
      borderRadius: s(2),
    },

    /* ── Card grid ───────────────────────────────────────────────────────
     * Row-to-row spacing is per-row (Figma is not uniform) and lives in
     * components/ChallengeGrid.tsx → ROW_BOTTOM_MARGIN.
     */
    modeRow: {
      flexDirection: 'row',
      marginHorizontal: s(HUB_GUTTER),
      gap: s(GRID_GAP),
    },
    emptyColumn: { flex: 1 },

    /* ── Stats strip — Figma "Frame 29" (404 × 85 @ x 22, y 1087) ────────
     * [level badge] │ XP │ Answered │ Total XP [star badge]
     * CUSTOMIZE: badge size → levelSection / footerIconBadge (Figma 49×49)
     */
    summaryStrip: {
      minHeight: s(85),
      marginHorizontal: s(HUB_GUTTER),
      marginBottom: s(16),
      borderRadius: s(HUB_RADIUS.stats),
      backgroundColor: HUB_COLOR.statsBg,
      borderWidth: 1,
      borderColor: HUB_COLOR.statsBorder,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // Figma node 18:50 — gap 12, no side padding (the strip is exactly 404
      // wide and its children are content-sized).
      gap: s(12),
      paddingVertical: s(10),
    },
    summaryStripCompact: { gap: s(6) },
    divider: {
      width: 1,
      height: s(29),
      backgroundColor: HUB_COLOR.divider,
    },
    levelSection: {
      width: s(49),
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerIconBadge: {
      width: s(49),
      height: s(49),
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerIconPolygon: {
      width: s(49),
      height: s(49),
      position: 'absolute',
    },
    footerIconStar: {
      width: s(20),
      height: s(19),
    },
    summaryBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(2),
      minWidth: 0,
    },
    summaryLabel: {
      fontFamily: font(400),
      fontSize: f(10),
      lineHeight: f(12),
      color: HUB_COLOR.textStatLabel,
      marginBottom: s(4),
      textAlign: 'center',
    },
    summaryLabelCompact: { fontSize: f(8), lineHeight: f(10) },
    summaryValue: {
      fontFamily: font(600),
      fontSize: f(18),
      lineHeight: f(22),
      color: HUB_COLOR.textStatValue,
      textAlign: 'center',
    },
    summaryValueCompact: { fontSize: f(14), lineHeight: f(16) },
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * CHALLENGE CARDS
   * Two silhouettes, both 194pt wide in Figma:
   *   • horizontal — 109 tall, artwork beside the copy  (guess-player, bingo)
   *   • vertical   — 149 tall, artwork above the copy   (all other modes)
   * Per-mode padding/artwork overrides live in components/ChallengeCard.tsx
   * → CHALLENGE_LAYOUT.
   * ═══════════════════════════════════════════════════════════════════════ */

  const card = StyleSheet.create({
    /** Shared shell. `flex: 1` lets two cards split the 404pt row. */
    card: {
      flex: 1,
      borderRadius: s(HUB_RADIUS.card),
      borderWidth: 1,
      borderColor: HUB_COLOR.cardBorder,
      backgroundColor: HUB_COLOR.cardBg,
      overflow: 'hidden',
    },
    /** Figma Frame 27:287 / 8:31 — 194 × 109, px-10, gap-8. */
    horizontalCard: {
      height: s(109),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s(10),
      gap: s(8),
    },
    /**
     * Figma Frame 30:314 etc. — 194 × 149, flex-col, gap-8, justify-center.
     * Centring (rather than a per-mode top padding) is what produces Figma's
     * 16/17/20/21pt artwork insets automatically, whatever the artwork height.
     */
    verticalCard: {
      height: s(149),
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: s(8),
    },
    cardPressed: { opacity: 0.92 },

    /* Artwork. Per-mode width/height overrides come from CHALLENGE_LAYOUT. */
    /** Figma 27:288 — 81 × 80, radius 8. */
    horizontalImg: {
      width: s(81),
      height: s(80),
      borderRadius: s(HUB_RADIUS.cardImage),
    },
    /** Figma 30:312 etc. — the vertical cards' artwork is NOT rounded. */
    verticalImg: {
      width: s(115),
      height: s(66),
    },
    horizontalArt: {
      borderRadius: s(HUB_RADIUS.cardImage),
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      // Figma `shrink-0` — the artwork keeps its box whatever the copy does.
      flexShrink: 0,
    },
    /**
     * Figma Frame 8 — 87pt copy column beside the artwork, gap 8.
     * Figma's own frame overflows its 194pt card by 2pt (10+81+8+87+10 = 196),
     * so the column is allowed to shrink those last 2pt rather than push the
     * XP line past the card's `overflow: hidden` edge.
     */
    horizontalTextCol: {
      width: s(87),
      gap: s(8),
      flexShrink: 1,
      minWidth: 0,
    },
    /** Figma Frame 27:302 — full-width copy block under the artwork, gap 8. */
    verticalTextBlock: {
      alignSelf: 'stretch',
      gap: s(8),
    },

    /* Card typography — Figma Frame 7 / Frame 33.
     * Figma draws the card copy in Inter Semi Bold (600) / Medium (500) — NOT
     * Bold. 700 made the titles and the XP line noticeably heavier than the
     * design. */
    title: {
      fontFamily: font(600),
      fontSize: f(14),
      lineHeight: f(17),
      color: HUB_COLOR.textPrimary,
      textAlign: 'left',
    },
    /**
     * The card's second line is always the mode's ARABIC name (see
     * ../data.ts → mergeQuestionModes), so it is pinned to the Arabic face
     * rather than following the UI language — Inter carries no Arabic glyphs
     * and would fall through to a system font.
     */
    subtitle: {
      fontFamily: getAppFont(500, 'ar'),
      fontSize: f(12),
      lineHeight: f(15),
      color: HUB_COLOR.textMuted,
      textAlign: 'left',
      // Figma marks the row `whitespace-nowrap`: the subtitle gives way before
      // the XP does, so a long name never pushes the reward off the card.
      flexShrink: 1,
      minWidth: 0,
    },
    /** Figma Frame 8:34 — 4pt between the horizontal card's title and subtitle. */
    horizontalTitleGroup: { gap: s(4) },
    /**
     * Figma Frame 27:309 / 30:319 — subtitle and XP side by side, gap 8,
     * `items-start`: the two runs are 15pt and 18pt tall and Figma aligns their
     * TOPS (both at y = 0), not their centres.
     */
    horizontalSubXpRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: s(8),
    },
    horizontalSubXpRowRtl: { flexDirection: 'row-reverse' },
  });

  return { hub, card };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. HOOK  —  the only thing components should import
 * ═══════════════════════════════════════════════════════════════════════════ */

type HubStyles = ReturnType<typeof createStyles>;

/** Styles are pure functions of (scale, language) — cache to avoid rebuilds. */
const styleCache = new Map<string, HubStyles>();

export interface QuestionsHubStyleBundle {
  /** Screen-level styles. */
  hub: HubStyles['hub'];
  /** Challenge-card styles. */
  card: HubStyles['card'];
  /** `s()` / `f()` helpers + live window size, for inline one-offs. */
  metrics: DesignScale;
}

export function useQuestionsHubStyles(): QuestionsHubStyleBundle {
  const metrics = useDesignScale();
  const language = useLanguageStore((state) => state.language);
  const { scale, fontScale } = metrics;
  const key = `${Math.round(scale * 1000)}-${language}`;

  const styles = useMemo(() => {
    const cached = styleCache.get(key);
    if (cached) return cached;
    const created = createStyles(scale, fontScale, language);
    styleCache.set(key, created);
    return created;
  }, [key, scale, fontScale, language]);

  return { hub: styles.hub, card: styles.card, metrics };
}
