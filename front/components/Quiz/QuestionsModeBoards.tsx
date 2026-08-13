/**
 * =============================================================================
 * QUESTION MODE ANSWER SURFACES
 * =============================================================================
 *
 * The non-list answer surfaces used by QuestionsModeScreen.tsx:
 *
 *   BingoBoard              3×3 tappable grid            Figma 233:224
 *   ConstraintGridBoard     awards × clubs 3×3 board     Figma 233:249
 *   ConnectionsPlayersGrid  2×2 player photo cards       Figma 233:274
 *   ClubAnswerGrid          2×2 crest answer cards       Figma 233:299
 *   TransferPath            player → player → ?          Figma 238:324
 *   TopTenInputs            ten numbered name inputs     Figma 238:349
 *
 * All measurements are RAW FIGMA UNITS converted at render time by
 * `useDesignScale()`, and every fixed dimension is expressed as a ratio of the
 * available width, so each surface is responsive from iPhone SE to tablet
 * without overflowing or clipping.
 *
 * Colours and the header/progress chrome come from ./gameChrome.tsx — this file
 * owns only the answer surfaces.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   ALL SIZES ............... BOARD_SIZE
 *   COLOURS ................. GAME_COLOR in ./gameChrome.tsx
 *   GRID CELL LOOK .......... styles.gridCell / styles.gridCellDashed
 *   PLAYER CARD PROPORTION .. BOARD_SIZE.playerCard
 *   CLUB CARD PROPORTION .... BOARD_SIZE.clubCard
 *   TRANSFER CARD / ARROW ... BOARD_SIZE.transfer* / TransferArrow
 * =============================================================================
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, CircleDot, Flag, LandPlot, Plus, Shield, User } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { useDesignScale } from '../../utils/responsive';
import { getAppFont } from '../../utils/fontSetup';
import { useLanguageStore } from '../../src/i18n/store';
import { monogram } from '../../data/questionModes/media';
import { GAME_COLOR, GAME_LAYOUT } from './gameChrome';
import { GamePressable } from './gameMotion';

type BingoCellKind = 'club' | 'player' | 'country' | 'stadium';
type OptionCell = { id: string; label?: string; imageUrl?: string; kind?: BingoCellKind };

/**
 * Themed glyph a Football Bingo cell falls back to when its label has no
 * resolvable crest / portrait / flag (see data/questionModes/media.ts). Every
 * cell in the game always shows SOMETHING in its artwork slot — never an empty
 * box — and the glyph is built from icons already used elsewhere on this exact
 * screen (Trophy, LandPlot, MapPin, Shirt in QuestionsModeScreen.tsx's
 * evidence rows), so it reads as part of the same design system rather than a
 * bolted-on placeholder.
 */
const CATEGORY_GLYPH: Record<BingoCellKind | 'generic', typeof Shield> = {
  club: Shield,
  player: User,
  country: Flag,
  stadium: LandPlot,
  generic: CircleDot,
};

/* ═══════════════════════════════════════════════════════════════════════════
 * SIZE TOKENS — raw Figma units.
 * Ratios are used wherever Figma had a fixed pair of dimensions, so a cell
 * keeps its proportion instead of its pixel size on a narrower screen.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const BOARD_SIZE = {
  /* Football Bingo — Figma 233:224 */
  bingoGap: 8,
  bingoCellRatio: 130 / 105,
  bingoRadius: 16,
  bingoIcon: 44,

  /* Football Grid — Figma 233:249 */
  gridGap: 12,
  gridRowGap: 16,
  /** Width of the row-header column. */
  gridRowHeaderWidth: 50,
  /** Space between the row-header column and the first cell. */
  gridHeaderGap: 28,
  /** Figma cell is 103 × 105. */
  gridCellRatio: 103 / 105,
  gridRadius: 16,
  /** Inset of the dashed outline inside a cell (103→93 / 105→95). */
  gridDashInset: 5,
  gridPlusIcon: 41,
  /** Column-header crest box. Figma crests vary 46–53 × 54–62. */
  gridColLogoW: 53,
  gridColLogoH: 58,
  /** Row-header flag box. Figma 50 × 35, radius 4. */
  gridFlagW: 50,
  gridFlagH: 35,
  gridFlagRadius: 4,
  gridHeaderLabelGap: 4,

  /* Player Connections — Figma 233:274 (405 × 460 grid, 20/16 gaps) */
  playersRowGap: 16,
  /** Card is 192.5 × 222. */
  playerCardRatio: 192.5 / 222,
  playerCardRadius: 16,

  /* Guess The Club — Figma 233:299 (404 × 368 grid, 20/16 gaps) */
  clubRowGap: 16,
  /** Card is 192 × 176. */
  clubCardRatio: 192 / 176,
  clubCardRadius: 16,
  clubCardPadX: 24,
  clubCardPadY: 16,
  clubLogoW: 104,
  clubLogoH: 106,
  clubRadio: 20,

  /* Transfer Puzzle — Figma 238:324 */
  transferGap: 6,
  /** Card is ~98 × 116. */
  transferCardRatio: 98 / 116,
  transferCardRadius: 14,
  /** Width reserved for the "?" + arrow connector between two cards. */
  transferConnector: 42,

  /* Top 10 — Figma 238:349 */
  topRowHeight: 64,
  topRowRadius: 16,
  topRowGap: 12,
  topIndexCircle: 28,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLESHEET
 * ═══════════════════════════════════════════════════════════════════════════ */

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (w: 400 | 500 | 600 | 700 | 800) => getAppFont(w, language);
  const isRtl = language === 'ar';

  return StyleSheet.create({
    /* ── Shared ───────────────────────────────────────────────────────── */
    cellSelected: { borderColor: GAME_COLOR.accent },
    cellCorrect: { borderColor: GAME_COLOR.correct },
    cellWrong: { borderColor: GAME_COLOR.wrong },
    cellDisabled: { opacity: 0.76 },
    /**
     * Figma paints an inset top shadow on the photo/crest cards
     * (`inset 0 8px …`). RN has no inset shadow, so it is drawn as a short
     * gradient hugging the top edge — same read, no extra views on Android.
     */
    innerTopShadow: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },

    /** Crest-less state: the club's monogram in the same box as the crest. */
    monogramBox: { alignItems: 'center', justifyContent: 'center' },
    monogramText: {
      fontFamily: font(700),
      color: GAME_COLOR.accent,
      textAlign: 'center',
    },

    /* ── FOOTBALL BINGO — Figma 233:224 ───────────────────────────────── */
    bingoWrap: { gap: s(BOARD_SIZE.bingoGap) },
    bingoRow: { flexDirection: 'row', gap: s(BOARD_SIZE.bingoGap) },
    bingoCellOuter: { flex: 1, aspectRatio: BOARD_SIZE.bingoCellRatio },
    bingoCell: {
      flex: 1,
      borderRadius: s(BOARD_SIZE.bingoRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(8),
      paddingVertical: s(10),
      gap: s(6),
      overflow: 'hidden',
    },
    bingoIcon: { width: s(BOARD_SIZE.bingoIcon), height: s(BOARD_SIZE.bingoIcon) },
    /**
     * Backdrop for the themed fallback glyph — same bordered-tile treatment
     * used everywhere else in this file (evidence icons, letter badges), sized
     * to the same box a real crest/portrait would occupy.
     */
    bingoIconGlyph: {
      width: s(BOARD_SIZE.bingoIcon),
      height: s(BOARD_SIZE.bingoIcon),
      borderRadius: s(BOARD_SIZE.bingoIcon) / 2,
      borderWidth: 1,
      borderColor: GAME_COLOR.accent,
      backgroundColor: GAME_COLOR.tileSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /**
     * PLAYER PORTRAIT in a bingo cell.
     *
     * Club crests arrive as transparent PNGs and drop straight onto the cell,
     * but player portraits are square headshots on an OPAQUE WHITE background
     * — at this size they read as small white stickers on the dark board.
     * Cropping them into the same circle the fallback glyph uses removes the
     * square edge, and a purple wash pulls what is left into the brand ramp,
     * so a cell with a photo and a cell with a glyph share one silhouette.
     */
    bingoAvatar: {
      width: s(BOARD_SIZE.bingoIcon),
      height: s(BOARD_SIZE.bingoIcon),
      borderRadius: s(BOARD_SIZE.bingoIcon) / 2,
      borderWidth: 1,
      borderColor: GAME_COLOR.accent,
      backgroundColor: GAME_COLOR.tileSurface,
      overflow: 'hidden',
    },
    bingoAvatarImage: { width: '100%', height: '100%' },
    bingoAvatarTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(76,4,144,0.30)' },
    bingoCellText: {
      fontFamily: font(500),
      fontSize: f(11),
      lineHeight: f(15),
      color: GAME_COLOR.textMuted,
      textAlign: 'center',
    },

    /* ── FOOTBALL GRID — Figma 233:249 ────────────────────────────────── */
    gridWrap: { gap: s(BOARD_SIZE.gridRowGap) },
    /** Column headers sit above the cells, offset by the row-header column. */
    gridColHeaderRow: {
      flexDirection: 'row',
      gap: s(BOARD_SIZE.gridGap),
      // Figma leaves 27 between the headers and the first row; `gridWrap`
      // already contributes `gridRowGap`, so only the remainder is added here.
      marginBottom: s(11),
    },
    gridColHeaderCell: {
      flex: 1,
      alignItems: 'center',
      gap: s(BOARD_SIZE.gridHeaderLabelGap),
    },
    gridColLogo: { width: s(BOARD_SIZE.gridColLogoW), height: s(BOARD_SIZE.gridColLogoH) },
    gridRow: { flexDirection: 'row', alignItems: 'center', gap: s(BOARD_SIZE.gridHeaderGap) },
    gridRowHeader: {
      width: s(BOARD_SIZE.gridRowHeaderWidth),
      alignItems: 'center',
      gap: s(BOARD_SIZE.gridHeaderLabelGap),
    },
    gridFlag: {
      width: s(BOARD_SIZE.gridFlagW),
      height: s(BOARD_SIZE.gridFlagH),
      borderRadius: s(BOARD_SIZE.gridFlagRadius),
      overflow: 'hidden',
    },
    gridHeaderLabel: {
      fontFamily: font(500),
      fontSize: f(17),
      lineHeight: f(22),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    /**
     * A grid header is laid out as a ROW OF WORDS, not one wrapping string —
     * see `GridAxisLabel`. "Real Madrid" sits on one line when the column is
     * wide enough and stacks into two when it isn't, and because each word is
     * its own single-line Text, the layout engine is never allowed to break one
     * apart ("MAN / CHESTER").
     */
    gridHeaderWords: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
    /**
     * `flexShrink` lets a word give up space rather than push past the cell,
     * and `maxWidth` caps it at the cell itself — combined with numberOfLines=1
     * that makes overflow impossible without ever splitting the word.
     */
    gridHeaderWord: { flexShrink: 1, maxWidth: '100%', textAlign: 'center' },
    /**
     * Header with no artwork: the label takes over the artwork box's space so
     * the axis stays aligned with the headers that do have one.
     */
    gridHeaderTextOnly: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(2),
    },
    gridCells: { flex: 1, flexDirection: 'row', gap: s(BOARD_SIZE.gridGap) },
    gridCellOuter: { flex: 1, aspectRatio: BOARD_SIZE.gridCellRatio },
    gridCell: {
      flex: 1,
      borderRadius: s(BOARD_SIZE.gridRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.gridCellBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /**
     * A cell the server accepted a player into. Green ring + wash, the same
     * "correct" colour every other mode reveals with, and it never reverts.
     */
    gridCellFilled: {
      borderColor: GAME_COLOR.correct,
      backgroundColor: 'rgba(34,197,94,0.12)',
    },
    gridPlacement: { alignItems: 'center', justifyContent: 'center', gap: s(4), paddingHorizontal: s(4) },
    gridPlacementImage: {
      width: s(34),
      height: s(34),
      borderRadius: s(17),
      borderWidth: 1,
      borderColor: GAME_COLOR.correct,
    },
    gridPlacementText: {
      fontFamily: font(600),
      fontSize: f(9),
      lineHeight: f(11),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    /** The dashed outline drawn inside an empty cell — Figma node 289:373. */
    gridCellDashed: {
      position: 'absolute',
      top: s(BOARD_SIZE.gridDashInset),
      left: s(BOARD_SIZE.gridDashInset),
      right: s(BOARD_SIZE.gridDashInset),
      bottom: s(BOARD_SIZE.gridDashInset),
      borderRadius: s(BOARD_SIZE.gridRadius),
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: GAME_COLOR.gridCellDashed,
    },

    /* ── PLAYER CONNECTIONS — Figma 233:274 ───────────────────────────── */
    /**
     * Two columns whose gap is a share of the container rather than a fixed
     * width, so the pair always fills the content column exactly on any device.
     * Figma: 192.5 card in a 405 grid ⇒ 47.5%, leaving a 5% (20pt) gutter.
     */
    playersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: s(BOARD_SIZE.playersRowGap),
    },
    playerCardOuter: { width: '47.5%', aspectRatio: BOARD_SIZE.playerCardRatio },
    playerCard: {
      flex: 1,
      borderRadius: s(BOARD_SIZE.playerCardRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    /**
     * The portrait fills the card and is shown CLEAN — no tint, no wash, no
     * gradient and no shadow layer on top of it. The purple duotone that used
     * to sit here (a flat `rgba(76,4,144,0.38)` fill plus a bottom gradient)
     * was hiding the actual photo, so both are gone: what the card shows is the
     * player's real image.
     */
    playerPhoto: { ...StyleSheet.absoluteFillObject },
    /** Shown when a player has no portrait URL. */
    playerNameBox: { paddingHorizontal: s(10), paddingVertical: s(12), width: '100%' },
    playerName: {
      fontFamily: font(600),
      fontSize: f(15),
      lineHeight: f(20),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },

    /* ── GUESS THE CLUB ANSWERS — Figma 233:299 ───────────────────────── */
    /** Same two-column rule as the player grid: 192 card in a 404 grid ⇒ 47.5%. */
    clubGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: s(BOARD_SIZE.clubRowGap),
    },
    clubCardOuter: { width: '47.5%', aspectRatio: BOARD_SIZE.clubCardRatio },
    clubCard: {
      flex: 1,
      borderRadius: s(BOARD_SIZE.clubCardRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(BOARD_SIZE.clubCardPadX),
      paddingVertical: s(BOARD_SIZE.clubCardPadY),
      gap: s(12),
      overflow: 'hidden',
    },
    /**
     * Crest box — Figma 104 × 106, `contain`-fitted so a tall shield and a wide
     * roundel both keep their own aspect ratio and neither is stretched.
     *
     * `flex: 1` + `maxHeight` rather than a fixed height: the crest takes the
     * height the name doesn't need, capped at the Figma size. On a small phone
     * (or when a long club name wraps to two lines) it shrinks instead of
     * overflowing the card, which `overflow: hidden` would otherwise clip.
     */
    clubLogo: {
      flex: 1,
      width: s(BOARD_SIZE.clubLogoW),
      maxWidth: '100%',
      maxHeight: s(BOARD_SIZE.clubLogoH),
    },
    clubName: {
      fontFamily: font(500),
      fontSize: f(19),
      lineHeight: f(24),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    /** Figma node 246:608 — 20pt ring, 14 from the trailing edge, 11 from top. */
    clubRadio: {
      position: 'absolute',
      top: s(11),
      [isRtl ? 'left' : 'right']: s(14),
      width: s(BOARD_SIZE.clubRadio),
      height: s(BOARD_SIZE.clubRadio),
      borderRadius: s(BOARD_SIZE.clubRadio) / 2,
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /**
     * "Ask the crowd" percentage — mirrors `clubRadio` on the OPPOSITE corner
     * and is absolutely positioned like it, so it never competes with the
     * card's fixed aspect ratio for flow height (there is no spare vertical
     * budget to grow into here, unlike the answer-row list).
     */
    clubStatBadge: {
      position: 'absolute',
      top: s(11),
      [isRtl ? 'right' : 'left']: s(14),
      paddingHorizontal: s(8),
      paddingVertical: s(3),
      borderRadius: s(10),
      backgroundColor: 'rgba(168,85,247,0.16)',
      borderWidth: 1,
      borderColor: GAME_COLOR.accent,
    },
    clubStatBadgeText: {
      fontFamily: font(700),
      fontSize: f(11),
      lineHeight: f(14),
      color: GAME_COLOR.accent,
    },
    clubRadioFill: {
      width: s(10),
      height: s(10),
      borderRadius: s(5),
      backgroundColor: GAME_COLOR.accent,
    },

    /* ── TRANSFER PATH — Figma 238:324 ────────────────────────────────── */
    transferRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    transferCardOuter: { flex: 1, aspectRatio: BOARD_SIZE.transferCardRatio },
    transferCard: {
      flex: 1,
      borderRadius: s(BOARD_SIZE.transferCardRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    /** Crest inset inside the tile so it is never cropped by the rounded corners. */
    transferCrest: { width: '72%', height: '72%' },
    /** The final tile the player is solving for — purple ring + bloom. */
    transferUnknownCard: {
      borderColor: GAME_COLOR.accent,
      shadowColor: GAME_COLOR.accent,
      shadowOpacity: 0.55,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: s(10),
      elevation: 8,
    },
    transferLabelBox: { paddingHorizontal: s(6), paddingVertical: s(8) },
    transferLabel: {
      fontFamily: font(600),
      fontSize: f(13),
      lineHeight: f(17),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    transferUnknownGlyph: {
      fontFamily: font(800),
      fontSize: f(34),
      lineHeight: f(40),
      color: GAME_COLOR.accent,
      textAlign: 'center',
    },
    /** "?" stacked above the arrow, exactly as Figma draws the connector. */
    transferConnector: {
      width: s(BOARD_SIZE.transferConnector),
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(4),
    },
    transferConnectorMark: {
      fontFamily: font(600),
      fontSize: f(16),
      lineHeight: f(20),
      color: GAME_COLOR.accent,
      textAlign: 'center',
    },

    /* ── TOP 10 — Figma 238:349 ───────────────────────────────────────── */
    topList: { gap: s(BOARD_SIZE.topRowGap), width: '100%' },
    topRow: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: s(BOARD_SIZE.topRowRadius),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      paddingHorizontal: s(16),
      minHeight: s(BOARD_SIZE.topRowHeight),
      gap: s(12),
    },
    topIndexCircle: {
      width: s(BOARD_SIZE.topIndexCircle),
      height: s(BOARD_SIZE.topIndexCircle),
      borderRadius: s(BOARD_SIZE.topIndexCircle) / 2,
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      backgroundColor: GAME_COLOR.tileSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topIndexText: { fontFamily: font(700), fontSize: f(13), color: GAME_COLOR.accent },
    topRowText: {
      flex: 1,
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(21),
      color: GAME_COLOR.textPrimary,
      textAlign: isRtl ? 'right' : 'left',
    },
    /**
     * The typed name. Same type ramp and alignment as `topRowText`, so a row
     * being filled in and a row showing its answer read as the same row —
     * only the caret differs.
     */
    topInput: {
      flex: 1,
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(21),
      color: GAME_COLOR.textPrimary,
      textAlign: isRtl ? 'right' : 'left',
      paddingVertical: s(8),
    },
    pickDot: {
      width: s(20),
      height: s(20),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickDotActive: { backgroundColor: GAME_COLOR.accent, borderColor: GAME_COLOR.accent },
  });
}

type BoardStyles = ReturnType<typeof createStyles>;
const styleCache = new Map<string, BoardStyles>();

function useBoardStyles() {
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
 * SHARED PIECES
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Surface fill shared by every card, row and cell. */
function Surface({ style, children }: { style?: object | object[]; children?: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[...GAME_COLOR.rowGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={style as never}
    >
      {children}
    </LinearGradient>
  );
}

/** Figma's `inset 0 8px …` top shadow, drawn as a gradient. */
function InnerTopShadow({ color }: { color: string }) {
  const { styles } = useBoardStyles();
  return (
    <LinearGradient
      colors={[color, 'rgba(0,0,0,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.innerTopShadow}
      pointerEvents="none"
    />
  );
}

/**
 * A crest / flag box. Renders the artwork when there is one and the club's
 * monogram when there isn't — never a stock placeholder, and never a blank box.
 * `contain` keeps every crest's real aspect ratio, so nothing is stretched.
 */
export function CrestSlot({
  url,
  label,
  style,
  fontSize,
}: {
  url?: string;
  label?: string;
  style: object | object[];
  /** Monogram size, in device units. Defaults to a third of the box height. */
  fontSize?: number;
}) {
  const { styles } = useBoardStyles();

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={style as never}
        contentFit="contain"
        transition={140}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View style={[style, styles.monogramBox]}>
      <Text style={[styles.monogramText, fontSize ? { fontSize } : null]} numberOfLines={1}>
        {monogram(label ?? '')}
      </Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FOOTBALL GRID — AXIS LABELS THAT NEVER SPLIT A WORD
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Average glyph advance as a fraction of the font size, used to predict how
 * wide a word will render. 0.62 is a deliberate OVER-estimate for the app's
 * sans faces (real mixed-case Latin averages ≈0.5, Arabic less): erring wide
 * means the size we pick always fits, and never that a word is nudged past its
 * cell on a device whose font metrics differ slightly.
 */
const GLYPH_WIDTH_RATIO = 0.62;

/** Never shrink an axis label below this, however long the word is. */
const MIN_AXIS_FONT_SIZE = 9;

/** Longest single word in a label, in characters. */
function longestWordLength(label: string): number {
  return label
    .trim()
    .split(/\s+/)
    .reduce((widest, word) => Math.max(widest, word.length), 0);
}

/** Width one word of `chars` characters needs at `fontSize`, in device units. */
function estimateWordWidth(chars: number, fontSize: number): number {
  return Math.ceil(chars * GLYPH_WIDTH_RATIO * fontSize);
}

/**
 * The largest font size at which the LONGEST word still fits `maxWidth` on one
 * line, capped at the design size. Pure function of the available width, so it
 * responds to screen size, orientation and label length — no fixed widths and
 * no per-device special cases.
 */
function fitAxisFontSize(words: string[], maxWidth: number, designFontSize: number): number {
  const longest = words.reduce((widest, word) => Math.max(widest, word.length), 0);
  if (longest === 0 || maxWidth <= 0) return designFontSize;
  const fitted = Math.floor(maxWidth / (longest * GLYPH_WIDTH_RATIO));
  return Math.max(MIN_AXIS_FONT_SIZE, Math.min(designFontSize, fitted));
}

/**
 * A Football Grid axis label — "Real Madrid", "Champions League", "Brazil".
 *
 * THE RULE THIS EXISTS TO ENFORCE: a word is never broken across lines.
 *
 * React Native's `Text` breaks INSIDE a word as soon as the word is wider than
 * its box, which is what produced "MAN / CHESTER" in the 50pt row-header column
 * and in the narrow column headers on small phones. Wrapping, shrinking or
 * clipping the string as a whole cannot fix that — the break happens below the
 * level a single Text gives you any control over.
 *
 * So the label is split into words and each word becomes its own single-line
 * Text inside a wrapping row:
 *
 *   • `numberOfLines={1}` per word  → a word CANNOT be split, ever.
 *   • wrapping row                  → two words sit side by side when they fit
 *                                     and stack when they don't.
 *   • font size fitted to the widest word (see `fitAxisFontSize`)
 *                                   → a long word shrinks to fit its cell
 *                                     instead of being cut, at any screen size.
 *   • `flexShrink` + `maxWidth: 100%`
 *                                   → nothing can spill outside the cell.
 */
function GridAxisLabel({ label, maxWidth }: { label: string; maxWidth: number }) {
  const { styles, metrics } = useBoardStyles();

  const words = useMemo(() => label.trim().split(/\s+/).filter(Boolean), [label]);
  const fontSize = useMemo(
    () => fitAxisFontSize(words, maxWidth, metrics.f(17)),
    [words, maxWidth, metrics],
  );

  if (words.length === 0) return null;

  return (
    <View style={[styles.gridHeaderWords, { columnGap: Math.round(fontSize * 0.28) }]}>
      {words.map((word, index) => (
        <Text
          key={`${word}-${index}`}
          style={[
            styles.gridHeaderLabel,
            styles.gridHeaderWord,
            { fontSize, lineHeight: Math.round(fontSize * 1.3) },
          ]}
          numberOfLines={1}
          // Belt and braces on top of the computed size: if a device's real
          // font metrics are wider than the estimate, the word shrinks a touch
          // further rather than being clipped. It still cannot wrap.
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {word}
        </Text>
      ))}
    </View>
  );
}

/**
 * One Football Grid axis header — a club crest above its name, or a country
 * flag above its name (Figma 233:249).
 *
 * IMAGE → TEXT. Roughly half the grid's axes are not things that HAVE artwork:
 * a column can be "Premier League", "No. 10", "1990s" or "Ballon d'Or" just as
 * easily as it can be a club. Those get the header text rendered in place of
 * the artwork instead of an empty box (or a cryptic "PL" monogram sitting above
 * the words "Premier League", which is what it used to do).
 *
 * The text-only variant reserves the SAME total height as the image variant,
 * so a grid mixing both kinds keeps its columns and rows aligned exactly as
 * Figma draws them, at every screen size.
 */
function GridHeaderSlot({
  label,
  url,
  imageStyle,
  slotHeight,
  slotWidth,
}: {
  label: string;
  url?: string;
  imageStyle: object;
  /** Height of the artwork box, so the text-only variant can match it. */
  slotHeight: number;
  /** Width the label has to live inside, in device units. */
  slotWidth: number;
}) {
  const { styles } = useBoardStyles();

  if (url) {
    return (
      <>
        <Image
          source={{ uri: url }}
          style={imageStyle as never}
          contentFit="contain"
          transition={140}
          cachePolicy="memory-disk"
        />
        <GridAxisLabel label={label} maxWidth={slotWidth} />
      </>
    );
  }

  return (
    <View style={[styles.gridHeaderTextOnly, { minHeight: slotHeight }]}>
      {/*
        The row-header column is only 50pt wide, and a text-only axis can hold
        a long unbreakable word ("Goalkeeper", "Libertadores"). `GridAxisLabel`
        fits it to the column instead of letting it split or spill.
      */}
      <GridAxisLabel label={label} maxWidth={slotWidth} />
    </View>
  );
}

/** Purple chevron used between two transfer cards — Figma 238:324. */
function TransferArrow({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h15M13 6l6 6-6 6"
        stroke={GAME_COLOR.accent}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * BOARDS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One Football Bingo cell. Split out from `BingoBoard` so it can track its own
 * image-load failure — a crest URL that 404s (or times out offline) falls back
 * to the same themed glyph an unresolved name uses, rather than showing a torn
 * image icon or an empty box.
 */
function BingoCell({
  cell,
  isOn,
  disabled,
  onPress,
}: {
  cell: OptionCell;
  isOn: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { styles, metrics } = useBoardStyles();
  const [imageFailed, setImageFailed] = React.useState(false);
  const hasImage = Boolean(cell.imageUrl) && !imageFailed;
  const Glyph = CATEGORY_GLYPH[cell.kind ?? 'generic'];
  /** Portraits need the circular avatar treatment; crests and flags do not. */
  const isPortrait = cell.kind === 'player';

  return (
    <GamePressable
      onPress={onPress}
      disabled={disabled}
      style={styles.bingoCellOuter}
      accessibilityRole="button"
      accessibilityState={{ selected: isOn, disabled }}
      accessibilityLabel={cell.label}
    >
      <Surface
        style={[styles.bingoCell, isOn && styles.cellSelected, disabled && styles.cellDisabled]}
      >
        {!hasImage ? (
          // No real artwork resolved (or it failed to load) — a themed glyph
          // fills the same slot so the cell is never a bare caption.
          <View style={styles.bingoIconGlyph}>
            <Glyph size={metrics.s(22)} color={GAME_COLOR.accent} strokeWidth={1.75} />
          </View>
        ) : isPortrait ? (
          // Headshot: cropped into the glyph's circle and washed purple.
          <View style={styles.bingoAvatar}>
            <Image
              source={{ uri: cell.imageUrl }}
              style={styles.bingoAvatarImage}
              contentFit="cover"
              contentPosition="top center"
              transition={140}
              cachePolicy="memory-disk"
              onError={() => setImageFailed(true)}
            />
            <View style={styles.bingoAvatarTint} pointerEvents="none" />
          </View>
        ) : (
          // Crest / flag: transparent artwork, shown whole so it is never cropped.
          <Image
            source={{ uri: cell.imageUrl }}
            style={styles.bingoIcon}
            contentFit="contain"
            transition={140}
            cachePolicy="memory-disk"
            onError={() => setImageFailed(true)}
          />
        )}
        <Text style={styles.bingoCellText} numberOfLines={3}>
          {cell.label}
        </Text>
      </Surface>
    </GamePressable>
  );
}

export function BingoBoard({
  board,
  selected,
  onToggle,
  disabled = false,
}: {
  board: OptionCell[][];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const { styles } = useBoardStyles();

  return (
    <View style={styles.bingoWrap}>
      {board.map((row, rowIdx) => (
        <View key={`br-${rowIdx}`} style={styles.bingoRow}>
          {row.map((cell) => (
            <BingoCell
              key={cell.id}
              cell={cell}
              isOn={selected.includes(cell.id)}
              disabled={disabled}
              onPress={() => onToggle(cell.id)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * FOOTBALL GRID — the 3×3 board, drawn once and filled a cell at a time.
 *
 * Columns are AWARDS, rows are CLUBS / NATIONAL TEAMS, and a cell is filled by
 * a player who satisfies both. The board is not tappable: the round walks the
 * cells, the highlighted one is the cell being answered now, and a cell only
 * shows a player once the SERVER accepted that placement (`placements`) —
 * a refused placement leaves the cell empty and flashes `rejectedCell`.
 */
export function ConstraintGridBoard({
  rowHeaders,
  colHeaders,
  rowImages,
  colImages,
  placements,
  activeCell,
  rejectedCell,
}: {
  rowHeaders: string[];
  colHeaders: string[];
  /** Crest per row header (club / national team), resolved by the caller. */
  rowImages?: (string | undefined)[];
  /** Artwork per award column, when the provider has one. */
  colImages?: (string | undefined)[];
  /** `r{row}-c{col}` → the player fixed there by a correct placement. */
  placements: Record<string, { label: string; imageUrl?: string }>;
  /** The cell the current question is asking for. */
  activeCell?: { row: number; column: number };
  /** The cell whose last placement the server refused. */
  rejectedCell?: string | null;
}) {
  const { styles, metrics } = useBoardStyles();

  // The column headers must line up with the cell columns, so they carry the
  // same leading offset as the row-header column plus its gap.
  const rowHeaderWidth = metrics.s(BOARD_SIZE.gridRowHeaderWidth);
  const headerOffset = rowHeaderWidth + metrics.s(BOARD_SIZE.gridHeaderGap);

  /**
   * Real width of the board, so axis labels can be sized to the space they
   * actually have. Measured rather than assumed; until the first layout lands
   * it falls back to the screen's content column (window − the 22pt gutters),
   * which is the width this board is always given.
   */
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const handleWrapLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  }, []);
  const boardWidth = measuredWidth || metrics.width - metrics.s(GAME_LAYOUT.gutter) * 2;

  /** Width of ONE column-header cell — what a club name has to fit inside. */
  const colSlotWidth = Math.max(
    0,
    (boardWidth - headerOffset - metrics.s(BOARD_SIZE.gridGap) * Math.max(colHeaders.length - 1, 0)) /
      Math.max(colHeaders.length, 1),
  );

  /*
   * ROW-HEADER COLUMN WIDTH.
   *
   * Figma's 50pt column is not wide enough for the words the grid actually
   * carries — "Brazil" at the design's 17pt needs about 60 — which is what
   * used to force a mid-word break. So the column takes as much of the 28pt
   * gap that follows it as its longest word needs, uniformly for the WHOLE
   * board (never per row, or the cells would stop lining up).
   *
   * `headerOffset` is unchanged, so the cells and the column headers stay
   * exactly where the design puts them: only the split between the header
   * column and the gap moves, and at least 8pt of gap always remains.
   */
  const widestRowWord = rowHeaders.reduce(
    (widest, header) => Math.max(widest, longestWordLength(header)),
    0,
  );
  const rowHeaderColumnWidth = Math.min(
    Math.max(rowHeaderWidth, estimateWordWidth(widestRowWord, metrics.f(17)) + metrics.s(4)),
    Math.max(headerOffset - metrics.s(8), rowHeaderWidth),
  );
  const rowHeaderToCellsGap = headerOffset - rowHeaderColumnWidth;
  /** What a row label has to fit inside, less the slot's own padding. */
  const rowSlotWidth = Math.max(0, rowHeaderColumnWidth - metrics.s(4));

  return (
    <View style={styles.gridWrap} onLayout={handleWrapLayout}>
      <View style={[styles.gridColHeaderRow, { marginLeft: headerOffset }]}>
        {colHeaders.map((header, colIdx) => (
          <View key={`ch-${header}-${colIdx}`} style={styles.gridColHeaderCell}>
            <GridHeaderSlot
              label={header}
              url={colImages?.[colIdx]}
              imageStyle={styles.gridColLogo}
              slotHeight={metrics.s(BOARD_SIZE.gridColLogoH)}
              slotWidth={colSlotWidth}
            />
          </View>
        ))}
      </View>

      {rowHeaders.map((row, rowIdx) => (
        <View key={`gr-${row}-${rowIdx}`} style={[styles.gridRow, { gap: rowHeaderToCellsGap }]}>
          <View style={[styles.gridRowHeader, { width: rowHeaderColumnWidth }]}>
            <GridHeaderSlot
              label={row}
              url={rowImages?.[rowIdx]}
              imageStyle={styles.gridFlag}
              slotHeight={metrics.s(BOARD_SIZE.gridFlagH)}
              slotWidth={rowSlotWidth}
            />
          </View>

          <View style={styles.gridCells}>
            {colHeaders.map((col, colIdx) => {
              const id = `r${rowIdx}-c${colIdx}`;
              const placed = placements[id];
              const isActive = activeCell?.row === rowIdx && activeCell?.column === colIdx;
              const isRejected = rejectedCell === id;

              return (
                <View
                  key={id}
                  style={styles.gridCellOuter}
                  accessibilityRole="image"
                  accessibilityLabel={
                    placed ? `${row} · ${col}: ${placed.label}` : `${row} · ${col}`
                  }
                >
                  <Surface
                    style={[
                      styles.gridCell,
                      // Filled = accepted by the server, and it stays.
                      placed && styles.gridCellFilled,
                      isActive && !placed && styles.cellSelected,
                      isRejected && !placed && styles.cellWrong,
                    ]}
                  >
                    {placed ? (
                      <View style={styles.gridPlacement}>
                        {placed.imageUrl ? (
                          <Image
                            source={{ uri: placed.imageUrl }}
                            style={styles.gridPlacementImage}
                            contentFit="cover"
                            contentPosition="top center"
                            transition={140}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <User size={metrics.s(22)} color={GAME_COLOR.correct} strokeWidth={1.8} />
                        )}
                        <Text style={styles.gridPlacementText} numberOfLines={2}>
                          {placed.label}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.gridCellDashed} pointerEvents="none" />
                        <Plus
                          size={metrics.s(BOARD_SIZE.gridPlusIcon)}
                          color={isActive ? GAME_COLOR.accent : GAME_COLOR.textMuted}
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </Surface>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 2×2 grid of player photo cards — Figma 233:274.
 *
 * THE PORTRAIT IS SHOWN CLEAN. Nothing is painted over it: no purple duotone
 * wash, no bottom gradient, no inset top shadow. Those layers used to sit on
 * top of every photo and tinted the player's real colours; the card now shows
 * the image exactly as it is served.
 *
 * The card's own surface (border + gradient fill) is still there — it is what
 * a player WITHOUT a portrait falls back to, behind their name, so the four
 * tiles keep one silhouette either way.
 */
export function ConnectionsPlayersGrid({
  players,
}: {
  players: { id: string; name: string; imageUrl?: string }[];
}) {
  const { styles } = useBoardStyles();

  return (
    <View style={styles.playersGrid}>
      {players.map((player) => {
        const hasPhoto = Boolean(player.imageUrl && player.imageUrl.trim().length > 0);
        return (
          <View key={player.id} style={styles.playerCardOuter}>
            <Surface style={styles.playerCard}>
              {hasPhoto ? (
                <Image
                  source={{ uri: player.imageUrl }}
                  style={styles.playerPhoto}
                  contentFit="cover"
                  // Headshots are framed tight to the top of the head, so
                  // anchoring top guarantees the face is never cropped.
                  contentPosition="top center"
                  transition={160}
                  cachePolicy="memory-disk"
                  accessibilityLabel={player.name}
                />
              ) : (
                <>
                  <View style={styles.playerNameBox}>
                    <Text style={styles.playerName} numberOfLines={3}>
                      {player.name}
                    </Text>
                  </View>
                  <InnerTopShadow color="#120335" />
                </>
              )}
            </Surface>
          </View>
        );
      })}
    </View>
  );
}

/**
 * 2×2 grid of crest answer cards — Figma 233:299 (Guess The Club).
 *
 * Each card is a crest over the club name with a selection ring in the trailing
 * top corner. The crest is `contain`-fitted inside a fixed box so crests of
 * different proportions (tall shields, wide roundels) are never stretched.
 */
export function ClubAnswerGrid({
  options,
  selected,
  revealed,
  correctIds,
  onToggle,
  statPercentById,
}: {
  options: { id: string; label: string; imageUrl?: string }[];
  selected: string[];
  revealed: boolean;
  correctIds: string[];
  onToggle: (id: string) => void;
  /** "Ask the crowd" result, keyed by option id. Omit to show nothing. */
  statPercentById?: Record<string, number>;
}) {
  const { styles, metrics } = useBoardStyles();

  return (
    <View style={styles.clubGrid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isCorrect = revealed && correctIds.includes(option.id);
        const isWrong = revealed && isSelected && !isCorrect;

        return (
          <GamePressable
            key={option.id}
            style={styles.clubCardOuter}
            onPress={() => onToggle(option.id)}
            disabled={revealed}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: revealed }}
            accessibilityLabel={option.label}
          >
            <Surface
              style={[
                styles.clubCard,
                isSelected && !revealed && styles.cellSelected,
                isCorrect && styles.cellCorrect,
                isWrong && styles.cellWrong,
              ]}
            >
              {/* Painted first so the crest and the selection ring stay crisp. */}
              <InnerTopShadow color="#210561" />

              {typeof statPercentById?.[option.id] === 'number' ? (
                <View style={styles.clubStatBadge} pointerEvents="none">
                  <Text style={styles.clubStatBadgeText}>{statPercentById[option.id]}%</Text>
                </View>
              ) : null}

              <CrestSlot
                url={option.imageUrl}
                label={option.label}
                style={styles.clubLogo}
                fontSize={metrics.f(34)}
              />
              <Text style={styles.clubName} numberOfLines={2}>
                {option.label}
              </Text>

              <View
                style={[
                  styles.clubRadio,
                  isSelected && !revealed && styles.cellSelected,
                  isCorrect && styles.cellCorrect,
                  isWrong && styles.cellWrong,
                ]}
              >
                {isSelected ? (
                  revealed && !isCorrect ? (
                    <Text style={[styles.monogramText, { fontSize: metrics.f(13), color: GAME_COLOR.wrong }]}>
                      ×
                    </Text>
                  ) : (
                    <View
                      style={[
                        styles.clubRadioFill,
                        isCorrect ? { backgroundColor: GAME_COLOR.correct } : null,
                      ]}
                    />
                  )
                ) : null}
              </View>
            </Surface>
          </GamePressable>
        );
      })}
    </View>
  );
}

/**
 * The transfer path — Figma 238:324.
 *
 * Figma flattens this strip into a single exported bitmap, so it cannot be
 * lifted verbatim: the tiles have to be real views to show the actual clubs and
 * players of the current question. This rebuilds the same composition — equal
 * tiles separated by a "?" over a purple arrow, with the unsolved tile carrying
 * a purple ring and bloom — from live data.
 *
 * The chain always reads LEFT→RIGHT with right-pointing arrows, in both
 * languages — that is how Figma draws it on the Arabic artboard too, because a
 * transfer timeline is chronological rather than textual.
 */
export function TransferPath({
  chain,
}: {
  chain: { id: string; label: string; imageUrl?: string; unknown?: boolean }[];
}) {
  const { styles, metrics } = useBoardStyles();
  const steps = chain;

  return (
    <View style={styles.transferRow}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.transferCardOuter}>
            <Surface
              style={[styles.transferCard, step.unknown && styles.transferUnknownCard]}
            >
              {step.unknown ? (
                <Text style={styles.transferUnknownGlyph}>?</Text>
              ) : step.imageUrl ? (
                <Image
                  source={{ uri: step.imageUrl }}
                  style={styles.transferCrest}
                  contentFit="contain"
                  transition={160}
                  cachePolicy="memory-disk"
                  accessibilityLabel={step.label}
                />
              ) : (
                <View style={styles.transferLabelBox}>
                  <Text style={styles.transferLabel} numberOfLines={3}>
                    {step.label}
                  </Text>
                </View>
              )}
            </Surface>
          </View>

          {index < steps.length - 1 ? (
            <View style={styles.transferConnector}>
              <Text style={styles.transferConnectorMark}>?</Text>
              <TransferArrow size={metrics.s(22)} />
            </View>
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * TOP 10 — ten numbered text inputs, one per rank.
 *
 * The player types names; nothing on the device knows the answer. After the
 * list is submitted the server says which slots it matched (`results`) and
 * what the real names were (`reveal`), and each row shows that.
 */
export function TopTenInputs({
  slots,
  entries,
  onChangeEntry,
  results,
  reveal,
  disabled = false,
  placeholder,
}: {
  slots: number;
  entries: string[];
  onChangeEntry: (index: number, value: string) => void;
  /** Per slot, whether the server matched it. Empty before grading. */
  results?: boolean[];
  /** The real names, sent only with the graded result. */
  reveal?: Array<{ rank: number; canonical: string; imageUrl?: string; value?: number }>;
  disabled?: boolean;
  placeholder: string;
}) {
  const { styles, metrics } = useBoardStyles();
  const graded = Array.isArray(results) && results.length > 0;

  return (
    <View style={styles.topList}>
      {Array.from({ length: slots }, (_, index) => {
        const isHit = graded ? results![index] === true : undefined;
        const realName = reveal?.find((slot) => slot.rank === index + 1)?.canonical;

        return (
          <Surface
            key={`top-${index}`}
            style={[
              styles.topRow,
              isHit === true && styles.cellCorrect,
              isHit === false && styles.cellWrong,
            ]}
          >
            <View style={styles.topIndexCircle}>
              <Text style={styles.topIndexText}>{index + 1}</Text>
            </View>

            {graded ? (
              <Text style={styles.topRowText} numberOfLines={2}>
                {realName ?? entries[index] ?? ''}
              </Text>
            ) : (
              <TextInput
                style={styles.topInput}
                value={entries[index] ?? ''}
                onChangeText={(value) => onChangeEntry(index, value)}
                editable={!disabled}
                placeholder={placeholder}
                placeholderTextColor={GAME_COLOR.textMuted}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel={`${index + 1}`}
              />
            )}

            {graded ? (
              <View style={[styles.pickDot, isHit === true && styles.pickDotActive]}>
                {isHit === true ? (
                  <Check size={metrics.s(12)} color={GAME_COLOR.textPrimary} strokeWidth={3} />
                ) : null}
              </View>
            ) : null}
          </Surface>
        );
      })}
    </View>
  );
}
