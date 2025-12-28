import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const FIELD_WIDTH = width - 80; // Adjusted for parent padding (20 screen + 20 container) * 2
const FIELD_HEIGHT = FIELD_WIDTH * 1.4; // نسبة الملعب

interface Player {
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
}

export const FootballField: React.FC<FootballFieldProps> = ({
  formation,
  players,
  teamColor = '#22c55e',
  teamName
}) => {
  // تحويل التشكيلة لصفوف (مثال: "4-3-3" => [4, 3, 3])
  const formationRows = formation.split('-').map(Number).reverse(); // عكس عشان نبدأ من الحارس

  // توزيع اللاعبين على الصفوف
  const distributePlayersInRows = () => {
    const rows: Player[][] = [];
    let playerIndex = 0;

    // الحارس أولاً
    if (players[0]) {
      rows.push([players[0]]);
      playerIndex = 1;
    }

    // باقي الصفوف
    formationRows.forEach(rowCount => {
      const rowPlayers = players.slice(playerIndex, playerIndex + rowCount);
      rows.push(rowPlayers);
      playerIndex += rowCount;
    });

    return rows;
  };

  const playerRows = distributePlayersInRows();

  return (
    <View style={styles.container}>
      {/* الملعب */}
      <LinearGradient
        colors={['#1a4d2e', '#0f3a1f', '#1a4d2e']}
        style={styles.field}
      >
        {/* خطوط الملعب */}
        <View style={styles.fieldLines}>
          {/* خط المنتصف */}
          <View style={styles.centerLine} />
          <View style={styles.centerCircle} />
          <View style={styles.centerDot} />

          {/* منطقة الجزاء العلوية */}
          <View style={styles.penaltyBoxTop}>
            <View style={styles.goalBoxTop} />
          </View>

          {/* منطقة الجزاء السفلية */}
          <View style={styles.penaltyBoxBottom}>
            <View style={styles.goalBoxBottom} />
          </View>
        </View>

        {/* اسم الفريق */}
        <View style={styles.teamNameBadge}>
          <Text style={styles.teamNameText}>{teamName}</Text>
          <Text style={styles.formationText}>{formation}</Text>
        </View>

        {/* اللاعبين */}
        <View style={styles.playersContainer}>
          {playerRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.playerRow}>
              {row.map((player, playerIndex) => (
                <View key={playerIndex} style={styles.playerWrapper}>
                  {/* دائرة اللاعب */}
                  <View style={[styles.playerCircle, { borderColor: teamColor }]}>
                    {player.photo ? (
                      <Image
                        source={{ uri: player.photo }}
                        style={styles.playerImage}
                        onError={() => console.log('Image error')}
                      />
                    ) : (
                      <Ionicons name="person" size={20} color="#fff" />
                    )}
                  </View>

                  {/* رقم اللاعب */}
                  <View style={[styles.playerNumberBadge, { backgroundColor: teamColor }]}>
                    <Text style={styles.playerNumberText}>{player.number}</Text>
                  </View>

                  {/* اسم اللاعب */}
                  <Text style={styles.playerNameText} numberOfLines={1}>
                    {player.name.split(' ').pop()}
                  </Text>
                </View>
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
    marginVertical: 20,
  },
  field: {
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  fieldLines: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  centerLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  centerDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  penaltyBoxTop: {
    position: 'absolute',
    top: 0,
    left: '20%',
    width: '60%',
    height: '18%',
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  goalBoxTop: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    width: '50%',
    height: '40%',
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  penaltyBoxBottom: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: '60%',
    height: '18%',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  goalBoxBottom: {
    position: 'absolute',
    top: 0,
    left: '25%',
    width: '50%',
    height: '40%',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  teamNameBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
  },
  teamNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formationText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  playersContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: 30,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  playerWrapper: {
    alignItems: 'center',
    width: 60,
  },
  playerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playerNumberBadge: {
    position: 'absolute',
    top: -5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  playerNumberText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerNameText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
