import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import {
  buildFormationColumns,
  distinctGridLines,
  groupPlayersByGridLine,
  hasAbsoluteFieldData,
  resolveFormationLabel,
} from '../../utils/lineupGrid';
import { shortPlayerName } from '../../utils/lineupMatchState';
import { LINEUP_ART, LINEUP_ICON } from './lineupAssets';
import { LineupRatingBadge } from './LineupRatingBadge';

/** Figma artboard width — every number below is in artboard units, scaled to the screen. */
const DESIGN_W = 448;
const MAX_CANVAS_W = 520;
/** Artboard y where the lineup section starts; Figma `top` values are offset by this. */
const ORIGIN_Y = 383;
/** The bench card starts here, overlapping the faded end of the pitch. */
const SECTION_BOTTOM_Y = 996;
const SECTION_BG = '#030303';

const CARD_W = 97;
const CARD_H = 71;
const AVATAR = 55;
const AVATAR_RISE = 31;
const CARD_GAP = 8;
/** Card plus the avatar that sticks out above it. */
const CARD_STACK = 104;
const PLAYERS_SPAN = 432;
const PITCH_CENTER_X = 224;
const KEEPER_TOP = 889;
/** Absolute depth (0–100) gap that starts a new row. */
const DEPTH_ROW_GAP = 8;

interface Player {
  id?: number;
  name: string;
  number: number;
  photo?: string;
  pos: string;
  grid?: string;
  fieldLine?: number | null;
  fieldSide?: number | null;
  rating?: number | null;
  goals?: number;
  assists?: number;
  subbedOff?: number | null;
  subbedIn?: number | null;
}

interface FootballFieldProps {
  /** Provider formation; may be empty — the pitch then derives rows from positions. */
  formation: string | null | undefined;
  players: Player[];
  onPlayerPress?: (player: Player) => void;
  /** Fills the 247×37 team-switch slot at the top right; receives the canvas scale. */
  renderTeamToggle?: (scale: number) => React.ReactNode;
  kitToggleLabel?: string;
}

type PitchLayer = {
  key: string;
  source: number;
  left: number;
  top: number;
  width: number;
  height: number;
  flip?: 'x' | 'y';
};

/** Perspective pitch from node 1347:19132, in artboard coordinates (SVG boxes incl. stroke bleed). */
const PITCH_LAYERS: PitchLayer[] = [
  { key: 's31', source: LINEUP_ART.stripe31, left: -36, top: 929.46, width: 519.458, height: 49.111 },
  { key: 's32a', source: LINEUP_ART.stripe32, left: -35.49, top: 891.49, width: 518.193, height: 38.225 },
  { key: 's32b', source: LINEUP_ART.stripe32, left: -35.49, top: 820.61, width: 518.193, height: 38.225 },
  { key: 's37', source: LINEUP_ART.stripe37, left: -32.2, top: 750.99, width: 506.548, height: 37.466 },
  { key: 's39', source: LINEUP_ART.stripe39, left: -13.47, top: 682.39, width: 469.842, height: 36.2 },
  { key: 's41', source: LINEUP_ART.stripe41, left: 6.02, top: 613.03, width: 432.629, height: 35.947 },
  { key: 's43', source: LINEUP_ART.stripe43, left: 24.5, top: 544.17, width: 396.429, height: 35.947 },
  { key: 's34', source: LINEUP_ART.stripe34, left: -36, top: 858.58, width: 519.458, height: 33.669 },
  { key: 's36', source: LINEUP_ART.stripe36, left: -35.49, top: 787.7, width: 518.193, height: 34.175 },
  { key: 's38', source: LINEUP_ART.stripe38, left: -22.33, top: 718.08, width: 487.058, height: 33.922 },
  { key: 's40', source: LINEUP_ART.stripe40, left: -3.34, top: 648.72, width: 450.349, height: 33.669 },
  { key: 's42', source: LINEUP_ART.stripe42, left: 15.89, top: 579.61, width: 413.509, height: 33.415 },
  { key: 'boxNear', source: LINEUP_ART.boxNear, left: 51.64, top: 844, width: 344.963, height: 182.266 },
  { key: 'boxFar', source: LINEUP_ART.boxFar, left: 96.4, top: 460, width: 255.92, height: 182.266, flip: 'y' },
  { key: 'halfway', source: LINEUP_ART.halfwayLine, left: 3.28, top: 717.34, width: 437.395, height: 3 },
  { key: 'circle', source: LINEUP_ART.centerCircle, left: 157.91, top: 683.4, width: 132.143, height: 70.375 },
  { key: 'outline', source: LINEUP_ART.outline, left: -37.02, top: 554.01, width: 522, height: 402 },
  { key: 'spot', source: LINEUP_ART.centerSpot, left: 218.16, top: 713.27, width: 12.151, height: 10.126 },
  { key: 'cornerL', source: LINEUP_ART.cornerLeft, left: 46.84, top: 556.7, width: 21.63, height: 13.936 },
  { key: 'cornerR', source: LINEUP_ART.cornerRight, left: 380.53, top: 556.7, width: 21.63, height: 13.936, flip: 'x' },
];

type Slot = { player: Player; cx: number; top: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Evenly space `count` values from `from` to `to` (inclusive, either direction). */
function spread(count: number, from: number, to: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(from + to) / 2];
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

function clusterByDepth(players: Player[]): Player[][] {
  const sorted = [...players].sort(
    (a, b) => Number(a.fieldLine ?? 50) - Number(b.fieldLine ?? 50),
  );
  const rows: Player[][] = [];
  let lastDepth = -Infinity;
  for (const player of sorted) {
    const depth = Number(player.fieldLine ?? 50);
    if (rows.length === 0 || depth - lastDepth > DEPTH_ROW_GAP) rows.push([player]);
    else rows[rows.length - 1].push(player);
    lastDepth = depth;
  }
  // Viewed from behind our own goal, so the provider's lateral axis is mirrored.
  return rows.map((row) =>
    row.sort((a, b) => Number(b.fieldSide ?? 50) - Number(a.fieldSide ?? 50)),
  );
}

/** Keeper row first, each row ordered left → right as drawn (own goal at the bottom). */
function buildPitchRows(players: Player[], formation: string | null | undefined): Player[][] {
  if (players.length === 0) return [];
  if (hasAbsoluteFieldData(players)) return clusterByDepth(players);
  const rows =
    distinctGridLines(players) >= 2
      ? groupPlayersByGridLine(players).map((row) => row.players)
      : buildFormationColumns(players, formation);
  return rows.map((row) => [...row].reverse());
}

/**
 * Rows of up to three outfield lines reproduce the Figma spacing exactly; deeper
 * or wider shapes shrink the cards (k) so avatars never cover the row above.
 */
function layoutPitchRows(rows: Player[][]): { slots: Slot[]; k: number } {
  if (rows.length === 0) return { slots: [], k: 1 };
  const [keeperRow, ...outfield] = rows.length > 1 ? rows : [[], ...rows];
  const lines = outfield.length;
  const dense = lines >= 4;
  const attackTop = dense ? 536 : 550;
  const defenceTop = dense ? 800 : 766;
  const tops = lines === 1 ? [658] : spread(lines, defenceTop, attackTop);
  const spacing = lines > 1 ? (defenceTop - attackTop) / (lines - 1) : CARD_STACK;
  const widest = Math.max(1, ...rows.map((row) => row.length));
  const kV = Math.min(1, spacing / CARD_STACK);
  const kH = Math.min(1, PLAYERS_SPAN / (widest * CARD_W + (widest - 1) * CARD_GAP));
  const k = clamp(Math.min(kV, kH), 0.6, 1);
  const step = (CARD_W + CARD_GAP) * k;

  const place = (row: Player[], top: number): Slot[] =>
    row.map((player, i) => ({
      player,
      top,
      cx: PITCH_CENTER_X + (i - (row.length - 1) / 2) * step,
    }));

  return {
    slots: [
      ...place(keeperRow, KEEPER_TOP),
      ...outfield.flatMap((row, i) => place(row, tops[i] ?? attackTop)),
    ],
    k,
  };
}

function PitchPlayerCard({
  player,
  u,
  left,
  top,
  showKit,
  onPress,
}: {
  player: Player;
  /** Artboard → screen multiplier for this card (canvas scale × density shrink). */
  u: number;
  left: number;
  top: number;
  showKit: boolean;
  onPress?: (player: Player) => void;
}) {
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const hasRating = player.rating != null && player.rating > 0;
  const borderWidth = Math.max(1, 2 * u);
  const innerW = CARD_W * u - borderWidth * 2;
  const avatar = AVATAR * u;
  const mini = 14 * u;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          left,
          top,
          width: CARD_W * u,
          height: CARD_H * u,
          borderRadius: 16 * u,
          borderWidth,
          paddingBottom: 5 * u,
          gap: 7 * u,
        },
      ]}
      onPress={onPress ? () => onPress(player) : undefined}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={player.name}
    >
      <Text
        style={[styles.cardName, { fontSize: 12 * u, paddingHorizontal: 4 * u }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
      >
        {shortPlayerName(player.name)}
      </Text>
      {hasRating ? <LineupRatingBadge rating={player.rating as number} scale={u} /> : null}

      <View
        style={[
          styles.avatar,
          {
            width: avatar,
            height: avatar,
            borderRadius: avatar / 2,
            top: -AVATAR_RISE * u,
            left: (innerW - avatar) / 2,
          },
        ]}
      >
        {showKit ? (
          <MaterialCommunityIcons name="tshirt-crew" size={avatar * 0.62} color="#8B5CF6" />
        ) : (
          <CachedAthletePhoto
            uri={player.photo}
            size={avatar}
            recyclingKey={player.id ?? player.photo}
            preSized
          />
        )}
      </View>

      {player.number ? (
        <View
          style={[
            styles.numberBadge,
            {
              left: 18 * u,
              top: 10 * u,
              width: 20 * u,
              height: 20 * u,
              borderRadius: 10 * u,
            },
          ]}
        >
          <Text style={[styles.numberText, { fontSize: 12 * u }]} maxFontSizeMultiplier={1.1}>
            {player.number}
          </Text>
        </View>
      ) : null}

      {goals > 0 || assists > 0 || player.subbedIn != null ? (
        <View style={[styles.eventBadges, { right: 16 * u, top: 10 * u, gap: 2 * u }]}>
          {goals > 0 ? (
            <View style={[styles.mini, { width: mini, height: mini, borderRadius: mini / 2 }]}>
              <MaterialCommunityIcons name="soccer" size={mini * 0.7} color="#fff" />
            </View>
          ) : null}
          {assists > 0 ? (
            <View
              style={[
                styles.mini,
                { width: mini, height: mini, borderRadius: mini / 2, backgroundColor: '#3B82F6' },
              ]}
            >
              <Ionicons name="star" size={mini * 0.6} color="#FBBF24" />
            </View>
          ) : null}
          {player.subbedIn != null ? (
            <View
              style={[
                styles.mini,
                { width: mini, height: mini, borderRadius: mini / 2, backgroundColor: '#1F2937' },
              ]}
            >
              <Ionicons name="arrow-up" size={mini * 0.7} color="#22C55E" />
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export const FootballField: React.FC<FootballFieldProps> = ({
  formation,
  players,
  onPlayerPress,
  renderTeamToggle,
  kitToggleLabel,
}) => {
  const { width: windowW } = useWindowDimensions();
  const [containerW, setContainerW] = useState(windowW);
  const [showKits, setShowKits] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - containerW) > 1) setContainerW(w);
  };

  const canvasW = Math.min(containerW, MAX_CANVAS_W);
  const s = canvasW / DESIGN_W;
  const sectionH = (SECTION_BOTTOM_Y - ORIGIN_Y) * s;
  const y = (artboardTop: number) => (artboardTop - ORIGIN_Y) * s;

  const formationLabel = useMemo(
    () => resolveFormationLabel(formation, players).label,
    [formation, players],
  );
  const rows = useMemo(() => buildPitchRows(players, formation), [players, formation]);
  const { slots, k } = useMemo(() => layoutPitchRows(rows), [rows]);
  const u = s * k;

  return (
    <View style={[styles.section, { height: sectionH }]} onLayout={onLayout}>
      <View style={{ width: canvasW, height: sectionH }}>
        <Image
          source={LINEUP_ART.stadium}
          style={[styles.abs, { left: 0, top: 0, width: 449 * s, height: 484 * s }]}
          contentFit="fill"
          transition={0}
        />

        {PITCH_LAYERS.map((layer) => (
          <Image
            key={layer.key}
            source={layer.source}
            style={[
              styles.abs,
              {
                left: layer.left * s,
                top: y(layer.top),
                width: layer.width * s,
                height: layer.height * s,
              },
              layer.flip === 'x' && styles.flipX,
              layer.flip === 'y' && styles.flipY,
            ]}
            contentFit="fill"
            transition={0}
          />
        ))}

        <LinearGradient
          colors={['rgba(3,3,3,0)', SECTION_BG]}
          locations={[0.0065, 0.813]}
          style={[styles.abs, { left: -1 * s, top: y(857), width: 451 * s, height: 145 * s }]}
          pointerEvents="none"
        />

        {slots.map(({ player, cx, top }, index) => (
          <PitchPlayerCard
            key={`${player.id ?? player.name}-${index}`}
            player={player}
            u={u}
            left={(cx - (CARD_W * k) / 2) * s}
            top={y(top)}
            showKit={showKits}
            onPress={onPlayerPress}
          />
        ))}

        {formationLabel ? (
          <View
            style={[
              styles.pill,
              {
                left: 24 * s,
                top: y(406),
                minWidth: 122 * s,
                height: 36 * s,
                paddingHorizontal: 14 * s,
                gap: 10 * s,
              },
            ]}
          >
            <Text style={[styles.pillText, { fontSize: 16 * s }]} maxFontSizeMultiplier={1.1}>
              {formationLabel.split('-').join(' - ')}
            </Text>
            <Image
              source={LINEUP_ICON.chevronDown}
              style={{ width: 24 * s, height: 24 * s }}
              contentFit="contain"
            />
          </View>
        ) : null}

        {renderTeamToggle ? (
          <View
            style={[styles.abs, { right: 18 * s, top: y(406), width: 247 * s, height: 37 * s }]}
          >
            {renderTeamToggle(s)}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.abs,
            { left: 388.5 * s, top: y(904.5), width: 45 * s, height: 45 * s },
            showKits && styles.kitActive,
          ]}
          onPress={() => setShowKits((v) => !v)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={kitToggleLabel}
          accessibilityState={{ selected: showKits }}
        >
          <Image
            source={LINEUP_ICON.tShirt}
            style={{ width: 45 * s, height: 45 * s }}
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: SECTION_BG,
  },
  abs: {
    position: 'absolute',
  },
  flipX: {
    transform: [{ scaleX: -1 }],
  },
  flipY: {
    transform: [{ scaleY: -1 }],
  },
  card: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#0B0518',
    borderColor: 'rgba(168,85,247,0.31)',
    zIndex: 2,
  },
  cardName: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
  avatar: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1240',
  },
  numberBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00081B',
  },
  numberText: {
    color: '#FFFFFF',
    fontWeight: '600',
    includeFontPadding: false,
  },
  eventBadges: {
    position: 'absolute',
    flexDirection: 'row',
  },
  mini: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D25',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.24)',
    borderRadius: 48,
    zIndex: 3,
  },
  pillText: {
    color: '#FFFFFF',
    fontWeight: '600',
    includeFontPadding: false,
  },
  kitActive: {
    borderRadius: 999,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
});
