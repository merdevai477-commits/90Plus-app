import { create } from 'zustand';
import { ApiFootballService, MAJOR_LEAGUES, Fixture } from '../../services/apiFootball';
import { MatchFavoritesStorage } from '../storage/matchFavorites.storage';
import { matchesBatchService } from '../../services/matchesBatchService';
import { logger } from '../../services/logger';
import rankingsService from '../../services/rankingsService';
import { cacheService } from '../../services/cacheService';

// Cache keys for home data
const HOME_CACHE_KEYS = {
    MATCHES: 'home_matches',
    VIDEOS: 'home_videos',
    PLAYERS: 'home_players',
    TEAM_OF_MONTH: 'home_team_of_month',
};

// Cache TTL: 2 minutes for home data
const HOME_CACHE_TTL = 2 * 60 * 1000;

export interface Match {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore?: number;
    awayScore?: number;
    time: string;
    league: string;
    leagueId: number; // ✅ Added leagueId
    isLive: boolean;
    isImportant: boolean;
    isFavorited?: boolean;
    homeLogo?: string;
    awayLogo?: string;
    minute?: string;
    fixtureId: number;
    startTimestamp?: number;
    statusShort?: string;
    date?: string; // ✅ Added date
}

export interface Video {
    id: string;
    title: string;
    thumbnail: string;
    views: string;
    likes: string;
    duration: string;
    userId?: string;
    username?: string;
    avatar?: string;
}

export interface Player {
    id: string;
    username: string; // ✅ Added username for navigation
    name: string;
    position: string;
    rating: number;
    image: string;
    team: string;
    isVerified?: boolean;
    level?: number;
    stats?: {
        totalViews: number;
        totalLikes: number;
        profileViews: number;
    };
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    fixtureId?: string; // For match-related notifications
    eventType?: 'goal' | 'red_card' | 'yellow_card' | 'penalty'; // Match event type
}

interface HomeState {
    matches: Match[];
    videos: Video[];
    players: Player[];  // أهم 5 لاعبين (أسبوعي)
    teamOfMonth: Player[];  // تشكيلة الشهر (11 لاعب)
    notifications: Notification[];
    userMode: 'guest' | 'user' | 'diamond' | 'admin';
    favoritedMatches: string[];
    loadingMatches: boolean;
    loadingRankings: boolean;
    setUserMode: (mode: 'guest' | 'user' | 'diamond' | 'admin') => void;
    fetchHomeData: (token?: string | null) => Promise<void>;
    fetchRankingsData: (token?: string | null) => Promise<void>;
    toggleFavorite: (matchId: string, token?: string | null) => Promise<void>;
    addMatchNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
    clearNotifications: () => void;
    clearUserData: () => void;
}

/**
 * Sort matches by priority: Favorites -> Live -> Top Leagues -> Time
 */
const sortMatches = (matches: Match[], favoriteIds: string[]): Match[] => {
    return [...matches].sort((a, b) => {
        // Favorites always first
        if (a.isFavorited && !b.isFavorited) return -1;
        if (!a.isFavorited && b.isFavorited) return 1;

        // Live Matches
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;

        // Top 5 Leagues Priority
        const top5Leagues = [
            MAJOR_LEAGUES.PREMIER_LEAGUE,
            MAJOR_LEAGUES.LA_LIGA,
            MAJOR_LEAGUES.BUNDESLIGA,
            MAJOR_LEAGUES.SERIE_A,
            MAJOR_LEAGUES.LIGUE_1,
            MAJOR_LEAGUES.CHAMPIONS_LEAGUE
        ];
        const aIsTop5 = top5Leagues.includes(a.leagueId);
        const bIsTop5 = top5Leagues.includes(b.leagueId);

        if (aIsTop5 && !bIsTop5) return -1;
        if (!aIsTop5 && bIsTop5) return 1;

        // Default: Sort by fixture ID (newer matches first)
        return b.fixtureId - a.fixtureId;
    });
};

/**
 * Background refresh for matches data
 * Fetches fresh data without blocking the UI
 */
const refreshMatchesInBackground = async (
    favoriteIds: string[],
    set: (state: Partial<HomeState>) => void
) => {
    try {
        logger.debug('🔄 Background refresh starting...');

        // Fetch live matches (always fresh)
        let liveFixtures: Fixture[] = [];
        try {
            liveFixtures = await ApiFootballService.getLiveFixtures();
        } catch (err) {
            logger.warn('Background: Failed to fetch live fixtures:', err);
        }

        // Get fresh batched matches
        const today = new Date();
        let batchedFixtures: Fixture[] = [];
        try {
            // Check if cache is still valid, if not refresh
            const isValid = await matchesBatchService.isCacheValid(today);
            if (!isValid) {
                await matchesBatchService.refreshCache();
            }
            batchedFixtures = await matchesBatchService.getMatches(today);
        } catch (err) {
            logger.warn('Background: Failed to refresh batched fixtures:', err);
        }

        // Get favorited matches from cache
        let favoritedFixtures: Fixture[] = [];
        if (favoriteIds.length > 0) {
            const allCached = await matchesBatchService.getAllCachedMatches();
            favoritedFixtures = allCached.filter(f =>
                f?.fixture?.id && favoriteIds.includes(String(f.fixture.id))
            );
        }

        // Combine all fixtures
        const uniqueFixturesMap = new Map<number, Fixture>();
        favoritedFixtures.forEach(f => {
            if (f?.fixture?.id) {
                uniqueFixturesMap.set(f.fixture.id, f);
            }
        });
        liveFixtures.forEach(f => {
            if (f?.fixture?.id) {
                uniqueFixturesMap.set(f.fixture.id, f);
            }
        });
        batchedFixtures.forEach(f => {
            if (f?.fixture?.id && !uniqueFixturesMap.has(f.fixture.id)) {
                uniqueFixturesMap.set(f.fixture.id, f);
            }
        });

        const allFixtures = Array.from(uniqueFixturesMap.values());
        const mappedMatches = allFixtures.map(fixture =>
            mapFixtureToMatch(fixture, favoriteIds.includes(String(fixture.fixture.id)))
        );

        const sortedMatches = sortMatches(mappedMatches, favoriteIds);
        const finalMatches = sortedMatches.slice(0, 15);

        logger.debug(`🔄 Background refresh complete: ${finalMatches.length} matches`);

        set({ matches: finalMatches });
    } catch (error) {
        logger.warn('Background refresh failed:', error);
    }
};

// Helper function to map API fixture to Match interface
const mapFixtureToMatch = (fixture: Fixture, isFavorited: boolean = false): Match => {
    const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(fixture.fixture.status.short);

    // Get minute for live matches using unified status engine
    let minute: string | undefined;
    if (isLive) {
        const status = fixture.fixture.status.short;
        const elapsed = fixture.fixture.status.elapsed;
        
        // Use unified status logic: never show > 90 minutes directly
        if (status === 'HT') {
            minute = 'HT';
        } else if (status === 'ET' && elapsed !== null && elapsed !== undefined) {
            if (elapsed > 90) {
                minute = `90+${elapsed - 90}' (ET)`;
            } else {
                minute = `${elapsed}' (ET)`;
            }
        } else if ((status === '1H' || status === '2H') && elapsed !== null && elapsed !== undefined) {
            if (elapsed > 90) {
                minute = `90+${elapsed - 90}'`;
            } else {
                minute = `${elapsed}'`;
            }
        } else if (status === 'P' || status === 'PEN') {
            minute = 'PEN';
        }
    }

    //  Format time
    const date = new Date(fixture.fixture.date);
    const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return {
        id: String(fixture.fixture.id),
        fixtureId: fixture.fixture.id,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        homeScore: fixture.goals.home ?? undefined,
        awayScore: fixture.goals.away ?? undefined,
        time: isLive ? 'LIVE' : timeString,
        league: fixture.league.name,
        leagueId: fixture.league.id, // ✅ Map leagueId
        isLive,
        isImportant: true,
        isFavorited,
        homeLogo: fixture.teams.home.logo,
        awayLogo: fixture.teams.away.logo,
        minute,
        statusShort: fixture.fixture.status.short,
        date: fixture.fixture.date, // ✅ Map date
        startTimestamp: fixture.fixture.status.short === '2H'
            ? fixture.fixture.periods.second || undefined
            : fixture.fixture.periods.first || undefined,
    };
};

export const useHomeStore = create<HomeState>((set: (state: Partial<HomeState> | ((state: HomeState) => Partial<HomeState>)) => void, get: () => HomeState) => ({
    userMode: 'guest',
    matches: [],
    favoritedMatches: [],
    loadingMatches: false,
    loadingRankings: false,
    videos: [],  // سيتم ملؤها من الـ API
    players: [],  // أهم 5 لاعبين أسبوعياً
    teamOfMonth: [],  // تشكيلة الشهر (11 لاعب)
    notifications: [],
    setUserMode: (mode: 'guest' | 'user' | 'diamond' | 'admin') => set({ userMode: mode }),

    // Fetch rankings data (videos, players, teamOfMonth)
    fetchRankingsData: async (token?: string | null) => {
        set({ loadingRankings: true });
        
        try {
            logger.debug('🏆 Fetching rankings data for home screen...');
            
            // Fetch all data in parallel
            const [topViewsData, weeklyPlayersData, monthlyPlayersData] = await Promise.all([
                // أهم فيديوهات (3 أيام)
                rankingsService.getAllRankings(token || null, 5),
                // أهم 5 لاعبين (أسبوعي)
                rankingsService.getTopPlayers(token || null, 5, 'weekly'),
                // تشكيلة الشهر (11 لاعب)
                rankingsService.getTopPlayers(token || null, 11, 'monthly'),
            ]);

            // Transform videos data
            const videos: Video[] = topViewsData.topViews.map(reel => ({
                id: reel.id,
                title: reel.caption || 'فيديو رائع',
                thumbnail: reel.thumbnail || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=500&fit=crop',
                views: formatNumber(reel.views),
                likes: formatNumber(reel.likesCount),
                duration: '0:30',
                userId: reel.user?.id,
                username: reel.user?.username,
                avatar: reel.user?.avatar || undefined,
            }));

            // Transform weekly players (top 5)
            const players: Player[] = weeklyPlayersData.players.map(player => ({
                id: player.id,
                username: player.username, // ✅ Added username for navigation
                name: player.displayName || player.username,
                position: player.position || 'ST',
                rating: Math.min(10, (player.score / 1000) + 7), // Calculate rating from score
                image: player.avatar || 'https://via.placeholder.com/150',
                team: player.countryFlag || '🇪🇬',
                isVerified: player.isVerified,
                level: player.level,
                stats: player.stats,
            }));

            // Transform monthly players (team of month - 11 players)
            const teamOfMonth: Player[] = monthlyPlayersData.players.map(player => ({
                id: player.id,
                username: player.username, // ✅ Added username for navigation
                name: player.displayName || player.username,
                position: player.position || 'ST',
                rating: Math.min(10, (player.score / 1000) + 7),
                image: player.avatar || 'https://via.placeholder.com/150',
                team: player.countryFlag || '🇪🇬',
                isVerified: player.isVerified,
                level: player.level,
                stats: player.stats,
            }));

            logger.debug(`✅ Rankings loaded: ${videos.length} videos, ${players.length} weekly players, ${teamOfMonth.length} monthly players`);

            set({
                videos,
                players,
                teamOfMonth,
                loadingRankings: false,
            });
        } catch (error) {
            logger.error('❌ Error fetching rankings data:', error);
            set({ loadingRankings: false });
        }
    },

    fetchHomeData: async (token?: string | null) => {
        set({ loadingMatches: true });

        try {
            logger.debug('🏠 Fetching home screen data...');

            // Load favorited match IDs from storage
            const favoriteIds = await MatchFavoritesStorage.getFavorites();

            // 1. Try to get cached matches first (cache-first pattern)
            // Requirements 5.3, 5.4: Serve from cache if data exists
            const today = new Date();
            let cachedMatches = await matchesBatchService.getCachedMatches(today);

            if (cachedMatches && cachedMatches.length > 0) {
                logger.debug(`📦 Cache hit: ${cachedMatches.length} matches from cache`);

                // Map cached matches to UI format
                const mappedCached = cachedMatches.map(fixture =>
                    mapFixtureToMatch(fixture, favoriteIds.includes(String(fixture.fixture.id)))
                );

                // Sort and display cached data immediately
                const sortedCached = sortMatches(mappedCached, favoriteIds);
                set({
                    matches: sortedCached.slice(0, 15),
                    favoritedMatches: favoriteIds,
                    loadingMatches: false
                });

                // Background refresh: fetch fresh data without blocking UI
                // Requirements 5.5: Fetch fresh data when needed
                refreshMatchesInBackground(favoriteIds, set);
                return;
            }

            logger.debug('📡 Cache miss, fetching fresh data...');

            // 2. Fetch ALL live matches (always fresh for live data)
            let liveFixtures: Fixture[] = [];
            try {
                liveFixtures = await ApiFootballService.getLiveFixtures();
                logger.debug(`📡 Found ${liveFixtures.length} live matches`);
            } catch (err) {
                logger.warn('Failed to fetch live fixtures:', err);
            }

            // 3. Use batch service to get today's matches (with caching)
            // Requirements 5.1, 5.6: Batch fetch for multiple days
            let batchedFixtures: Fixture[] = [];
            try {
                batchedFixtures = await matchesBatchService.getMatches(today);
                logger.debug(`📦 Batch service returned ${batchedFixtures.length} matches`);
            } catch (err) {
                logger.warn('Failed to fetch batched fixtures:', err);
            }

            // 4. Filter favorited matches from batched data
            let favoritedFixtures: Fixture[] = [];
            if (favoriteIds.length > 0) {
                // Get all cached matches to find favorites
                const allCached = await matchesBatchService.getAllCachedMatches();
                favoritedFixtures = allCached.filter(f =>
                    f?.fixture?.id && favoriteIds.includes(String(f.fixture.id))
                );
                logger.debug(`⭐ Found ${favoritedFixtures.length} favorited matches`);
            }

            // 5. Combine All (Live + Favorites + Batched)
            const uniqueFixturesMap = new Map<number, Fixture>();

            // Add favorited matches first (higher priority)
            favoritedFixtures.forEach(f => {
                if (f?.fixture?.id) {
                    uniqueFixturesMap.set(f.fixture.id, f);
                }
            });

            // Add live matches
            liveFixtures.forEach(f => {
                if (f?.fixture?.id) {
                    uniqueFixturesMap.set(f.fixture.id, f);
                }
            });

            // Add batched matches
            batchedFixtures.forEach(f => {
                if (f?.fixture?.id && !uniqueFixturesMap.has(f.fixture.id)) {
                    uniqueFixturesMap.set(f.fixture.id, f);
                }
            });

            const allFixtures = Array.from(uniqueFixturesMap.values());

            // 6. Map to Match interface
            const mappedMatches = allFixtures.map(fixture =>
                mapFixtureToMatch(fixture, favoriteIds.includes(String(fixture.fixture.id)))
            );

            // 7. Sort and limit
            const sortedMatches = sortMatches(mappedMatches, favoriteIds);
            const finalMatches = sortedMatches.slice(0, 15);

            logger.debug(`✅ Displaying ${finalMatches.length} matches`);

            set({
                matches: finalMatches,
                favoritedMatches: favoriteIds,
                loadingMatches: false
            });
        } catch (error) {
            logger.error('❌ Error fetching home data:', error);
            set({ loadingMatches: false });
        }
    },

    toggleFavorite: async (matchId: string, token?: string | null) => {
        const { matches, favoritedMatches } = get();

        try {
            const isFavorited = favoritedMatches.includes(matchId);
            const match = matches.find(m => m.id === matchId);

            if (isFavorited) {
                // Remove locally
                await MatchFavoritesStorage.removeFavorite(matchId);

                // Sync with backend if signed in
                if (token) {
                    await ApiFootballService.unfavoriteMatch(parseInt(matchId), token);
                }

                logger.debug(`🗑️ Removed favorite: ${matchId}`);
            } else {
                // Add locally
                await MatchFavoritesStorage.addFavorite(matchId);

                // Sync with backend if signed in
                if (token && match) {
                    await ApiFootballService.favoriteMatch(
                        parseInt(matchId),
                        {
                            homeTeam: match.homeTeam,
                            awayTeam: match.awayTeam,
                            homeTeamLogo: match.homeLogo,
                            awayTeamLogo: match.awayLogo,
                            matchDate: match.date || new Date().toISOString(), // Match interface needs date
                            leagueName: match.league
                        },
                        token
                    );
                }

                logger.debug(`⭐ Added favorite: ${matchId}`);
            }

            // Instant update
            const newFavorites = isFavorited
                ? favoritedMatches.filter(id => id !== matchId)
                : [...favoritedMatches, matchId];

            const updatedMatches = matches.map(m =>
                m.id === matchId ? { ...m, isFavorited: !isFavorited } : m
            );

            // Use the shared sorting function
            const sortedMatches = sortMatches(updatedMatches, newFavorites);

            set({
                matches: sortedMatches,
                favoritedMatches: newFavorites
            });

            logger.debug(`✅ Favorites updated instantly (${newFavorites.length} total)`);
        } catch (error) {
            logger.error('❌ Error toggling favorite:', error);
        }
    },

    addMatchNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => {
        const { notifications } = get();
        const newNotification: Notification = {
            ...notification,
            id: `match-${Date.now()}-${Math.random()}`,
            time: getTimeAgo(Date.now()),
            read: false,
        };

        // Add to beginning of array (most recent first)
        set({ notifications: [newNotification, ...notifications] });
        logger.debug('📢 New match notification:', newNotification.title);
    },

    clearNotifications: () => {
        set({ notifications: [] });
    },
    
    clearUserData: () => {
        set({ 
            userMode: 'guest',
            notifications: [],
            // Keep matches, videos, players, teamOfMonth as they're not user-specific
        });
    },
}));

// Helper function to format time ago
function getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// Helper function to format numbers
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
