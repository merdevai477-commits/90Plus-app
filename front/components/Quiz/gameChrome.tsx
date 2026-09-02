/**
 * =============================================================================
 * SHARED INTERNAL GAME CHROME
 * =============================================================================
 *
 * The top of EVERY playable game screen — Football Quiz, Guess The Player,
 * Football Bingo, Football Grid, Player Connections, Guess The Club, Transfer
 * Puzzle — is the same two blocks:
 *
 *   GameScreenHeader   back arrow · centred title · XP cluster   Figma y 95, 404×38
 *   GameProgressCard   "Question 2 of 6" + segments              Figma y 185, 404×95
 *
 * Every Figma node in the set (233:249, 233:274, 233:299, 238:324, 238:374,
 * 231:73, 233:224) draws these identically, so they live here once instead of
 * being re-implemented per screen. This module is the single source of truth —
 * change a value here and every game screen follows.
 *
 * NOTE ON THE TOP OFFSET
 * ----------------------
 * Figma measures y from the top of the 448×… artboard, which INCLUDES the 62pt
 * iOS status bar. On device that 62pt is `insets.top`, so the header's real
 * offset below the safe area is 95 − 62 = 33 (`GAME_LAYOUT.contentTop`).
 * Adding the full 95 on top of `insets.top` double-counts the status bar and is
 * what used to push the Football Quiz hero too far down the screen.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   COLOURS ............ GAME_COLOR
 *   GUTTER / OFFSETS ... GAME_LAYOUT
 *   BACK ARROW ......... BackArrowIcon
 *   TITLE TYPE ......... styles.headerTitle
 *   XP BADGE + PILL .... styles.xpBadge / styles.xpPill
 *   PROGRESS CARD ...... styles.progressCard / styles.progressSegment
 * =============================================================================
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';

import { useLanguageStore } from '../../src/i18n/store';
import { getAppFont } from '../../utils/fontSetup';
import { useDesignScale, type DesignScale } from '../../utils/responsive';
import QuestionLifelines, { type Lifeline } from './QuestionLifelines';
import { useFadeOnChange, usePulse } from './gameMotion';
import {
  QUIZ_FIGMA_ACTION_GRAD_END,
  QUIZ_FIGMA_ACTION_GRAD_START,
  QUIZ_FIGMA_XP_GLOW,
  QUIZ_FIGMA_XP_GRAD,
  QUIZ_FIGMA_XP_GRAD_LOCATIONS,
} from './quiz.constants';

/* ═══════════════════════════════════════════════════════════════════════════
 * DESIGN TOKENS — shared by every game screen and every answer surface.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const GAME_COLOR = {
  /** Page background. */
  background: '#030303',
  /** Progress card border. */
  progressBorder: '#590AA4',
  /** Progress card accent (the "2" and the "6"). */
  progressAccent: '#5F00B9',
  /** Filled progress segment, top → bottom. */
  segmentGradient: ['#5F00B9', '#2B0053'] as const,
  segmentEmpty: '#202020',

  /** 1px border on option rows, evidence rows, cards and cells. */
  rowBorder: '#2B2539',
  /**
   * Surface fill for every card / row.
   * Figma is `bg-gradient-to-t from-#07040d to-#0c051a` — #0c051a at the TOP,
   * #07040d at the BOTTOM. Listed here in RN paint order (top → bottom).
   */
  rowGradient: ['#0C051A', '#07040D'] as const,

  /** Purple used for letter badges, radio fills, icons and "+" glyphs. */
  accent: '#A855F7',
  /** Deeper purple the accent fades into on gradient text. */
  accentDeep: '#633291',
  /** Letter / icon tile fill. */
  tileSurface: '#0A0412',
  /** Solid border on the Football Grid's answer cells. */
  gridCellBorder: '#633291',
  /** Dashed inner outline on an empty grid cell. */
  gridCellDashed: '#381E51',

  pillSurface: '#05010E',
  textPrimary: '#FFFFFF',
  /** Question subtitle. */
  textMuted: '#ADADAD',
  /** Evidence row value + secondary copy. */
  textValue: '#E9E9E9',
  /** Option "example" line. */
  textExample: '#8D8D8D',

  correct: '#22C55E',
  wrong: '#EF4444',
} as const;

/**
 * The little vertical bar beside a section heading — 4pt wide, round-capped,
 * top → bottom. Figma nodes 7:16 (Questions hub) and 260:1421 (Evidence).
 */
export const SECTION_RULE_GRADIENT = ['#460BCB', '#230665'] as const;

export const GAME_LAYOUT = {
  /** Figma artboard width every measurement is relative to. */
  artboard: 448,
  /** Side gutter → the 404pt content column. */
  gutter: 22,
  /** Header offset BELOW the safe area. Figma y 95 − 62pt status bar. */
  contentTop: 33,
  /** Header row height (back arrow / XP badge). */
  headerHeight: 39,
  /** Space between the header and the progress card. Figma 185 − (95 + 38). */
  headerToProgress: 52,
  /** Progress card height. */
  progressHeight: 95,
  /** Pinned action bar height. Figma Frame 174. */
  actionBarHeight: 218,
} as const;

/** Total height the header + progress card occupy, excluding the safe area. */
export function gameChromeHeight(s: (value: number) => number): number {
  return (
    s(GAME_LAYOUT.contentTop) +
    s(GAME_LAYOUT.headerHeight) +
    s(GAME_LAYOUT.headerToProgress) +
    s(GAME_LAYOUT.progressHeight)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLESHEET
 * ═══════════════════════════════════════════════════════════════════════════ */

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (w: 400 | 500 | 600 | 700 | 800) => getAppFont(w, language);

  /** Badge (39) + pill (94) overlapping by 22 — Figma Group 277:1750. */
  const xpClusterWidth = s(39) + s(94) - s(22);

  return StyleSheet.create({
    /* ── HEADER — Figma 404 × 38 @ y 95 ────────────────────────────────
     * Back arrow hugs the leading edge, XP cluster the trailing edge, and the
     * title is absolutely centred in the column so it lands in the same place
     * on every screen regardless of how wide the title or the XP value is.
     */
    header: {
      height: s(GAME_LAYOUT.headerHeight),
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    backButton: {
      width: s(38),
      height: s(38),
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    /**
     * Inset by the XP cluster on BOTH sides so the text box stays centred on
     * the column and can never collide with the badge. Long titles shrink
     * (adjustsFontSizeToFit) rather than clip.
     */
    headerTitleSlot: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: xpClusterWidth + s(8),
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    headerTitle: {
      fontFamily: font(600),
      fontSize: f(20),
      lineHeight: f(26),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },

    /* ── XP CLUSTER — Figma Group 277:1750 ─────────────────────────────
     * A 39pt circular badge with a 94pt pill sliding out from under it. The
     * pill is offset 17pt inside the group, so the overlap is 39 − 17 = 22.
     */
    /*
     * ── XP CLUSTER — Figma node 277:1738 (group 277:1750), verified against
     * the live file via get_design_context on 246:796 ───────────────────
     *
     * An "XP" disc (277:1741) in FRONT of a value pill (277:1739), both 39pt
     * tall, both filled #05010e with a 1px BLACK stroke — the border is not
     * purple, it is nearly invisible against the fill. The purple ring the eye
     * reads comes entirely from a drop-shadow / bloom, and per the Figma node
     * tree that bloom sits on the PILL ONLY, not the disc.
     *
     * Exact numbers off the node (not approximated):
     *   pill  — w 94 h 39, radius 48 on the TRAILING corners only (the leading
     *           edge is square, tucked under the disc), pl 33 / pr 23 / pt 4 /
     *           pb 5, text 16px Inter Medium (500)
     *   disc  — 39×39, radius 35 (⇒ a circle at this size), text 16px Inter
     *           Semibold (600)
     *   overlap — pill sits at x 17 inside the group, disc at x 0 ⇒ the disc
     *           covers the pill's square left edge by 39 − 17 = 22pt.
     *
     * A previous pass changed the stroke to purple, the value to 24pt/700 and
     * the pill to 34pt tall — all three were wrong; this restores the literal
     * node values.
     */
    xpCluster: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
    /** Painted after the pill (see JSX) so it sits in front, per the node. */
    xpBadge: {
      zIndex: 2,
      width: s(39),
      height: s(39),
      borderRadius: s(39) / 2,
      borderWidth: 1,
      borderColor: '#000000',
      backgroundColor: GAME_COLOR.pillSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    xpBadgeText: {
      fontFamily: font(600),
      fontSize: f(16),
      lineHeight: f(20),
      color: QUIZ_FIGMA_XP_GRAD[1],
      textAlign: 'center',
    },
    xpPill: {
      marginLeft: -s(22),
      minWidth: s(94),
      height: s(39),
      // Only the trailing corners round — the leading edge tucks under the
      // disc. Figma: rounded-tr-48 / rounded-br-48, no radius on the left.
      borderTopRightRadius: s(48),
      borderBottomRightRadius: s(48),
      borderWidth: 1,
      borderColor: '#000000',
      backgroundColor: GAME_COLOR.pillSurface,
      alignItems: 'center',
      justifyContent: 'center',
      // Figma node 277:1739 — pl-33 / pr-23 / pt-4 / pb-5.
      paddingLeft: s(33),
      paddingRight: s(23),
      paddingTop: s(4),
      paddingBottom: s(5),
      // Figma drop-shadow 0 0 4.3px rgba(92,20,202,0.58) — the ONLY glow in
      // the cluster; the disc has none of its own.
      shadowColor: QUIZ_FIGMA_XP_GLOW,
      shadowOpacity: 1,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: s(4.3),
      elevation: 6,
    },
    xpPillText: {
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(20),
      color: QUIZ_FIGMA_XP_GRAD[1],
      textAlign: 'center',
    },
    gradientTextHidden: { opacity: 0 },

    /* ── PROGRESS CARD — Figma 404 × 95 @ y 185 ───────────────────────── */
    progressCard: {
      marginTop: s(GAME_LAYOUT.headerToProgress),
      height: s(GAME_LAYOUT.progressHeight),
      borderRadius: s(16),
      borderWidth: 1,
      borderColor: GAME_COLOR.progressBorder,
      backgroundColor: GAME_COLOR.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(12),
    },
    progressLabel: { textAlign: 'center' },
    progressLabelBase: {
      fontFamily: font(600),
      fontSize: f(20),
      lineHeight: f(26),
      color: GAME_COLOR.textPrimary,
    },
    progressLabelAccent: {
      fontFamily: font(600),
      fontSize: f(20),
      lineHeight: f(26),
      color: GAME_COLOR.progressAccent,
    },
    /** Strip is 277 wide inside a 404 card ⇒ 15.7% inset per side. */
    progressSegments: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      height: s(7),
      gap: s(8),
      paddingHorizontal: '15.7%',
    },
    progressSegment: { flex: 1, height: s(7), borderRadius: s(11) },
    progressSegmentEmpty: { backgroundColor: GAME_COLOR.segmentEmpty },

    /* ── ACTION BAR — Figma Frame 174 (448 × 218, full bleed, pinned) ──
     * Row 1: the three hexagon lifelines. Row 2: the confirm / next button.
     * Content is 72 + 24 + 64 = 160 inside 218, leaving 29 above and below.
     */
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: GAME_COLOR.background,
      borderTopWidth: 1,
      borderTopColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: s(29),
      paddingHorizontal: s(GAME_LAYOUT.gutter),
      gap: s(24),
    },
    /** Figma 384:332 — 404 × 64. */
    primaryButton: {
      alignSelf: 'stretch',
      height: s(64),
      borderRadius: s(16),
      overflow: 'hidden',
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: {
      fontFamily: font(600),
      fontSize: f(18),
      lineHeight: f(24),
      color: GAME_COLOR.textPrimary,
    },

    /* ── LOADING STATE — shared by every game mode ────────────────────── */
    loadingRoot: {
      flex: 1,
      backgroundColor: GAME_COLOR.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(GAME_LAYOUT.gutter),
    },
    /** Children bring their own top spacing, so the spinner never double-gaps. */
    loadingExtras: { alignItems: 'center' },
    /**
     * The escape hatch pinned over the spinner — see GameLoadingState.
     *
     * Absolutely positioned so adding it cannot move the spinner, which stays
     * centred on the page exactly where it has always been. It sits on the
     * same leading edge and the same `contentTop` offset as the real header's
     * back arrow, so the arrow does not jump when the round finishes loading
     * and GameScreenHeader takes over.
     */
    loadingBack: {
      position: 'absolute',
      left: s(GAME_LAYOUT.gutter),
      zIndex: 5,
    },
  });
}

type GameChromeStyles = ReturnType<typeof createStyles>;

/** Styles are a pure function of (scale, language) — cache to avoid rebuilds. */
const styleCache = new Map<string, GameChromeStyles>();

export function useGameChromeStyles(): {
  styles: GameChromeStyles;
  metrics: DesignScale;
  isRtl: boolean;
} {
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

  return { styles, metrics, isRtl: language === 'ar' };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PIECES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * THE loading state for every game mode — Football Quiz included.
 *
 * There is one spinner in this feature and it lives here: a large
 * `ActivityIndicator` in the accent purple, centred on the game background.
 * Football Quiz used to draw its own (soft-accent spinner + caption over the
 * quiz background), which made entering it feel like a different app to
 * entering Guess The Player. Both screens now render this component, so size,
 * colour, animation and position can only ever change for all of them at once.
 *
 * `topInset` pushes the spinner down by the same content offset the screen's
 * header would occupy, so it sits exactly where the mode screens put it.
 * `children` is for anything a specific screen must add BELOW the spinner (the
 * daily pack's "preparing…" retry button) — never a second spinner.
 *
 * ── THE BACK ARROW IS NOT OPTIONAL ───────────────────────────────────────────
 * `onBack` draws the same arrow, in the same place, as GameScreenHeader.
 *
 * This screen used to render the spinner ALONE. Every game mode swaps its whole
 * header out for this component while the round loads, so for as long as the
 * request was in flight there was no back arrow, no title and nothing to tap:
 * the hardware back button is the only way out on Android and there is none at
 * all on iOS. A round that took a long time — or a request that never came back
 * — was therefore indistinguishable from the app freezing, which is exactly how
 * "Bingo hangs" and "the Daily Quiz has no back button" were both reported.
 *
 * Callers pass their own back handler because the two families of screen unwind
 * differently (goBackToQuestionsHub vs. the mode screen's router.back), but no
 * caller should omit it: a loading state with no way out is a trap.
 */
export function GameLoadingState({
  topInset = 0,
  onBack,
  backAccessibilityLabel = 'Back',
  children,
}: {
  topInset?: number;
  /** Leaves the screen while the round is still loading. */
  onBack?: () => void;
  backAccessibilityLabel?: string;
  children?: React.ReactNode;
}) {
  const { styles, metrics } = useGameChromeStyles();

  return (
    <View style={[styles.loadingRoot, { paddingTop: topInset }]}>
      {onBack ? (
        <TouchableOpacity
          style={[styles.loadingBack, { top: topInset }]}
          onPress={onBack}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          testID="game-loading-back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrowIcon size={metrics.s(38)} />
        </TouchableOpacity>
      ) : null}
      <ActivityIndicator size="large" color={GAME_COLOR.accent} />
      {children ? <View style={styles.loadingExtras}>{children}</View> : null}
    </View>
  );
}

/**
 * Back arrow — Figma "ion:arrow-back" (38 × 38), exported verbatim so the
 * stroke weight and cap geometry match the design.
 */
export function BackArrowIcon({ size, color = GAME_COLOR.textPrimary }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <Path
        d="M18.4375 25.75L11.6875 19L18.4375 12.25M12.625 19H26.3125"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Gradient-filled text — the RN stand-in for CSS `background-clip: text`.
 * Defaults to the XP purple ramp; pass `colors` for a different fill.
 */
export function GameGradientText({
  value,
  style,
  colors,
}: {
  value: string | number;
  style: object;
  colors?: readonly [string, string];
}) {
  const { styles } = useGameChromeStyles();

  return (
    <MaskedView maskElement={<Text style={style}>{value}</Text>}>
      <LinearGradient
        colors={colors ? [...colors] : [...QUIZ_FIGMA_XP_GRAD]}
        locations={colors ? undefined : [...QUIZ_FIGMA_XP_GRAD_LOCATIONS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={[style, styles.gradientTextHidden]}>{value}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * The internal game header. Identical on every game screen.
 *
 * @param trailing optional extra control rendered before the XP cluster (the
 *                 Football Quiz uses it for its language toggle, which has no
 *                 Figma counterpart but is real, shipped functionality).
 */
export function GameScreenHeader({
  title,
  onBack,
  xp,
  stats,
  backAccessibilityLabel = 'Back',
  trailing,
}: {
  title: string;
  onBack: () => void;
  xp?: number | string;
  stats?: React.ReactNode;
  backAccessibilityLabel?: string;
  trailing?: React.ReactNode;
}) {
  const { styles, metrics } = useGameChromeStyles();
  const fallbackXp = xp ?? '—';
  const xpLabel = typeof fallbackXp === 'number' ? fallbackXp.toLocaleString() : fallbackXp;
  const xpPulse = usePulse(String(xpLabel));

  /**
   * The title is centred on the column and inset by the XP cluster on both
   * sides so the two can never collide. The cluster's width depends on how many
   * digits the value has, so it is MEASURED rather than assumed — a five-figure
   * balance widens the pill and the title's safe area follows it.
   */
  const [xpWidth, setXpWidth] = useState(0);
  const handleXpLayout = useCallback((event: LayoutChangeEvent) => {
    setXpWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <BackArrowIcon size={metrics.s(38)} />
      </TouchableOpacity>

      {/* Centred on the column, drawn under the back arrow / XP cluster. */}
      <View
        style={[
          styles.headerTitleSlot,
          xpWidth ? { paddingHorizontal: xpWidth + metrics.s(8) } : null,
        ]}
        pointerEvents="none"
      >
        <Text
          style={styles.headerTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {title}
        </Text>
      </View>

      {/* One quiet beat when the balance changes — see usePulse in ./gameMotion. */}
      <Animated.View style={[styles.xpCluster, xpPulse]} onLayout={handleXpLayout}>
        {trailing}
        {stats ? (
          stats
        ) : (
          <>
            <View style={styles.xpBadge}>
              <GameGradientText value="XP" style={styles.xpBadgeText} />
            </View>
            <View style={styles.xpPill}>
              <GameGradientText value={xpLabel} style={styles.xpPillText} />
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/**
 * The pinned bottom bar — Figma Frame 174, identical on every game artboard:
 * three hexagon lifelines over a full-width primary button.
 *
 * Screens differ only in what the lifelines DO and what the button says, so
 * they pass those in; the chrome itself is never re-implemented. The Football
 * Quiz, for example, spends coins per lifeline (`badgeKind: 'cost'`) while the
 * other modes spend a per-round budget (`badgeKind: 'count'`) — same bar.
 */
export function GameActionBar({
  lifelines,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  showPrimary = true,
  bottomInset,
  onLayout,
}: {
  lifelines: Lifeline[];
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  /**
   * False on a board that answers itself — Football Bingo submits on the third
   * cell and Football Grid on the placement, so there is nothing left to
   * "confirm". The button comes back once the answer is revealed, as "Next".
   */
  showPrimary?: boolean;
  bottomInset: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { styles, metrics } = useGameChromeStyles();

  return (
    <View
      style={[
        styles.actionBar,
        { paddingBottom: Math.max(bottomInset + metrics.s(11), metrics.s(29)) },
      ]}
      onLayout={onLayout}
    >
      <QuestionLifelines lifelines={lifelines} />

      {showPrimary ? (
        <TouchableOpacity
          style={[styles.primaryButton, primaryDisabled && styles.primaryButtonDisabled]}
          onPress={onPrimary}
          disabled={primaryDisabled}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ disabled: primaryDisabled }}
        >
          <LinearGradient
            colors={[QUIZ_FIGMA_ACTION_GRAD_START, QUIZ_FIGMA_ACTION_GRAD_END]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.primaryButtonFill}
          >
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * "Question 2 of 6" + the segmented bar. The segment COUNT comes from the
 * caller, so changing the round length redraws the bar automatically.
 */
export function GameProgressCard({
  current,
  total,
  language,
}: {
  current: number;
  total: number;
  language: string;
}) {
  const { styles } = useGameChromeStyles();
  const segments = Array.from({ length: Math.max(total, 1) });
  // The label is replaced rather than moved when the question advances, so it
  // fades through instead of snapping — see useFadeOnChange in ./gameMotion.
  const labelFade = useFadeOnChange(current);

  return (
    <View style={styles.progressCard}>
      <Animated.Text style={[styles.progressLabel, labelFade]}>
        <Text style={styles.progressLabelBase}>{language === 'ar' ? 'السؤال ' : 'Question '}</Text>
        <Text style={styles.progressLabelAccent}>{current}</Text>
        <Text style={styles.progressLabelBase}>{language === 'ar' ? ' من ' : ' of '}</Text>
        <Text style={styles.progressLabelAccent}>{total}</Text>
      </Animated.Text>

      <View style={styles.progressSegments}>
        {segments.map((_, index) =>
          index < current ? (
            <LinearGradient
              key={index}
              colors={[...GAME_COLOR.segmentGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.progressSegment}
            />
          ) : (
            <View key={index} style={[styles.progressSegment, styles.progressSegmentEmpty]} />
          ),
        )}
      </View>
    </View>
  );
}
