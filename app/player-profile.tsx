import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Animated,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiFootballService from '../services/apiFootball';
import { ProfileTheme } from '../constants/ProfileTheme';
import { logger } from '../utils/logger';

const { width, height } = Dimensions.get('window');

// Cache key prefix for player data
const PLAYER_CACHE_PREFIX = 'player_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface PlayerParams {
    id: string;
    name?: string;
    photo?: string;
    teamName?: string;
    teamLogo?: string;
    teamColor?: string;
}

interface PlayerData {
    player: {
        id: number;
        name: string;
        firstname: string | null;
        lastname: string | null;
        age: number | null;
        birth: {
            date: string | null;
            place: string | null;
            country: string | null;
        };
        nationality: string | null;
        height: string | null;
        weight: string | null;
        injured: boolean;
        photo: string | null;
    };
    statistics: Array<{
        team: { id: number; name: string; logo: string };
        league: { id: number; name: string; country: string; logo: string; season: number };
        games: { appearences: number | null; lineups: number | null; minutes: number | null; position: string | null; rating: string | null };
        goals: { total: number | null; assists: number | null; saves: number | null };
        cards: { yellow: number | null; red: number | null };
        passes: { total: number | null; key: number | null; accuracy: number | null };
        shots: { total: number | null; on: number | null };
        tackles: { total: number | null; blocks: number | null; interceptions: number | null };
        dribbles: { attempts: number | null; success: number | null };
    }>;
}

// Team colors mapping (common teams) - using app theme colors
const TEAM_COLORS: { [key: string]: string[] } = {
    'Liverpool': ['#C8102E', '#8B0000'],
    'Manchester City': ['#6CABDD', '#1C2C5B'],
    'Manchester United': ['#DA291C', '#8B0000'],
    'Chelsea': ['#034694', '#001489'],
    'Arsenal': ['#EF0107', '#9C824A'],
    'Barcelona': ['#A50044', '#004D98'],
    'Real Madrid': ['#FEBE10', '#00529F'],
    'Bayern Munich': ['#DC052D', '#8B0000'],
    'Paris Saint-Germain': ['#004170', '#DA291C'],
    'Juventus': ['#000000', '#FFFFFF'],
    'Al Ahly': ['#C8102E', '#8B0000'],
    'Zamalek': ['#FFFFFF', '#000000'],
    'default': [ProfileTheme.colors.neonBlue, ProfileTheme.colors.neonPurple],
};

const getTeamColors = (teamName: string): string[] => {
    for (const [team, colors] of Object.entries(TEAM_COLORS)) {
        if (teamName.toLowerCase().includes(team.toLowerCase())) {
            return colors;
        }
    }
    return TEAM_COLORS.default;
};

export default function PlayerProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as PlayerParams;
    const insets = useSafeAreaInsets();

    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const playerId = parseInt(params.id || '0');
    const teamColors = getTeamColors(params.teamName || '');

    useEffect(() => {
        loadPlayerData();

        // Entrance animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [playerId]);

    // ✅ Get current season (2024 or 2025 based on current date)
    const getCurrentSeason = (): number => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11
        // If we're in July or later, use current year as season start
        // Otherwise use previous year
        return month >= 6 ? year : year - 1;
    };

    // ✅ Get current team from statistics (most recent season)
    const getCurrentTeamStats = (statistics: PlayerData['statistics']): PlayerData['statistics'][0] | null => {
        if (!statistics || statistics.length === 0) return null;
        
        const currentSeason = getCurrentSeason();
        
        // ✅ 1. Try to find statistics from current season
        const currentSeasonStats = statistics.find(stat => stat.league?.season === currentSeason);
        if (currentSeasonStats) {
            logger.debug(`✅ Found current season (${currentSeason}) stats for player`);
            return currentSeasonStats;
        }
        
        // ✅ 2. Find most recent season (highest season number)
        const sortedBySeason = [...statistics].sort((a, b) => {
            const seasonA = a.league?.season || 0;
            const seasonB = b.league?.season || 0;
            return seasonB - seasonA; // Descending order
        });
        
        if (sortedBySeason.length > 0) {
            logger.debug(`✅ Using most recent season (${sortedBySeason[0].league?.season}) stats`);
            return sortedBySeason[0];
        }
        
        // ✅ 3. Fallback to first statistics
        logger.debug('⚠️ Using first statistics as fallback');
        return statistics[0];
    };

    const loadPlayerData = async (forceRefresh = false) => {
        if (!playerId) {
            setError('Invalid player ID');
            setLoading(false);
            return;
        }

        try {
            if (!forceRefresh) {
                setLoading(true);
            }
            setError(null);

            // ✅ 1. Check local cache first (unless force refresh)
            if (!forceRefresh) {
                const cached = await getCachedPlayer(playerId);
                if (cached) {
                    logger.debug('📦 Player from cache:', playerId);
                    // ✅ Validate cache is recent (less than 1 hour old for team info)
                    const cacheAge = Date.now() - (await getCachedTimestamp(playerId) || 0);
                    if (cacheAge < 60 * 60 * 1000) { // 1 hour
                        setPlayer(cached);
                        setLoading(false);
                        await addToRecentlyViewed(cached.player);
                        // ✅ Background refresh to ensure data is up-to-date
                        loadPlayerData(true).catch(err => {
                            logger.warn('Background refresh failed:', err);
                        });
                        return;
                    }
                }
            }

            // ✅ 2. Fetch from API with current season (real-time data)
            const currentSeason = getCurrentSeason();
            logger.debug(`📡 Fetching player from API (season ${currentSeason}):`, playerId);
            const data = await ApiFootballService.getPlayerById(playerId, currentSeason);

            if (data && data.length > 0) {
                const playerData = data[0];
                
                // ✅ Ensure we have valid statistics
                if (!playerData.statistics || playerData.statistics.length === 0) {
                    logger.warn('⚠️ Player data has no statistics, trying previous season');
                    // Try previous season as fallback
                    const previousSeasonData = await ApiFootballService.getPlayerById(playerId, currentSeason - 1);
                    if (previousSeasonData && previousSeasonData.length > 0) {
                        setPlayer(previousSeasonData[0]);
                        await cachePlayer(playerId, previousSeasonData[0]);
                        await addToRecentlyViewed(previousSeasonData[0].player);
                        return;
                    }
                }
                
                setPlayer(playerData);

                // ✅ Cache locally with timestamp
                await cachePlayer(playerId, playerData);
                await addToRecentlyViewed(playerData.player);
            } else {
                setError('Player not found');
            }
        } catch (err: any) {
            logger.error('Failed to load player:', err);
            setError(err?.message || 'Failed to load player data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPlayerData(true);
    };

    const addToRecentlyViewed = async (player: any) => {
        try {
            const recentKey = 'recently_viewed_players';
            const existing = await AsyncStorage.getItem(recentKey);
            let players = existing ? JSON.parse(existing) : [];

            // Remove if already exists to move to top
            players = players.filter((p: any) => p.id !== player.id);

            // Add to top
            players.unshift({
                id: player.id,
                name: player.name,
                photo: player.photo,
                nationality: player.nationality
            });

            // Keep only last 10
            players = players.slice(0, 10);

            await AsyncStorage.setItem(recentKey, JSON.stringify(players));
        } catch (err) {
            logger.warn('Failed to update recently viewed:', err);
        }
    };

    const getCachedPlayer = async (id: number): Promise<PlayerData | null> => {
        try {
            const cached = await AsyncStorage.getItem(`${PLAYER_CACHE_PREFIX}${id}`);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL) {
                    return data;
                }
            }
        } catch (err) {
            logger.warn('Cache read error:', err);
        }
        return null;
    };

    const getCachedTimestamp = async (id: number): Promise<number | null> => {
        try {
            const cached = await AsyncStorage.getItem(`${PLAYER_CACHE_PREFIX}${id}`);
            if (cached) {
                const { timestamp } = JSON.parse(cached);
                return timestamp;
            }
        } catch (err) {
            logger.warn('Cache timestamp read error:', err);
        }
        return null;
    };

    const cachePlayer = async (id: number, data: PlayerData): Promise<void> => {
        try {
            // ✅ Also store in offlineDataService for permanent access
            const { offlineDataService } = await import('../services/offlineDataService');
            await offlineDataService.storePlayerData(id, data);
            
            // ✅ Store in local cache with timestamp
            await AsyncStorage.setItem(
                `${PLAYER_CACHE_PREFIX}${id}`,
                JSON.stringify({ data, timestamp: Date.now() })
            );
            logger.debug('✅ Cached player:', id);
        } catch (err) {
            logger.warn('Cache write error:', err);
        }
    };

    // ✅ Get current team statistics (most recent season)
    const stats = player ? getCurrentTeamStats(player.statistics) : null;
    const games = stats?.games;
    const goals = stats?.goals;

    if (loading && !player) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={ProfileTheme.colors.neonGreen} />
                <Text style={styles.loadingText}>Loading player...</Text>
            </View>
        );
    }

    if (error || (!player && !loading)) {
        return (
            <View style={styles.errorContainer}>
                <StatusBar barStyle="light-content" />
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text style={styles.errorText}>{error || 'Player not found'}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!player) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Hero Section with Gradient Background */}
            <LinearGradient
                colors={[...teamColors, ProfileTheme.colors.deepBlack]}
                style={styles.heroGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                {/* Back Button */}
                <TouchableOpacity 
                    style={[styles.backButtonFloat, { top: insets.top + 10 }]} 
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>

                {/* Player Name Watermark */}
                <Text style={styles.nameWatermark}>
                    {player.player.lastname?.toUpperCase() || player.player.name.split(' ').pop()?.toUpperCase() || ''}
                </Text>

                {/* Player Photo */}
                <Animated.View
                    style={[
                        styles.playerPhotoContainer,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    {player.player.photo ? (
                        <Image
                            source={{ uri: player.player.photo }}
                            style={styles.playerPhoto}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[styles.playerPhoto, styles.playerPhotoPlaceholder]}>
                            <Ionicons name="person" size={120} color="rgba(255,255,255,0.3)" />
                        </View>
                    )}
                </Animated.View>
            </LinearGradient>

            {/* Info Card */}
            <Animated.View
                style={[
                    styles.infoCard,
                    { opacity: fadeAnim }
                ]}
            >
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={ProfileTheme.colors.neonGreen}
                            colors={[ProfileTheme.colors.neonGreen]}
                        />
                    }
                >
                    {/* Player Header */}
                    <View style={styles.playerHeader}>
                        {stats?.team?.logo && (
                            <Image source={{ uri: stats.team.logo }} style={styles.teamLogo} />
                        )}
                        <View style={styles.playerNameSection}>
                            <Text style={styles.playerName}>{player.player.name}</Text>
                            <View style={styles.playerSubInfo}>
                                <Ionicons name="location" size={14} color={ProfileTheme.colors.textSecondary} />
                                <Text style={styles.playerCountry}>
                                    {player.player.nationality || 'Unknown'}
                                </Text>
                                {player.player.age != null && player.player.age > 0 && (
                                    <>
                                        <Text style={styles.separator}>•</Text>
                                        <Text style={styles.playerAge}>{player.player.age} years</Text>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <View style={styles.statIconContainer}>
                                <Ionicons name="football" size={24} color={ProfileTheme.colors.neonBlue} />
                            </View>
                            <Text style={styles.statValue}>{games?.appearences || 0}</Text>
                            <Text style={styles.statLabel}>Matches</Text>
                        </View>
                        <View style={[styles.statBox, styles.statBoxMiddle]}>
                            <View style={styles.statIconContainer}>
                                <Ionicons name="football-outline" size={24} color={ProfileTheme.colors.neonGreen} />
                            </View>
                            <Text style={styles.statValue}>{goals?.total || 0}</Text>
                            <Text style={styles.statLabel}>Goals</Text>
                        </View>
                        <View style={styles.statBox}>
                            <View style={styles.statIconContainer}>
                                <Ionicons name="share-outline" size={24} color={ProfileTheme.colors.neonPurple} />
                            </View>
                            <Text style={styles.statValue}>{goals?.assists || 0}</Text>
                            <Text style={styles.statLabel}>Assists</Text>
                        </View>
                    </View>

                    {/* Basic Info Section */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>Player Info</Text>
                        <View style={styles.infoCardContainer}>
                            <View style={styles.infoRow}>
                                <View style={styles.infoItem}>
                                    <Ionicons name="shirt-outline" size={20} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>Position</Text>
                                    <Text style={styles.infoValue}>{games?.position || 'N/A'}</Text>
                                </View>
                                <View style={styles.infoDivider} />
                                <View style={styles.infoItem}>
                                    <Ionicons name="resize-outline" size={20} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>Height</Text>
                                    <Text style={styles.infoValue}>{player.player.height || 'N/A'}</Text>
                                </View>
                                <View style={styles.infoDivider} />
                                <View style={styles.infoItem}>
                                    <Ionicons name="barbell-outline" size={20} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>Weight</Text>
                                    <Text style={styles.infoValue}>{player.player.weight || 'N/A'}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Season Statistics */}
                    {stats && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Season Statistics</Text>
                            <View style={styles.statsCard}>
                                <View style={styles.statRow}>
                                    <View style={styles.statRowLeft}>
                                        <Ionicons name="time-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                        <Text style={styles.statRowLabel}>Minutes Played</Text>
                                    </View>
                                    <Text style={styles.statRowValue}>{games?.minutes?.toLocaleString() || 0}</Text>
                                </View>

                                <View style={styles.statRowDivider} />

                                <View style={styles.statRow}>
                                    <View style={styles.statRowLeft}>
                                        <Ionicons name="star-outline" size={18} color={ProfileTheme.colors.gold} />
                                        <Text style={styles.statRowLabel}>Rating</Text>
                                    </View>
                                    <Text style={[styles.statRowValue, { color: ProfileTheme.colors.gold }]}>
                                        {games?.rating ? parseFloat(games.rating).toFixed(1) : 'N/A'}
                                    </Text>
                                </View>

                                {stats.cards && (stats.cards.yellow || stats.cards.red) && (
                                    <>
                                        <View style={styles.statRowDivider} />
                                        <View style={styles.statRow}>
                                            <View style={styles.statRowLeft}>
                                                <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                                                <Text style={styles.statRowLabel}>Yellow Cards</Text>
                                            </View>
                                            <Text style={[styles.statRowValue, { color: '#f59e0b' }]}>
                                                {stats.cards.yellow || 0}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {stats.cards?.red != null && (
                                    <>
                                        <View style={styles.statRowDivider} />
                                        <View style={styles.statRow}>
                                            <View style={styles.statRowLeft}>
                                                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                                                <Text style={styles.statRowLabel}>Red Cards</Text>
                                            </View>
                                            <Text style={[styles.statRowValue, { color: '#ef4444' }]}>
                                                {stats.cards.red || 0}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {stats.passes?.accuracy != null && (
                                    <>
                                        <View style={styles.statRowDivider} />
                                        <View style={styles.statRow}>
                                            <View style={styles.statRowLeft}>
                                                <Ionicons name="git-merge-outline" size={18} color={ProfileTheme.colors.neonBlue} />
                                                <Text style={styles.statRowLabel}>Pass Accuracy</Text>
                                            </View>
                                            <Text style={styles.statRowValue}>{stats.passes.accuracy}%</Text>
                                        </View>
                                    </>
                                )}

                                {stats.shots?.on != null && (
                                    <>
                                        <View style={styles.statRowDivider} />
                                        <View style={styles.statRow}>
                                            <View style={styles.statRowLeft}>
                                                <Ionicons name="target-outline" size={18} color={ProfileTheme.colors.neonGreen} />
                                                <Text style={styles.statRowLabel}>Shots on Target</Text>
                                            </View>
                                            <Text style={styles.statRowValue}>{stats.shots.on || 0}</Text>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Current Team */}
                    {stats?.team && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Current Team</Text>
                            <TouchableOpacity style={styles.teamCard} activeOpacity={0.7}>
                                <Image source={{ uri: stats.team.logo }} style={styles.teamCardLogo} />
                                <View style={styles.teamCardInfo}>
                                    <Text style={styles.teamCardName}>{stats.team.name}</Text>
                                    {stats.league && stats.league.name && stats.league.season != null && (
                                        <Text style={styles.teamCardLeague}>
                                            {stats.league.name} • {stats.league.season}/{stats.league.season + 1}
                                        </Text>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={ProfileTheme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ height: insets.bottom + 40 }} />
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: ProfileTheme.colors.deepBlack,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: ProfileTheme.colors.deepBlack,
    },
    loadingText: {
        color: ProfileTheme.colors.textSecondary,
        marginTop: 16,
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: ProfileTheme.colors.deepBlack,
        padding: 20,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    backButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: ProfileTheme.colors.neonGreen,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    heroGradient: {
        height: height * 0.45,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    backButtonFloat: {
        position: 'absolute',
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    nameWatermark: {
        position: 'absolute',
        top: '25%',
        left: 0,
        right: 0,
        fontSize: 100,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.08)',
        textAlign: 'center',
        letterSpacing: -3,
    },
    playerPhotoContainer: {
        position: 'absolute',
        bottom: -40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 5,
    },
    playerPhoto: {
        width: width * 0.75,
        height: height * 0.4,
    },
    playerPhotoPlaceholder: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    infoCard: {
        flex: 1,
        backgroundColor: ProfileTheme.colors.deepBlack,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
        paddingTop: 50,
        paddingHorizontal: 20,
    },
    playerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    teamLogo: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff',
        marginRight: 16,
        borderWidth: 2,
        borderColor: ProfileTheme.colors.border,
    },
    playerNameSection: {
        flex: 1,
    },
    playerName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: ProfileTheme.colors.textPrimary,
        marginBottom: 6,
    },
    playerSubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    playerCountry: {
        fontSize: 14,
        color: ProfileTheme.colors.textSecondary,
    },
    separator: {
        fontSize: 14,
        color: ProfileTheme.colors.textSecondary,
        marginHorizontal: 4,
    },
    playerAge: {
        fontSize: 14,
        color: ProfileTheme.colors.textSecondary,
    },
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 24,
    },
    statBoxMiddle: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    statIconContainer: {
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 12,
        color: ProfileTheme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: ProfileTheme.colors.textPrimary,
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: ProfileTheme.colors.textPrimary,
        marginBottom: 16,
    },
    infoCardContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoItem: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    infoDivider: {
        width: 1,
        height: '80%',
        backgroundColor: ProfileTheme.colors.border,
    },
    infoLabel: {
        fontSize: 12,
        color: ProfileTheme.colors.textSecondary,
        textAlign: 'center',
    },
    infoValue: {
        fontSize: 16,
        color: ProfileTheme.colors.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    statsCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    statRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statRowLabel: {
        fontSize: 15,
        color: ProfileTheme.colors.textSecondary,
    },
    statRowValue: {
        fontSize: 16,
        color: ProfileTheme.colors.textPrimary,
        fontWeight: '600',
    },
    statRowDivider: {
        height: 1,
        backgroundColor: ProfileTheme.colors.border,
        marginVertical: 4,
    },
    teamCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    teamCardLogo: {
        width: 48,
        height: 48,
        marginRight: 16,
        borderRadius: 24,
    },
    teamCardInfo: {
        flex: 1,
    },
    teamCardName: {
        fontSize: 17,
        color: ProfileTheme.colors.textPrimary,
        fontWeight: '600',
        marginBottom: 4,
    },
    teamCardLeague: {
        fontSize: 13,
        color: ProfileTheme.colors.textSecondary,
    },
});
