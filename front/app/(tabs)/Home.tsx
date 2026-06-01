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
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

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
import type { MatchListItem } from '../../components/home/MatchList';
import AdvancedSearchBar, { SearchResult } from '../../components/common/AdvancedSearchBar';
import LuckyWheelModal from '../../components/common/LuckyWheelModal';
import { HomeSectionError } from '../../components/home/HomeSectionError';
import { useHomeStore } from '../../src/store/home.store';
import { APP_BG } from '../../constants/ui';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useHomeLikes } from '../../hooks/useHomeLikes';
import { globalState } from '../../globalState';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import { ProfileCompletionService } from '../../services/profileCompletion.service';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { AuthService } from '../../src/services/authService';
import { MatchSubscriptionsService } from '../../services/matchSubscriptions.service';
import { useScreenFont } from '../../utils/fontSetup';
import { useTranslation } from '../../src/i18n';
import { QuizApiService } from '../../services/quizApi.service';
import { dailyQuizQueryKey, todayQuizDateKey } from '../../utils/quizDateKey';

const API_URL = getApiUrl();

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
    useScreenFont();
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchVisible, setSearchVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userInfo, setUserInfo] = useState({
        username: '',
        avatar: null as string | null,
        loginStreak: 0,
        remainingPredictions: 10,
        rank: null as number | null,
        spinWheelAvailable: true,
        nextSpinTime: undefined as Date | undefined,
    });
    const [luckyWheelVisible, setLuckyWheelVisible] = useState(false);
    const isLoadingRef = useRef(false);

    // ── Network status ────────────────────────────────────────────────────────
    const { isOnline } = useNetworkStatus();

    // ── Per-section error states ──────────────────────────────────────────────
    const [matchesError, setMatchesError] = useState<string | null>(null);
    const [rankingsError, setRankingsError] = useState<string | null>(null);

    // ── Subscribed (pinned) fixture IDs ───────────────────────────────────────
    const [subscribedIds, setSubscribedIds] = useState<Set<number>>(new Set());

    // ── Persisted video likes ─────────────────────────────────────────────────
    const { user } = useUser();
    const { isSignedIn, getToken } = useAuth();
    const queryClient = useQueryClient();
    const quizPreloadDone = useRef(false);
    const { likedIds, toggleLike } = useHomeLikes(user?.id);

    // Open lucky wheel from push notification deep link
    const params = useLocalSearchParams<{ openLuckyWheel?: string }>();
    const openLuckyWheelHandledRef = useRef(false);
    useEffect(() => {
        if (params.openLuckyWheel === 'true' && !openLuckyWheelHandledRef.current) {
            openLuckyWheelHandledRef.current = true;
            setLuckyWheelVisible(true);
            router.setParams({ openLuckyWheel: undefined });
        }
    }, [params.openLuckyWheel, router]);


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

    // ── FIXED: fetchUserRank — returns the best rank across all categories ────
    // The backend returns { views, shares, predictions, comments } — each is
    // either a 1-10 rank or null. We pick the best (lowest number = best rank).
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
                    const { views, shares, predictions, comments, globalXpRank } = data.data as {
                        views: number | null;
                        shares: number | null;
                        predictions: number | null;
                        comments: number | null;
                        globalXpRank: number | null;
                    };
                    // Pick the best (lowest) rank across all categories, or null if none.
                    const candidates = [views, shares, predictions, comments, globalXpRank].filter(
                        (v): v is number => v !== null && v !== undefined,
                    );
                    const bestRank = candidates.length > 0 ? Math.min(...candidates) : null;

                    if (__DEV__ && bestRank === null) {
                        logger.warn(
                            '[Home] fetchUserRank: no rank found in any category. ' +
                            'Backend returned:', JSON.stringify(data.data),
                        );
                    }

                    setUserInfo((prev) => ({ ...prev, rank: bestRank }));
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

    const preloadQuizData = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token || !isSignedIn || quizPreloadDone.current) return;
            quizPreloadDone.current = true;
            
            const dateKey = todayQuizDateKey();

            queryClient.prefetchQuery({
                queryKey: dailyQuizQueryKey('ar', dateKey),
                queryFn: () => QuizApiService.fetchDaily(token, 'ar'),
                staleTime: 5 * 60 * 1000,
            }).catch(() => {});

            queryClient.prefetchQuery({
                queryKey: dailyQuizQueryKey('en', dateKey),
                queryFn: () => QuizApiService.fetchDaily(token, 'en'),
                staleTime: 5 * 60 * 1000,
            }).catch(() => {});
        } catch {
            // silent
        }
    }, [getToken, isSignedIn, queryClient]);

    // ── Fetch subscribed fixture IDs (pinned matches) ─────────────────────────
    const fetchSubscribedIds = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token || !isSignedIn) return;
            const ids = await MatchSubscriptionsService.listIds(token);
            setSubscribedIds(ids);
        } catch {
            // silent — bell state just won't show
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
        loadingMatches,
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

    // Refs to avoid stale closures in useFocusEffect
    const fetchUserProfileRef = useRef(fetchUserProfile);
    const fetchSpinWheelStatusRef = useRef(fetchSpinWheelStatus);
    const fetchUserRankRef = useRef(fetchUserRank);
    const fetchPredictionsDataRef = useRef(fetchPredictionsData);
    const fetchHomeDataRef = useRef(fetchHomeData);
    const fetchRankingsDataRef = useRef(fetchRankingsData);
    const preloadProfileDataRef = useRef(preloadProfileData);
    const preloadQuizDataRef = useRef(preloadQuizData);
    const fetchSubscribedIdsRef = useRef(fetchSubscribedIds);
    const getTokenRef = useRef(getToken);
    const setUserModeRef = useRef(setUserMode);
    const lastLoadTimeRef = useRef(0);
    const secondaryLoadedSessionRef = useRef(false);
    const LOAD_THROTTLE_MS = 2500;

    useEffect(() => {
        fetchUserProfileRef.current = fetchUserProfile;
        fetchSpinWheelStatusRef.current = fetchSpinWheelStatus;
        fetchUserRankRef.current = fetchUserRank;
        fetchPredictionsDataRef.current = fetchPredictionsData;
        fetchHomeDataRef.current = fetchHomeData;
        fetchRankingsDataRef.current = fetchRankingsData;
        preloadProfileDataRef.current = preloadProfileData;
        fetchSubscribedIdsRef.current = fetchSubscribedIds;
        getTokenRef.current = getToken;
        setUserModeRef.current = setUserMode;
    }, [
        fetchUserProfile,
        fetchSpinWheelStatus,
        fetchUserRank,
        fetchPredictionsData,
        fetchHomeData,
        fetchRankingsData,
        preloadProfileData,
        preloadQuizData,
        fetchSubscribedIds,
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
                    if (abortController.signal.aborted) {
                        if (isMounted) isLoadingRef.current = false;
                        return;
                    }

                    // Critical — matches load from cache without auth; rankings need token
                    const criticalPromises = [
                        fetchHomeDataRef.current(token ?? null).catch((err: unknown) => {
                            logger.error('Error fetching home data:', err);
                            if (isMounted) setMatchesError(String(err));
                            return null;
                        }),
                    ];

                    if (token) {
                        criticalPromises.push(
                            fetchUserProfileRef.current().catch((err: unknown) => {
                                logger.error('Error fetching user profile:', err);
                                return null;
                            }),
                        );
                    }

                    const secondaryPromises = token
                        ? [
                            fetchRankingsDataRef.current(token).catch((err: unknown) => {
                                logger.error('Error fetching rankings:', err);
                                if (isMounted) setRankingsError(String(err));
                                return null;
                            }),
                            fetchSpinWheelStatusRef.current().catch(() => null),
                            fetchPredictionsDataRef.current(token).catch(() => null),
                            fetchUserRankRef.current().catch(() => null),
                            fetchSubscribedIdsRef.current().catch(() => null),
                        ]
                        : [];

                    await Promise.all(criticalPromises);

                    if (!secondaryLoadedSessionRef.current) {
                        secondaryLoadedSessionRef.current = true;
                        Promise.all(secondaryPromises).catch(() => {});
                        preloadProfileDataRef.current().catch(() => {});
                        preloadQuizDataRef.current().catch(() => {});
                    }
                } catch (error) {
                    logger.error('Error loading home screen data:', error);
                } finally {
                    if (isMounted && !abortController.signal.aborted) {
                        isLoadingRef.current = false;
                    }
                }
            };

            void loadData();

            return () => {
                isMounted = false;
                abortController.abort();
                isLoadingRef.current = false;
            };
        }, []),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setMatchesError(null);
        setRankingsError(null);
        try {
            const token = await getToken();
            await Promise.all([
                fetchHomeDataRef.current(token).catch(() => null),
                fetchRankingsDataRef.current(token).catch(() => null),
                fetchUserProfileRef.current().catch(() => null),
                fetchSubscribedIdsRef.current().catch(() => null),
                fetchSpinWheelStatusRef.current().catch(() => null),
                fetchPredictionsDataRef.current(token).catch(() => null),
                fetchUserRankRef.current().catch(() => null),
            ]);
        } catch (error) {
            logger.error('Error refreshing home screen:', error);
        } finally {
            setRefreshing(false);
        }
    }, [getToken]);

    const handleSearchPress = useCallback(() => {
        setSearchVisible(true);
    }, []);

    const handleSearchResult = useCallback((_result: SearchResult) => {
        setSearchVisible(false);
    }, []);

    const handleSearchClose = useCallback(() => {
        setSearchVisible(false);
    }, []);

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
                    date: match.date || new Date().toISOString().split('T')[0],
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

    const handleViewAllMatches = useCallback(
        () => router.navigate('/(tabs)/matches'),
        [router],
    );

    const handleViewAllReels = useCallback(
        () => router.push('/reels'),
        [router],
    );

    const handleViewAllRank = useCallback(
        () => router.push('/rank'),
        [router],
    );

    const handleVideoPress = useCallback(
        (videoId: string) =>
            router.push({
                pathname: '/(tabs)/reels',
                params: { startFrom: videoId },
            }),
        [router],
    );

    const handlePlayerPress = useCallback(
        (player: any) => {
            if (player.username) {
                router.push({
                    pathname: '/user/[username]',
                    params: { username: player.username },
                });
            }
        },
        [router],
    );

    const handlePitchPlayerPress = useCallback(
        (player: any) => {
            if (player.username) {
                router.push({
                    pathname: '/user/[username]',
                    params: { username: player.username },
                });
            }
        },
        [router],
    );

    const handleLuckyWheelClose = useCallback(() => {
        setLuckyWheelVisible(false);
        void fetchSpinWheelStatus();
    }, [fetchSpinWheelStatus]);

    const handleLuckyWheelCoinsWon = useCallback(
        (coins: number, newBalance: number) => {
            logger.log(`Won ${coins} coins! New balance: ${newBalance}`);
            void fetchSpinWheelStatus();
        },
        [fetchSpinWheelStatus],
    );

    const displayMatches = useMemo(() => matches.slice(0, 3), [matches]);

    // ─── Adapters: store shape → design component shape ──────────────────────
    const POSITION_COLOR: Record<string, string> = {
        ST: '#FF7A3D', CF: '#FF7A3D', LW: '#11998E', RW: '#F5576C',
        CM: '#8E54E9', DM: '#8E54E9', AM: '#A855F7',
        LB: '#60A5FA', RB: '#60A5FA', CB: '#3B82F6', GK: '#FFD700',
    };

    const designMatches = useMemo<MatchListItem[]>(
        () =>
            displayMatches.map((m) => ({
                id: m.id,
                homeTeam: {
                    name: m.homeTeam,
                    shortName: m.homeTeam,
                    score: m.homeScore ?? 0,
                    logo: m.homeLogo,
                },
                awayTeam: {
                    name: m.awayTeam,
                    shortName: m.awayTeam,
                    score: m.awayScore ?? 0,
                    logo: m.awayLogo,
                },
                status: (m.isLive
                    ? 'LIVE'
                    : m.homeScore !== undefined && m.awayScore !== undefined
                      ? 'FT'
                      : 'UPCOMING') as MatchListItem['status'],
                minute: m.minute,
                league: m.league,
                kickoff: m.time,
                // Pinned = user subscribed to this fixture via bell
                isPinned: subscribedIds.has(m.fixtureId),
                isFavorited: m.isFavorited,
            })),
        [displayMatches, subscribedIds],
    );

    // Sort: pinned first, then live, then rest
    const sortedDesignMatches = useMemo<MatchListItem[]>(
        () =>
            [...designMatches].sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                const aLive = a.status === 'LIVE';
                const bLive = b.status === 'LIVE';
                if (aLive && !bLive) return -1;
                if (!aLive && bLive) return 1;
                return 0;
            }),
        [designMatches],
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
        () => {
            return players.map((p, idx) => {
                const pos = (p.position || 'CM').toUpperCase();
                const color = POSITION_COLOR[pos] ?? '#8E54E9';
                return {
                    id: idx + 1,
                    name: p.name,
                    team: p.team,
                    // The store stores the user's country flag emoji in `team`
                    // (see home.store.ts: `team: player.countryFlag || '🇪🇬'`).
                    country: p.team,
                    position: pos,
                    positionColor: color,
                    weeklyRating: p.rating ? p.rating.toFixed(2) : '—',
                    overallRating: p.rating ? p.rating.toFixed(1) : '—',
                    borderColor: color,
                    photoUri: p.image,
                    username: p.username,
                };
            });
        },
        [players],
    );

    const designPitchPlayers = useMemo(() => {
        const seen = new Set<string>();
        const unique: typeof teamOfMonth = [];
        for (const p of teamOfMonth) {
            const key = p.id || p.username;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            unique.push(p);
            if (unique.length >= 11) break;
        }
        return unique.map((p) => ({
            id: p.id,
            name: p.name,
            short: (p.name || p.username || '??').slice(0, 3).toUpperCase(),
            rating: Math.round((p.rating ?? 80) * 10) / 10,
            position: p.position || 'CM',
            photoUri: p.image || '',
            username: p.username,
        }));
    }, [teamOfMonth]);

    const NAV_BOTTOM_PADDING = Math.max(insets.bottom, 16) + 16 + 4;
    const headerOffset = insets.top + HOME_HEADER_BODY_HEIGHT + -1;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Static ambient gradient — matches the neon-purple artwork palette */}
            <LinearGradient
                colors={[
              '#030008', '#05010F', '#080118', '#05010F', '#030008'
                ]}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{
                    paddingTop: headerOffset +10,
                    // ─── MAX SCROLL BOTTOM ───────────────────────────────────
                    // Change this number to control how far down the scroll goes.
                    // 0   = ends exactly at the last element (image gets hidden behind BottomNav)
                    // 70  = just enough clearance for the BottomNav
                    // 96  = current value (comfortable spacing)
                    paddingBottom: Math.max(insets.bottom, 0) + 46,
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

                {/* ── Matches ─────────────────────────────────────────────── */}
                <ScreenSection>
                    {matchesError && !loadingMatches && matches.length === 0 ? (
                        <HomeSectionError
                            sectionName={t.home.importantMatches}
                            detail={matchesError}
                            isOffline={!isOnline}
                            onRetry={() => {
                                setMatchesError(null);
                                getToken().then((t) => fetchHomeData(t)).catch(() => {});
                            }}
                        />
                    ) : (
                        <MatchList
                            matches={sortedDesignMatches}
                            onMatchPress={handleMatchPress}
                            onViewAllPress={handleViewAllMatches}
                            onFavoritePress={handleFavoritePress}
                            onRefreshPress={onRefresh}
                            isLoading={loadingMatches && matches.length === 0}
                        />
                    )}
                </ScreenSection>

                {/* ── Videos ──────────────────────────────────────────────── */}
                <ScreenSection>
                    {rankingsError && !loadingRankings && videos.length === 0 ? (
                        <HomeSectionError
                            sectionName={t.home.trendingReels}
                            detail={rankingsError}
                            isOffline={!isOnline}
                            onRetry={() => {
                                setRankingsError(null);
                                getToken().then((t) => fetchRankingsData(t)).catch(() => {});
                            }}
                        />
                    ) : (
                        <VideoList
                            videos={designVideos}
                            isOffline={!isOnline}
                            likedIds={likedIds}
                            onVideoPress={handleVideoPress}
                            onToggleLike={toggleLike}
                            onViewAllPress={handleViewAllReels}
                            isLoading={loadingRankings && videos.length === 0}
                        />
                    )}
                </ScreenSection>

                {/* ── Players ─────────────────────────────────────────────── */}
                <ScreenSection>
                    {rankingsError && !loadingRankings && players.length === 0 ? (
                        <HomeSectionError
                            sectionName={t.home.players}
                            detail={rankingsError}
                            isOffline={!isOnline}
                            onRetry={() => {
                                setRankingsError(null);
                                getToken().then((t) => fetchRankingsData(t)).catch(() => {});
                            }}
                        />
                    ) : (
                        <PlayerList
                            players={designPlayers}
                            onPlayerPress={handlePlayerPress}
                            onViewAllPress={handleViewAllRank}
                            isLoading={loadingRankings && players.length === 0}
                        />
                    )}
                </ScreenSection>

                {/* ── Team of the Month ────────────────────────────────────── */}
                <ScreenSection gapAfter={0}>
                    <TeamPitch
                        players={designPitchPlayers}
                        isLoading={loadingRankings && teamOfMonth.length === 0}
                        onPlayerPress={handlePitchPlayerPress}
                        onDetailsPress={handleViewAllRank}
                    />
                </ScreenSection>
            </ScrollView>

            <HomeHeader
                userName={userInfo.username}
                onSearchPress={handleSearchPress}
                isOffline={!isOnline}
            />

            <AdvancedSearchBar
                visible={searchVisible}
                onClose={handleSearchClose}
                onResultSelect={handleSearchResult}
            />

            <LuckyWheelModal
                visible={luckyWheelVisible}
                onClose={handleLuckyWheelClose}
                onCoinsWon={handleLuckyWheelCoinsWon}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: APP_BG,
    },
    scroll: { flex: 1 },
});