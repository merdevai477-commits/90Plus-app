/**
 * Match Subscriptions Service
 *
 * Thin client over `/api/notifications/match-subscribe` endpoints. Used by
 * the bell icon on the matches screen and match-details top bar.
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

/** Collapse concurrent GETs and cache briefly across Matches + Match Details. */
const LIST_IDS_TTL_MS = 30_000;
let _inFlightIds: Promise<Set<number>> | null = null;
let _cachedIds: Set<number> | null = null;
let _cachedAt = 0;

function authHeaders(token: string): HeadersInit {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

function invalidateListIdsCache(): void {
    _cachedIds = null;
    _cachedAt = 0;
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
        invalidateListIdsCache();
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
        invalidateListIdsCache();
    },

    /**
     * Fetch the current user's set of subscribed fixture ids. Returns a Set
     * for O(1) membership checks on the UI side.
     */
    async listIds(token: string): Promise<Set<number>> {
        if (_cachedIds && Date.now() - _cachedAt < LIST_IDS_TTL_MS) {
            return _cachedIds;
        }
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
                const set = new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
                _cachedIds = set;
                _cachedAt = Date.now();
                return set;
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
