import prisma from '../lib/prisma';
import { NotificationService } from './notification.service';
import { WebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { footballService } from './football.service';
import { PredictionResolverService } from './prediction-resolver.service';

interface ApiFootballMatch {
    fixture: {
        id: number;
        status: {
            short: string; // NS, 1H, HT, 2H, FT, etc.
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
}

export class MatchWatcherService {
    private static isRunning = false;
    private static intervalId: NodeJS.Timeout | null = null;

    /**
     * Start the match watcher (runs every 2 minutes)
     */
    static start() {
        if (this.intervalId) {
            logger.info('⚠️ Match watcher already running');
            return;
        }

        logger.info('🔄 Starting match watcher service (API-Football)...');

        // Run immediately on start
        this.checkMatches();

        // Then run every 2 minutes
        this.intervalId = setInterval(() => {
            this.checkMatches();
        }, 2 * 60 * 1000); // 2 minutes

        logger.info('✅ Match watcher started (checking every 2 minutes)');
    }

    /**
     * Stop the match watcher
     */
    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('✅ Match watcher stopped');
        }
    }

    /**
     * Check all favorite matches for updates
     */
    static async checkMatches() {
        if (this.isRunning) {
            logger.debug('⏳ Match check already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        logger.info('🔍 Checking favorite matches for updates...');

        try {
            // Get all unique match IDs that are favorited and might be live
            // (matches within 3 hours before and now - we check more frequently for live matches)
            const now = new Date();
            const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const favoriteMatches = await prisma.favoriteMatch.findMany({
                where: {
                    matchDate: {
                        gte: threeHoursAgo,
                        lte: tomorrow,
                    },
                    notifiedEnd: false, // Don't check matches that already ended
                },
                include: {
                    user: {
                        select: {
                            expoPushToken: true,
                        },
                    },
                },
            });

            if (favoriteMatches.length === 0) {
                logger.debug('📭 No active favorite matches to check');
                this.isRunning = false;
                return;
            }

            // Group by apiMatchId to avoid duplicate API calls
            const matchIds = [...new Set(favoriteMatches.map(f => f.apiMatchId))];
            logger.info(`📊 Checking ${matchIds.length} unique matches with API-Football...`);

            // Fetch match data from API-Football
            for (const matchId of matchIds) {
                try {
                    const matchData = await this.fetchMatchFromApiFootball(matchId);
                    if (matchData) {
                        await this.processMatchUpdate(matchId, matchData, favoriteMatches);
                    }
                } catch (error) {
                    logger.error(`Error fetching match ${matchId}:`, error);
                }

                // Delay between API calls if needed (though footballService handles rate limiting)
            }

            logger.info('✅ Match check completed');
        } catch (error) {
            logger.error('❌ Match watcher error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Fetch match data from API-Football
     */
    private static async fetchMatchFromApiFootball(matchId: number): Promise<ApiFootballMatch | null> {
        try {
            const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: matchId });

            if (data && data.length > 0) {
                const match = data[0];
                return {
                    fixture: {
                        id: match.fixture.id,
                        status: {
                            short: match.fixture.status.short,
                        },
                    },
                    goals: {
                        home: match.goals.home,
                        away: match.goals.away,
                    },
                };
            }

            return null;
        } catch (error) {
            logger.error(`API-Football fetch error for match ${matchId}:`, error);
            return null;
        }
    }

    /**
     * Process match update and send notifications
     */
    private static async processMatchUpdate(
        matchId: number,
        matchData: ApiFootballMatch,
        favoriteMatches: any[]
    ) {
        const status = matchData.fixture.status.short;
        const homeScore = matchData.goals.home ?? 0;
        const awayScore = matchData.goals.away ?? 0;

        // Get all favorites for this match
        const matchFavorites = favoriteMatches.filter(f => f.apiMatchId === matchId);

        for (const favorite of matchFavorites) {
            const pushToken = favorite.user?.expoPushToken;
            if (!pushToken) continue;

            const lastHomeScore = favorite.lastHomeScore ?? 0;
            const lastAwayScore = favorite.lastAwayScore ?? 0;
            const lastStatus = favorite.lastStatus;

            // STATUSES IN API-FOOTBALL:
            // TBD, NS (Not Started), 1H, HT, 2H, ET, BT, P (Penalty), FT, AET, PEN

            // Check for match start (NS -> 1H or LIVE)
            if (!favorite.notifiedStart && ['1H', 'LIVE', 'HT'].includes(status) && !['1H', 'LIVE', 'HT', '2H'].includes(lastStatus || '')) {
                logger.info(`📢 Sending match start notification for match ${matchId}`);
                await NotificationService.createMatchStartNotification(
                    favorite.userId,
                    pushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    matchId
                );

                await prisma.favoriteMatch.update({
                    where: { id: favorite.id },
                    data: { notifiedStart: true },
                });
            }

            // Check for goals
            if (homeScore > lastHomeScore) {
                logger.info(`⚽ Home team scored! Match ${matchId}`);
                await NotificationService.createGoalNotification(
                    favorite.userId,
                    pushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    'home',
                    matchId
                );
            }

            if (awayScore > lastAwayScore) {
                logger.info(`⚽ Away team scored! Match ${matchId}`);
                await NotificationService.createGoalNotification(
                    favorite.userId,
                    pushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    'away',
                    matchId
                );
            }

            // Check for halftime
            if (status === 'HT' && lastStatus !== 'HT') {
                logger.info(`⏸️ Halftime for match ${matchId}`);
                await NotificationService.createHalftimeNotification(
                    favorite.userId,
                    pushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    matchId
                );
            }

            // Check for match end (FT, AET, PEN)
            if (!favorite.notifiedEnd && ['FT', 'AET', 'PEN'].includes(status)) {
                logger.info(`🏁 Match ended: ${matchId}`);
                await NotificationService.createMatchEndNotification(
                    favorite.userId,
                    pushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    matchId
                );

                // Resolve predictions for this match (awards coins for correct predictions)
                await PredictionResolverService.resolveMatchPredictions(matchId, homeScore, awayScore);

                await prisma.favoriteMatch.update({
                    where: { id: favorite.id },
                    data: { notifiedEnd: true },
                });
            }

            // Update last known scores and status in DB
            await prisma.favoriteMatch.update({
                where: { id: favorite.id },
                data: {
                    lastHomeScore: homeScore,
                    lastAwayScore: awayScore,
                    lastStatus: status,
                    updatedAt: new Date()
                },
            });
        }

        // Send WebSocket match update to all subscribed clients
        WebSocketService.sendMatchUpdate(matchId, {
            matchId,
            homeScore,
            awayScore,
            status,
        });
    }
}

export default MatchWatcherService;
