import prisma from '../lib/prisma';
import { NotificationService } from './notification.service';
import { WebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { footballService } from './football.service';
import { PredictionResolverService } from './prediction-resolver.service';
import { renderPushTemplate, type PushTemplateKey } from './push-templates.service';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';

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

interface ApiFootballEvent {
    time: { elapsed: number };
    team: { id: number; name: string };
    // API-Football also returns the player coming OFF in the `player` field
    // for substitutions, with the player coming ON in `assist`. We capture both.
    player: { id: number | null; name: string | null };
    assist: { id: number | null; name: string | null };
    type: string;    // 'Goal', 'Card', 'subst', 'Var'
    detail: string;  // 'Normal Goal', 'Yellow Card', 'Red Card', 'Second Yellow card',
                     // 'Substitution 1', 'Penalty confirmed', 'Goal cancelled', etc.
}

// In-memory store for last-seen event count per match (resets on server restart)
const seenEventCounts = new Map<number, number>();

// Deduplicate lineup-announcement notifications across cron drift. Lineups
// are not in /fixtures/events; we infer "lineup announced" from the lineup
// being available for a fixture and emit once per fixture.
const seenLineupMatches = new Set<number>();

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

        // Delay first run by 30 seconds to let the server finish startup
        setTimeout(() => {
            this.checkMatches();
        }, 30_000);

        // Then run every 2 minutes
        this.intervalId = setInterval(() => {
            this.checkMatches();
        }, 2 * 60 * 1000); // 2 minutes

        logger.info('✅ Match watcher started (first check in 30s, then every 2 minutes)');
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
                            pushNotificationsConsent: true,
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
        const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status);

        // Get all favorites for this match
        const matchFavorites = favoriteMatches.filter(f => f.apiMatchId === matchId);

        // Fetch events for this match if it's LIVE (for card notifications)
        let liveEvents: ApiFootballEvent[] = [];
        if (isLive) {
            liveEvents = await this.fetchMatchEvents(matchId);
        }

        for (const favorite of matchFavorites) {
            const pushToken = favorite.user?.expoPushToken;
            // The user explicitly tapped the bell icon for this match, so we bypass global pushNotificationsConsent.
            const effectivePushToken = pushToken ? pushToken : null;

            const lastHomeScore = favorite.lastHomeScore ?? 0;
            const lastAwayScore = favorite.lastAwayScore ?? 0;
            const lastStatus = favorite.lastStatus;

            // STATUSES IN API-FOOTBALL:
            // TBD, NS (Not Started), 1H, HT, 2H, ET, BT, P (Penalty), FT, AET, PEN

            // Match metadata bundle reused across all notification calls below
            // so the push deep-links to match-details with logos & league
            // already populated.
            const matchMeta = {
                homeTeamLogo: favorite.homeTeamLogo,
                awayTeamLogo: favorite.awayTeamLogo,
                leagueName: favorite.leagueName,
                matchDate: favorite.matchDate,
            };

            // Check for match start (NS -> 1H or LIVE)
            if (!favorite.notifiedStart && ['1H', 'LIVE', 'HT'].includes(status) && !['1H', 'LIVE', 'HT', '2H'].includes(lastStatus || '')) {
                logger.info(`📢 Sending match start notification for match ${matchId}`);
                await NotificationService.createMatchStartNotification(
                    favorite.userId,
                    effectivePushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    matchId,
                    matchMeta
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
                    effectivePushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    'home',
                    matchId,
                    matchMeta
                );
            }

            if (awayScore > lastAwayScore) {
                logger.info(`⚽ Away team scored! Match ${matchId}`);
                await NotificationService.createGoalNotification(
                    favorite.userId,
                    effectivePushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    'away',
                    matchId,
                    matchMeta
                );
            }

            // Check for halftime
            if (status === 'HT' && lastStatus !== 'HT') {
                logger.info(`⏸️ Halftime for match ${matchId}`);
                await NotificationService.createHalftimeNotification(
                    favorite.userId,
                    effectivePushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    matchId,
                    matchMeta
                );
            }

            // Check for match end (FT, AET, PEN)
            if (!favorite.notifiedEnd && ['FT', 'AET', 'PEN'].includes(status)) {
                logger.info(`🏁 Match ended: ${matchId}`);
                await NotificationService.createMatchEndNotification(
                    favorite.userId,
                    effectivePushToken,
                    favorite.homeTeam,
                    favorite.awayTeam,
                    homeScore,
                    awayScore,
                    matchId,
                    matchMeta
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

        // Process all live in-match events (cards / subs / VAR / penalty)
        // for users who favorited this match.
        if (isLive && liveEvents.length > 0) {
            await this.processLiveEvents(matchId, liveEvents, matchFavorites);
        }

        // Lineup announcements arrive ~30-60 min before kickoff. Re-check
        // for matches still in NS/TBD; if a lineup is present we emit once.
        if (status === 'NS' || status === 'TBD') {
            await this.checkLineupAnnouncements(matchId, matchFavorites).catch((err) =>
                logger.debug('[MatchWatcher] lineup check skipped:', err?.message),
            );
        }

        // Send WebSocket match update to all subscribed clients
        WebSocketService.sendMatchUpdate(matchId, {
            matchId,
            homeScore,
            awayScore,
            status,
        });
    }

    /**
     * Fetch live events (goals, cards) for a match from API-Football
     */
    private static async fetchMatchEvents(matchId: number): Promise<ApiFootballEvent[]> {
        try {
            const data = await footballService.fetchFromApi<any[]>('/fixtures/events', { fixture: matchId });
            if (!data || !Array.isArray(data)) return [];
            return data as ApiFootballEvent[];
        } catch (error) {
            logger.warn(`[MatchWatcher] Failed to fetch events for match ${matchId}:`, error);
            return [];
        }
    }

    /**
     * Process all live in-match events (cards / subs / VAR / penalty) and
     * notify users who favorited the match. Each event type maps to its own
     * notification type + template + preference toggle so the user can
     * silence noisy categories independently.
     *
     * We dedupe via `seenEventCounts` on the *total* count of relevant
     * events for this match in the current process. API-Football events are
     * append-only, so any new arrivals are at the tail of the array.
     */
    private static async processLiveEvents(
        matchId: number,
        events: ApiFootballEvent[],
        matchFavorites: any[]
    ) {
        // Filter to event types we care about.
        const relevant = events.filter((e) => this.classifyEvent(e) !== null);

        const prevCount = seenEventCounts.get(matchId) ?? 0;
        const newEvents = relevant.slice(prevCount);

        if (newEvents.length === 0) return;

        seenEventCounts.set(matchId, relevant.length);
        logger.info(`[MatchWatcher] ${newEvents.length} new live event(s) for match ${matchId}`);

        for (const event of newEvents) {
            const classified = this.classifyEvent(event);
            if (!classified) continue;
            await this.dispatchEvent(matchId, event, classified, matchFavorites);
        }
    }

    /**
     * Decide which notification + template family an API-Football event maps
     * to. Returns `null` when the event is ignored (e.g. a normal Goal which
     * is handled separately via the scoreline update path).
     */
    private static classifyEvent(event: ApiFootballEvent): null | {
        kind: 'card_yellow' | 'card_red' | 'substitution' | 'var' | 'penalty';
        type: NotificationType;
        titleKey: PushTemplateKey;
        bodyKey: PushTemplateKey;
    } {
        // Cards
        if (event.type === 'Card') {
            if (event.detail === 'Yellow Card') {
                return {
                    kind: 'card_yellow',
                    type: NotificationType.MATCH_YELLOW_CARD,
                    titleKey: 'matchYellowCardTitle',
                    bodyKey: 'matchCardBody',
                };
            }
            if (event.detail === 'Red Card' || event.detail === 'Second Yellow card') {
                return {
                    kind: 'card_red',
                    type: NotificationType.MATCH_RED_CARD,
                    titleKey: 'matchRedCardTitle',
                    bodyKey: 'matchCardBody',
                };
            }
        }
        // Substitutions
        if (event.type === 'subst') {
            return {
                kind: 'substitution',
                type: NotificationType.MATCH_UPDATE,
                titleKey: 'matchSubstitutionTitle',
                bodyKey: 'matchSubstitutionBody',
            };
        }
        // VAR review (Goal cancelled / Penalty confirmed / Goal confirmed)
        if (event.type === 'Var') {
            return {
                kind: 'var',
                type: NotificationType.MATCH_UPDATE,
                titleKey: 'matchVarTitle',
                bodyKey: 'matchVarBody',
            };
        }
        // Penalty awarded (subset of Goal: "Penalty" detail or VAR penalty)
        if (event.type === 'Goal' && event.detail === 'Penalty') {
            return {
                kind: 'penalty',
                type: NotificationType.MATCH_UPDATE,
                titleKey: 'matchPenaltyTitle',
                bodyKey: 'matchPenaltyBody',
            };
        }
        return null;
    }

    /**
     * Send the localized push + inbox row + WebSocket emit for one (event,
     * favorite) pair. Each event type honours its own pref toggle through
     * the `notifyUser` helper.
     */
    private static async dispatchEvent(
        matchId: number,
        event: ApiFootballEvent,
        classified: NonNullable<ReturnType<typeof MatchWatcherService['classifyEvent']>>,
        matchFavorites: any[],
    ): Promise<void> {
        const elapsed = event.time?.elapsed ?? '';
        const team = event.team?.name || '';

        // For subst events the player coming OFF is in `player`, coming ON
        // in `assist`. For all other types we use `player` directly.
        const playerOff = event.player?.name || '';
        const playerOn = event.assist?.name || playerOff;

        const vars: Record<string, string | number> = {
            player: event.player?.name || '',
            playerIn: playerOn,
            playerOut: playerOff,
            team,
            minute: elapsed,
            detail: event.detail || '',
        };

        // Each event kind maps to its own preference column on
        // NotificationPreferences. We check it here so users can mute
        // (e.g.) substitutions without muting goals.
        const prefKey: string | null =
            classified.kind === 'card_yellow' || classified.kind === 'card_red'
                ? 'matchCards'
                : classified.kind === 'substitution'
                    ? 'matchSubs'
                    : classified.kind === 'var'
                        ? 'matchVar'
                        : classified.kind === 'penalty'
                            ? 'matchGoals' // penalty is a goal-flavoured event
                            : null;

        // Bulk fetch preferences once per dispatch — favorites can be many.
        const userIds = matchFavorites.map((f) => f.userId);
        const prefRows = prefKey
            ? await (prisma as any).notificationPreferences.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, [prefKey]: true },
            }).catch(() => [] as any[])
            : ([] as any[]);
        const optedOut = new Set<string>(
            prefKey
                ? prefRows.filter((r: any) => r[prefKey] === false).map((r: any) => r.userId)
                : [],
        );

        // Fan-out with idempotency so retries can't double-notify.
        for (const favorite of matchFavorites) {
            if (optedOut.has(favorite.userId)) continue;
            try {
                await notifyUser({
                    userId: favorite.userId,
                    type: classified.type,
                    titleKey: classified.titleKey,
                    bodyKey: classified.bodyKey,
                    vars,
                    data: {
                        screen: '/match-details',
                        matchId,
                        eventKind: classified.kind,
                        team,
                        elapsed,
                    },
                    // We already enforced the per-kind preference above; the
                    // helper's coarser TYPE_TO_PREF maps the generic
                    // MATCH_UPDATE to matchGoals which would be wrong here.
                    bypassPreferences: true,
                    idempotencyKey: `match-event:${matchId}:${classified.kind}:${elapsed}:${event.player?.id ?? 'na'}:${favorite.userId}`,
                });
            } catch (err: any) {
                logger.warn(
                    `[MatchWatcher] ${classified.kind} notify failed for user ${favorite.userId}:`,
                    err?.message,
                );
            }
        }
    }

    /**
     * Detect lineup announcements and emit a one-shot notification per match.
     * API-Football exposes /fixtures/lineups; if at least one team has a
     * `startXI` we treat the lineup as announced and fan out to favorites.
     */
    static async checkLineupAnnouncements(matchId: number, matchFavorites: any[]): Promise<void> {
        if (seenLineupMatches.has(matchId)) return;
        try {
            const data = await footballService.fetchFromApi<any[]>('/fixtures/lineups', { fixture: matchId });
            if (!Array.isArray(data) || data.length === 0) return;
            const hasStartXI = data.some((team) => Array.isArray(team?.startXI) && team.startXI.length > 0);
            if (!hasStartXI) return;

            seenLineupMatches.add(matchId);

            const home = data[0]?.team?.name ?? '';
            const away = data[1]?.team?.name ?? '';

            // Bulk-check matchLineups preference so muted users are skipped.
            const userIds = matchFavorites.map((f) => f.userId);
            const prefRows = await (prisma as any).notificationPreferences.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, matchLineups: true },
            }).catch(() => [] as any[]);
            const optedOut = new Set<string>(
                prefRows.filter((r: any) => r.matchLineups === false).map((r: any) => r.userId),
            );

            for (const favorite of matchFavorites) {
                if (optedOut.has(favorite.userId)) continue;
                try {
                    await notifyUser({
                        userId: favorite.userId,
                        type: NotificationType.MATCH_UPDATE,
                        titleKey: 'matchLineupTitle',
                        bodyKey: 'matchLineupBody',
                        vars: { home, away },
                        data: { screen: '/match-details', matchId, eventKind: 'lineup' },
                        bypassPreferences: true,
                        idempotencyKey: `match-lineup:${matchId}:${favorite.userId}`,
                    });
                } catch (err: any) {
                    logger.warn(`[MatchWatcher] lineup notify failed for user ${favorite.userId}:`, err?.message);
                }
            }
        } catch (err: any) {
            logger.debug('[MatchWatcher] checkLineupAnnouncements skipped:', err?.message);
        }
    }
}

export default MatchWatcherService;
