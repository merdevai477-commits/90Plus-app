import React from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import { COLORS } from '../reels/constants';
import { Player } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { User, Trophy } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const PITCH_HEIGHT = width * 1.2;

interface TeamPitchProps {
    players: Player[];
    onPlayerPress: (player: Player) => void; // ✅ Changed to pass full player object
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

// Empty placeholder node for when no player data
const EmptyPlayerNode: React.FC<{ position: string; style: any; onPress: () => void }> = ({ position, style, onPress }) => (
    <TouchableOpacity style={[styles.playerNode, style]} onPress={onPress}>
        <View style={styles.nodeContent}>
            <View style={styles.emptyNodeImage}>
                <User size={20} color="rgba(255,255,255,0.3)" />
            </View>
            <View style={styles.emptyNodeRating}>
                <Text style={styles.emptyNodeRatingText}>?</Text>
            </View>
        </View>
        <View style={styles.emptyNodeNameContainer}>
            <Text style={styles.emptyNodePosition}>{position}</Text>
        </View>
    </TouchableOpacity>
);

// Default positions for 4-3-3 formation
const FORMATION_POSITIONS = {
    gk: ['GK'],
    defenders: ['RB', 'CB', 'CB', 'LB'],
    midfielders: ['CDM', 'CM', 'CAM'],
    forwards: ['RW', 'ST', 'LW'],
};

// ✅ Helper function to match player position to formation position
const matchPosition = (playerPosition: string, formationPositions: string[]): string | null => {
    const pos = playerPosition.toUpperCase();
    
    // Direct match
    if (formationPositions.includes(pos)) {
        return pos;
    }
    
    // Position mapping for flexibility
    const positionMap: Record<string, string[]> = {
        'GK': ['GK', 'G'],
        'RB': ['RB', 'RWB', 'RWB'],
        'CB': ['CB', 'RCB', 'LCB'],
        'LB': ['LB', 'LWB', 'LWB'],
        'CDM': ['CDM', 'DM', 'DMF'],
        'CM': ['CM', 'LCM', 'RCM'],
        'CAM': ['CAM', 'AM', 'AMC', 'OM'],
        'RW': ['RW', 'RM', 'RAM', 'RF'],
        'ST': ['ST', 'CF', 'F'],
        'LW': ['LW', 'LM', 'LAM', 'LF'],
    };
    
    // Find matching position
    for (const [formationPos, aliases] of Object.entries(positionMap)) {
        if (formationPositions.includes(formationPos) && aliases.includes(pos)) {
            return formationPos;
        }
    }
    
    return null;
};

// ✅ Function to organize players by their actual positions
const organizePlayersByPosition = (players: Player[]): (Player | null)[] => {
    const allPositions = [
        ...FORMATION_POSITIONS.gk,
        ...FORMATION_POSITIONS.defenders,
        ...FORMATION_POSITIONS.midfielders,
        ...FORMATION_POSITIONS.forwards,
    ];
    
    const organized: (Player | null)[] = new Array(11).fill(null);
    const usedPlayers = new Set<string>();
    
    // First pass: Match exact positions
    allPositions.forEach((formationPos, index) => {
        const player = players.find(p => {
            if (usedPlayers.has(p.id)) return false;
            const matched = matchPosition(p.position, [formationPos]);
            return matched === formationPos;
        });
        
        if (player) {
            organized[index] = player;
            usedPlayers.add(player.id);
        }
    });
    
    // Second pass: Fill remaining positions with best match
    allPositions.forEach((formationPos, index) => {
        if (organized[index] === null) {
            const player = players.find(p => {
                if (usedPlayers.has(p.id)) return false;
                const matched = matchPosition(p.position, [formationPos]);
                return matched !== null;
            });
            
            if (player) {
                organized[index] = player;
                usedPlayers.add(player.id);
            }
        }
    });
    
    // Third pass: Fill any remaining empty slots with unused players
    let unusedIndex = 0;
    for (let i = 0; i < organized.length; i++) {
        if (organized[i] === null && unusedIndex < players.length) {
            const unusedPlayer = players.find(p => !usedPlayers.has(p.id));
            if (unusedPlayer) {
                organized[i] = unusedPlayer;
                usedPlayers.add(unusedPlayer.id);
            }
            unusedIndex++;
        }
    }
    
    return organized;
};

export const TeamPitch: React.FC<TeamPitchProps> = ({ players, onPlayerPress }) => {
    const { t } = useTranslation();
    
    // Check if we have players
    const hasPlayers = players && players.length >= 11;
    
    // ✅ Organize players by their actual positions from profile
    const organizedPlayers = organizePlayersByPosition(players || []);

    const renderPlayerOrEmpty = (player: Player | null, position: string, index: number) => {
        if (player) {
            return (
                <PlayerNode 
                    key={player.id} 
                    player={player} 
                    style={{}} 
                    onPress={() => onPlayerPress(player)} // ✅ Pass full player object
                />
            );
        }
        return (
            <EmptyPlayerNode 
                key={`empty-${position}-${index}`} 
                position={position} 
                style={{}} 
                onPress={() => {}} 
            />
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Trophy size={20} color={COLORS.neonGreen} />
                    <Text style={styles.title}>{t.home.teamOfMonth || 'Team of the Month'}</Text>
                </View>
                <View style={styles.formationBadge}>
                    <Text style={styles.formationText}>4-3-3</Text>
                </View>
            </View>

            {/* Empty state message */}
            {!hasPlayers && (
                <View style={styles.emptyBanner}>
                    <Text style={styles.emptyBannerText}>🏆 في انتظار أبطال الشهر!</Text>
                    <Text style={styles.emptyBannerSubtext}>شارك وتفاعل لتكون من التشكيلة</Text>
                </View>
            )}

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
                {/* ✅ Organized by actual player positions from profile */}
                {/* GK */}
                <View style={styles.gkRow}>
                    {renderPlayerOrEmpty(organizedPlayers[0], FORMATION_POSITIONS.gk[0], 0)}
                </View>

                {/* Defenders */}
                <View style={styles.row}>
                    {FORMATION_POSITIONS.defenders.map((pos, i) => 
                        renderPlayerOrEmpty(organizedPlayers[1 + i], pos, i)
                    )}
                </View>

                {/* Midfielders */}
                <View style={styles.row}>
                    {FORMATION_POSITIONS.midfielders.map((pos, i) => 
                        renderPlayerOrEmpty(organizedPlayers[5 + i], pos, i)
                    )}
                </View>

                {/* Forwards */}
                <View style={styles.row}>
                    {FORMATION_POSITIONS.forwards.map((pos, i) => 
                        renderPlayerOrEmpty(organizedPlayers[8 + i], pos, i)
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create<{
    container: ViewStyle;
    header: ViewStyle;
    headerLeft: ViewStyle;
    title: TextStyle;
    formationBadge: ViewStyle;
    formationText: TextStyle;
    emptyBanner: ViewStyle;
    emptyBannerText: TextStyle;
    emptyBannerSubtext: TextStyle;
    pitchContainer: ViewStyle;
    pitch: ViewStyle;
    centerCircle: ViewStyle;
    centerLine: ViewStyle;
    penaltyAreaTop: ViewStyle;
    penaltyAreaBottom: ViewStyle;
    gkRow: ViewStyle;
    row: ViewStyle;
    playerNode: ViewStyle;
    nodeContent: ViewStyle;
    nodeImage: ImageStyle;
    emptyNodeImage: ViewStyle;
    nodeRating: ViewStyle;
    emptyNodeRating: ViewStyle;
    nodeRatingText: TextStyle;
    emptyNodeRatingText: TextStyle;
    nodeName: TextStyle;
    emptyNodeNameContainer: ViewStyle;
    emptyNodePosition: TextStyle;
}>({
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.white,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
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
    emptyBanner: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    emptyBannerText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
    },
    emptyBannerSubtext: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
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
    gkRow: {
        alignItems: 'center',
        marginBottom: 10,
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
    emptyNodeImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
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
    emptyNodeRating: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
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
    emptyNodeRatingText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    nodeName: {
        fontSize: 10,
        color: COLORS.white,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    emptyNodeNameContainer: {
        backgroundColor: 'rgba(34, 197, 94, 0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    emptyNodePosition: {
        fontSize: 9,
        fontWeight: 'bold',
        color: COLORS.neonGreen,
        textAlign: 'center',
    },
});
