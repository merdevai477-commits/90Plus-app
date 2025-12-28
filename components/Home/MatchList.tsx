import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../reels/constants';
import { Match } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';

interface MatchListProps {
    matches: Match[];
    onMatchPress: (matchId: string) => void;
    onViewAllPress: () => void;
    onFavoritePress: (matchId: string) => void;
}

const MatchCard = React.memo(({ match, onPress, onFavoritePress }: { match: Match; onPress: () => void; onFavoritePress: () => void }) => {
    const [scaleAnim] = React.useState(new Animated.Value(1));

    const handleFavoritePress = () => {
        // Animate scale on press
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        onFavoritePress();
    };

    // Check if match has started (is live or finished)
    const hasStarted = match.isLive || (match.homeScore !== undefined && match.awayScore !== undefined);

    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
            <LinearGradient
                colors={['#1a1a1a', '#000000']}
                style={styles.cardContainer}
            >
                <View style={styles.leagueBadge}>
                    <Text style={styles.leagueText}>{match.league}</Text>
                </View>

                {/* Favorite Star Icon */}
                <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={handleFavoritePress}
                    activeOpacity={0.7}
                >
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <Ionicons
                            name={match.isFavorited ? "star" : "star-outline"}
                            size={24}
                            color={match.isFavorited ? "#FFD700" : "rgba(255,255,255,0.5)"}
                        />
                    </Animated.View>
                </TouchableOpacity>

                <View style={styles.teamsContainer}>
                    <View style={styles.teamInfo}>
                        <Image source={{ uri: match.homeLogo || 'https://placehold.co/50x50/png' }} style={styles.teamLogo} />
                        <Text style={styles.teamName} numberOfLines={1}>{match.homeTeam}</Text>
                    </View>

                    <View style={styles.scoreContainer}>
                        {/* LIVE Badge - Centered above score */}
                        {match.isLive && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}

                        {hasStarted ? (
                            <>
                                <Text style={styles.scoreText}>
                                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
                                </Text>
                                {match.isLive && match.minute && (
                                    <Text style={styles.minuteText}>{match.minute}</Text>
                                )}
                            </>
                        ) : (
                            <Text style={styles.timeText}>{match.time}</Text>
                        )}
                    </View>

                    <View style={styles.teamInfo}>
                        <Image source={{ uri: match.awayLogo || 'https://placehold.co/50x50/png' }} style={styles.teamLogo} />
                        <Text style={styles.teamName} numberOfLines={1}>{match.awayTeam}</Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
});

export const MatchList: React.FC<MatchListProps> = ({ matches, onMatchPress, onViewAllPress, onFavoritePress }) => {
    const renderItem = React.useCallback(({ item }: { item: Match }) => (
        <MatchCard
            match={item}
            onPress={() => onMatchPress(item.id)}
            onFavoritePress={() => onFavoritePress(item.id)}
        />
    ), [onMatchPress, onFavoritePress]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Important Matches</Text>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={matches}
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
        fontSize: 20,
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
        width: 320,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    leagueBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 10,
        marginBottom: 16,
    },
    leagueText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    favoriteButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 6,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(255,0,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,0,0,0.5)',
        marginBottom: 8,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginRight: 5,
    },
    liveText: {
        fontSize: 11,
        color: '#FF3B30',
        fontWeight: 'bold',
    },
    teamsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    teamInfo: {
        alignItems: 'center',
        width: 90,
    },
    teamLogo: {
        width: 60,
        height: 60,
        marginBottom: 10,
    },
    teamName: {
        fontSize: 13,
        color: COLORS.white,
        textAlign: 'center',
        fontWeight: '600',
    },
    scoreContainer: {
        alignItems: 'center',
    },
    scoreText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    minuteText: {
        fontSize: 12,
        color: COLORS.neonGreen,
        marginTop: 6,
        fontWeight: '600',
    },
    timeText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
});

