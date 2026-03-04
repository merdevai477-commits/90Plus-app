import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, RefreshControl, Modal, Dimensions, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import { logger } from '../../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import LeagueCenterHeader from './LeagueCenterHeader';
import DatePickerStrip from './DatePickerStrip';
import LeagueFilterChips, { DEFAULT_LEAGUES, LeagueChip } from './LeagueFilterChips';
import LiveGamesSection from './LiveGamesSection';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import AllLeaguesScreen from './AllLeaguesScreen';
import LeagueFilterModal from './LeagueFilterModal';
import { Match } from './matchCardUtils';
import { UserPrediction } from './GradientMatchCard';
import { filterMatches } from './filterUtils';
import { useLeagueCenterData } from './useLeagueCenterData';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';

// Re-export filter functions for backwards compatibility
export { filterMatchesByDate, filterMatchesByLeagues, filterMatches } from './filterUtils';

// الدوريات الخمس الكبرى
const TOP_5_LEAGUES = [39, 140, 78, 135, 61];

interface LeagueCenterScreenProps {
    initialMatches?: Match[];
    useApi?: boolean;
    showPredictions?: boolean;
    userPredictions?: { [matchId: string]: UserPrediction };
    onPredictionSubmit?: (matchId: string, prediction: UserPrediction) => void;
    onFavoritePress?: (matchId: string) => void;
    initialSelectedLeagues?: number[];
}

const LeagueCenterScreen: React.FC<LeagueCenterScreenProps> = ({
    initialMatches,
    useApi = true,
    showPredictions = false,
    userPredictions = {},
    onPredictionSubmit,
    onFavoritePress,
    initialSelectedLeagues = [],
}) => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { userId } = useAuth();

    // Predictions store
    const {
        userCoins,
        remainingPredictions,
        totalDailyPredictions,
        userPredictions: storePredictions,
        fetchUserData,
        fetchUserPredictions,
        submitPrediction,
    } = usePredictionsStore();

    // Fetch predictions data on mount
    useEffect(() => {
        if (userId) {
            fetchUserData(userId);
            fetchUserPredictions(userId);
        }
    }, [userId]);

    // State
    const [activeTab, setActiveTab] = useState<'matches' | 'predictions'>('matches');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [leagues] = useState<LeagueChip[]>(DEFAULT_LEAGUES);
    const [selectedLeagues, setSelectedLeagues] = useState<number[]>(initialSelectedLeagues);
    const [refreshing, setRefreshing] = useState(false);
    const [showAllLeagues, setShowAllLeagues] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Effect to handle navigation params (Deep linking to tabs)
    useEffect(() => {
        if (params.tab && (params.tab === 'matches' || params.tab === 'predictions')) {
            setActiveTab(params.tab as 'matches' | 'predictions');
        }
    }, [params.tab]);

    // Fetch data
    const { matches: apiMatches, loading, error, refetch } = useLeagueCenterData(selectedDate);
    const matches = initialMatches ?? apiMatches;

    // Sort matches by priority: favorite leagues → top 5 → alphabetically
    const sortedAndFilteredMatches = useMemo(() => {
        // 1. Filter by Date & League
        let filtered = filterMatches(matches, selectedDate, selectedLeagues);

        // 2. Filter by Tab Mode
        if (activeTab === 'predictions') {
            // For predictions, show upcoming matches or matches that haven't started.
            filtered = filtered.filter(m =>
                m.status === 'upcoming' ||
                m.status === 'NS' ||
                m.status === 'TBD'
            );
        }

        // Sort by priority
        return filtered.sort((a, b) => {
            const aLeagueId = a.league?.id || 0;
            const bLeagueId = b.league?.id || 0;

            // 1. Live matches first (Only for matches tab)
            if (activeTab === 'matches') {
                if (a.status === 'live' && b.status !== 'live') return -1;
                if (b.status === 'live' && a.status !== 'live') return 1;
            }

            // 2. User's favorite leagues
            const aIsFavorite = selectedLeagues.includes(aLeagueId);
            const bIsFavorite = selectedLeagues.includes(bLeagueId);
            if (aIsFavorite && !bIsFavorite) return -1;
            if (bIsFavorite && !aIsFavorite) return 1;

            // 3. Top 5 leagues
            const aIsTop5 = TOP_5_LEAGUES.includes(aLeagueId);
            const bIsTop5 = TOP_5_LEAGUES.includes(bLeagueId);
            if (aIsTop5 && !bIsTop5) return -1;
            if (bIsTop5 && !aIsTop5) return 1;

            // 4. Alphabetically by league name
            const aName = a.league?.name || '';
            const bName = b.league?.name || '';
            return aName.localeCompare(bName);
        });
    }, [matches, selectedDate, selectedLeagues, activeTab]);

    // Handle prediction submission - calls backend API
    // ✅ IMPROVED: Optimistic update - update UI immediately
    const handlePredictionSubmit = useCallback(async (matchId: string, prediction: any) => {
        if (!userId) {
            logger.error('User not authenticated');
            return;
        }

        // Find match info for the prediction
        const match = matches.find(m => m.id === matchId);
        if (!match) return;

        // ✅ Optimistic update - save previous state for rollback
        const previousState = {
            userPredictions: { ...storePredictions },
            userCoins: usePredictionsStore.getState().userCoins,
            remainingPredictions: usePredictionsStore.getState().remainingPredictions,
        };

        // ✅ Update store immediately (optimistic)
        usePredictionsStore.setState(state => ({
            userPredictions: {
                ...state.userPredictions,
                [matchId]: {
                    id: `temp_${matchId}`,
                    prediction: {
                        type: prediction.type,
                        homeScore: prediction.homeScore || 0,
                        awayScore: prediction.awayScore || 0,
                    },
                    coinsSpent: 5,
                    createdAt: new Date().toISOString(),
                },
            },
            userCoins: Math.max(0, state.userCoins - 5),
            remainingPredictions: Math.max(0, state.remainingPredictions - 1),
        }));

        try {
            const result = await submitPrediction(
                userId,
                parseInt(matchId),
                { type: prediction.type },
                {
                    homeTeam: match.homeTeam.name,
                    awayTeam: match.awayTeam.name,
                    homeTeamLogo: match.homeTeam.logo,
                    awayTeamLogo: match.awayTeam.logo,
                    matchDate: match.fixtureDate,
                    leagueName: match.league?.name,
                }
            );

            if (!result.success) {
                // ✅ Rollback on error
                usePredictionsStore.setState({
                    userPredictions: previousState.userPredictions,
                    userCoins: previousState.userCoins,
                    remainingPredictions: previousState.remainingPredictions,
                });
                Alert.alert('خطأ', result.error || 'فشل في حفظ التوقعات');
            }
        } catch (error) {
            // ✅ Rollback on error
            usePredictionsStore.setState({
                userPredictions: previousState.userPredictions,
                userCoins: previousState.userCoins,
                remainingPredictions: previousState.remainingPredictions,
            });
            logger.error('Prediction error:', error);
            Alert.alert('خطأ', 'حدث خطأ أثناء حفظ التوقعات');
        }
    }, [userId, matches, submitPrediction, storePredictions]);

    // Handlers
    const handleFilterPress = useCallback(() => {
        setShowFilterModal(true);
    }, []);

    const handleFilterSave = useCallback((leagues: number[]) => {
        setSelectedLeagues(leagues);
    }, []);

    const handleDateSelect = useCallback((date: Date) => {
        setSelectedDate(date);
    }, []);

    const handleLeagueToggle = useCallback((leagueId: number) => {
        setSelectedLeagues((prev) => {
            if (prev.includes(leagueId)) {
                return prev.filter((id) => id !== leagueId);
            }
            return [...prev, leagueId];
        });
    }, []);

    const handleSeeAllPress = useCallback(() => {
        setShowAllLeagues(true);
    }, []);

    const handleLeagueSelect = useCallback((leagueId: number) => {
        setSelectedLeagues([leagueId]);
        setShowAllLeagues(false);
    }, []);

    const handleMatchPress = useCallback(
        (matchId: string) => {
            const match = matches.find((m) => m.id === matchId);
            if (match) {
                router.push({
                    pathname: '/(tabs)/match-details',
                    params: {
                        fixtureId: matchId,
                        homeTeam: match.homeTeam.name,
                        awayTeam: match.awayTeam.name,
                        homeLogo: match.homeTeam.logo,
                        awayLogo: match.awayTeam.logo,
                        homeScore: match.score.home?.toString() || '',
                        awayScore: match.score.away?.toString() || '',
                        league: match.league?.name || '',
                        leagueLogo: match.league?.logo || '',
                        date: match.fixtureDate || '',
                        time: match.time || '',
                        status: match.status,
                    },
                });
            }
        },
        [router, matches]
    );

    const handleRetry = useCallback(() => {
        refetch();
    }, [refetch]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    // Render content
    const renderContent = () => {
        if (loading && !refreshing && matches.length === 0) {
            return <LoadingState skeletonCount={3} />;
        }

        if (error && matches.length === 0) {
            return <ErrorState error={error} onRetry={handleRetry} />;
        }

        if (!loading && sortedAndFilteredMatches.length === 0) {
            return (
                <EmptyState
                    title={activeTab === 'predictions' ? "No Matches to Predict" : "لا توجد مباريات"}
                    subtitle={activeTab === 'predictions' ? "Try selecting a future date" : "جرب اختيار تاريخ أو دوري مختلف"}
                />
            );
        }

        // Transform store predictions to match GradientMatchCard format
        const transformedPredictions = Object.entries(storePredictions).reduce((acc, [matchId, pred]: [string, any]) => {
            acc[matchId] = {
                type: pred.prediction?.type || pred.type,
                points: pred.coinsSpent || 5,
            };
            return acc;
        }, {} as { [key: string]: any });

        return (
            <LiveGamesSection
                matches={sortedAndFilteredMatches}
                onSeeAllPress={handleSeeAllPress}
                onMatchPress={handleMatchPress}
                onFavoritePress={onFavoritePress}
                showPredictions={activeTab === 'predictions'}
                userPredictions={transformedPredictions}
                onPredictionSubmit={handlePredictionSubmit}
            />
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Background */}
            <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                    colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.blob, styles.blob1]} />
                <View style={[styles.blob, styles.blob2]} />
                <View style={[styles.blob, styles.blob3]} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 20 },
                ]}
                stickyHeaderIndices={[0]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#8B5CF6"
                        colors={['#8B5CF6']}
                    />
                }
            >
                {/* Header with Filter Button */}
                <LeagueCenterHeader
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onFilterPress={handleFilterPress}
                    filterCount={selectedLeagues.length}
                    matchCount={sortedAndFilteredMatches.length}
                    leagueCount={new Set(sortedAndFilteredMatches.map(m => m.league?.id)).size}
                    userCoins={userCoins}
                    remainingPredictions={remainingPredictions}
                    totalPredictions={totalDailyPredictions}
                />

                {/* Date Picker */}
                <DatePickerStrip
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                />

                {/* League Filter Chips */}
                <LeagueFilterChips
                    leagues={leagues}
                    selectedLeagues={selectedLeagues}
                    onLeagueToggle={handleLeagueToggle}
                />

                {/* Content */}
                <View style={styles.contentWrapper}>
                    {renderContent()}
                </View>
            </ScrollView>

            {/* Filter Modal */}
            <LeagueFilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                selectedLeagues={selectedLeagues}
                onSave={handleFilterSave}
            />

            {/* All Leagues Modal */}
            <Modal
                visible={showAllLeagues}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowAllLeagues(false)}
            >
                <AllLeaguesScreen
                    onLeagueSelect={handleLeagueSelect}
                    onClose={() => setShowAllLeagues(false)}
                />
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    contentWrapper: {
        flex: 1,
        paddingHorizontal: 16,
    },
    blob: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.15,
    },
    blob1: {
        top: -50,
        right: -100,
        backgroundColor: '#8B5CF6',
    },
    blob2: {
        bottom: 200,
        left: -150,
        backgroundColor: '#32cd32',
    },
    blob3: {
        top: 300,
        left: 200,
        backgroundColor: '#6366f1',
        width: 200,
        height: 200,
    },
});

export default LeagueCenterScreen;
