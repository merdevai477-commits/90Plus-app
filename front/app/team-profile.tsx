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
    FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiFootballService, { Injury, Trophy, Coach } from '../services/apiFootball';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName } from '../utils/i18nHelpers';
import { useHaptic } from '../hooks/useHaptic';

const { width, height } = Dimensions.get('window');

// Cache keys
const TEAM_CACHE_PREFIX = 'team_cache_';
const SQUAD_CACHE_PREFIX = 'squad_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface TeamParams {
    id: string;
    name?: string;
    logo?: string;
}

// Team colors mapping (reusing from player-profile)
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
    'default': ['#1a1a2e', '#16213e'],
};

const getTeamColors = (teamName: string): string[] => {
    if (!teamName) return TEAM_COLORS.default;
    for (const [team, colors] of Object.entries(TEAM_COLORS)) {
        if (teamName.toLowerCase().includes(team.toLowerCase())) {
            return colors;
        }
    }
    return TEAM_COLORS.default;
};

export default function TeamProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as TeamParams;
    const { t, language } = useTranslation();
    const { trigger } = useHaptic();

    const [team, setTeam] = useState<any | null>(null);
    const [squad, setSquad] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'squad' | 'statistics' | 'injuries' | 'matches' | 'trophies' | 'coaches'>('squad');
    
    // New features data
    const [statistics, setStatistics] = useState<any | null>(null);
    const [injuries, setInjuries] = useState<Injury[]>([]);
    const [teamMatches, setTeamMatches] = useState<{ live: any[]; upcoming: any[]; finished: any[] }>({ live: [], upcoming: [], finished: [] });
    const [trophies, setTrophies] = useState<Trophy[]>([]);
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [loadingFeatures, setLoadingFeatures] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const teamId = parseInt(params.id || '0');
    const teamName = params.name || team?.team?.name || '';
    const teamColors = getTeamColors(teamName);

    useEffect(() => {
        loadData();

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [teamId]);

    const loadData = async () => {
        if (!teamId) {
            setError('Invalid team ID');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch team info and squad in parallel
            const [teamData, squadData] = await Promise.all([
                getTeamInfo(teamId),
                getSquadInfo(teamId)
            ]);

            if (teamData) {
                setTeam(teamData);
                setSquad(squadData || []);
                // Load additional features in background
                loadAdditionalFeatures(teamId, teamData);
            } else {
                setError('Team not found');
            }
        } catch (err: any) {
            console.error('Failed to load team data:', err);
            setError('Failed to load team details');
        } finally {
            setLoading(false);
        }
    };

    const loadAdditionalFeatures = async (id: number, teamData: any) => {
        try {
            setLoadingFeatures(true);
            
            // Get primary league from team data if available
            const primaryLeague = teamData?.team?.id ? null : null; // Will need league ID from team data
            
            // Load all features in parallel
            const [injuriesData, matchesData, trophiesData, coachesData] = await Promise.allSettled([
                ApiFootballService.getTeamInjuries(id),
                ApiFootballService.getTeamMatches(id, 10),
                ApiFootballService.getTeamTrophies(id),
                ApiFootballService.getTeamCoaches(id),
            ]);

            if (injuriesData.status === 'fulfilled') setInjuries(injuriesData.value);
            if (matchesData.status === 'fulfilled') setTeamMatches(matchesData.value);
            if (trophiesData.status === 'fulfilled') setTrophies(trophiesData.value);
            if (coachesData.status === 'fulfilled') setCoaches(coachesData.value);
        } catch (err) {
            console.error('Failed to load additional features:', err);
        } finally {
            setLoadingFeatures(false);
        }
    };

    const loadStatistics = async (leagueId?: number, season: number = 2024) => {
        if (!teamId || statistics) return; // Already loaded or no team ID
        if (!leagueId) return; // Need league ID
        
        try {
            const stats = await ApiFootballService.getTeamStatistics(teamId, leagueId, season);
            setStatistics(stats);
        } catch (err) {
            console.error('Failed to load statistics:', err);
        }
    };

    const getTeamInfo = async (id: number) => {
        const cacheKey = `${TEAM_CACHE_PREFIX}${id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) return data;
        }

        const data = await ApiFootballService.getTeamById(id);
        if (data && data.length > 0) {
            await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: data[0], timestamp: Date.now() }));
            return data[0];
        }
        return null;
    };

    const getSquadInfo = async (id: number) => {
        const cacheKey = `${SQUAD_CACHE_PREFIX}${id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) return data;
        }

        const data = await ApiFootballService.getTeamSquad(id);
        if (data && data.length > 0) {
            // API-Football returns { team: {}, players: [] } for squad
            const players = data[0].players || [];
            await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: players, timestamp: Date.now() }));
            return players;
        }
        return [];
    };

    const handlePlayerPress = (player: any) => {
        trigger('light');
        router.push({
            pathname: '/player-profile',
            params: {
                id: player.id,
                name: player.name,
                photo: player.photo,
                teamName: team?.team?.name,
                teamLogo: team?.team?.logo
            }
        } as any);
    };

    const renderSquad = () => (
        <View style={styles.tabContentInner}>
            <View style={styles.headerSection}>
                <View style={styles.venueCard}>
                    <Ionicons name="business" size={24} color="#8B5CF6" />
                    <View style={styles.venueInfo}>
                        <Text style={styles.venueLabel}>{t.teamProfile?.stadium || 'Stadium'}</Text>
                        <Text style={styles.venueName}>{venue.name}</Text>
                        <Text style={styles.venueCity}>{venue.city} • {venue.capacity?.toLocaleString()} {t.teamProfile?.capacity || 'capacity'}</Text>
                    </View>
                </View>
                <Text style={styles.sectionTitle}>{t.teamProfile?.squadList || 'Squad List'}</Text>
            </View>
            {squad.length > 0 ? (
                squad.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.playerItem}
                        onPress={() => handlePlayerPress(item)}
                    >
                        <View style={styles.playerInfo}>
                            <View style={styles.playerNumberCircle}>
                                <Text style={styles.playerNumber}>{item.number || '-'}</Text>
                            </View>
                            <View>
                                <Text style={styles.playerName}>{item.name}</Text>
                                <Text style={styles.playerPosition}>{item.position}</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.2)" />
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptySquad}>
                    <Text style={styles.emptyText}>{t.teamProfile?.noSquadData || 'No squad data available'}</Text>
                </View>
            )}
        </View>
    );

    const renderStatistics = () => (
        <View style={styles.tabContentInner}>
            <Text style={styles.sectionTitle}>Team Statistics</Text>
            {loadingFeatures ? (
                <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
            ) : statistics ? (
                <View style={styles.statsContainer}>
                    {statistics.statistics?.map((stat: any, index: number) => (
                        <View key={index} style={styles.statRow}>
                            <Text style={styles.statLabel}>{stat.type}</Text>
                            <Text style={styles.statValue}>{stat.value}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptySquad}>
                    <Text style={styles.emptyText}>No statistics available</Text>
                </View>
            )}
        </View>
    );

    const renderInjuries = () => (
        <View style={styles.tabContentInner}>
            <Text style={styles.sectionTitle}>Injuries</Text>
            {loadingFeatures ? (
                <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
            ) : injuries.length > 0 ? (
                injuries.map((injury, index) => (
                    <View key={index} style={styles.injuryCard}>
                        <View style={styles.injuryHeader}>
                            <Image source={{ uri: injury.player.photo }} style={styles.injuryPlayerPhoto} />
                            <View style={styles.injuryInfo}>
                                <Text style={styles.injuryPlayerName}>{injury.player.name}</Text>
                                <Text style={styles.injuryType}>{injury.type}</Text>
                            </View>
                        </View>
                        {injury.reason && <Text style={styles.injuryReason}>{injury.reason}</Text>}
                    </View>
                ))
            ) : (
                <View style={styles.emptySquad}>
                    <Text style={styles.emptyText}>No injuries reported</Text>
                </View>
            )}
        </View>
    );

    const renderMatches = () => (
        <View style={styles.tabContentInner}>
            <Text style={styles.sectionTitle}>Team Matches</Text>
            {loadingFeatures ? (
                <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
            ) : (
                <>
                    {teamMatches.live.length > 0 && (
                        <>
                            <Text style={styles.subSectionTitle}>Live</Text>
                            {teamMatches.live.map((match: any) => renderMatchCard(match))}
                        </>
                    )}
                    {teamMatches.upcoming.length > 0 && (
                        <>
                            <Text style={styles.subSectionTitle}>Upcoming</Text>
                            {teamMatches.upcoming.map((match: any) => renderMatchCard(match))}
                        </>
                    )}
                    {teamMatches.finished.length > 0 && (
                        <>
                            <Text style={styles.subSectionTitle}>Finished</Text>
                            {teamMatches.finished.map((match: any) => renderMatchCard(match))}
                        </>
                    )}
                    {teamMatches.live.length === 0 && teamMatches.upcoming.length === 0 && teamMatches.finished.length === 0 && (
                        <View style={styles.emptySquad}>
                            <Text style={styles.emptyText}>No matches available</Text>
                        </View>
                    )}
                </>
            )}
        </View>
    );

    const renderMatchCard = (match: any) => (
        <TouchableOpacity
            key={match.fixture?.id}
            style={styles.matchCard}
            onPress={() => {
                if (match.fixture?.id) {
                    router.push({
                        pathname: '/(tabs)/match-details',
                        params: {
                            fixtureId: match.fixture.id.toString(),
                            homeTeam: match.teams?.home?.name || '',
                            awayTeam: match.teams?.away?.name || '',
                            homeLogo: match.teams?.home?.logo || '',
                            awayLogo: match.teams?.away?.logo || '',
                            homeScore: match.goals?.home?.toString() || '',
                            awayScore: match.goals?.away?.toString() || '',
                            league: match.league?.name || '',
                            date: match.fixture?.date || '',
                            status: match.fixture?.status?.short || '',
                        },
                    });
                }
            }}
        >
            <View style={styles.matchTeams}>
                <View style={styles.matchTeam}>
                    <Image source={{ uri: match.teams?.home?.logo }} style={styles.matchTeamLogo} />
                    <Text style={styles.matchTeamName} numberOfLines={2}>{getTeamDisplayName(match.teams?.home?.name, language)}</Text>
                </View>
                <Text style={styles.matchScore}>
                    {match.goals?.home ?? '-'} - {match.goals?.away ?? '-'}
                </Text>
                <View style={styles.matchTeam}>
                    <Image source={{ uri: match.teams?.away?.logo }} style={styles.matchTeamLogo} />
                    <Text style={styles.matchTeamName} numberOfLines={2}>{getTeamDisplayName(match.teams?.away?.name, language)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderTrophies = () => (
        <View style={styles.tabContentInner}>
            <Text style={styles.sectionTitle}>Trophies & Awards</Text>
            {loadingFeatures ? (
                <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
            ) : trophies.length > 0 ? (
                trophies.map((trophy, index) => (
                    <View key={index} style={styles.trophyCard}>
                        <Image source={{ uri: trophy.league.logo }} style={styles.trophyLogo} />
                        <View style={styles.trophyInfo}>
                            <Text style={styles.trophyName} numberOfLines={2}>{getLeagueDisplayName(trophy.league.name, language)}</Text>
                            <Text style={styles.trophySeason}>{trophy.season}</Text>
                            <Text style={styles.trophyPlace}>{trophy.place}</Text>
                        </View>
                    </View>
                ))
            ) : (
                <View style={styles.emptySquad}>
                    <Text style={styles.emptyText}>No trophies available</Text>
                </View>
            )}
        </View>
    );

    const renderCoaches = () => (
        <View style={styles.tabContentInner}>
            <Text style={styles.sectionTitle}>Coaches</Text>
            {loadingFeatures ? (
                <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
            ) : coaches.length > 0 ? (
                coaches.map((coach, index) => (
                    <View key={index} style={styles.coachCard}>
                        <Image source={{ uri: coach.photo }} style={styles.coachPhoto} />
                        <View style={styles.coachInfo}>
                            <Text style={styles.coachName}>{coach.name}</Text>
                            <Text style={styles.coachNationality}>{coach.nationality}</Text>
                            {coach.team && (
                                <View style={styles.coachTeam}>
                                    <Image source={{ uri: coach.team.logo }} style={styles.coachTeamLogo} />
                                    <Text style={styles.coachTeamName} numberOfLines={1}>{getTeamDisplayName(coach.team.name, language)}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))
            ) : (
                <View style={styles.emptySquad}>
                    <Text style={styles.emptyText}>No coaches available</Text>
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.loadingText}>{t.common.loading}</Text>
            </View>
        );
    }

    if (error || !team) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text style={styles.errorText}>{error || 'Team not found'}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>{t.common.retry}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { team: teamInfo, venue } = team;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Hero Section */}
            <LinearGradient
                colors={[teamColors[0], teamColors[1], '#0a0a0a']}
                style={styles.heroGradient}
            >
                <TouchableOpacity style={styles.backButtonFloat} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>

                <Animated.View style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <Image source={{ uri: teamInfo.logo }} style={styles.heroLogo} />
                    <Text style={styles.heroName} numberOfLines={2}>{getTeamDisplayName(teamInfo.name, language)}</Text>
                    <View style={styles.heroDetails}>
                        <Text style={styles.heroDetailText}>{teamInfo.country}</Text>
                        <Text style={styles.separator}>•</Text>
                        <Text style={styles.heroDetailText}>Est. {teamInfo.founded || 'N/A'}</Text>
                    </View>
                </Animated.View>
            </LinearGradient>

            {/* Content */}
            <Animated.View style={[styles.infoCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                        {[
                            { key: 'squad', label: 'Squad', icon: 'people' },
                            { key: 'statistics', label: 'Statistics', icon: 'stats-chart' },
                            { key: 'injuries', label: 'Injuries', icon: 'medical' },
                            { key: 'matches', label: 'Matches', icon: 'football' },
                            { key: 'trophies', label: 'Trophies', icon: 'trophy' },
                            { key: 'coaches', label: 'Coaches', icon: 'person' },
                        ].map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                                onPress={() => setActiveTab(tab.key as any)}
                            >
                                <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? '#fff' : '#888'} />
                                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Tab Content */}
                <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                    {activeTab === 'squad' && renderSquad()}
                    {activeTab === 'statistics' && renderStatistics()}
                    {activeTab === 'injuries' && renderInjuries()}
                    {activeTab === 'matches' && renderMatches()}
                    {activeTab === 'trophies' && renderTrophies()}
                    {activeTab === 'coaches' && renderCoaches()}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
    },
    loadingText: {
        color: '#888',
        marginTop: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        padding: 20,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
    },
    backButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#8B5CF6',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    heroGradient: {
        height: height * 0.35,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    backButtonFloat: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    heroContent: {
        alignItems: 'center',
    },
    heroLogo: {
        width: 100,
        height: 100,
        marginBottom: 16,
    },
    heroName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    heroDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    heroDetailText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
    separator: {
        color: 'rgba(255,255,255,0.4)',
        marginHorizontal: 8,
    },
    infoCard: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
        overflow: 'hidden',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    headerSection: {
        marginVertical: 24,
    },
    venueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    venueInfo: {
        marginLeft: 16,
        flex: 1,
    },
    venueLabel: {
        color: '#8B5CF6',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    venueName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 2,
    },
    venueCity: {
        color: '#888',
        fontSize: 13,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playerNumberCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    playerNumber: {
        color: '#8B5CF6',
        fontSize: 14,
        fontWeight: 'bold',
    },
    playerName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    playerPosition: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    emptySquad: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },
    tabsContainer: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 12,
    },
    tabsScroll: {
        paddingHorizontal: 20,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginRight: 8,
        gap: 6,
    },
    activeTab: {
        backgroundColor: '#8B5CF6',
    },
    tabText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#fff',
    },
    tabContent: {
        flex: 1,
    },
    tabContentInner: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    loader: {
        marginVertical: 40,
    },
    statsContainer: {
        gap: 12,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
    },
    statLabel: {
        color: '#888',
        fontSize: 14,
    },
    statValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    injuryCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    injuryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    injuryPlayerPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    injuryInfo: {
        flex: 1,
    },
    injuryPlayerName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    injuryType: {
        color: '#ef4444',
        fontSize: 14,
        marginTop: 4,
    },
    injuryReason: {
        color: '#888',
        fontSize: 13,
        marginTop: 8,
    },
    subSectionTitle: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 12,
    },
    matchCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    matchTeams: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    matchTeam: {
        flex: 1,
        alignItems: 'center',
    },
    matchTeamLogo: {
        width: 40,
        height: 40,
        marginBottom: 8,
    },
    matchTeamName: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
    },
    matchScore: {
        color: '#8B5CF6',
        fontSize: 18,
        fontWeight: 'bold',
        marginHorizontal: 16,
    },
    trophyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    trophyLogo: {
        width: 60,
        height: 60,
        marginRight: 16,
    },
    trophyInfo: {
        flex: 1,
    },
    trophyName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    trophySeason: {
        color: '#888',
        fontSize: 14,
        marginTop: 4,
    },
    trophyPlace: {
        color: '#8B5CF6',
        fontSize: 14,
        marginTop: 4,
    },
    coachCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    coachPhoto: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16,
    },
    coachInfo: {
        flex: 1,
    },
    coachName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    coachNationality: {
        color: '#888',
        fontSize: 14,
        marginTop: 4,
    },
    coachTeam: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    coachTeamLogo: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    coachTeamName: {
        color: '#8B5CF6',
        fontSize: 14,
    },
});
