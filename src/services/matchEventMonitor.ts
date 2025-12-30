import ApiFootballService, { FixtureEvent, Fixture, isRateLimitError } from '../../services/apiFootball';
import { MatchEventStorage, EventSnapshot } from '../storage/matchEventStorage';
import { logger } from '../../services/logger';

export interface MatchEvent {
    fixtureId: string;
    matchName: string; // "Team A vs Team B"
    type: 'goal' | 'red_card' | 'yellow_card' | 'penalty';
    player: string;
    team: string;
    minute: number;
    detail: string;
    timestamp: number;
}

/**
 * Service to monitor favorited matches for new events
 */
export const MatchEventMonitor = {
    /**
     * Check for new events in a specific match
     * Returns array of NEW events that weren't in the last snapshot
     */
    async checkMatchEvents(fixtureId: number): Promise<MatchEvent[]> {
        try {
            const fixtureIdStr = String(fixtureId);

            // Fetch fixture details to get match name
            const fixtureDetails = await ApiFootballService.getFixtureById(fixtureId);
            const matchName = fixtureDetails 
                ? `${fixtureDetails.teams.home.name} vs ${fixtureDetails.teams.away.name}`
                : 'Match';

            // Fetch current events from API
            const currentEvents = await ApiFootballService.getFixtureEvents(fixtureId);

            // Get last known snapshot
            const lastSnapshot = await MatchEventStorage.getSnapshot(fixtureIdStr);

            // Convert API events to snapshot format
            const currentSnapshot: EventSnapshot['events'] = currentEvents.map((event: FixtureEvent) => ({
                id: `${fixtureId}-${event.time.elapsed}-${event.type}-${event.player.id}`,
                time: event.time.elapsed,
                type: event.type,
                detail: event.detail,
                player: event.player.name,
                team: event.team.name,
            }));

            // Detect new events
            const newEvents: MatchEvent[] = [];

            if (!lastSnapshot) {
                // First time checking this match - don't notify about existing events
                logger.error(`📸 First snapshot for fixture ${fixtureId} (${matchName})`);
            } else {
                // Compare current with last snapshot
                const lastEventIds = new Set(lastSnapshot.events.map((e) => e.id));

                const newApiEvents = currentSnapshot.filter((e) => !lastEventIds.has(e.id));

                // Convert to MatchEvent format (only important events)
                for (const event of newApiEvents) {
                    const matchEvent = this.convertToMatchEvent(
                        fixtureId,
                        event,
                        matchName
                    );
                    if (matchEvent) {
                        newEvents.push(matchEvent);
                    }
                }
            }

            // Save the current snapshot
            await MatchEventStorage.saveSnapshot(fixtureIdStr, currentSnapshot);

            return newEvents;
        } catch (error) {
            // Handle rate limit errors gracefully with debug-level logging
            if (isRateLimitError(error)) {
                logger.debug(`⏸️ Rate limit encountered while checking events for fixture ${fixtureId}, will retry later`);
                return [];
            }
            // Log actual errors (not rate limits) as errors
            logger.error(`Error checking match events for ${fixtureId}:`, error);
            return [];
        }
    },

    /**
     * Monitor multiple matches and return all new events
     */
    async monitorMatches(fixtureIds: number[]): Promise<MatchEvent[]> {
        const allNewEvents: MatchEvent[] = [];

        // Check all matches in parallel
        const results = await Promise.allSettled(
            fixtureIds.map((id) => this.checkMatchEvents(id))
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allNewEvents.push(...result.value);
            } else {
                // Handle rate limit errors gracefully with debug-level logging
                if (isRateLimitError(result.reason)) {
                    logger.debug(`⏸️ Rate limit encountered while monitoring fixture ${fixtureIds[index]}, will retry later`);
                } else {
                    // Log actual errors (not rate limits) as errors
                    logger.error(`Failed to monitor fixture ${fixtureIds[index]}:`, result.reason);
                }
            }
        });

        return allNewEvents;
    },

    /**
     * Convert snapshot event to MatchEvent (filter only important events)
     */
    convertToMatchEvent(
        fixtureId: number,
        event: EventSnapshot['events'][0],
        matchName: string
    ): MatchEvent | null {
        const { type, detail, player, team, time } = event;

        // Goal
        if (type === 'Goal') {
            return {
                fixtureId: String(fixtureId),
                matchName,
                type: 'goal',
                player,
                team,
                minute: time,
                detail: detail.includes('Penalty')
                    ? 'Penalty Goal'
                    : detail.includes('Own')
                        ? 'Own Goal'
                        : 'Goal',
                timestamp: Date.now(),
            };
        }

        // Red Card
        if (type === 'Card' && detail.includes('Red')) {
            return {
                fixtureId: String(fixtureId),
                matchName,
                type: 'red_card',
                player,
                team,
                minute: time,
                detail: 'Red Card',
                timestamp: Date.now(),
            };
        }

        // Yellow Card (optional: might be too noisy)
        if (type === 'Card' && detail.includes('Yellow')) {
            return {
                fixtureId: String(fixtureId),
                matchName,
                type: 'yellow_card',
                player,
                team,
                minute: time,
                detail: 'Yellow Card',
                timestamp: Date.now(),
            };
        }

        // Penalty awarded (from Var events)
        if (type === 'Var' && detail.includes('Penalty')) {
            return {
                fixtureId: String(fixtureId),
                matchName,
                type: 'penalty',
                player,
                team,
                minute: time,
                detail: 'Penalty Awarded',
                timestamp: Date.now(),
            };
        }

        // Not an important event
        return null;
    },

    /**
     * Get live favorited fixtures
     */
    async getLiveFavoritedFixtures(favoritedIds: string[]): Promise<number[]> {
        if (favoritedIds.length === 0) return [];

        try {
            // Fetch all live fixtures
            const liveFixtures = await ApiFootballService.getLiveFixtures();

            // Filter to only favorited ones
            const liveFavorited = liveFixtures
                .filter((f: Fixture) => favoritedIds.includes(String(f.fixture.id)))
                .map((f: Fixture) => f.fixture.id);

            return liveFavorited;
        } catch (error) {
            // Handle rate limit errors gracefully with debug-level logging
            if (isRateLimitError(error)) {
                logger.debug('⏸️ Rate limit encountered while getting live favorited fixtures, will retry later');
                return [];
            }
            // Log actual errors (not rate limits) as errors
            logger.error('Error getting live favorited fixtures:', error);
            return [];
        }
    },
};
