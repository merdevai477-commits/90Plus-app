import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS } from '../reels/constants';
import { Player } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { Star, User } from 'lucide-react-native';
import { Skeleton } from '../ui/Skeleton';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/designSystem/designSystem';

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

import TeamBadge from '../common/TeamBadge';

const PlayerCard = React.memo(({ player, onPress }: { player: Player; onPress: () => void }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.cardContainer}
        >
            <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: 100 }}>
                <TeamBadge name={player.name} logo={player.image} size={80} color="transparent" />
            </View>
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
    const isLoading = !hasPlayers;
    const placeholderData = [
        { id: 'empty-1' }, { id: 'empty-2' }, { id: 'empty-3' }, 
        { id: 'empty-4' }, { id: 'empty-5' }
    ];
    const skeletonData = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ id: `skeleton-${i}` })), []);
    
    const renderItem = React.useCallback(({ item, index }: { item: Player | { id: string }; index: number }) => {
        if ('name' in item) {
            return (
                <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(15)}>
                    <PlayerCard player={item as Player} onPress={() => onPlayerPress(item as Player)} />
                </Animated.View>
            );
        }
        return (
            <Animated.View entering={FadeInDown.delay(index * 50)}>
                <EmptyPlayerCard index={index} onPress={onViewAllPress} t={t} />
            </Animated.View>
        );
    }, [onPlayerPress, onViewAllPress, t]);

    const renderSkeleton = React.useCallback(({ index }: { index: number }) => (
        <Animated.View 
            entering={FadeInDown.delay(index * 50)}
            style={{ marginRight: Spacing.md }}
        >
            <Skeleton width={140} height={200} borderRadius={BorderRadius.lg} />
        </Animated.View>
    ), []);

    return (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Star size={20} color={Colors.primary[500]} fill={Colors.primary[500]} />
                    <Text style={styles.title}>{t.home.playerOfWeek || 'Player of the Week'}</Text>
                </View>
                {!isLoading && (
                    <TouchableOpacity 
                        onPress={onViewAllPress}
                        accessibilityLabel="View all players"
                        accessibilityRole="button"
                    >
                        <Text style={styles.viewAll}>{t.home.viewAll}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={isLoading ? skeletonData : (hasPlayers ? players : placeholderData)}
                renderItem={isLoading ? renderSkeleton : renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                initialNumToRender={3}
                windowSize={3}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                    length: 140 + Spacing.md,
                    offset: (140 + Spacing.md) * index,
                    index,
                })}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        paddingTop: Spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    title: {
        ...Typography.title.large,
        color: Colors.onSurface.primary,
        fontWeight: Typography.title.large.fontWeight,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    viewAll: {
        ...Typography.label.medium,
        color: Colors.primary[500],
        fontWeight: Typography.label.medium.fontWeight,
    },
    listContent: {
        paddingHorizontal: 16,
    },
    cardContainer: {
        width: 140,
        height: 200,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
        borderWidth: 1,
        borderColor: Colors.glass.border,
        padding: Spacing.md,
        alignItems: 'center',
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
