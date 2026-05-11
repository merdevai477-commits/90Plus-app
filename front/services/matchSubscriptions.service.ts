/**
 * Match Subscriptions Service
 *
 * Thin client over `/api/notifications/match-subscribe` endpoints. Used by
 * the bell icon on the matches screen.
 */

import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

const API_URL = getApiUrl();

export interface SubscribeInput {
    fixtureId: string | number;
    matchTime: string; // ISO
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    leagueName?: string;
}

// Collapse duplicate concurrent GET calls from multiple screens.
let _inFlightIds: Promise<Set<number>> | null = null;

function authHeaders(token: string): HeadersInit {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export const MatchSubscriptionsService = {
    /**
     * Subscribe the current user to match-start push notifications for the
     * given fixture. Idempotent — resending the same payload is a no-op server-side.
     */
    async subscribe(token: string, input: SubscribeInput): Promise<void> {
        const response = await fetch(`${API_URL}/notifications/match-subscribe`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                fixtureId: input.fixtureId,
                matchTime: input.matchTime,
                homeTeam: input.homeTeam,
                awayTeam: input.awayTeam,
                homeTeamLogo: input.homeTeamLogo,
                awayTeamLogo: input.awayTeamLogo,
                leagueName: input.leagueName,
            }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Subscribe failed (${response.status}): ${text || response.statusText}`);
        }
    },

    /**
     * Unsubscribe from match-start notifications. Idempotent.
     */
    async unsubscribe(token: string, fixtureId: string | number): Promise<void> {
        const response = await fetch(`${API_URL}/notifications/match-subscribe/${fixtureId}`, {
            method: 'DELETE',
            headers: authHeaders(token),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Unsubscribe failed (${response.status}): ${text || response.statusText}`);
        }
    },

    /**
     * Fetch the current user's set of subscribed fixture ids. Returns a Set
     * for O(1) membership checks on the UI side.
     */
    async listIds(token: string): Promise<Set<number>> {
        if (_inFlightIds) return _inFlightIds;
        _inFlightIds = (async () => {
            try {
                const response = await fetch(`${API_URL}/notifications/match-subscriptions`, {
                    headers: authHeaders(token),
                });
                if (!response.ok) {
                    return new Set<number>();
                }
                const result = await response.json() as { data?: { fixtureIds?: number[] } };
                const ids = Array.isArray(result?.data?.fixtureIds) ? result.data!.fixtureIds! : [];
                return new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
            } catch (err) {
                logger.warn('MatchSubscriptionsService.listIds failed:', err);
                return new Set<number>();
            } finally {
                _inFlightIds = null;
            }
        })();
        return _inFlightIds;
    },
};

export default MatchSubscriptionsService;
