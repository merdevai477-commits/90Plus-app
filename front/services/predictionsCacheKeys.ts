/**
 * User-scoped AsyncStorage keys for prediction state.
 *
 * SECURITY: The predictions cache MUST be scoped per-user. Without the
 * trailing userId, a logged-out → logged-in user on the same device would
 * inherit the previous account's predictions. Always construct keys through
 * these helpers, never as string literals.
 */

const PRED_MAP_BASE = 'predictions_map_v1';
const PRED_TICKETS_BASE = 'predictions_tickets_v1';

/** Prefix used to discover every prediction-related key at logout time. */
export const PREDICTION_CACHE_KEY_PREFIXES = [PRED_MAP_BASE, PRED_TICKETS_BASE] as const;

export function predictionsMapKey(userId: string): string {
    return `${PRED_MAP_BASE}_${userId}`;
}

export function predictionsTicketsKey(userId: string): string {
    return `${PRED_TICKETS_BASE}_${userId}`;
}
