import { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
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
import PlayerAvatar from '../components/common/PlayerAvatar';
import TeamBadge from '../components/common/TeamBadge';
import { getAPIConfig } from '../config/api.config';
import { useTranslation } from '../src/i18n';
import type { Language } from '../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName } from '../utils/i18nHelpers';
import { Image as ExpoImage } from 'expo-image';
import LeagueIcon from '../components/common/LeagueIcon';
import {
  getFootballSeasonYear,
  getPlayerLeagueStats,
  playerPhotoCandidates,
  statNum,
  sumSeasonTotals,
  teamLogoUrl,
  type PlayerStatRow,
} from '../utils/playerStatsAggregate';

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
    teamId?: string;
    season?: string;
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
        games: { 
            appearences: number | null; 
            lineups: number | null; 
            minutes: number | null; 
            position: string | null; 
            rating: string | null;
            captain: boolean | null;
        };
        goals: { 
            total: number | null; 
            assists: number | null; 
            saves: number | null;
            conceded: number | null;
        };
        cards: { yellow: number | null; red: number | null };
        passes: { total: number | null; key: number | null; accuracy: number | null };
        shots: { total: number | null; on: number | null };
        tackles: { total: number | null; blocks: number | null; interceptions: number | null };
        dribbles: { attempts: number | null; success: number | null };
        penalty?: {
            won: number | null;
            commited: number | null;
            scored: number | null;
            missed: number | null;
            saved: number | null;
        };
    }>;
}

interface Transfer {
    player: {
        id: number;
        name: string;
        photo: string | null;
    };
    transfers: Array<{
        date: string;
        type: string;
        teams: {
            in: { id: number; name: string; logo: string | null } | null;
            out: { id: number; name: string; logo: string | null } | null;
        };
    }>;
}

// Team colors mapping (common teams) - using app theme colors
const TEAM_COLORS: { [key: string]: readonly [string, string, ...string[]] } = {
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

const getTeamColors = (teamName: string): readonly [string, string, ...string[]] => {
    for (const [team, colors] of Object.entries(TEAM_COLORS)) {
        if (teamName.toLowerCase().includes(team.toLowerCase())) {
            return colors;
        }
    }
    return TEAM_COLORS.default;
};

// Helper to format date
const formatDate = (dateString: string | null, language: Language): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const locale = language === 'ar' ? 'ar-EG' : 'en-US';
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return dateString;
    }
};

// Helper to format transfer value
const formatTransferValue = (type: string | null, labels: Record<string, string>): string => {
    if (!type) return labels.freeTransfer;
    if (type.includes('€') || type.includes('M') || type.includes('K')) {
        return type;
    }
    if (type.toLowerCase().includes('free')) return labels.freeTransfer;
    if (type.toLowerCase().includes('loan')) return labels.loan;
    return type;
};

function formatPreferredFoot(
    statistics: PlayerData['statistics'],
    labels: Record<string, string>,
): string | null {
    if (!statistics || statistics.length === 0) return null;

    const stats = statistics[0];
    const goals = stats.goals as { by?: { right?: number; left?: number } };

    if (goals?.by?.right != null && goals?.by?.left != null) {
        const right = goals.by.right || 0;
        const left = goals.by.left || 0;
        if (right > left) return labels.footRight;
        if (left > right) return labels.footLeft;
        return labels.footBoth;
    }

    return null;
}

function PlayerHeroPhoto({
    playerId,
    photo,
    name,
    position,
    colors,
}: {
    playerId: number;
    photo?: string | null;
    name: string;
    position: string | null;
    colors: readonly [string, string, ...string[]];
}) {
    const candidates = useMemo(() => playerPhotoCandidates(playerId, photo), [playerId, photo]);
    const [uriIndex, setUriIndex] = useState(0);

    useEffect(() => {
        setUriIndex(0);
    }, [playerId, photo]);

    const uri = candidates[uriIndex] ?? '';

    if (!uri || uriIndex >= candidates.length) {
        return (
            <PlayerAvatar name={name} position={position} size={112} colors={colors} />
        );
    }

    return (
        <View style={heroPhotoStyles.circle}>
            <ExpoImage
                source={{ uri }}
                style={heroPhotoStyles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`player-${playerId}-${uriIndex}`}
                transition={200}
                onError={() => {
                    if (uriIndex + 1 < candidates.length) {
                        setUriIndex((i) => i + 1);
                    } else {
                        setUriIndex(candidates.length);
                    }
                }}
            />
        </View>
    );
}

const heroPhotoStyles = StyleSheet.create({
    circle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.45)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
    return (
        <View style={miniStatStyles.box}>
            <Text style={[miniStatStyles.value, accent ? { color: accent } : null]}>{value}</Text>
            <Text style={miniStatStyles.label}>{label}</Text>
        </View>
    );
}

function LeagueStatCard({
    stat,
    language,
    labels,
    teamColor,
}: {
    stat: PlayerStatRow;
    language: Language;
    labels: Record<string, string>;
    teamColor: string;
}) {
    const leagueName = getLeagueDisplayName(stat.league.name, language);
    const seasonLabel = stat.league.season
        ? `${stat.league.season}/${stat.league.season + 1}`
        : '';
    const rating = stat.games.rating ? parseFloat(stat.games.rating).toFixed(1) : '—';
    const showPassAcc = stat.passes?.accuracy != null;
    const showShots = statNum(stat.shots?.on) > 0;
    const showTackles = statNum(stat.tackles?.total) > 0;
    const showDribbles = statNum(stat.dribbles?.success) > 0;
    const showAdvanced = showPassAcc || showShots || showTackles || showDribbles;

    return (
        <View style={leagueCardStyles.card}>
            <View style={leagueCardStyles.header}>
                <LeagueIcon
                    name={stat.league.name}
                    logo={stat.league.logo}
                    leagueId={stat.league.id}
                    size={44}
                    color={teamColor}
                />
                <View style={leagueCardStyles.headerText}>
                    <Text style={leagueCardStyles.leagueName} numberOfLines={2}>{leagueName}</Text>
                    <Text style={leagueCardStyles.leagueMeta} numberOfLines={1}>
                        {stat.league.country}{seasonLabel ? ` • ${seasonLabel}` : ''}
                    </Text>
                </View>
                <View style={leagueCardStyles.teamChip}>
                    <TeamBadge
                        name={stat.team.name}
                        color={teamColor}
                        size={28}
                        logo={stat.team.logo}
                    />
                    <Text style={leagueCardStyles.teamName} numberOfLines={1}>
                        {getTeamDisplayName(stat.team.name, language)}
                    </Text>
                </View>
            </View>

            <View style={leagueCardStyles.statsRow}>
                <MiniStat label={labels.matches} value={statNum(stat.games.appearences)} accent={ProfileTheme.colors.neonBlue} />
                <MiniStat label={labels.goals} value={statNum(stat.goals.total)} accent={ProfileTheme.colors.neonGreen} />
                <MiniStat label={labels.assists} value={statNum(stat.goals.assists)} accent={ProfileTheme.colors.neonPurple} />
                <MiniStat label={labels.rating} value={rating} accent={ProfileTheme.colors.gold} />
            </View>

            <View style={leagueCardStyles.detailsRow}>
                <View style={leagueCardStyles.detailItem}>
                    <Ionicons name="time-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                    <Text style={leagueCardStyles.detailText}>
                        {statNum(stat.games.minutes).toLocaleString()} {labels.minutesPlayed}
                    </Text>
                </View>
                {stat.games.lineups != null && (
                    <View style={leagueCardStyles.detailItem}>
                        <Ionicons name="shirt-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                        <Text style={leagueCardStyles.detailText}>
                            {statNum(stat.games.lineups)} {labels.lineups}
                        </Text>
                    </View>
                )}
                {stat.games.position && (
                    <View style={leagueCardStyles.detailItem}>
                        <Ionicons name="locate-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                        <Text style={leagueCardStyles.detailText}>{stat.games.position}</Text>
                    </View>
                )}
            </View>

            {showAdvanced && (
                <View style={leagueCardStyles.advancedRow}>
                    {showPassAcc && (
                        <View style={leagueCardStyles.detailItem}>
                            <Ionicons name="git-network-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                            <Text style={leagueCardStyles.detailText}>
                                {labels.passAccuracy}: {stat.passes!.accuracy}%
                            </Text>
                        </View>
                    )}
                    {showShots && (
                        <View style={leagueCardStyles.detailItem}>
                            <Ionicons name="radio-button-on-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                            <Text style={leagueCardStyles.detailText}>
                                {labels.shotsOnTarget}: {statNum(stat.shots?.on)}
                            </Text>
                        </View>
                    )}
                    {showTackles && (
                        <View style={leagueCardStyles.detailItem}>
                            <Ionicons name="shield-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                            <Text style={leagueCardStyles.detailText}>
                                {labels.tackles}: {statNum(stat.tackles?.total)}
                            </Text>
                        </View>
                    )}
                    {showDribbles && (
                        <View style={leagueCardStyles.detailItem}>
                            <Ionicons name="flash-outline" size={14} color={ProfileTheme.colors.textSecondary} />
                            <Text style={leagueCardStyles.detailText}>
                                {labels.successfulDribbles}: {statNum(stat.dribbles?.success)}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {(statNum(stat.cards.yellow) > 0 || statNum(stat.cards.red) > 0) && (
                <View style={leagueCardStyles.cardsRow}>
                    {statNum(stat.cards.yellow) > 0 && (
                        <View style={leagueCardStyles.cardBadge}>
                            <View style={[leagueCardStyles.cardDot, { backgroundColor: '#f59e0b' }]} />
                            <Text style={leagueCardStyles.cardText}>{statNum(stat.cards.yellow)} {labels.yellowCards}</Text>
                        </View>
                    )}
                    {statNum(stat.cards.red) > 0 && (
                        <View style={leagueCardStyles.cardBadge}>
                            <View style={[leagueCardStyles.cardDot, { backgroundColor: '#ef4444' }]} />
                            <Text style={leagueCardStyles.cardText}>{statNum(stat.cards.red)} {labels.redCards}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const miniStatStyles = StyleSheet.create({
    box: { flex: 1, alignItems: 'center', paddingVertical: 10 },
    value: { fontSize: 22, fontWeight: '800', color: ProfileTheme.colors.textPrimary },
    label: { fontSize: 11, color: ProfileTheme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
});

const leagueCardStyles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
    headerText: { flex: 1 },
    leagueName: { fontSize: 16, fontWeight: '700', color: ProfileTheme.colors.textPrimary },
    leagueMeta: { fontSize: 12, color: ProfileTheme.colors.textSecondary, marginTop: 2 },
    teamChip: { alignItems: 'center', maxWidth: 72, gap: 4 },
    teamName: { fontSize: 10, color: ProfileTheme.colors.textSecondary, textAlign: 'center' },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        overflow: 'hidden',
    },
    detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    advancedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailText: { fontSize: 12, color: ProfileTheme.colors.textSecondary },
    cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardDot: { width: 8, height: 8, borderRadius: 4 },
    cardText: { fontSize: 12, color: ProfileTheme.colors.textSecondary },
});

export default function PlayerProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as PlayerParams;
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();

    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingTransfers, setLoadingTransfers] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const playerId = parseInt(params.id || '0');
    const contextTeamId = params.teamId ? parseInt(params.teamId, 10) : undefined;
    const contextSeason = params.season ? parseInt(params.season, 10) : undefined;

    useEffect(() => {
        loadPlayerData();
        loadPlayerTransfers();

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
    }, [playerId, contextSeason, contextTeamId]);

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
            const seasonToFetch = contextSeason ?? getFootballSeasonYear();
            logger.debug(`📡 Fetching player from API (season ${seasonToFetch}):`, playerId);
            const data = await ApiFootballService.getPlayerById(playerId, seasonToFetch);

            if (data && data.length > 0) {
                const playerData = data[0];
                
                // ✅ Ensure we have valid statistics
                if (!playerData.statistics || playerData.statistics.length === 0) {
                    logger.warn('⚠️ Player data has no statistics, trying previous season');
                    // Try previous season as fallback
                    const previousSeasonData = await ApiFootballService.getPlayerById(
                        playerId,
                        seasonToFetch - 1,
                    );
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
                setError(t.playerProfile.playerNotFound);
            }
        } catch (err: any) {
            logger.error('Failed to load player:', err);
            setError(err?.message || 'Failed to load player data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadPlayerTransfers = async () => {
        if (!playerId) return;

        try {
            setLoadingTransfers(true);
            const { baseUrl } = getAPIConfig();
            const response = await fetch(`${baseUrl}/football/transfers?player=${playerId}`);
            const data = await response.json();

            if (data.status === 'SUCCESS' && data.response) {
                setTransfers(data.response);
            }
        } catch (err: any) {
            logger.warn('Failed to load transfers:', err);
        } finally {
            setLoadingTransfers(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadPlayerData(true), loadPlayerTransfers()]);
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

    const seasonYear = contextSeason ?? getFootballSeasonYear();
    const leagueStats = useMemo(
        () =>
            player
                ? getPlayerLeagueStats(player.statistics as PlayerStatRow[], {
                      season: seasonYear,
                      teamId: contextTeamId,
                  })
                : [],
        [player, seasonYear, contextTeamId],
    );
    const seasonTotals = useMemo(() => sumSeasonTotals(leagueStats), [leagueStats]);
    const primaryPosition = leagueStats[0]?.games?.position ?? null;
    const primaryTeam = leagueStats[0]?.team ?? (params.teamName ? { id: 0, name: params.teamName, logo: params.teamLogo || '' } : null);
    const teamColors = useMemo(
        () => getTeamColors(primaryTeam?.name || params.teamName || ''),
        [primaryTeam?.name, params.teamName],
    );
    const preferredFoot = player ? formatPreferredFoot(player.statistics, t.playerProfile) : null;
    const pp = t.playerProfile;

    if (loading && !player) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={ProfileTheme.colors.neonGreen} />
                <Text style={styles.loadingText}>{pp.loadingPlayer}</Text>
            </View>
        );
    }

    if (error || (!player && !loading)) {
        return (
            <View style={styles.errorContainer}>
                <StatusBar barStyle="light-content" />
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text style={styles.errorText}>{error || t.playerProfile.playerNotFound}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>{pp.goBack}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!player) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

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
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
                {/* Hero: photo + name */}
                <LinearGradient
                    colors={[teamColors[0], teamColors[1] || teamColors[0], ProfileTheme.colors.deepBlack]}
                    style={[styles.hero, { paddingTop: insets.top + 12 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.backButtonFloat}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <Animated.View
                        style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
                    >
                        <View style={styles.heroRow}>
                            <PlayerHeroPhoto
                                key={playerId}
                                playerId={playerId}
                                photo={player.player.photo ?? params.photo}
                                name={player.player.name}
                                position={primaryPosition}
                                colors={teamColors}
                            />

                            <View style={styles.heroInfo}>
                                <Text style={styles.playerName} numberOfLines={2}>{player.player.name}</Text>
                                {player.player.injured && (
                                    <View style={styles.injuredBadge}>
                                        <Ionicons name="medkit-outline" size={12} color="#fca5a5" />
                                        <Text style={styles.injuredText}>{pp.injured}</Text>
                                    </View>
                                )}
                                <View style={styles.playerSubInfo}>
                                    {player.player.nationality && (
                                        <Text style={styles.playerMeta}>{player.player.nationality}</Text>
                                    )}
                                    {player.player.age != null && player.player.age > 0 && (
                                        <>
                                            <Text style={styles.separator}>•</Text>
                                            <Text style={styles.playerMeta}>{player.player.age} {pp.years}</Text>
                                        </>
                                    )}
                                    {primaryPosition && (
                                        <>
                                            <Text style={styles.separator}>•</Text>
                                            <Text style={styles.playerMeta}>{primaryPosition}</Text>
                                        </>
                                    )}
                                </View>
                                {primaryTeam && (
                                    <View style={styles.heroTeamRow}>
                                        <TeamBadge
                                            name={primaryTeam.name}
                                            color={teamColors[0]}
                                            size={32}
                                            logo={teamLogoUrl(primaryTeam.id, primaryTeam.logo)}
                                        />
                                        <Text style={styles.heroTeamName} numberOfLines={1}>
                                            {getTeamDisplayName(primaryTeam.name, language)}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.seasonBadge}>
                                    {pp.seasonStats} {seasonYear}/{seasonYear + 1}
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                </LinearGradient>

                <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
                    {/* Season total summary */}
                    {leagueStats.length > 0 && (
                        <View style={styles.totalCard}>
                            <Text style={styles.totalTitle}>{pp.seasonTotal}</Text>
                            <View style={styles.totalRow}>
                                <MiniStat label={pp.matches} value={seasonTotals.appearences} accent={ProfileTheme.colors.neonBlue} />
                                <MiniStat label={pp.goals} value={seasonTotals.goals} accent={ProfileTheme.colors.neonGreen} />
                                <MiniStat label={pp.assists} value={seasonTotals.assists} accent={ProfileTheme.colors.neonPurple} />
                                <MiniStat
                                    label={pp.rating}
                                    value={seasonTotals.rating ? parseFloat(seasonTotals.rating).toFixed(1) : '—'}
                                    accent={ProfileTheme.colors.gold}
                                />
                            </View>
                        </View>
                    )}

                    {/* Per-league stats */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>{pp.competitions}</Text>
                        {leagueStats.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="stats-chart-outline" size={32} color={ProfileTheme.colors.textSecondary} />
                                <Text style={styles.emptyText}>{pp.noCompetitionStats}</Text>
                            </View>
                        ) : (
                            leagueStats.map((stat) => (
                                <LeagueStatCard
                                    key={`${stat.league.id}-${stat.league.season}-${stat.team.id}`}
                                    stat={stat}
                                    language={language}
                                    labels={pp}
                                    teamColor={teamColors[0]}
                                />
                            ))
                        )}
                    </View>

                    {/* Personal info */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>{pp.personalInfo}</Text>
                        <View style={styles.infoCardContainer}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoGridItem}>
                                    <Ionicons name="calendar-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>{pp.dateOfBirth}</Text>
                                    <Text style={styles.infoValue}>
                                        {player.player.birth?.date ? formatDate(player.player.birth.date, language) : 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.infoGridDivider} />
                                <View style={styles.infoGridItem}>
                                    <Ionicons name="location-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>{pp.birthPlace}</Text>
                                    <Text style={styles.infoValue}>{player.player.birth?.place || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.infoGridDividerHorizontal} />
                            <View style={styles.infoGrid}>
                                <View style={styles.infoGridItem}>
                                    <Ionicons name="resize-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>{pp.height}</Text>
                                    <Text style={styles.infoValue}>{player.player.height || 'N/A'}</Text>
                                </View>
                                <View style={styles.infoGridDivider} />
                                <View style={styles.infoGridItem}>
                                    <Ionicons name="barbell-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                    <Text style={styles.infoLabel}>{pp.weight}</Text>
                                    <Text style={styles.infoValue}>{player.player.weight || 'N/A'}</Text>
                                </View>
                            </View>
                            {(preferredFoot || leagueStats.some((s) => s.games.captain)) && (
                                <>
                                    <View style={styles.infoGridDividerHorizontal} />
                                    <View style={styles.infoGrid}>
                                        {preferredFoot && (
                                            <View style={styles.infoGridItem}>
                                                <Ionicons name="footsteps-outline" size={18} color={ProfileTheme.colors.textSecondary} />
                                                <Text style={styles.infoLabel}>{pp.preferredFoot}</Text>
                                                <Text style={styles.infoValue}>{preferredFoot}</Text>
                                            </View>
                                        )}
                                        {leagueStats.some((s) => s.games.captain) && (
                                            <>
                                                {preferredFoot && <View style={styles.infoGridDivider} />}
                                                <View style={styles.infoGridItem}>
                                                    <Ionicons name="star" size={18} color={ProfileTheme.colors.gold} />
                                                    <Text style={styles.infoLabel}>{pp.captain}</Text>
                                                    <Text style={[styles.infoValue, { color: ProfileTheme.colors.gold }]}>{pp.yes}</Text>
                                                </View>
                                            </>
                                        )}
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Transfers */}
                    {transfers.length > 0 && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>{pp.transfers}</Text>
                            {loadingTransfers ? (
                                <View style={styles.loadingContainerSmall}>
                                    <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
                                </View>
                            ) : (
                                <View style={styles.transfersContainer}>
                                    {transfers.map((transfer, index) => (
                                        <View key={index} style={styles.transferCard}>
                                            {transfer.transfers?.map((tr, tIndex) => (
                                                <View key={tIndex} style={styles.transferItem}>
                                                    <View style={styles.transferDateContainer}>
                                                        <Text style={styles.transferDate}>
                                                            {tr.date ? formatDate(tr.date, language) : 'N/A'}
                                                        </Text>
                                                        <Text style={styles.transferType}>
                                                            {formatTransferValue(tr.type, pp)}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.transferTeams}>
                                                        {tr.teams.out && (
                                                            <View style={styles.transferTeam}>
                                                                <TeamBadge
                                                                    name={tr.teams.out.name}
                                                                    color={teamColors[0]}
                                                                    size={32}
                                                                    logo={teamLogoUrl(tr.teams.out.id, tr.teams.out.logo)}
                                                                />
                                                                <Text style={styles.transferTeamName} numberOfLines={1}>
                                                                    {tr.teams.out.name}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        <Ionicons name="arrow-forward" size={20} color={ProfileTheme.colors.textSecondary} />
                                                        {tr.teams.in && (
                                                            <View style={styles.transferTeam}>
                                                                <TeamBadge
                                                                    name={tr.teams.in.name}
                                                                    color={teamColors[0]}
                                                                    size={32}
                                                                    logo={teamLogoUrl(tr.teams.in.id, tr.teams.in.logo)}
                                                                />
                                                                <Text style={styles.transferTeamName} numberOfLines={1}>
                                                                    {tr.teams.in.name}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </Animated.View>
            </ScrollView>
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
    loadingContainerSmall: {
        padding: 20,
        alignItems: 'center',
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
    hero: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    backButtonFloat: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    heroContent: {},
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    playerPhotoCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    playerPhotoImage: {
        width: '100%',
        height: '100%',
    },
    heroInfo: {
        flex: 1,
    },
    playerName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 6,
    },
    injuredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        backgroundColor: 'rgba(239,68,68,0.25)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.45)',
    },
    injuredText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fca5a5',
    },
    playerSubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 8,
    },
    playerMeta: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
    },
    separator: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    heroTeamRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    heroTeamName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
    },
    seasonBadge: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '500',
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    totalCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    totalTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: ProfileTheme.colors.textSecondary,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    totalRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        overflow: 'hidden',
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: ProfileTheme.colors.textPrimary,
        marginBottom: 14,
    },
    emptyCard: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
        gap: 10,
    },
    emptyText: {
        fontSize: 14,
        color: ProfileTheme.colors.textSecondary,
        textAlign: 'center',
    },
    infoCardContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoGridItem: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    infoGridDivider: {
        width: 1,
        height: '80%',
        backgroundColor: ProfileTheme.colors.border,
    },
    infoGridDividerHorizontal: {
        height: 1,
        width: '100%',
        backgroundColor: ProfileTheme.colors.border,
        marginVertical: 14,
    },
    infoLabel: {
        fontSize: 11,
        color: ProfileTheme.colors.textSecondary,
        textAlign: 'center',
    },
    infoValue: {
        fontSize: 15,
        color: ProfileTheme.colors.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    transfersContainer: {
        gap: 12,
    },
    transferCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.border,
    },
    transferItem: {
        gap: 12,
    },
    transferDateContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    transferDate: {
        fontSize: 14,
        color: ProfileTheme.colors.textSecondary,
    },
    transferType: {
        fontSize: 14,
        color: ProfileTheme.colors.neonGreen,
        fontWeight: '600',
    },
    transferTeams: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    transferTeam: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    transferTeamName: {
        flex: 1,
        fontSize: 14,
        color: ProfileTheme.colors.textPrimary,
        fontWeight: '500',
    },
});
