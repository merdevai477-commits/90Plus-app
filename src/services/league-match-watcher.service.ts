import prisma from '../lib/prisma';
import { NotificationService, NotificationType } from './notification.service';
import { logger } from '../utils/logger';
import { footballService } from './football.service';

interface ApiFootballFixture {
    fixture: {
        id: number;
        date: string;
        status: {
            short: string; // NS, 1H, HT, 2H, FT, etc.
        };
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
        };
        away: {
            id: number;
            name: string;
            logo: string;
        };
    };
    league: {
        id: number;
        name: string;
        season: number;
    };
    goals: {
        home: number | null;
        away: number | null;
    };
}

/**
 * League Match Watcher Service
 * Watches for matches in users' favorite leagues and sends notifications when matches start
 */
export class LeagueMatchWatcherService {
    private static isRunning = false;
    private static intervalId: NodeJS.Timeout | null = null;
    private static notifiedMatches = new Set<string>(); // Track notified matches: "userId:matchId"

    /**
     * Start the league match watcher (runs every 5 minutes)
     */
    static start() {
        if (this.intervalId) {
            logger.info('⚠️ League match watcher already running');
            return;
        }

        logger.info('🔄 Starting league match watcher service...');

        // Delay first run by 45 seconds to let the server finish startup
        setTimeout(() => {
            this.checkLeagueMatches();
        }, 45_000);

        // Then run every 5 minutes
        this.intervalId = setInterval(() => {
            this.checkLeagueMatches();
        }, 5 * 60 * 1000); // 5 minutes

        logger.info('✅ League match watcher started (first check in 45s, then every 5 minutes)');
    }

    /**
     * Stop the league match watcher
     */
    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('✅ League match watcher stopped');
        }
    }

    /**
     * Check for upcoming matches in users' favorite leagues
     */
    static async checkLeagueMatches() {
        if (this.isRunning) {
            logger.debug('⏳ League match check already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        logger.info('🔍 Checking favorite leagues for upcoming matches...');

        try {
            // Get all users with favorite leagues
            const users = await prisma.user.findMany({
                where: {
                    favoriteLeagues: {
                        isEmpty: false,
                    },
                    expoPushToken: {
                        not: null,
                    },
                    pushNotificationsConsent: true,
                },
                select: {
                    id: true,
                    favoriteLeagues: true,
                    expoPushToken: true,
                },
            });

            if (users.length === 0) {
                logger.debug('📭 No users with favorite leagues to check');
                this.isRunning = false;
                return;
            }

            logger.info(`👥 Found ${users.length} users with favorite leagues`);

            // Get current date and next 24 hours
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Group users by league to minimize API calls
            const leagueToUsers = new Map<number, string[]>(); // leagueId -> userIds[]
            for (const user of users) {
                for (const leagueId of user.favoriteLeagues) {
                    if (!leagueToUsers.has(leagueId)) {
                        leagueToUsers.set(leagueId, []);
                    }
                    leagueToUsers.get(leagueId)!.push(user.id);
                }
            }

            logger.info(`🏆 Checking ${leagueToUsers.size} unique favorite leagues`);

            // Check each league for upcoming matches
            for (const [leagueId, userIds] of leagueToUsers) {
                try {
                    await this.checkLeagueForMatches(leagueId, userIds, now, tomorrow);
                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error: any) {
                    logger.error(`❌ Error checking league ${leagueId}:`, error.message);
                }
            }

            logger.info('✅ League match check completed');
        } catch (error: any) {
            logger.error('❌ Error in league match watcher:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Check a specific league for upcoming matches and notify users
     */
    private static async checkLeagueForMatches(
        leagueId: number,
        userIds: string[],
        now: Date,
        tomorrow: Date
    ) {
        try {
            // Fetch fixtures for this league (next 24 hours)
            // Use 'from' and 'to' parameters to get fixtures in date range
            const fromDate = now.toISOString().split('T')[0];
            const toDate = tomorrow.toISOString().split('T')[0];
            
            const fixtures = await footballService.getFixtures({
                league: leagueId,
                season: new Date().getFullYear(),
                from: fromDate,
                to: toDate,
            });
            
            const allFixtures = fixtures || [];

            if (!fixtures || fixtures.length === 0) {
                return;
            }

            logger.info(`📅 Found ${fixtures.length} fixtures in league ${leagueId}`);

            // Get users for this league
            const users = await prisma.user.findMany({
                where: {
                    id: { in: userIds },
                    expoPushToken: { not: null },
                },
                select: {
                    id: true,
                    expoPushToken: true,
                },
            });

            // Process each fixture
            for (const fixture of allFixtures as ApiFootballFixture[]) {
                const matchId = fixture.fixture.id;
                const matchDate = new Date(fixture.fixture.date);
                const status = fixture.fixture.status.short;

                // Only notify for matches that are starting soon (within next 30 minutes) or just started
                const timeUntilMatch = matchDate.getTime() - now.getTime();
                const thirtyMinutes = 30 * 60 * 1000;

                // Notify if:
                // 1. Match is starting within 30 minutes and hasn't started yet (NS status)
                // 2. Match just started (1H, LIVE status) and we haven't notified yet
                if (
                    (status === 'NS' && timeUntilMatch > 0 && timeUntilMatch <= thirtyMinutes) ||
                    (['1H', 'LIVE'].includes(status) && timeUntilMatch <= thirtyMinutes)
                ) {
                    for (const user of users) {
                        const notificationKey = `${user.id}:${matchId}`;
                        
                        // Skip if already notified (check DB to survive server restarts)
                        if (this.notifiedMatches.has(notificationKey)) {
                            continue;
                        }

                        // Also check DB for persistence across restarts
                        const alreadyNotified = await prisma.notification.findFirst({
                            where: {
                                userId: user.id,
                                type: NotificationType.MATCH_START as any,
                                data: {
                                    path: ['matchId'],
                                    equals: matchId,
                                },
                                createdAt: {
                                    gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
                                },
                            },
                            select: { id: true },
                        });

                        if (alreadyNotified) {
                            this.notifiedMatches.add(notificationKey); // cache in memory too
                            continue;
                        }

                        // Send notification
                        await this.sendLeagueMatchNotification(
                            user.id,
                            user.expoPushToken!,
                            fixture,
                            leagueId
                        );

                        // Mark as notified
                        this.notifiedMatches.add(notificationKey);

                        // Clean up old notifications (keep only last 1000)
                        if (this.notifiedMatches.size > 1000) {
                            const firstKey = this.notifiedMatches.values().next().value;
                            if (firstKey) {
                                this.notifiedMatches.delete(firstKey);
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            logger.error(`❌ Error checking league ${leagueId} for matches:`, error.message);
        }
    }

    /**
     * Send notification to user about a match in their favorite league
     */
    private static async sendLeagueMatchNotification(
        userId: string,
        pushToken: string,
        fixture: ApiFootballFixture,
        leagueId: number
    ) {
        try {
            const homeTeam = fixture.teams.home.name;
            const awayTeam = fixture.teams.away.name;
            const leagueName = fixture.league.name;
            const matchId = fixture.fixture.id;
            const status = fixture.fixture.status.short;

            let title: string;
            let message: string;

            if (status === 'NS') {
                // Match starting soon
                const matchDate = new Date(fixture.fixture.date);
                const minutesUntil = Math.round((matchDate.getTime() - Date.now()) / (60 * 1000));
                title = '⏰ مباراة قريباً!';
                message = `${homeTeam} vs ${awayTeam} - بعد ${minutesUntil} دقيقة`;
            } else {
                // Match just started
                title = '🚀 بدأت المباراة!';
                message = `${homeTeam} vs ${awayTeam}\n${leagueName}\nالمباراة بدأت الآن`;
            }

            await NotificationService.createNotification({
                userId,
                pushToken,
                title,
                message,
                type: NotificationType.MATCH_START,
                data: {
                    type: status === 'NS' ? 'MATCH_REMINDER' : 'LEAGUE_MATCH_START',
                    matchId,
                    fixtureId: matchId,
                    leagueId,
                    homeTeam,
                    awayTeam,
                    leagueName,
                },
            });

            logger.info(`📢 Sent league match notification to user ${userId} for match ${matchId}`);
        } catch (error: any) {
            logger.error(`❌ Error sending league match notification:`, error.message);
        }
    }
}

export default LeagueMatchWatcherService;

