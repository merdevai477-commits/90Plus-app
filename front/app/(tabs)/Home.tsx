import React, {
    useState,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
    ScrollView,
    View,
    RefreshControl,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    withDelay,
    Easing,
} from 'react-native-reanimated';

import {
    HomeHeader,
    HOME_HEADER_BODY_HEIGHT,
    HomeHero,
    MatchList,
    VideoList,
    PlayerList,
    TeamPitch,
    ScreenSection,
} from '../../components/home';
import AdvancedSearchBar, { SearchResult } from '../../components/common/AdvancedSearchBar';
import LuckyWheelModal from '../../components/common/LuckyWheelModal';
import { useHomeStore } from '../../src/store/home.store';
import { BG_BASE, BG_MID, BG_SURFACE } from '../../constants/tokens';
import { useMatchEventsMonitor } from '../../src/hooks/useMatchEventsMonitor';
import { globalState } from '../../globalState';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';
import { getDailyQuizStatus, DailyQuizStatus } from '../../services/quizApi';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import { ProfileCompletionService } from '../../services/profileCompletion.service';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { AuthService } from '../../src/services/authService';

const API_URL = getApiUrl();

// ─── Animated Ambient Glow Orbs (background atmosphere) ──────────────────────
function AmbientGlow() {
    const { width } = useWindowDimensions();

    const orb1Opacity = useSharedValue(0.15);
    const orb1Scale = useSharedValue(0.9);
    const orb2Opacity = useSharedValue(0.1);
    const orb2Scale = useSharedValue(0.85);
    const orb3Opacity = useSharedValue(0.08);
    const orb3Scale = useSharedValue(1.0);

    useEffect(() => {
        orb1Opacity.value = withRepeat(
            withTiming(0.22, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
        orb1Scale.value = withRepeat(
            withTiming(1.06, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
        orb2Opacity.value = withDelay(
            1500,
            withRepeat(
                withTiming(0.14, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            ),
        );
        orb2Scale.value = withDelay(
            1500,
            withRepeat(
                withTiming(1.06, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            ),
        );
        orb3Opacity.value = withDelay(
            800,
            withRepeat(
                withTiming(0.12, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            ),
        );
        orb3Scale.value = withDelay(
            800,
            withRepeat(
                withTiming(1.06, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            ),
        );
    }, []);

    const orb1Style = useAnimatedStyle(() => ({
        opacity: orb1Opacity.value,
        transform: [{ scale: orb1Scale.value }],
    }));
    const orb2Style = useAnimatedStyle(() => ({
        opacity: orb2Opacity.value,
        transform: [{ scale: orb2Scale.value }],
    }));
    const orb3Style = useAnimatedStyle(() => ({
        opacity: orb3Opacity.value,
        transform: [{ scale: orb3Scale.value }],
    }));

    return (
        <>
            <Animated.View
                pointerEvents="none"
                style={[styles.orb, styles.orb1, { left: width / 2 - 175 }, orb1Style]}
            />
            <Animated.View pointerEvents="none" style={[styles.orb, styles.orb2, orb2Style]} />
            <Animated.View pointerEvents="none" style={[styles.orb, styles.orb3, orb3Style]} />
        </>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchVisible, setSearchVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userInfo, setUserInfo] = useState({
        username: '',
        avatar: null as string | null,
        loginStreak: 0,
        remainingPredictions: 5,
        rank: null as number | null,
        spinWheelAvailable: true,
        nextSpinTime: undefined as Date | undefined,
        dailyQuizStatus: null as DailyQuizStatus | null,
    });
    const [luckyWheelVisible, setLuckyWheelVisible] = useState(false);
    const isLoadingRef = useRef(false);

    // Open lucky wheel from push notification deep link
    const params = useLocalSearchParams<{ openLuckyWheel?: string }>();
    const openLuckyWheelHandledRef = useRef(false);
    useEffect(() => {
        if (params.openLuckyWheel === 'true' && !openLuckyWheelHandledRef.current) {
            openLuckyWheelHandledRef.current = true;
            setLuckyWheelVisible(true);
            router.setParams({ openLuckyWheel: undefined });
        }
    }, [params.openLuckyWheel]);

    const { isSignedIn, getToken } = useAuth();
    const { user } = useUser();

    const fetchSpinWheelStatus = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) return;
            const response = await fetch(`${API_URL}/daily-spin/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (data.status === 'SUCCESS') {
                setUserInfo((prev) => ({
                    ...prev,
                    spinWheelAvailable: data.data.canSpin,
                    nextSpinTime:
                        !data.data.canSpin && data.data.timeRemaining
                            ? new Date(
                                  Date.now() +
                                      data.data.timeRemaining.hours * 3600000 +
                                      data.data.timeRemaining.minutes * 60000,
                              )
                            : undefined,
                }));
            }
        } catch (error) {
            logger.error('Error fetching spin status:', error);
        }
    }, [getToken]);

    const fetchDailyQuizStatus = useCallback(async () => {
        try {
            if (!getToken) return;
            const status = await getDailyQuizStatus(getToken);
            setUserInfo((prev) => ({ ...prev, dailyQuizStatus: status }));
        } catch (error) {
            logger.error('Error fetching daily quiz status:', error);
        }
    }, [getToken]);

    const fetchUserRank = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token || !isSignedIn) return;
            const response = await fetch(`${API_URL}/reels/rankings/user-rank`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'SUCCESS' && data.data) {
                    const rank =
                        data.data.views ||
                        data.data.shares ||
                        data.data.predictions ||
                        data.data.comments ||
                        null;
                    setUserInfo((prev) => ({ ...prev, rank }));
                }
            }
        } catch (error) {
            logger.error('Error fetching user rank:', error);
            setUserInfo((prev) => ({ ...prev, rank: null }));
        }
    }, [getToken, isSignedIn]);

    const fetchUserProfile = useCallback(async () => {
        const applyClerkHomeFallback = () => {
            if (!user) return;
            const emailUsername =
                user.primaryEmailAddress?.emailAddress
                    ?.split('@')[0]
                    ?.toLowerCase()
                    .replace(/[^a-z0-9_]/g, '') || '';
            const display =
                [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
                globalState.userProfile?.displayName ||
                globalState.userProfile?.username ||
                emailUsername;

            setUserInfo((prev) => ({
                ...prev,
                username: display || prev.username,
                avatar:
                    user.imageUrl || user.externalAccounts?.[0]?.imageUrl || prev.avatar,
            }));
        };

        try {
            const token = await getToken();
            if (!token || !isSignedIn) return;

            try {
                const userData = await AuthService.syncUserWithBackend(token);
                setUserInfo((prev) => ({
                    ...prev,
                    username: userData.username || prev.username,
                    avatar: userData.avatar || prev.avatar,
                    loginStreak:
                        userData.consecutiveLoginDays !== undefined
                            ? userData.consecutiveLoginDays
                            : prev.loginStreak,
                }));
                if (userData.username && globalState.userProfile)
                    globalState.userProfile.username = userData.username;
                if (userData.avatar && globalState.userProfile)
                    globalState.userProfile.avatar = userData.avatar;
            } catch {
                applyClerkHomeFallback();
            }
        } catch (error) {
            logger.error('Error fetching user profile:', error);
            applyClerkHomeFallback();
        }
    }, [getToken, isSignedIn, user]);

    const preloadProfileData = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token || !isSignedIn) return;

            ProfileCompletionService.getCompletionStatus(token)
                .then((status) => {
                    if (status) {
                        cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000);
                    }
                })
                .catch(() => {});

            fetch(`${API_URL}/clerk/me`, { headers: { Authorization: `Bearer ${token}` } })
                .then(async (response) => {
                    if (response.ok) {
                        const data = await response.json();
                        if (data.status === 'SUCCESS' && data.data?.user) {
                            await cacheService.set(
                                CACHE_KEYS.PROFILE_DATA,
                                data.data.user,
                                5 * 60 * 1000,
                            );
                        }
                    }
                })
                .catch(() => {});
        } catch {
            // silent
        }
    }, [getToken, isSignedIn]);

    const {
        userMode,
        matches,
        videos,
        players,
        teamOfMonth,
        fetchHomeData,
        fetchRankingsData,
        setUserMode,
        toggleFavorite,
        loadingRankings,
    } = useHomeStore();

    const {
        remainingPredictions: predictionsRemaining,
        fetchUserData: fetchPredictionsData,
    } = usePredictionsStore();

    useEffect(() => {
        if (isSignedIn && user) {
            const email = user.primaryEmailAddress?.emailAddress || '';
            const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
            const displayUsername = globalState.userProfile?.username || emailUsername;
            setUserInfo((prev) => ({ ...prev, username: displayUsername }));

            if (!globalState.userProfile || globalState.userProfile.id !== user.id) {
                if (globalState.userProfile && globalState.userProfile.id !== user.id) {
                    globalState.setUserProfile(null);
                }
                if (!globalState.userProfile) {
                    globalState.username = emailUsername;
                    globalState.setUserProfile({
                        id: user.id,
                        username: emailUsername,
                        displayName:
                            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                            emailUsername,
                        avatar: user.imageUrl || undefined,
                        bio: undefined,
                        stats: {
                            views: 0,
                            likes: 0,
                            questionsSolved: 0,
                            rating: 0,
                            posts: 0,
                            predictions: 0,
                            interactions: 0,
                            level: 1,
                            followers: 0,
                            following: 0,
                            monthlyViews: 0,
                            yearlyViews: 0,
                            engagementRate: 0,
                            contentQuality: 0,
                        },
                        videos: [],
                        badges: [],
                        achievements: [],
                        socialStats: { followers: [], following: [] },
                        notifications: [],
                        isOwner: true,
                        isVerified: false,
                        isAppOwner: false,
                    });
                }
            }
        }
    }, [isSignedIn, user]);

    useMatchEventsMonitor();

    // Refs to avoid stale closures
    const fetchUserProfileRef = useRef(fetchUserProfile);
    const fetchSpinWheelStatusRef = useRef(fetchSpinWheelStatus);
    const fetchDailyQuizStatusRef = useRef(fetchDailyQuizStatus);
    const fetchUserRankRef = useRef(fetchUserRank);
    const fetchPredictionsDataRef = useRef(fetchPredictionsData);
    const fetchHomeDataRef = useRef(fetchHomeData);
    const fetchRankingsDataRef = useRef(fetchRankingsData);
    const preloadProfileDataRef = useRef(preloadProfileData);
    const getTokenRef = useRef(getToken);
    const setUserModeRef = useRef(setUserMode);
    const lastLoadTimeRef = useRef(0);
    const LOAD_THROTTLE_MS = 2500;

    useEffect(() => {
        fetchUserProfileRef.current = fetchUserProfile;
        fetchSpinWheelStatusRef.current = fetchSpinWheelStatus;
        fetchDailyQuizStatusRef.current = fetchDailyQuizStatus;
        fetchUserRankRef.current = fetchUserRank;
        fetchPredictionsDataRef.current = fetchPredictionsData;
        fetchHomeDataRef.current = fetchHomeData;
        fetchRankingsDataRef.current = fetchRankingsData;
        preloadProfileDataRef.current = preloadProfileData;
        getTokenRef.current = getToken;
        setUserModeRef.current = setUserMode;
    }, [
        fetchUserProfile,
        fetchSpinWheelStatus,
        fetchDailyQuizStatus,
        fetchUserRank,
        fetchPredictionsData,
        fetchHomeData,
        fetchRankingsData,
        preloadProfileData,
        getToken,
        setUserMode,
    ]);

    useLayoutEffect(() => {
        if (isSignedIn) setUserMode('user');
    }, [isSignedIn, setUserMode]);

    useEffect(() => {
        const shouldBeUser = Boolean(isSignedIn) || globalState.userType !== 'guest';
        if (shouldBeUser && userMode !== 'user') setUserMode('user');
        else if (!shouldBeUser && userMode !== 'guest') setUserMode('guest');
    }, [userMode, setUserMode, isSignedIn]);

    useEffect(() => {
        setUserInfo((prev) => ({ ...prev, remainingPredictions: predictionsRemaining }));
    }, [predictionsRemaining]);

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            if (now - lastLoadTimeRef.current < LOAD_THROTTLE_MS) return;
            if (isLoadingRef.current) return;

            isLoadingRef.current = true;
            lastLoadTimeRef.current = now;
            let isMounted = true;
            const abortController = new AbortController();

            const loadData = async () => {
                if (!isMounted || abortController.signal.aborted) return;
                try {
                    const token = await getTokenRef.current();
                    if (!token || abortController.signal.aborted) {
                        if (isMounted) isLoadingRef.current = false;
                        return;
                    }

                    const criticalPromises = [
                        fetchHomeDataRef.current(token).catch((err: any) => {
                            logger.error('Error fetching home data:', err);
                            return null;
                        }),
                        fetchUserProfileRef.current().catch((err: any) => {
                            logger.error('Error fetching user profile:', err);
                            return null;
                        }),
                    ];

                    const secondaryPromises = [
                        fetchRankingsDataRef.current(token).catch((err: any) => {
                            logger.error('Error fetching rankings:', err);
                            return null;
                        }),
                        fetchSpinWheelStatusRef.current().catch((err: any) => {
                            logger.error('Error fetching spin status:', err);
                            return null;
                        }),
                        fetchDailyQuizStatusRef.current().catch((err: any) => {
                            logger.error('Error fetching quiz status:', err);
                            return null;
                        }),
                        fetchPredictionsDataRef.current(token).catch((err: any) => {
                            logger.error('Error fetching predictions:', err);
                            return null;
                        }),
                        fetchUserRankRef.current().catch((err: any) => {
                            logger.error('Error fetching user rank:', err);
                            return null;
                        }),
                    ];

                    await Promise.all(criticalPromises);
                    Promise.all(secondaryPromises).catch(() => {});
                    preloadProfileDataRef.current().catch(() => {});
                } catch (error) {
                    logger.error('Error loading home screen data:', error);
                } finally {
                    if (isMounted && !abortController.signal.aborted) {
                        isLoadingRef.current = false;
                    }
                }
            };

            loadData();

            return () => {
                isMounted = false;
                abortController.abort();
                isLoadingRef.current = false;
            };
        }, []),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const token = await getToken();
            await Promise.all([
                fetchHomeDataRef.current(token).catch(() => null),
                fetchRankingsDataRef.current(token).catch(() => null),
                fetchUserProfileRef.current().catch(() => null),
            ]);
        } catch (error) {
            logger.error('Error refreshing home screen:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearchPress = useCallback(() => {
        setSearchVisible(true);
    }, []);

    const handleSearchResult = (_result: SearchResult) => {
        setSearchVisible(false);
    };

    const handleMatchPress = useCallback(
        (matchId: string) => {
            const match = matches.find((m: any) => m.id === matchId);
            if (!match) return;
            router.push({
                pathname: '/(tabs)/match-details',
                params: {
                    fixtureId: String(match.fixtureId),
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    homeLogo: match.homeLogo || '',
                    awayLogo: match.awayLogo || '',
                    homeScore: match.homeScore?.toString() || '',
                    awayScore: match.awayScore?.toString() || '',
                    league: match.league,
                    leagueLogo: '',
                    date: new Date().toISOString().split('T')[0],
                    time: match.time,
                    status: match.isLive ? 'live' : 'upcoming',
                },
            });
        },
        [matches, router],
    );

    const handleFavoritePress = useCallback(
        async (matchId: string) => {
            const token = await getToken();
            await toggleFavorite(matchId, token);
        },
        [getToken, toggleFavorite],
    );

    const displayMatches = useMemo(() => matches.slice(0, 3), [matches]);

    // ─── Adapters: store shape → design component shape ──────────────────────
    const POSITION_COLOR: Record<string, string> = {
        ST: '#FF7A3D', CF: '#FF7A3D', LW: '#11998E', RW: '#F5576C',
        CM: '#8E54E9', DM: '#8E54E9', AM: '#A855F7',
        LB: '#60A5FA', RB: '#60A5FA', CB: '#3B82F6', GK: '#FFD700',
    };

    const designMatches = useMemo(
        () =>
            displayMatches.map((m) => ({
                id: m.id,
                homeTeam: {
                    name: m.homeTeam,
                    shortName: m.homeTeam,
                    score: m.homeScore ?? 0,
                },
                awayTeam: {
                    name: m.awayTeam,
                    shortName: m.awayTeam,
                    score: m.awayScore ?? 0,
                },
                status: (m.isLive
                    ? 'LIVE'
                    : m.homeScore !== undefined && m.awayScore !== undefined
                      ? 'FT'
                      : 'UPCOMING') as 'LIVE' | '1ST' | '2ND' | 'HT' | 'FT' | 'UPCOMING',
                minute: m.minute,
                league: m.league,
                kickoff: m.time,
            })),
        [displayMatches],
    );

    const designVideos = useMemo(
        () =>
            videos.map((v) => ({
                id: v.id,
                title: v.title,
                views: v.views,
                likes: v.likes,
                thumbnail: v.thumbnail,
            })),
        [videos],
    );

    const designPlayers = useMemo(
        () =>
            players.map((p, idx) => {
                const pos = (p.position || 'CM').toUpperCase();
                const color = POSITION_COLOR[pos] ?? '#8E54E9';
                return {
                    id: idx + 1,
                    name: p.name,
                    team: p.team,
                    country: '',
                    position: pos,
                    positionColor: color,
                    weeklyRating: p.rating ? p.rating.toFixed(2) : '—',
                    overallRating: p.rating ? p.rating.toFixed(1) : '—',
                    borderColor: color,
                    photoUri: p.image,
                    username: p.username,
                };
            }),
        [players],
    );

    const designPitchPlayers = useMemo(() => {
        const positions = [
            { x: -1, y: 40 }, { x: 24, y: 1 }, { x: 14, y: 23 }, { x: 14, y: 56 },
            { x: 25, y: 75 }, { x: 40, y: 46 }, { x: 54, y: 23 }, { x: 54, y: 64 },
            { x: 82, y: 10 }, { x: 88, y: 45 }, { x: 82, y: 80 },
        ];
        return teamOfMonth.slice(0, 11).map((p, i) => ({
            name: p.name,
            short: (p.name || '??').slice(0, 3).toUpperCase(),
            rating: Math.round((p.rating ?? 80) * 10) / 10,
            position: p.position || 'CM',
            x: positions[i]?.x ?? 50,
            y: positions[i]?.y ?? 50,
            username: p.username,
        }));
    }, [teamOfMonth]);

    const NAV_BOTTOM_PADDING = Math.max(insets.bottom, 16) + 56 + 24;
    const headerOffset = insets.top + HOME_HEADER_BODY_HEIGHT + 2;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Base background gradient */}
            <LinearGradient
                colors={[BG_BASE, BG_MID, BG_SURFACE, BG_BASE]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
            />

            <AmbientGlow />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{
                    paddingTop: headerOffset + 14,
                    paddingBottom: NAV_BOTTOM_PADDING,
                }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#7C3AED"
                        colors={['#7C3AED']}
                        progressBackgroundColor="#0d0a14"
                    />
                }
            >
                <ScreenSection>
                    <HomeHero />
                </ScreenSection>

                <ScreenSection>
                    <MatchList
                        matches={designMatches}
                        onMatchPress={handleMatchPress}
                        onViewAllPress={useCallback(
                            () => router.navigate('/(tabs)/matches'),
                            [router],
                        )}
                        onFavoritePress={handleFavoritePress}
                        isLoading={matches.length === 0}
                    />
                </ScreenSection>

                <ScreenSection>
                    <VideoList
                        videos={designVideos}
                        onVideoPress={useCallback(
                            (videoId: string) =>
                                router.push({
                                    pathname: '/reels',
                                    params: { startFrom: videoId },
                                }),
                            [router],
                        )}
                        onViewAllPress={useCallback(() => router.push('/reels'), [router])}
                        isLoading={loadingRankings}
                    />
                </ScreenSection>

                <ScreenSection>
                    <PlayerList
                        players={designPlayers}
                        onPlayerPress={useCallback(
                            (player: any) => {
                                if (player.username) {
                                    router.push({
                                        pathname: '/user/[username]',
                                        params: { username: player.username },
                                    });
                                }
                            },
                            [router],
                        )}
                        onViewAllPress={useCallback(() => router.push('/rank'), [router])}
                        isLoading={loadingRankings}
                    />
                </ScreenSection>

                <ScreenSection>
                    <TeamPitch
                        players={designPitchPlayers}
                        onPlayerPress={useCallback(
                            (player: any) => {
                                if (player.username) {
                                    router.push({
                                        pathname: '/user/[username]',
                                        params: { username: player.username },
                                    });
                                }
                            },
                            [router],
                        )}
                        onDetailsPress={useCallback(() => router.push('/rank'), [router])}
                    />
                </ScreenSection>
            </ScrollView>

            <HomeHeader userName={userInfo.username} onSearchPress={handleSearchPress} />

            <AdvancedSearchBar
                visible={searchVisible}
                onClose={() => setSearchVisible(false)}
                onResultSelect={handleSearchResult}
            />

            <LuckyWheelModal
                visible={luckyWheelVisible}
                onClose={() => {
                    setLuckyWheelVisible(false);
                    fetchSpinWheelStatus();
                }}
                onCoinsWon={(coins, newBalance) => {
                    logger.log(`Won ${coins} coins! New balance: ${newBalance}`);
                    fetchSpinWheelStatus();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_BASE,
    },
    scroll: { flex: 1 },
    orb: {
        position: 'absolute',
        borderRadius: 999,
    },
    orb1: {
        width: 350,
        height: 350,
        top: -80,
        backgroundColor: 'rgba(76,29,149,0.28)',
    },
    orb2: {
        width: 280,
        height: 280,
        top: 200,
        right: -100,
        backgroundColor: 'rgba(59,130,246,0.18)',
    },
    orb3: {
        width: 250,
        height: 250,
        bottom: 200,
        left: -80,
        backgroundColor: 'rgba(91,33,182,0.14)',
    },
});
