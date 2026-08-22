import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import {
  FootballPitchSvg,
  FOOTBALL_PITCH_ASPECT_VERTICAL,
  pitchPercentToContainer,
} from '../common/FootballPitchSvg';
import {
  groupPlayersByGridLine,
  hasGridLayoutData,
  sortPlayersByGrid,
} from '../../utils/lineupGrid';
import { ratingBadgeColor } from '../../utils/lineupMatchState';

const { width: SCREEN_W } = Dimensions.get('window');
/** Portrait pitch — slightly taller than FIFA vertical so names fit. */
const LINEUP_PITCH_ASPECT = FOOTBALL_PITCH_ASPECT_VERTICAL * 0.92;
const DEFAULT_FIELD_W = Math.max(300, SCREEN_W - 24);
/** Extra vertical room so names under dense back lines are not clipped. */
const FIELD_PAD_Y = 10;

/** Lateral (X) bounds on vertical pitch. */
const X_MIN = 10;
const X_MAX = 90;
/** Depth (Y) bounds — own goal near top, attack toward bottom. */
const Y_MIN = 8;
const Y_MAX = 90;

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
  formation: string;
  players: Player[];
  teamColor?: string;
  teamName: string;
  onPlayerPress?: (player: Player) => void;
}

type PlacedPlayer = {
  player: Player;
  xPct: number;
  yPct: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Evenly space `count` values between min and max (inclusive endpoints). */
function spread(count: number, min: number, max: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(min + max) / 2];
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

/**
 * Depth (Y) slots for formation lines including GK.
 * GK near own goal (top); attack toward opposite goal (bottom).
 */
function depthSlots(columnCount: number): number[] {
  if (columnCount <= 1) return [12];
  if (columnCount === 2) return [12, 72];
  if (columnCount === 3) return [10, 42, 78];
  if (columnCount === 4) return [9, 32, 58, 82];
  return spread(columnCount, 8, 86);
}

function placeFormationColumns(columns: Player[][]): PlacedPlayer[] {
  const ys = depthSlots(columns.length);
  const placed: PlacedPlayer[] = [];
  columns.forEach((col, colIndex) => {
    const yPct = ys[colIndex] ?? 50;
    const pad = col.length >= 4 ? 14 : col.length === 3 ? 16 : 18;
    const xs = spread(col.length, pad, 100 - pad);
    col.forEach((player, i) => {
      placed.push({
        player,
        xPct: clamp(xs[i] ?? 50, X_MIN, X_MAX),
        yPct: clamp(yPct, Y_MIN, Y_MAX),
      });
    });
  });
  return placed;
}

function placeFromApiGrid(players: Player[]): PlacedPlayer[] {
  return players.map((player) => {
    // API fieldLine = attack depth, fieldSide = lateral → vertical: Y / X.
    const yPct = clamp(Number(player.fieldLine ?? 50), Y_MIN, Y_MAX);
    const xPct = clamp(Number(player.fieldSide ?? 50), X_MIN, X_MAX);
    return { player, xPct, yPct };
  });
}

function placeFromGridLines(players: Player[]): PlacedPlayer[] {
  const cols = groupPlayersByGridLine(players);
  return placeFormationColumns(cols.map((c) => c.players));
}

function markerSizeForDensity(maxInLine: number): { avatar: number; name: number; wrap: number } {
  if (maxInLine >= 5) return { avatar: 30, name: 8, wrap: 44 };
  if (maxInLine >= 4) return { avatar: 34, name: 8, wrap: 48 };
  return { avatar: 38, name: 9, wrap: 52 };
}

export const FootballField: React.FC<FootballFieldProps> = ({
  formation,
  players,
  teamName,
  onPlayerPress,
}) => {
  const [fieldWidth, setFieldWidth] = useState(DEFAULT_FIELD_W);

  const onFieldLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - fieldWidth) > 1) setFieldWidth(w);
  };

  const pitchH = Math.round(fieldWidth / LINEUP_PITCH_ASPECT);
  const fieldHeight = pitchH + FIELD_PAD_Y * 2;

  const useAbsoluteGrid = players.some(
    (p) => p.fieldLine != null && p.fieldSide != null,
  );
  const useRowGrid = !useAbsoluteGrid && hasGridLayoutData(players);

  const formationRows = useMemo(
    () => formation.split('-').map(Number).filter((n) => Number.isFinite(n) && n > 0),
    [formation],
  );
  const allRows = useMemo(() => [1, ...formationRows], [formationRows]);

  const formationColumns = useMemo(() => {
    const columns: Player[][] = [];
    let playerIndex = 0;
    const ordered = sortPlayersByGrid(players);

    allRows.forEach((rowCount) => {
      const colPlayers = ordered.slice(playerIndex, playerIndex + rowCount);
      if (colPlayers.length > 0) columns.push(colPlayers);
      playerIndex += rowCount;
    });

    if (playerIndex < ordered.length) {
      const tail = ordered.slice(playerIndex);
      if (columns.length === 0) columns.push(tail);
      else columns[columns.length - 1] = [...columns[columns.length - 1], ...tail];
    }
    return columns;
  }, [players, allRows]);

  const placed = useMemo(() => {
    if (useAbsoluteGrid) return placeFromApiGrid(players);
    if (useRowGrid) return placeFromGridLines(players);
    return placeFormationColumns(formationColumns);
  }, [useAbsoluteGrid, useRowGrid, players, formationColumns]);

  const densestLine = useMemo(() => {
    if (useAbsoluteGrid) {
      const buckets = new Map<number, number>();
      for (const p of placed) {
        const key = Math.round(p.yPct / 8);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      return Math.max(1, ...buckets.values());
    }
    if (useRowGrid) {
      return Math.max(
        1,
        ...groupPlayersByGridLine(players).map((c) => c.players.length),
      );
    }
    return Math.max(1, ...formationColumns.map((c) => c.length));
  }, [useAbsoluteGrid, useRowGrid, placed, formationColumns, players]);

  const marker = markerSizeForDensity(densestLine);
  const halfWrapX = marker.wrap / 2;
  const halfWrapY = marker.avatar / 2 + 2;

  return (
    <View style={styles.container} onLayout={onFieldLayout}>
      <View style={[styles.field, { width: fieldWidth, height: fieldHeight }]}>
        <View style={styles.pitchFill} pointerEvents="none">
          <FootballPitchSvg
            variant="lineup"
            orientation="vertical"
            fit="stretch"
            width={fieldWidth}
            height={pitchH}
            style={{ marginTop: FIELD_PAD_Y }}
          />
        </View>

        <Text style={styles.formationLabel}>{formation}</Text>
        <Text style={styles.teamNameLabel} numberOfLines={1}>
          {teamName}
        </Text>

        <View style={styles.playersLayer} pointerEvents="box-none">
          {placed.map(({ player, xPct, yPct }, index) => {
            const grass = pitchPercentToContainer(
              xPct,
              yPct,
              fieldWidth,
              pitchH,
              'vertical',
            );
            const left = grass.left;
            const top = grass.top + FIELD_PAD_Y;
            const goals = player.goals ?? 0;
            const assists = player.assists ?? 0;

            return (
              <TouchableOpacity
                key={`${player.id ?? player.name}-${index}`}
                style={[
                  styles.playerAbsolute,
                  {
                    left: left - halfWrapX,
                    top: top - halfWrapY,
                    width: marker.wrap,
                  },
                ]}
                onPress={() => onPlayerPress?.(player)}
                activeOpacity={onPlayerPress ? 0.7 : 1}
              >
                <View style={[styles.circleWrap, { width: marker.avatar, height: marker.avatar }]}>
                  {(player.rating != null && player.rating > 0) || goals > 0 || assists > 0 ? (
                    <View style={styles.badgesRow}>
                      {player.rating != null && player.rating > 0 ? (
                        <View
                          style={[
                            styles.ratingBadge,
                            { backgroundColor: ratingBadgeColor(player.rating) },
                          ]}
                        >
                          <Text style={styles.ratingText}>{player.rating.toFixed(1)}</Text>
                        </View>
                      ) : null}
                      {(goals > 0 || assists > 0) && (
                        <View style={styles.eventBadges}>
                          {goals > 0 ? (
                            <View style={styles.miniBadge}>
                              <MaterialCommunityIcons name="soccer" size={8} color="#fff" />
                            </View>
                          ) : null}
                          {assists > 0 ? (
                            <View style={[styles.miniBadge, { backgroundColor: '#3b82f6' }]}>
                              <Ionicons name="star" size={8} color="#fbbf24" />
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.photoCircle,
                      {
                        width: marker.avatar,
                        height: marker.avatar,
                        borderRadius: marker.avatar / 2,
                      },
                    ]}
                  >
                    {player.photo ? (
                      <CachedAthletePhoto
                        uri={player.photo}
                        size={marker.avatar}
                        recyclingKey={player.id ?? player.photo}
                      />
                    ) : (
                      <View style={styles.placeholder}>
                        <Text style={styles.placeholderNumber}>{player.number || '?'}</Text>
                      </View>
                    )}
                  </View>

                  {player.subbedIn != null ? (
                    <View style={styles.subIndicator}>
                      <Ionicons name="arrow-up" size={8} color="#22c55e" />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.playerName, { fontSize: marker.name }]}
                  numberOfLines={1}
                >
                  {player.name.split(' ').pop()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    marginVertical: 4,
  },
  field: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0E490B',
  },
  pitchFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'stretch',
  },
  playersLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  playerAbsolute: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  circleWrap: {
    marginBottom: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoCircle: {
    backgroundColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.9)',
  },
  placeholderNumber: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  badgesRow: {
    position: 'absolute',
    top: -8,
    left: -10,
    right: -10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    zIndex: 3,
  },
  ratingBadge: {
    minWidth: 18,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 5,
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
  },
  eventBadges: {
    flexDirection: 'row',
    gap: 2,
  },
  miniBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 4,
  },
  playerName: {
    color: '#f5f5f5',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    width: '100%',
  },
  formationLabel: {
    position: 'absolute',
    top: 8,
    left: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    zIndex: 5,
  },
  teamNameLabel: {
    position: 'absolute',
    top: 8,
    right: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    zIndex: 5,
    maxWidth: '45%',
  },
});
