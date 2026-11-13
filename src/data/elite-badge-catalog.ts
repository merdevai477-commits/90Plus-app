export const ELITE_BADGE_KEYS = [
    'prediction_streak',
    'king_game',
    'king_results',
    'prediction_accuracy',
    'competition_champion',
    'scorers_overall',
    'scorers_europe',
    'scorers_egypt',
    'scorers_streak',
    'coach',
    'coach_tactics',
    'community_activity',
    'shares',
    'posts',
    'reels',
    'reel_engagement',
    'comments',
    'daily_streak',
    'activity_streak',
    'points',
    'ranking_champion',
] as const;

export type EliteBadgeKey = (typeof ELITE_BADGE_KEYS)[number];

export type EliteAwardDuration = '7' | '30' | 'permanent';

export function expiresAtFor(duration: EliteAwardDuration, now = new Date()): Date | null {
    if (duration === 'permanent') return null;
    const days = duration === '7' ? 7 : 30;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function activeSlotFor(userId: string, badgeId: string, competitionId?: string | null): string {
    return `${userId}:${badgeId}:${competitionId || 'global'}`;
}

export function isAwardActive(
    award: { revokedAt: Date | null; expiresAt: Date | null; activeSlot?: string | null },
    now = new Date(),
): boolean {
    if (award.revokedAt) return false;
    if (!award.activeSlot) return false;
    if (award.expiresAt && award.expiresAt.getTime() <= now.getTime()) return false;
    return true;
}

export function takeTop<T>(rows: T[], limit = 10): T[] {
    return rows.slice(0, Math.max(0, limit));
}
