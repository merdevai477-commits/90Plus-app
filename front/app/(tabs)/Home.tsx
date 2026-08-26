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
} from '../../components/Home';
import type { MatchListItem } from '../../components/Home/MatchList';
import { useLiveFixtureStore } from '../../src/store/liveFixtureStore';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import { snapshotToMatchRow } from '../../src/utils/snapshotToMatchRow';
import { isMatchFinished, isMatchLive } from '../../utils/matchStatusUtils';
import AdvancedSearchBar, { SearchResult } from '../../components/common/AdvancedSearchBar';
import LuckyWheelModal from '../../components/common/LuckyWheelModal';
import { PredictAndWinHomeBanner } from '../../components/predictAndWin/HomeEntryBanner';
import { HomeSectionError } from '../../components/Home/HomeSectionError';
import { useHomeStore, type Match as HomeMatch } from '../../src/store/home.store';
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
import { scheduleMatchesWidgetSync } from '../../src/widgets/syncMatchesWidget';
import { useScreenFont } from '../../utils/fontSetup';
import { useTranslation } from '../../src/i18n';
import useMyProfileBasics from '../../hooks/useMyProfileBasics';
import { resolveProfileDisplayName, resolveGreetingFirstName, resolvePublicFirstName } from '../../hooks/useProfileCache';
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { QuizApiService } from '../../services/quizApi.service';
import { dailyQuizQueryKey, todayQuizDateKey } from '../../utils/quizDateKey';
import {
    canMakeAuthenticatedRequests,
    fetchWithClerkAuth,
    getClerkBearerToken,
} from '../../utils/clerkAuthToken';

const LIVE_STATUS_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_STATUS_SHORTS = new Set(['FT', 'AET', 'PEN']);

/** Map API/live snapshot status → home MatchList badge (never infer FT from 0-0). */
function deriveHomeMatchListStatus(
    liveRow: ReturnType<typeof snapshotToMatchRow> | null,
    m: HomeMatch,
): MatchListItem['status'] {
    const fromShort = (short: string | undefined): MatchListItem['status'] | null => {
        const s = (short ?? '').trim().toUpperCase();
        if (!s) return null;
        if (s === 'HT') return 'HT';
        if (s === '2H') return '2ND';
        if (s === '1H') return '1ST';
        if (LIVE_STATUS_SHORTS.has(s)) return 'LIVE';
        if (FINISHED_STATUS_SHORTS.has(s)) return 'FT';
        if (s === 'NS' || s === 'TBD' || s === 'PST') return 'UPCOMING';
        return null;
    };

    if (liveRow) {
        const fromLiveShort = fromShort(liveRow.statusShort);
        if (fromLiveShort) return fromLiveShort;
        if (liveRow.status === 'live') return 'LIVE';
        if (liveRow.status === 'finished') return 'FT';
        return 'UPCOMING';
    }

    const fromStoreShort = fromShort(m.statusShort);
    if (fromStoreShort) return fromStoreShort;
    if (m.isLive) return 'LIVE';
    return 'UPCOMING';
}

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
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const { data: profileBasics } = useMyProfileBasics();
    const queryClient = useQueryClient();
    const quizPreloadDone = useRef(false);
    const { likedIds, toggleLike } = useHomeLikes(user?.id);
    const worldCupCampaignMode = useAppFeaturesStore((s) => s.worldCupCampaignMode);

    useEffect(() => {
        void useAppFeaturesStore.getState().hydrate(true);
    }, []);

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
            const response = await fetchWithClerkAuth(getToken, `${API_URL}/daily-spin/status`);
            if (!response) return;
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
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const response = await fetchWithClerkAuth(
                getToken,
                `${API_URL}/reels/rankings/user-rank`,
            );
            if (!response) return;
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
    }, [getToken, isSignedIn, isLoaded]);

    const fetchUserProfile = useCallback(async () => {
        const clerkFallback = user
            ? {
                  clerkUserId: user.id,
                  username: user.username,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  fullName: user.fullName,
                  primaryEmail: user.primaryEmailAddress?.emailAddress,
              }
            : null;

        const applyClerkHomeFallback = () => {
            if (!user || !clerkFallback) return;
            const display = resolveProfileDisplayName(
                globalState.userProfile?.displayName,
                globalState.userProfile?.username,
                clerkFallback,
            );

            setUserInfo((prev) => ({
                ...prev,
                username: display || prev.username,
                avatar:
                    user.imageUrl || user.externalAccounts?.[0]?.imageUrl || prev.avatar,
            }));
        };

        try {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const token = await getClerkBearerToken(getToken);
            if (!token) return;

            try {
                const userData = await AuthService.syncUserWithBackend(token, { getToken });
                const greetingName = resolveProfileDisplayName(
                    userData.displayName,
                    userData.username,
                    clerkFallback,
                );
                setUserInfo((prev) => ({
                    ...prev,
                    username: greetingName || prev.username,
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
    }, [getToken, isSignedIn, isLoaded, user]);

    const preloadProfileData = useCallback(async () => {
        try {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const token = await getClerkBearerToken(getToken);
            if (!token) return;

            ProfileCompletionService.getCompletionStatus(token)
                .then((status) => {
                    if (status) {
                        cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000);
                    }
                })
                .catch(() => {});

            fetchWithClerkAuth(getToken, `${API_URL}/clerk/me`)
                .then(async (response) => {
                    if (response?.ok) {
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
    }, [getToken, isSignedIn, isLoaded]);

    const preloadQuizData = useCallback(async () => {
        try {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn) || quizPreloadDone.current) {
                return;
            }
            const token = await getClerkBearerToken(getToken);
            if (!token) return;
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
    }, [getToken, isSignedIn, isLoaded, queryClient]);

    // ── Fetch subscribed fixture IDs (pinned matches) ─────────────────────────
    const fetchSubscribedIds = useCallback(async () => {
        try {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const token = await getClerkBearerToken(getToken);
            if (!token) return;
            const ids = await MatchSubscriptionsService.listIds(token);
            setSubscribedIds(ids);
        } catch {
            // silent — bell state just won't show
        }
    }, [getToken, isSignedIn, isLoaded]);

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

    const greetingName = useMemo(() => {
        const clerkFallback = user
            ? {
                  clerkUserId: user.id,
                  username: user.username,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  fullName: user.fullName,
                  primaryEmail: user.primaryEmailAddress?.emailAddress,
              }
            : null;

        if (!user && !profileBasics) return userInfo.username;

        return resolveGreetingFirstName(
            profileBasics?.displayName || globalState.userProfile?.displayName,
            profileBasics?.username || globalState.userProfile?.username,
            clerkFallback,
        );
    }, [
        profileBasics?.displayName,
        profileBasics?.username,
        user,
        userInfo.username,
    ]);

    useEffect(() => {
        if (isSignedIn && user) {
            const email = user.primaryEmailAddress?.emailAddress || '';
            const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
            const displayUsername = resolveProfileDisplayName(
                globalState.userProfile?.displayName,
                globalState.userProfile?.username || emailUsername,
                {
                    clerkUserId: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    fullName: user.fullName,
                    primaryEmail: email,
                },
            );
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
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;

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
                    const token = await getClerkBearerToken(getTokenRef.current);
                    if (abortController.signal.aborted) {
                        if (isMounted) isLoadingRef.current = false;
                        return;
                    }
                    if (!token) {
                        if (isMounted) isLoadingRef.current = false;
                        return;
                    }

                    // Critical — matches load from cache without auth; rankings need token
                    const criticalPromises = [
                        fetchHomeDataRef.current(token).catch((err: unknown) => {
                            logger.error('Error fetching home data:', err);
                            if (isMounted) setMatchesError(String(err));
                            return null;
                        }),
                    ];

                    criticalPromises.push(
                        fetchUserProfileRef.current().catch((err: unknown) => {
                            logger.error('Error fetching user profile:', err);
                            return null;
                        }),
                    );

                    const secondaryPromises = [
                        fetchRankingsDataRef.current(token).catch((err: unknown) => {
                            logger.error('Error fetching rankings:', err);
                            if (isMounted) setRankingsError(String(err));
                            return null;
                        }),
                        fetchSpinWheelStatusRef.current().catch(() => null),
                        fetchPredictionsDataRef.current(token).catch(() => null),
                        fetchUserRankRef.current().catch(() => null),
                        fetchSubscribedIdsRef.current().catch(() => null),
                    ];

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
        }, [isLoaded, isSignedIn]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setMatchesError(null);
        setRankingsError(null);
        try {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const token = await getClerkBearerToken(getToken);
            if (!token) return;
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
            scheduleMatchesWidgetSync(400);
        }
    }, [getToken, isLoaded, isSignedIn]);

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
                },
            });
        },
        [matches, router],
    );

    const handleFavoritePress = useCallback(
        async (matchId: string) => {
            if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) return;
            const token = await getClerkBearerToken(getToken);
            await toggleFavorite(matchId, token);
        },
        [getToken, isLoaded, isSignedIn, toggleFavorite],
    );

    const handleViewAllMatches = useCallback(
        () =>
            router.navigate(
                worldCupCampaignMode
                    ? { pathname: '/(tabs)/matches', params: { filter: 'WorldCup' } }
                    : '/(tabs)/matches',
            ),
        [router, worldCupCampaignMode],
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
    const snapshots = useLiveFixtureStore((s) => s.snapshots);
    const liveHomeFixtureIds = useMemo(() => {
      const now = Date.now();
      const NEAR_MS = 12 * 60 * 1000;
      const OVERDUE_MS = 3 * 60 * 60 * 1000;
      return displayMatches
        .filter((m) => {
          if (!m.fixtureId) return false;
          if (m.isLive) return true;
          if (!m.date) return false;
          const kickoff = new Date(m.date).getTime();
          if (Number.isNaN(kickoff)) return false;
          const delta = kickoff - now;
          return delta <= NEAR_MS && delta >= -OVERDUE_MS;
        })
        .map((m) => m.fixtureId);
    }, [displayMatches]);
    useRegisterLiveFixtures(liveHomeFixtureIds);

    // ─── Adapters: store shape → design component shape ──────────────────────
    const POSITION_COLOR: Record<string, string> = {
        ST: '#FF7A3D', CF: '#FF7A3D', LW: '#11998E', RW: '#F5576C',
        CM: '#8E54E9', DM: '#8E54E9', AM: '#A855F7',
        LB: '#60A5FA', RB: '#60A5FA', CB: '#3B82F6', GK: '#FFD700',
    };

    const designMatches = useMemo<MatchListItem[]>(
        () =>
            displayMatches.map((m) => {
                const snap = snapshots[m.fixtureId];
                const liveRow = snap ? snapshotToMatchRow(snap) : null;
                const homeScore = liveRow?.score.home ?? m.homeScore ?? 0;
                const awayScore = liveRow?.score.away ?? m.awayScore ?? 0;
                return {
                id: m.id,
                homeTeam: {
                    name: m.homeTeam ?? '',
                    shortName: m.homeTeam ?? '?',
                    score: homeScore ?? 0,
                    logo: m.homeLogo,
                },
                awayTeam: {
                    name: m.awayTeam ?? '',
                    shortName: m.awayTeam ?? '?',
                    score: awayScore ?? 0,
                    logo: m.awayLogo,
                },
                status: deriveHomeMatchListStatus(liveRow, m),
                minute: liveRow?.minute ?? m.minute,
                stoppageTime:
                  liveRow?.extra != null && liveRow.extra > 0
                    ? liveRow.extra
                    : m.stoppageTime ?? undefined,
                league: m.league,
                leagueId: m.leagueId,
                kickoff: m.time,
                isPinned: subscribedIds.has(m.fixtureId),
                isFavorited: m.isFavorited,
            };
            }),
        [displayMatches, snapshots, subscribedIds],
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

    useEffect(() => {
        if (loadingMatches && matches.length === 0) return;
        scheduleMatchesWidgetSync(1200);
    }, [sortedDesignMatches, loadingMatches, matches.length, snapshots]);

    const designVideos = useMemo(
        () =>
            videos.map((v) => {
                const raw = v.title?.trim();
                const title =
                    !raw || raw === 'فيديو رائع' ? t.home.defaultVideoTitle : raw;
                return {
                    id: v.id,
                    title,
                    views: v.views,
                    likes: v.likes,
                    thumbnail: v.thumbnail,
                };
            }),
        [videos, t.home.defaultVideoTitle],
    );

    const designPlayers = useMemo(
        () => {
            return players.map((p, idx) => {
                const pos = (p.position || 'CM').toUpperCase();
                const color = POSITION_COLOR[pos] ?? '#8E54E9';
                return {
                    id: idx + 1,
                    name: resolvePublicFirstName(p.name, p.username) || p.name,
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
        return unique.map((p) => {
            const publicName =
                resolvePublicFirstName(p.name, p.username) ||
                (p.name && !/^user_[a-z0-9]+$/i.test(p.name) ? p.name.split(/\s+/)[0] : '');
            return {
                id: p.id,
                name: publicName,
                short: publicName ? publicName.slice(0, 2).toUpperCase() : '•',
                rating: Math.round((p.rating ?? 80) * 10) / 10,
                position: p.position || 'CM',
                photoUri: p.image || '',
                username: p.username,
            };
        });
    }, [teamOfMonth]);

    const NAV_BOTTOM_PADDING = Math.max(insets.bottom, 16) + 16 + 4;
    const headerOffset = insets.top + HOME_HEADER_BODY_HEIGHT + 10;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <HomeHeader
                userName={greetingName}
                onSearchPress={handleSearchPress}
                isOffline={!isOnline}
            />

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
                    paddingTop: headerOffset,
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
                                getClerkBearerToken(getToken)
                                    .then((t) => t && fetchHomeData(t))
                                    .catch(() => {});
                            }}
                        />
                    ) : (
                        <MatchList
                            matches={sortedDesignMatches}
                            worldCupMode={worldCupCampaignMode}
                            onMatchPress={handleMatchPress}
                            onViewAllPress={handleViewAllMatches}
                            onFavoritePress={handleFavoritePress}
                            onRefreshPress={onRefresh}
                            isLoading={loadingMatches && matches.length === 0}
                        />
                    )}
                </ScreenSection>

                {/* ── Predict & Win ───────────────────────────────────────── */}
                <ScreenSection>
                    <PredictAndWinHomeBanner />
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
                                getClerkBearerToken(getToken)
                                    .then((t) => t && fetchRankingsData(t))
                                    .catch(() => {});
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
                                getClerkBearerToken(getToken)
                                    .then((t) => t && fetchRankingsData(t))
                                    .catch(() => {});
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
                    />
                </ScreenSection>
            </ScrollView>

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