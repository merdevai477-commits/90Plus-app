import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { COLORS } from '../reels/constants';
import { Player } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { Star, Trophy, User } from 'lucide-react-native';

interface PlayerListProps {
    players: Player[];
    onPlayerPress: (player: Player) => void; // ✅ Changed to pass full player object
    onViewAllPress: () => void;
}

// Empty State Placeholder Card
const EmptyPlayerCard = React.memo(({ index, onPress, t }: { index: number; onPress: () => void; t: any }) => {
    const positions = ['ST', 'CAM', 'RW', 'LW', 'CM'];
    const messages = [
        { emoji: '👑', text: t?.rank?.firstPlace || '1st Place', hint: t?.rank?.waitingForYou || 'Waiting for you!' },
        { emoji: '🥈', text: t?.rank?.secondPlace || '2nd Place', hint: t?.rank?.beTheBest || 'Be the best' },
        { emoji: '🥉', text: t?.rank?.thirdPlace || '3rd Place', hint: t?.rank?.competeNow || 'Compete now' },
        { emoji: '⭐', text: t?.home?.playerOfWeek || 'Star of the Week', hint: t?.profile?.createContent || 'Create content' },
        { emoji: '🔥', text: t?.home?.trendingReels || 'Trending', hint: t?.home?.getStarted || 'Join now' },
    ];
    const msg = messages[index % messages.length];
    const pos = positions[index % positions.length];
    
    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
            <LinearGradient
                colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.05)']}
                style={styles.emptyCardContainer}
            >
                <View style={styles.emptyAvatarContainer}>
                    <View style={styles.emptyAvatar}>
                        <User size={32} color="rgba(255,255,255,0.3)" />
                    </View>
                    <View style={styles.positionBadge}>
                        <Text style={styles.positionText}>{pos}</Text>
                    </View>
                </View>
                <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>?</Text>
                </View>
                <View style={styles.infoContainer}>
                    <Text style={styles.emptyEmoji}>{msg.emoji}</Text>
                    <Text style={styles.emptyPlayerText}>{msg.text}</Text>
                    <Text style={styles.emptyHintText}>{msg.hint}</Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
});

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
    const { t } = useTranslation();
    
    // If no players, show placeholder cards
    const hasPlayers = players && players.length > 0;
    const placeholderData = [
        { id: 'empty-1' }, { id: 'empty-2' }, { id: 'empty-3' }, 
        { id: 'empty-4' }, { id: 'empty-5' }
    ];
    
    const renderItem = React.useCallback(({ item, index }: { item: Player | { id: string }; index: number }) => {
        if ('name' in item) {
            return <PlayerCard player={item as Player} onPress={() => onPlayerPress(item as Player)} />; // ✅ Pass full player object
        }
        return <EmptyPlayerCard index={index} onPress={onViewAllPress} t={t} />;
    }, [onPlayerPress, onViewAllPress, t]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Star size={20} color={COLORS.neonGreen} fill={COLORS.neonGreen} />
                    <Text style={styles.title}>{t.home.playerOfWeek || 'Player of the Week'}</Text>
                </View>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>{t.home.viewAll}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={hasPlayers ? players : placeholderData}
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    emptyCardContainer: {
        width: 140,
        height: 200,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
        borderStyle: 'dashed',
    },
    emptyAvatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    emptyAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(34, 197, 94, 0.3)',
        borderStyle: 'dashed',
    },
    positionBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: 'rgba(34, 197, 94, 0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    positionText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.neonGreen,
    },
    emptyEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    emptyPlayerText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.white,
        textAlign: 'center',
    },
    emptyHintText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
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
