import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const FIELD_WIDTH = width - 40; // Full width minus padding
const FIELD_HEIGHT = FIELD_WIDTH * 1.5; // Aspect ratio

interface Player {
  id?: number;
  name: string;
  number: number;
  photo?: string;
  pos: string;
  grid?: string;
}

interface FootballFieldProps {
  formation: string;
  players: Player[];
  teamColor?: string;
  teamName: string;
  onPlayerPress?: (player: Player) => void;
}

export const FootballField: React.FC<FootballFieldProps> = ({
  formation,
  players,
  teamColor = '#8b5cf6',
  teamName,
  onPlayerPress
}) => {
  // Convert formation to rows (e.g. "4-3-3" => [4, 3, 3])
  // Reverse to start from Goalkeeper at bottom/top?
  // Usually formation is Defenders-Midfielders-Attackers
  // We want Goalkeeper at one end.
  // Assuming standard view: GK at bottom or top.
  // Let's stick to standard vertical view: GK at top or bottom.
  // The image shows GK at Top and players listed downwards.
  // Actually, wait, often "Line-up" view shows GK at top or bottom depending on UI.
  // In the user image: Sanchez (GK) is at top. Defenders below, etc.
  // So we render from Top (GK) to Bottom (Forwards).

  const formationRows = formation.split('-').map(Number); // e.g. [4, 2, 2]
  // We need to add GK (1) at the start
  const allRows = [1, ...formationRows];

  // Distribute players
  const distributePlayersInRows = () => {
    const rows: Player[][] = [];
    let playerIndex = 0;

    allRows.forEach(rowCount => {
      const rowPlayers = players.slice(playerIndex, playerIndex + rowCount);
      // Ensure we don't crash if missing players
      if (rowPlayers.length > 0) {
        rows.push(rowPlayers);
      }
      playerIndex += rowCount;
    });

    return rows;
  };

  const playerRows = distributePlayersInRows();

  return (
    <View style={styles.container}>
      {/* Field Background */}
      <LinearGradient
        // Dark purple/blue gradient
        colors={['#1e1b4b', '#1e1b4b', '#2e1065']}
        style={styles.field}
      >
        {/* Field Lines - Semi-transparent white */}
        <View style={styles.fieldLines}>
          {/* Outer Border already on container */}

          {/* Halfway Line */}
          <View style={styles.centerLine} />
          <View style={styles.centerCircle} />
          <View style={styles.centerDot} />

          {/* Top Penalty Area (Goalkeeper area) */}
          <View style={styles.penaltyBoxTop}>
            <View style={styles.goalBoxTop} />
            <View style={styles.penaltyArcTop} />
          </View>

          {/* Bottom Penalty Area (Opponent side - unused in lineup usually but good for visuals) */}
          <View style={styles.penaltyBoxBottom}>
            <View style={styles.goalBoxBottom} />
            <View style={styles.penaltyArcBottom} />
          </View>

          {/* Corner Arcs */}
          <View style={[styles.cornerArc, styles.cornerTL]} />
          <View style={[styles.cornerArc, styles.cornerTR]} />
          <View style={[styles.cornerArc, styles.cornerBL]} />
          <View style={[styles.cornerArc, styles.cornerBR]} />
        </View>

        {/* Info Overlays */}
        <Text style={styles.formationLabel}>{formation}</Text>
        <Text style={styles.teamNameLabel}>{teamName}</Text>

        {/* Players */}
        <View style={styles.playersContainer}>
          {playerRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.playerRow}>
              {row.map((player, playerIndex) => (
                <TouchableOpacity
                  key={playerIndex}
                  style={styles.playerWrapper}
                  onPress={() => onPlayerPress?.(player)}
                  activeOpacity={onPlayerPress ? 0.7 : 1}
                >
                  {/* Player Circle */}
                  <View style={styles.playerCircleContainer}>
                    {player.photo ? (
                      <Image
                        source={{ uri: player.photo }}
                        style={styles.playerImage}
                        onError={() => console.log('Image error')}
                      />
                    ) : (
                      <View style={[styles.placeholderParams, { backgroundColor: '#333' }]}>
                        <Ionicons name="person" size={20} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* Player Name */}
                  <Text style={styles.playerNameText} numberOfLines={1}>
                    {player.name.split(' ').pop()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
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
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2, // Subtle lines like in the image
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

  // Labels
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

  // Players
  playersContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: 40, // Space from top/bottom
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  playerWrapper: {
    alignItems: 'center',
    width: 70, // Slightly wider for names
  },
  playerCircleContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginBottom: 4,
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
  playerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playerNameText: {
    color: '#9ca3af', // Gray text
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
