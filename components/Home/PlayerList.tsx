import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { COLORS } from '../reels/constants';
import { Player } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';

interface PlayerListProps {
    players: Player[];
    onPlayerPress: (playerId: string) => void;
    onViewAllPress: () => void;
}

const PlayerCard = React.memo(({ player, onPress }: { player: Player; onPress: () => void }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <LinearGradient
            colors={['#2a2a2a', '#1a1a1a']}
            style={styles.cardContainer}
        >
            <Image source={{ uri: player.image }} style={styles.playerImage} />
            <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{player.rating}</Text>
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.playerTeam}>{player.team}</Text>
                <Text style={styles.playerPosition}>{player.position}</Text>
            </View>
        </LinearGradient>
    </TouchableOpacity>
));

export const PlayerList: React.FC<PlayerListProps> = ({ players, onPlayerPress, onViewAllPress }) => {
    const renderItem = React.useCallback(({ item }: { item: Player }) => (
        <PlayerCard player={item} onPress={() => onPlayerPress(item.id)} />
    ), [onPlayerPress]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Player of the Week</Text>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={players}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
                initialNumToRender={3}
                windowSize={3}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    viewAll: {
        fontSize: 14,
        color: COLORS.neonGreen,
    },
    listContent: {
        paddingHorizontal: 16,
    },
    cardContainer: {
        width: 140,
        height: 200,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    playerImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: COLORS.neonGreen,
    },
    ratingBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: COLORS.neonGreen,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.deepBlack,
    },
    infoContainer: {
        alignItems: 'center',
        width: '100%',
    },
    playerName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
        textAlign: 'center',
    },
    playerTeam: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 2,
    },
    playerPosition: {
        fontSize: 12,
        color: COLORS.neonBlue,
        fontWeight: 'bold',
    },
});
