import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { shortPlayerName, type LineupPitchPlayer } from '../../utils/lineupMatchState';
import { LINEUP_ICON } from './lineupAssets';
import { LineupRatingBadge } from './LineupRatingBadge';

const DESIGN_W = 448;
const MAX_SCALE = 520 / DESIGN_W;
const PER_ROW = 3;

interface LineupBenchProps {
  players: LineupPitchPlayer[];
  title: string;
  expandLabel: string;
  collapseLabel: string;
  rtl: boolean;
  resolvePhoto: (playerId: number, photo?: string | null) => string;
  onPlayerPress?: (player: LineupPitchPlayer) => void;
}

export function LineupBench({
  players,
  title,
  expandLabel,
  collapseLabel,
  rtl,
  resolvePhoto,
  onPlayerPress,
}: LineupBenchProps) {
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const s = Math.min(width / DESIGN_W, MAX_SCALE);

  if (players.length === 0) return null;

  const visible = expanded ? players : players.slice(0, PER_ROW);
  const rows: LineupPitchPlayer[][] = [];
  for (let i = 0; i < visible.length; i += PER_ROW) rows.push(visible.slice(i, i + PER_ROW));
  const align = rtl ? 'flex-end' : 'flex-start';
  const textAlign = rtl ? 'right' : 'left';

  return (
    <View
      style={[
        styles.card,
        {
          marginHorizontal: 15 * s,
          paddingVertical: 17 * s,
          paddingHorizontal: 12 * s,
          gap: 16 * s,
          borderRadius: 18 * s,
        },
      ]}
    >
      <View style={{ gap: 12 * s }}>
        <Text
          style={[styles.title, { fontSize: 22 * s, paddingHorizontal: 15 * s, textAlign }]}
          maxFontSizeMultiplier={1.2}
        >
          {title}
        </Text>

        {rows.map((row, rowIndex) => (
          <View
            key={`bench-row-${rowIndex}`}
            style={[styles.row, { gap: 8 * s, flexDirection: rtl ? 'row-reverse' : 'row' }]}
          >
            {row.map((player, i) => {
              const subbedOff = player.subbedOff != null;
              const hasRating = player.rating != null && player.rating > 0;
              return (
                <TouchableOpacity
                  key={`bench-${player.id ?? player.name}-${i}`}
                  style={[
                    styles.player,
                    {
                      flexDirection: rtl ? 'row' : 'row-reverse',
                      justifyContent: 'flex-end',
                      gap: 10 * s,
                      paddingHorizontal: 5 * s,
                      paddingVertical: 15 * s,
                      borderRadius: 16 * s,
                    },
                    subbedOff && styles.playerOut,
                  ]}
                  onPress={onPlayerPress ? () => onPlayerPress(player) : undefined}
                  disabled={!onPlayerPress || !player.id}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={player.name}
                >
                  <View style={[styles.info, { gap: 8 * s, alignItems: align }]}>
                    <View style={[styles.numberRow, { gap: 4 * s, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.number, { fontSize: 17 * s }]} maxFontSizeMultiplier={1.1}>
                        {player.number || '-'}
                      </Text>
                      {subbedOff ? (
                        <View style={[styles.subOut, { gap: 1 * s }]}>
                          <Ionicons name="arrow-down" size={11 * s} color="#EF4444" />
                          <Text style={[styles.subOutText, { fontSize: 10 * s }]}>
                            {Math.floor(player.subbedOff as number)}'
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.name, { fontSize: 14 * s, textAlign }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      maxFontSizeMultiplier={1.1}
                    >
                      {shortPlayerName(player.name, 10)}
                    </Text>
                    {hasRating ? (
                      <LineupRatingBadge rating={player.rating as number} scale={s} />
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.avatar,
                      { width: 55 * s, height: 55 * s, borderRadius: 27.5 * s },
                    ]}
                  >
                    <CachedAthletePhoto
                      uri={player.id ? resolvePhoto(player.id, player.photo) : player.photo}
                      size={55 * s}
                      recyclingKey={player.id ?? player.photo}
                      preSized={Boolean(player.id)}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
            {Array.from({ length: PER_ROW - row.length }).map((_, i) => (
              <View key={`bench-spacer-${i}`} style={styles.spacer} />
            ))}
          </View>
        ))}
      </View>

      {players.length > PER_ROW ? (
        <TouchableOpacity
          style={[styles.fullList, { height: 49 * s, gap: 6 * s, borderRadius: 16 * s }]}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={[styles.fullListText, { fontSize: 14 * s }]} maxFontSizeMultiplier={1.2}>
            {expanded ? collapseLabel : expandLabel}
          </Text>
          <Image
            source={LINEUP_ICON.users}
            style={{ width: 24 * s, height: 24 * s }}
            contentFit="contain"
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B0518',
    borderWidth: 1,
    borderColor: 'rgba(106,46,242,0.34)',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  row: {
    alignItems: 'stretch',
  },
  player: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(20,14,33,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.07)',
  },
  playerOut: {
    opacity: 0.55,
  },
  spacer: {
    flex: 1,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  numberRow: {
    alignItems: 'center',
  },
  number: {
    color: '#D8B3FC',
    fontWeight: '600',
  },
  subOut: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subOutText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  name: {
    color: '#FFFFFF',
    fontWeight: '600',
    alignSelf: 'stretch',
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1240',
  },
  fullList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,14,33,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.07)',
  },
  fullListText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default LineupBench;
