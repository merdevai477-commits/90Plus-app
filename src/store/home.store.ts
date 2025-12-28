import { create } from 'zustand';
import { ApiFootballService, MAJOR_LEAGUES, Fixture } from '../../services/apiFootball';
import { MatchFavoritesStorage } from '../storage/matchFavorites.storage';

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
}

export interface Video {
    id: string;
    title: string;
    thumbnail: string;
    views: string;
    likes: string;
    duration: string;
}

export interface Player {
    id: string;
    name: string;
    position: string;
    rating: number;
    image: string;
    team: string;
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
    players: Player[];
    teamOfMonth: Player[];
    notifications: Notification[];
    userMode: 'guest' | 'user';
    favoritedMatches: string[];
    loadingMatches: boolean;
    setUserMode: (mode: 'guest' | 'user') => void;
    fetchHomeData: () => Promise<void>;
    toggleFavorite: (matchId: string) => Promise<void>;
    addMatchNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
    clearNotifications: () => void;
}

// Helper function to map API fixture to Match interface
const mapFixtureToMatch = (fixture: Fixture, isFavorited: boolean = false): Match => {
    const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(fixture.fixture.status.short);

    // Get minute for live matches
    let minute: string | undefined;
    if (isLive && fixture.fixture.status.elapsed) {
        minute = `${fixture.fixture.status.elapsed}'`;
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
    };
};

export const useHomeStore = create<HomeState>((set, get) => ({
    userMode: 'guest',
    matches: [],
    favoritedMatches: [],
    loadingMatches: false,
    videos: [
        { id: '1', title: 'Top 10 Goals of the Month', thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=500&fit=crop', views: '1.2M', likes: '85K', duration: '0:45' },
        { id: '2', title: 'Messi vs Ronaldo - The Final Battle', thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=300&h=500&fit=crop', views: '850K', likes: '120K', duration: '0:30' },
        { id: '3', title: 'Funny Moments in Football 2023', thumbnail: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=300&h=500&fit=crop', views: '2.5M', likes: '200K', duration: '0:55' },
        { id: '4', title: 'Neymar Skills 2024', thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&h=500&fit=crop', views: '500K', likes: '45K', duration: '0:25' },
    ],
    players: [
        { id: '1', name: 'Erling Haaland', position: 'ST', rating: 9.5, image: 'https://media.api-sports.io/football/players/1100.png', team: 'Man City' },
        { id: '2', name: 'Kylian Mbappe', position: 'LW', rating: 9.2, image: 'https://media.api-sports.io/football/players/278.png', team: 'Real Madrid' },
        { id: '3', name: 'Jude Bellingham', position: 'CAM', rating: 9.0, image: 'https://media.api-sports.io/football/players/157.png', team: 'Real Madrid' },
        { id: '4', name: 'Kevin De Bruyne', position: 'CM', rating: 8.9, image: 'https://media.api-sports.io/football/players/18.png', team: 'Man City' },
    ],
    teamOfMonth: [
        { id: '1', name: 'Courtois', position: 'GK', rating: 8.5, image: 'https://media.api-sports.io/football/players/35.png', team: 'Real Madrid' },
        { id: '2', name: 'Walker', position: 'RB', rating: 8.2, image: 'https://media.api-sports.io/football/players/188.png', team: 'Man City' },
        { id: '3', name: 'Dias', position: 'CB', rating: 8.4, image: 'https://media.api-sports.io/football/players/200.png', team: 'Man City' },
        { id: '4', name: 'Van Dijk', position: 'CB', rating: 8.3, image: 'https://media.api-sports.io/football/players/290.png', team: 'Liverpool' },
        { id: '5', name: 'Davies', position: 'LB', rating: 8.1, image: 'https://media.api-sports.io/football/players/162.png', team: 'Bayern' },
        { id: '6', name: 'Rodri', position: 'CDM', rating: 9.1, image: 'https://media.api-sports.io/football/players/631.png', team: 'Man City' },
        { id: '7', name: 'De Bruyne', position: 'CM', rating: 8.9, image: 'https://media.api-sports.io/football/players/18.png', team: 'Man City' },
        { id: '8', name: 'Bellingham', position: 'CAM', rating: 9.0, image: 'https://media.api-sports.io/football/players/157.png', team: 'Real Madrid' },
        { id: '9', name: 'Salah', position: 'RW', rating: 8.8, image: 'https://media.api-sports.io/football/players/306.png', team: 'Liverpool' },
        { id: '10', name: 'Haaland', position: 'ST', rating: 9.5, image: 'https://media.api-sports.io/football/players/1100.png', team: 'Man City' },
        { id: '11', name: 'Vinicius', position: 'LW', rating: 8.9, image: 'https://media.api-sports.io/football/players/234.png', team: 'Real Madrid' },
    ],
    notifications: [
        { id: '1', title: 'Match Started', message: 'Real Madrid vs Barcelona has started!', time: '2 mins ago', read: false, type: 'info' },
        { id: '2', title: 'Goal!', message: 'Haaland scores for Man City!', time: '15 mins ago', read: false, type: 'success' },
        { id: '3', title: 'Transfer News', message: 'Mbappe to Real Madrid confirmed?', time: '1 hour ago', read: true, type: 'warning' },
    ],
    setUserMode: (mode) => set({ userMode: mode }),

    fetchHomeData: async () => {
        set({ loadingMatches: true });

        try {
            console.log('🏠 Fetching home screen data...');

            // Load favorited match IDs from storage
            const favoriteIds = await MatchFavoritesStorage.getFavorites();

            // 1. Fetch ALL live matches
            let liveFixtures: Fixture[] = [];
            try {
                liveFixtures = await ApiFootballService.getLiveFixtures();
                console.log(`📡 Found ${liveFixtures.length} live matches`);
            } catch (err) {
                console.warn('Failed to fetch live fixtures:', err);
            }

            // 2. Fetch Favorited Matches (Yesterday, Today, Tomorrow)
            let favoritedFixtures: Fixture[] = [];
            if (favoriteIds.length > 0) {
                try {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const dates = [
                        yesterday.toISOString().split('T')[0],
                        today.toISOString().split('T')[0],
                        tomorrow.toISOString().split('T')[0],
                    ];

                    const allMatches: Fixture[] = [];
                    for (const date of dates) {
                        try {
                            const matches = await ApiFootballService.getFixturesByDate(date);
                            allMatches.push(...matches);
                        } catch (error) {
                            console.log(`Could not fetch matches for ${date}:`, error);
                        }
                    }

                    favoritedFixtures = allMatches.filter(f =>
                        favoriteIds.includes(String(f.fixture.id))
                    );
                    console.log(`⭐ Found ${favoritedFixtures.length} favorited matches`);
                } catch (error) {
                    console.log('Could not fetch favorited matches:', error);
                }
            }

            // 3. Fallback: If no live matches and few favorites, fetch Today's Matches
            let todaysFixtures: Fixture[] = [];
            if (liveFixtures.length === 0 && favoritedFixtures.length < 5) {
                try {
                    const todayDate = new Date().toISOString().split('T')[0];
                    console.log(`📅 No live matches, fetching today's matches for ${todayDate}...`);
                    todaysFixtures = await ApiFootballService.getFixturesByDate(todayDate);
                } catch (err) {
                    console.warn('Failed to fetch today\'s fixtures:', err);
                }
            }

            // 4. Combine All (Live + Favorites + Today's)
            const uniqueFixturesMap = new Map<number, Fixture>();

            // Add favorited matches first (higher priority)
            favoritedFixtures.forEach(f => uniqueFixturesMap.set(f.fixture.id, f));

            // Add live matches
            liveFixtures.forEach(f => uniqueFixturesMap.set(f.fixture.id, f));

            // Add today's matches (if fetched)
            todaysFixtures.forEach(f => {
                if (!uniqueFixturesMap.has(f.fixture.id)) {
                    uniqueFixturesMap.set(f.fixture.id, f);
                }
            });

            const allFixtures = Array.from(uniqueFixturesMap.values());

            // 5. Map to Match interface
            const mappedMatches = allFixtures.map(fixture =>
                mapFixtureToMatch(fixture, favoriteIds.includes(String(fixture.fixture.id)))
            );

            // 6. Sort: Favorites -> Live -> Top Leagues -> Time
            mappedMatches.sort((a, b) => {
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

                // Default: Sort by Time (descending for completed, ascending for upcoming?) 
                // Actually, usually we want upcoming soonest. But for mixed list...
                // Let's stick to ID or simple time comparison if needed.
                return b.fixtureId - a.fixtureId;
            });

            // 7. Limit to 15 matches (increased from 10 to ensure content)
            const finalMatches = mappedMatches.slice(0, 15);

            console.log(`✅ Displaying ${finalMatches.length} matches`);

            set({
                matches: finalMatches,
                favoritedMatches: favoriteIds,
                loadingMatches: false
            });
        } catch (error) {
            console.error('❌ Error fetching home data:', error);
            set({ loadingMatches: false });
        }
    },

    toggleFavorite: async (matchId: string) => {
        const { matches, favoritedMatches } = get();

        try {
            const isFavorited = favoritedMatches.includes(matchId);

            if (isFavorited) {
                await MatchFavoritesStorage.removeFavorite(matchId);
                console.log(`🗑️ Removed favorite: ${matchId}`);
            } else {
                await MatchFavoritesStorage.addFavorite(matchId);
                console.log(`⭐ Added favorite: ${matchId}`);
            }

            // Instant update
            const newFavorites = isFavorited
                ? favoritedMatches.filter(id => id !== matchId)
                : [...favoritedMatches, matchId];

            const updatedMatches = matches.map(m =>
                m.id === matchId ? { ...m, isFavorited: !isFavorited } : m
            );

            updatedMatches.sort((a, b) => {
                // Same sorting logic as above
                if (a.isFavorited && !b.isFavorited) return -1;
                if (!a.isFavorited && b.isFavorited) return 1;

                const top5Leagues = [
                    MAJOR_LEAGUES.PREMIER_LEAGUE,
                    MAJOR_LEAGUES.LA_LIGA,
                    MAJOR_LEAGUES.BUNDESLIGA,
                    MAJOR_LEAGUES.SERIE_A,
                    MAJOR_LEAGUES.LIGUE_1,
                    MAJOR_LEAGUES.CHAMPIONS_LEAGUE
                ];

                const aIsTop5Live = a.isLive && top5Leagues.includes(a.leagueId);
                const bIsTop5Live = b.isLive && top5Leagues.includes(b.leagueId);

                if (aIsTop5Live && !bIsTop5Live) return -1;
                if (!aIsTop5Live && bIsTop5Live) return 1;

                if (a.isLive && !b.isLive) return -1;
                if (!a.isLive && b.isLive) return 1;

                return b.fixtureId - a.fixtureId;
            });

            set({
                matches: updatedMatches,
                favoritedMatches: newFavorites
            });

            console.log(`✅ Favorites updated instantly (${newFavorites.length} total)`);
        } catch (error) {
            console.error('❌ Error toggling favorite:', error);
        }
    },

    addMatchNotification: (notification) => {
        const { notifications } = get();
        const newNotification: Notification = {
            ...notification,
            id: `match-${Date.now()}-${Math.random()}`,
            time: getTimeAgo(Date.now()),
            read: false,
        };

        // Add to beginning of array (most recent first)
        set({ notifications: [newNotification, ...notifications] });
        console.log('📢 New match notification:', newNotification.title);
    },

    clearNotifications: () => {
        set({ notifications: [] });
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
