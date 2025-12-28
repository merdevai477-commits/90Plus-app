/**
 * Match Cache Service
 * 
 * Provides intelligent caching for football matches:
 * - Finished matches → Stored permanently in PostgreSQL
 * - Live matches → Cached in memory with short TTL
 * - Scheduled matches → Cached in memory with medium TTL
 * 
 * This minimizes API calls by:
 * 1. Never re-fetching finished matches from API
 * 2. Sharing cached data across all users
 * 3. Using single batch requests with from/to parameters
 */

import { PrismaClient, CachedFixture } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Status codes for finished matches
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

// Status codes for live matches
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];

// Cache TTL values
const CACHE_TTL = {
    LIVE: 30 * 1000,        // 30 seconds for live matches
    SCHEDULED: 5 * 60 * 1000, // 5 minutes for scheduled matches
    FINISHED: Infinity,      // Permanent (stored in DB)
};

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface FixtureFromAPI {
    fixture: {
        id: number;
        referee: string | null;
        timezone: string;
        date: string;
        timestamp: number;
        periods: {
            first: number | null;
            second: number | null;
        };
        venue: {
            id: number | null;
            name: string | null;
            city: string | null;
        };
        status: {
            long: string;
            short: string;
            elapsed: number | null;
        };
    };
    league: {
        id: number;
        name: string;
        country: string;
        logo: string;
        flag: string | null;
        season: number;
        round: string;
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
        away: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    score: {
        halftime: {
            home: number | null;
            away: number | null;
        };
        fulltime: {
            home: number | null;
            away: number | null;
        };
        extratime: {
            home: number | null;
            away: number | null;
        };
        penalty: {
            home: number | null;
            away: number | null;
        };
    };
}

class MatchCacheService {
    // In-memory cache for live and scheduled matches
    private memoryCache = new Map<string, CacheEntry<any>>();

    // Track which fixture IDs are already in database
    private dbFixtureIds = new Set<number>();

    // Last time we synced DB fixture IDs
    private lastDbSync = 0;
    private readonly DB_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // ✅ Request deduplication: prevent multiple simultaneous API calls for the same data
    private pendingRequests = new Map<string, Promise<FixtureFromAPI[]>>();

    constructor() {
        // Initial DB sync
        this.syncDbFixtureIds();
    }

    /**
     * Sync fixture IDs from database to memory for fast lookup
     */
    private async syncDbFixtureIds(): Promise<void> {
        const now = Date.now();
        if (now - this.lastDbSync < this.DB_SYNC_INTERVAL) {
            return;
        }

        try {
            const fixtures = await prisma.cachedFixture.findMany({
                select: { fixtureId: true },
            });

            this.dbFixtureIds.clear();
            fixtures.forEach(f => this.dbFixtureIds.add(f.fixtureId));
            this.lastDbSync = now;

            logger.debug(`📦 Synced ${this.dbFixtureIds.size} fixture IDs from database`);
        } catch (error) {
            logger.error('Failed to sync fixture IDs from database:', error);
        }
    }

    /**
     * Check if a fixture is already stored in database
     */
    isFixtureInDb(fixtureId: number): boolean {
        return this.dbFixtureIds.has(fixtureId);
    }

    /**
     * Check if a fixture status indicates it's finished
     */
    isFinishedStatus(status: string): boolean {
        return FINISHED_STATUSES.includes(status);
    }

    /**
     * Check if a fixture status indicates it's live
     */
    isLiveStatus(status: string): boolean {
        return LIVE_STATUSES.includes(status);
    }

    /**
     * Get matches from memory cache
     */
    getFromMemoryCache<T>(key: string): T | null {
        const entry = this.memoryCache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.memoryCache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set matches in memory cache
     */
    setInMemoryCache<T>(key: string, data: T, ttl: number): void {
        this.memoryCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * Get finished matches from database for a date range
     */
    async getFinishedMatchesFromDb(from: Date, to: Date): Promise<CachedFixture[]> {
        try {
            const matches = await prisma.cachedFixture.findMany({
                where: {
                    matchDate: {
                        gte: from,
                        lte: to,
                    },
                    status: {
                        in: FINISHED_STATUSES,
                    },
                },
                orderBy: {
                    matchTimestamp: 'desc',
                },
            });

            logger.debug(`📦 Retrieved ${matches.length} finished matches from database`);
            return matches;
        } catch (error) {
            logger.error('Failed to get finished matches from database:', error);
            return [];
        }
    }

    /**
     * Archive finished matches to database
     * ✅ Automatically fetches and stores lineups, statistics, and events for finished matches
     * ✅ This ensures all match data is permanently cached (0 API calls for future requests)
     */
    async archiveFinishedMatches(fixtures: FixtureFromAPI[]): Promise<number> {
        const finishedFixtures = fixtures.filter(f =>
            this.isFinishedStatus(f.fixture.status.short) &&
            !this.isFixtureInDb(f.fixture.id)
        );

        if (finishedFixtures.length === 0) {
            return 0;
        }

        let archivedCount = 0;

        for (const fixture of finishedFixtures) {
            try {
                // ✅ Store basic match data first
                await prisma.cachedFixture.upsert({
                    where: { fixtureId: fixture.fixture.id },
                    update: {
                        homeScore: fixture.goals.home,
                        awayScore: fixture.goals.away,
                        status: fixture.fixture.status.short,
                        statusLong: fixture.fixture.status.long,
                        fullData: fixture as any,
                        updatedAt: new Date(),
                    },
                    create: {
                        fixtureId: fixture.fixture.id,
                        leagueId: fixture.league.id,
                        leagueName: fixture.league.name,
                        leagueLogo: fixture.league.logo,
                        leagueCountry: fixture.league.country,
                        leagueSeason: fixture.league.season,
                        leagueRound: fixture.league.round,
                        homeTeamId: fixture.teams.home.id,
                        homeTeamName: fixture.teams.home.name,
                        homeTeamLogo: fixture.teams.home.logo,
                        awayTeamId: fixture.teams.away.id,
                        awayTeamName: fixture.teams.away.name,
                        awayTeamLogo: fixture.teams.away.logo,
                        homeScore: fixture.goals.home,
                        awayScore: fixture.goals.away,
                        homeHalftimeScore: fixture.score?.halftime?.home,
                        awayHalftimeScore: fixture.score?.halftime?.away,
                        matchDate: new Date(fixture.fixture.date),
                        matchTimestamp: fixture.fixture.timestamp,
                        status: fixture.fixture.status.short,
                        statusLong: fixture.fixture.status.long,
                        venue: fixture.fixture.venue?.name,
                        referee: fixture.fixture.referee,
                        fullData: fixture as any,
                    },
                });

                // Add to local cache
                this.dbFixtureIds.add(fixture.fixture.id);
                archivedCount++;

                // ✅ AUTOMATIC: Fetch and store lineups, statistics, and events in background
                // This ensures future requests for this match data = 0 API calls
                this.fetchAndStoreMatchDetails(fixture.fixture.id).catch(error => {
                    logger.error(`Failed to fetch match details for fixture ${fixture.fixture.id}:`, error);
                });
            } catch (error) {
                logger.error(`Failed to archive fixture ${fixture.fixture.id}:`, error);
            }
        }

        if (archivedCount > 0) {
            logger.info(`✅ Archived ${archivedCount} finished matches to database (fetching details in background)`);
        }

        return archivedCount;
    }

    /**
     * ✅ Fetch and store match details (lineups, statistics, events) for finished matches
     * This is called automatically when a match finishes
     * Future requests for this data = 0 API calls (from DB)
     */
    private async fetchAndStoreMatchDetails(fixtureId: number): Promise<void> {
        try {
            // Import here to avoid circular dependencies
            const { footballService } = await import('./football.service');
            
            // Fetch all match details in parallel (1 API call per type, but only once)
            const [lineups, statistics, events] = await Promise.allSettled([
                footballService.getFixtureLineups(fixtureId),
                footballService.getFixtureStatistics(fixtureId),
                footballService.getFixtureEvents(fixtureId),
            ]);

            // Get existing fullData
            const existing = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { fullData: true },
            });

            if (existing) {
                const currentData = existing.fullData as any || {};
                const updatedData: any = { ...currentData };

                // Add lineups if fetched successfully
                if (lineups.status === 'fulfilled' && lineups.value?.length) {
                    updatedData.lineups = lineups.value;
                }

                // Add statistics if fetched successfully
                if (statistics.status === 'fulfilled' && statistics.value?.length) {
                    updatedData.statistics = statistics.value;
                }

                // Add events if fetched successfully
                if (events.status === 'fulfilled' && events.value?.length) {
                    updatedData.events = events.value;
                }

                // Update fullData with all match details
                await prisma.cachedFixture.update({
                    where: { fixtureId },
                    data: {
                        fullData: updatedData,
                        updatedAt: new Date(),
                    },
                });

                logger.debug(`💾 Stored match details for fixture ${fixtureId} (lineups, statistics, events) - future requests = 0 API calls`);
            }
        } catch (error) {
            logger.error(`Failed to fetch and store match details for fixture ${fixtureId}:`, error);
        }
    }

    /**
     * Convert CachedFixture from database to API-like format
     */
    convertDbMatchToApiFormat(dbMatch: CachedFixture): FixtureFromAPI {
        // If we have the full data stored, use it
        if (dbMatch.fullData && typeof dbMatch.fullData === 'object') {
            return dbMatch.fullData as unknown as FixtureFromAPI;
        }

        // Otherwise, reconstruct from individual fields
        return {
            fixture: {
                id: dbMatch.fixtureId,
                referee: dbMatch.referee,
                timezone: 'UTC',
                date: dbMatch.matchDate.toISOString(),
                timestamp: dbMatch.matchTimestamp,
                periods: { first: null, second: null },
                venue: {
                    id: null,
                    name: dbMatch.venue,
                    city: null,
                },
                status: {
                    long: dbMatch.statusLong || dbMatch.status,
                    short: dbMatch.status,
                    elapsed: null,
                },
            },
            league: {
                id: dbMatch.leagueId,
                name: dbMatch.leagueName,
                country: dbMatch.leagueCountry || '',
                logo: dbMatch.leagueLogo || '',
                flag: null,
                season: dbMatch.leagueSeason || 2024,
                round: dbMatch.leagueRound || '',
            },
            teams: {
                home: {
                    id: dbMatch.homeTeamId,
                    name: dbMatch.homeTeamName,
                    logo: dbMatch.homeTeamLogo || '',
                    winner: dbMatch.homeScore !== null && dbMatch.awayScore !== null
                        ? dbMatch.homeScore > dbMatch.awayScore
                        : null,
                },
                away: {
                    id: dbMatch.awayTeamId,
                    name: dbMatch.awayTeamName,
                    logo: dbMatch.awayTeamLogo || '',
                    winner: dbMatch.homeScore !== null && dbMatch.awayScore !== null
                        ? dbMatch.awayScore > dbMatch.homeScore
                        : null,
                },
            },
            goals: {
                home: dbMatch.homeScore,
                away: dbMatch.awayScore,
            },
            score: {
                halftime: {
                    home: dbMatch.homeHalftimeScore,
                    away: dbMatch.awayHalftimeScore,
                },
                fulltime: {
                    home: dbMatch.homeScore,
                    away: dbMatch.awayScore,
                },
                extratime: { home: null, away: null },
                penalty: { home: null, away: null },
            },
        };
    }

    /**
     * Get optimized matches - combines DB (finished) + API (live/scheduled)
     * ✅ Request deduplication: If 1000 users request the same data, only 1 API call is made
     * ✅ All users share the same cached data from database
     * This is the main entry point for match data
     */
    async getOptimizedMatches(
        from: Date,
        to: Date,
        fetchFromApi: () => Promise<FixtureFromAPI[]>
    ): Promise<FixtureFromAPI[]> {
        // 1. Get finished matches from database (no API call needed, shared across all users)
        const dbMatches = await this.getFinishedMatchesFromDb(from, to);
        const dbMatchesConverted = dbMatches.map(m => this.convertDbMatchToApiFormat(m));
        const dbFixtureIds = new Set(dbMatches.map(m => m.fixtureId));

        logger.debug(`📦 Got ${dbMatchesConverted.length} finished matches from DB (shared for all users)`);

        // 2. Check memory cache for live/scheduled matches
        const cacheKey = `matches_${from.toISOString()}_${to.toISOString()}`;
        const cachedApiMatches = this.getFromMemoryCache<FixtureFromAPI[]>(cacheKey);

        if (cachedApiMatches) {
            logger.debug(`📦 Got ${cachedApiMatches.length} matches from memory cache (shared for all users)`);

            // Filter out any matches that are now in DB
            const filteredApiMatches = cachedApiMatches.filter(m => !dbFixtureIds.has(m.fixture.id));

            // Combine DB + cached API matches
            return [...dbMatchesConverted, ...filteredApiMatches];
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request for this data
        // If 1000 users request the same data simultaneously, they all wait for the same API call
        const pendingRequest = this.pendingRequests.get(cacheKey);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending API request (${this.pendingRequests.size} concurrent requests)`);
            const apiMatches = await pendingRequest;
            
            // Filter out matches that are already in DB
            const nonDbMatches = apiMatches.filter(m => !this.isFixtureInDb(m.fixture.id));
            
            // Combine DB + API matches
            return [...dbMatchesConverted, ...nonDbMatches];
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug('📡 Fetching matches from API (this request will be shared with all concurrent users)...');
        const apiRequestPromise = (async () => {
            try {
                const apiMatches = await fetchFromApi();

                // Archive any newly finished matches to database (shared for all users)
                await this.archiveFinishedMatches(apiMatches);

                // Cache live/scheduled matches with appropriate TTL
                const nonDbMatches = apiMatches.filter(m => !this.isFixtureInDb(m.fixture.id));
                const hasLive = nonDbMatches.some(m => this.isLiveStatus(m.fixture.status.short));
                const ttl = hasLive ? CACHE_TTL.LIVE : CACHE_TTL.SCHEDULED;
                this.setInMemoryCache(cacheKey, nonDbMatches, ttl);

                logger.debug(`✅ API request completed. ${nonDbMatches.length} live/scheduled matches cached (shared for all users)`);
                return apiMatches;
            } finally {
                // Remove from pending requests after completion
                this.pendingRequests.delete(cacheKey);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingRequests.set(cacheKey, apiRequestPromise);

        // Wait for the API request to complete
        const apiMatches = await apiRequestPromise;

        // Filter out matches that are already in DB
        const nonDbMatches = apiMatches.filter(m => !this.isFixtureInDb(m.fixture.id));

        // Combine all matches
        return [...dbMatchesConverted, ...nonDbMatches];
    }

    /**
     * Clear memory cache (useful for testing)
     */
    clearMemoryCache(): void {
        this.memoryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        memoryCacheSize: number;
        dbFixtureCount: number;
        lastDbSync: number;
    } {
        return {
            memoryCacheSize: this.memoryCache.size,
            dbFixtureCount: this.dbFixtureIds.size,
            lastDbSync: this.lastDbSync,
        };
    }
}

export const matchCacheService = new MatchCacheService();
export { MatchCacheService, FixtureFromAPI, FINISHED_STATUSES, LIVE_STATUSES };
