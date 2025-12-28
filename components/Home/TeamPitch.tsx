import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import { COLORS } from '../reels/constants';
import { Player } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const PITCH_HEIGHT = width * 1.2;

interface TeamPitchProps {
    players: Player[];
    onPlayerPress: (playerId: string) => void;
}

const PlayerNode: React.FC<{ player: Player; style: any; onPress: () => void }> = ({ player, style, onPress }) => (
    <TouchableOpacity style={[styles.playerNode, style]} onPress={onPress}>
        <View style={styles.nodeContent}>
            <Image source={{ uri: player.image }} style={styles.nodeImage} />
            <View style={styles.nodeRating}>
                <Text style={styles.nodeRatingText}>{player.rating}</Text>
            </View>
        </View>
        <Text style={styles.nodeName} numberOfLines={1}>{player.name}</Text>
    </TouchableOpacity>
);

export const TeamPitch: React.FC<TeamPitchProps> = ({ players, onPlayerPress }) => {
    // 4-3-3 Formation Positions (Top to Bottom: GK -> ST)
    // Assuming players array is sorted: GK, Defenders, Midfielders, Forwards

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Team of the Month</Text>
                <View style={styles.formationBadge}>
                    <Text style={styles.formationText}>4-3-3</Text>
                </View>
            </View>

            <View style={styles.pitchContainer}>
                {/* Pitch Background */}
                <LinearGradient
                    colors={['#1a472a', '#2d5a3f']}
                    style={styles.pitch}
                >
                    {/* Pitch Markings */}
                    <View style={styles.centerCircle} />
                    <View style={styles.centerLine} />
                    <View style={styles.penaltyAreaTop} />
                    <View style={styles.penaltyAreaBottom} />
                </LinearGradient>

                {/* Players */}
                {/* GK */}
                {players[0] && <PlayerNode player={players[0]} style={{ bottom: '5%', alignSelf: 'center' }} onPress={() => onPlayerPress(players[0].id)} />}

                {/* Defenders */}
                <View style={styles.row}>
                    {players.slice(1, 5).map((p) => (
                        <PlayerNode key={p.id} player={p} style={{}} onPress={() => onPlayerPress(p.id)} />
                    ))}
                </View>

                {/* Midfielders */}
                <View style={styles.row}>
                    {players.slice(5, 8).map((p) => (
                        <PlayerNode key={p.id} player={p} style={{ marginTop: -20 }} onPress={() => onPlayerPress(p.id)} />
                    ))}
                </View>

                {/* Forwards */}
                <View style={styles.row}>
                    {players.slice(8, 11).map((p) => (
                        <PlayerNode key={p.id} player={p} style={{}} onPress={() => onPlayerPress(p.id)} />
                    ))}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 40,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    formationBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    formationText: {
        fontSize: 12,
        color: COLORS.neonGreen,
        fontWeight: 'bold',
    },
    pitchContainer: {
        height: PITCH_HEIGHT,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    pitch: {
        ...StyleSheet.absoluteFillObject,
    },
    centerCircle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        transform: [{ translateX: -50 }, { translateY: -50 }],
    },
    centerLine: {
        position: 'absolute',
        top: '50%',
        width: '100%',
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    penaltyAreaTop: {
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        width: '60%',
        height: '15%',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        borderTopWidth: 0,
    },
    penaltyAreaBottom: {
        position: 'absolute',
        bottom: 0,
        alignSelf: 'center',
        width: '60%',
        height: '15%',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        borderBottomWidth: 0,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 10,
    },
    playerNode: {
        alignItems: 'center',
        width: 60,
    },
    nodeContent: {
        position: 'relative',
        marginBottom: 4,
    },
    nodeImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: COLORS.white,
        backgroundColor: '#000',
    },
    nodeRating: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: COLORS.neonGreen,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.deepBlack,
    },
    nodeRatingText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: COLORS.deepBlack,
    },
    nodeName: {
        fontSize: 10,
        color: COLORS.white,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 4,
        borderRadius: 4,
    },
});
