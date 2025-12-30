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
import ApiFootballService from '../services/apiFootball';
import { useTranslation } from '../src/i18n';
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
    const { t } = useTranslation();
    const { trigger } = useHaptic();

    const [team, setTeam] = useState<any | null>(null);
    const [squad, setSquad] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    <Text style={styles.heroName}>{teamInfo.name}</Text>
                    <View style={styles.heroDetails}>
                        <Text style={styles.heroDetailText}>{teamInfo.country}</Text>
                        <Text style={styles.separator}>•</Text>
                        <Text style={styles.heroDetailText}>Est. {teamInfo.founded || 'N/A'}</Text>
                    </View>
                </Animated.View>
            </LinearGradient>

            {/* Content */}
            <Animated.View style={[styles.infoCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <FlatList
                    data={squad}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={styles.headerSection}>
                            {/* Venue Info */}
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
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
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
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptySquad}>
                            <Text style={styles.emptyText}>{t.teamProfile?.noSquadData || 'No squad data available'}</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                />
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
});
