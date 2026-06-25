import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  groupPlayersByGridLine,
  hasGridLayoutData,
  sortPlayersByGrid,
} from '../../utils/lineupGrid';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ratingBadgeColor } from '../../utils/lineupMatchState';

const { width } = Dimensions.get('window');
const FIELD_WIDTH = width - 40;
const FIELD_HEIGHT = FIELD_WIDTH * 1.5;

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

const viewStyles = StyleSheet.create<{
  container: ViewStyle;
  field: ViewStyle;
  fieldLines: ViewStyle;
  centerLine: ViewStyle;
  centerCircle: ViewStyle;
  centerDot: ViewStyle;
  penaltyBoxTop: ViewStyle;
  goalBoxTop: ViewStyle;
  penaltyArcTop: ViewStyle;
  penaltyBoxBottom: ViewStyle;
  goalBoxBottom: ViewStyle;
  penaltyArcBottom: ViewStyle;
  cornerArc: ViewStyle;
  cornerTL: ViewStyle;
  cornerTR: ViewStyle;
  cornerBL: ViewStyle;
  cornerBR: ViewStyle;
  playersContainer: ViewStyle;
  playersContainerAbsolute: ViewStyle;
  absolutePlayer: ViewStyle;
  playerRow: ViewStyle;
  playerWrapper: ViewStyle;
  playerCircleContainer: ViewStyle;
  playerPhotoCircle: ViewStyle;
  placeholderParams: ViewStyle;
  playerBadgesRow: ViewStyle;
  ratingBadge: ViewStyle;
  ratingText: TextStyle;
  eventBadges: ViewStyle;
  miniBadge: ViewStyle;
  miniBadgeText: TextStyle;
  subIndicator: ViewStyle;
  subbedOffDim: ViewStyle;
}>({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  field: {
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  fieldLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
  },
  centerLine: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 1,
    backgroundColor: '#fff',
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#fff',
    marginLeft: -50,
    marginTop: -50,
  },
  centerDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginLeft: -3,
    marginTop: -3,
  },
  penaltyBoxTop: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '60%',
    height: '16%',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  goalBoxTop: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '40%',
    height: '40%',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  penaltyArcTop: {
    position: 'absolute',
    bottom: -20,
    alignSelf: 'center',
    width: 60,
    height: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  penaltyBoxBottom: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '60%',
    height: '16%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  goalBoxBottom: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '40%',
    height: '40%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  penaltyArcBottom: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    width: 60,
    height: 40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  cornerArc: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
    borderWidth: 1,
  },
  cornerTL: { top: -15, left: -15, borderRadius: 15 },
  cornerTR: { top: -15, right: -15, borderRadius: 15 },
  cornerBL: { bottom: -15, left: -15, borderRadius: 15 },
  cornerBR: { bottom: -15, right: -15, borderRadius: 15 },
  playersContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: 40,
  },
  playersContainerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  absolutePlayer: {
    position: 'absolute',
    transform: [{ translateX: -41 }, { translateY: -36 }],
    zIndex: 2,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  playerWrapper: {
    alignItems: 'center',
    width: 82,
  },
  playerCircleContainer: {
    width: 52,
    height: 52,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  playerPhotoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderParams: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBadgesRow: {
    position: 'absolute',
    top: -10,
    left: -6,
    right: -6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    zIndex: 3,
  },
  ratingBadge: {
    minWidth: 22,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  eventBadges: {
    flexDirection: 'row',
    gap: 2,
  },
  miniBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  subIndicator: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 4,
  },
});

const imageStyles = StyleSheet.create<{
  playerImage: ImageStyle;
}>({
  playerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
});

const textStyles = StyleSheet.create<{
  formationLabel: TextStyle;
  teamNameLabel: TextStyle;
  placeholderNumber: TextStyle;
  playerNameText: TextStyle;
}>({
  formationLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamNameLabel: {
    position: 'absolute',
    top: 20,
    right: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerNameText: {
    color: '#f0f0f0',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export const FootballField: React.FC<FootballFieldProps> = ({
  formation,
  players,
  teamName,
  onPlayerPress,
}) => {
  const useAbsoluteGrid = players.some(
    (p) => p.fieldLine != null && p.fieldSide != null,
  );
  const useRowGrid = !useAbsoluteGrid && hasGridLayoutData(players);

  const formationRows = formation.split('-').map(Number);
  const allRows = [1, ...formationRows];

  const distributePlayersInRows = () => {
    const rows: Player[][] = [];
    let playerIndex = 0;
    const ordered = sortPlayersByGrid(players);

    allRows.forEach((rowCount) => {
      const rowPlayers = ordered.slice(playerIndex, playerIndex + rowCount);
      if (rowPlayers.length > 0) {
        rows.push(rowPlayers);
      }
      playerIndex += rowCount;
    });

    if (playerIndex < ordered.length) {
      const tail = ordered.slice(playerIndex);
      if (rows.length === 0) {
        rows.push(tail);
      } else {
        rows[rows.length - 1] = [...rows[rows.length - 1], ...tail];
      }
    }

    return rows;
  };

  const playerRows = distributePlayersInRows();
  const gridRows = groupPlayersByGridLine(players);

  const renderPlayer = (player: Player, key: string | number) => {
    const goals = player.goals ?? 0;
    const assists = player.assists ?? 0;

    return (
      <TouchableOpacity
        key={key}
        style={viewStyles.playerWrapper}
        onPress={() => onPlayerPress?.(player)}
        activeOpacity={onPlayerPress ? 0.7 : 1}
      >
        <View style={viewStyles.playerCircleContainer}>
          {(player.rating != null && player.rating > 0) || goals > 0 || assists > 0 ? (
            <View style={viewStyles.playerBadgesRow}>
              {player.rating != null && player.rating > 0 ? (
                <View
                  style={[
                    viewStyles.ratingBadge,
                    { backgroundColor: ratingBadgeColor(player.rating) },
                  ]}
                >
                  <Text style={viewStyles.ratingText}>{player.rating.toFixed(1)}</Text>
                </View>
              ) : null}
              {(goals > 0 || assists > 0) && (
                <View style={viewStyles.eventBadges}>
                  {goals > 0 ? (
                    <View style={viewStyles.miniBadge}>
                      <MaterialCommunityIcons name="soccer" size={9} color="#fff" />
                    </View>
                  ) : null}
                  {assists > 0 ? (
                    <View style={[viewStyles.miniBadge, { backgroundColor: '#3b82f6' }]}>
                      <Ionicons name="star" size={9} color="#fbbf24" />
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          <View style={viewStyles.playerPhotoCircle}>
            {player.photo ? (
              <Image source={{ uri: player.photo }} style={imageStyles.playerImage} />
            ) : (
              <View style={viewStyles.placeholderParams}>
                <Text style={textStyles.placeholderNumber}>
                  {player.number || '?'}
                </Text>
              </View>
            )}
          </View>

          {player.subbedIn != null ? (
            <View style={viewStyles.subIndicator}>
              <Ionicons name="arrow-up" size={9} color="#22c55e" />
            </View>
          ) : null}
        </View>
        <Text style={textStyles.playerNameText} numberOfLines={1}>
          {player.name.split(' ').pop()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={viewStyles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#1e1b4b', '#2e1065']}
        style={viewStyles.field}
      >
        <View style={viewStyles.fieldLines}>
          <View style={viewStyles.centerLine} />
          <View style={viewStyles.centerCircle} />
          <View style={viewStyles.centerDot} />
          <View style={viewStyles.penaltyBoxTop}>
            <View style={viewStyles.goalBoxTop} />
            <View style={viewStyles.penaltyArcTop} />
          </View>
          <View style={viewStyles.penaltyBoxBottom}>
            <View style={viewStyles.goalBoxBottom} />
            <View style={viewStyles.penaltyArcBottom} />
          </View>
          <View style={[viewStyles.cornerArc, viewStyles.cornerTL]} />
          <View style={[viewStyles.cornerArc, viewStyles.cornerTR]} />
          <View style={[viewStyles.cornerArc, viewStyles.cornerBL]} />
          <View style={[viewStyles.cornerArc, viewStyles.cornerBR]} />
        </View>

        <Text style={textStyles.formationLabel}>{formation}</Text>
        <Text style={textStyles.teamNameLabel}>{teamName}</Text>

        {useAbsoluteGrid ? (
          <View style={viewStyles.playersContainerAbsolute}>
            {players.map((player, index) => (
              <View
                key={`${player.id ?? player.name}-${index}`}
                style={[
                  viewStyles.absolutePlayer,
                  {
                    top: `${Math.min(92, Math.max(8, player.fieldLine ?? 50))}%`,
                    left: `${Math.min(92, Math.max(8, player.fieldSide ?? 50))}%`,
                  },
                ]}
              >
                {renderPlayer(player, index)}
              </View>
            ))}
          </View>
        ) : useRowGrid ? (
          <View style={viewStyles.playersContainer}>
            {gridRows.map((row) => (
              <View key={row.line} style={viewStyles.playerRow}>
                {row.players.map((player, playerIndex) =>
                  renderPlayer(player, `${row.line}-${playerIndex}`),
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={viewStyles.playersContainer}>
            {playerRows.map((row, rowIndex) => (
              <View key={rowIndex} style={viewStyles.playerRow}>
                {row.map((player, playerIndex) =>
                  renderPlayer(player, `${rowIndex}-${playerIndex}`),
                )}
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
};
