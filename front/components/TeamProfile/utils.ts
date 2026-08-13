/**
 * Pure data helpers for the Team/Club profile. No JSX, no side effects —
 * safe to call from render paths.
 */

import type { Fixture } from '../../services/apiFootball';
import {
    LIVE_STATUS_SHORTS,
    FINISHED_STATUS_SHORTS,
} from '../../src/store/liveFixtureStore.types';

export type MatchPhase = 'live' | 'finished' | 'upcoming';

export function getMatchPhase(shortStatus: string | null | undefined): MatchPhase {
    const s = (shortStatus ?? 'NS').toUpperCase();
    if (LIVE_STATUS_SHORTS.has(s)) return 'live';
    if (FINISHED_STATUS_SHORTS.has(s)) return 'finished';
    return 'upcoming';
}

export function isLiveStatus(shortStatus: string | null | undefined): boolean {
    return getMatchPhase(shortStatus) === 'live';
}

// ─── Competitions from fixtures ──────────────────────────────────────────────

export interface CompetitionOption {
    id: number;
    name: string;
    logo: string | null;
    country: string | null;
    count: number;
}

export function deriveCompetitions(fixtures: Fixture[]): CompetitionOption[] {
    const byId = new Map<number, CompetitionOption>();
    for (const fx of fixtures) {
        const league = fx.league;
        if (!league?.id) continue;
        const existing = byId.get(league.id);
        if (existing) {
            existing.count += 1;
        } else {
            byId.set(league.id, {
                id: league.id,
                name: league.name,
                logo: league.logo ?? null,
                country: league.country ?? null,
                count: 1,
            });
        }
    }
    return [...byId.values()].sort((a, b) => b.count - a.count);
}

export function mostFrequentLeagueId(fixtures: Fixture[]): number | null {
    const comps = deriveCompetitions(fixtures);
    return comps.length > 0 ? comps[0].id : null;
}

// ─── Season statistics normalization ─────────────────────────────────────────

export interface NormalizedTeamStats {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    cleanSheets: number | null;
    winRate: number; // 0..100
    avgGoalsFor: number;
    avgGoalsAgainst: number;
    form: string[]; // e.g. ['W','D','L']
}

/** Season stats derived directly from finished 365 fixtures. */
export function computeStatsFromFixtures(
    finished: Fixture[],
    teamId: number,
): NormalizedTeamStats | null {
    if (!Array.isArray(finished) || finished.length === 0) return null;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;
    const form: string[] = [];

    // Newest first for form; API returns finished newest-first already in most cases.
    for (const fx of finished) {
        const isHome = fx.teams?.home?.id === teamId;
        const gf = isHome ? fx.goals?.home ?? 0 : fx.goals?.away ?? 0;
        const ga = isHome ? fx.goals?.away ?? 0 : fx.goals?.home ?? 0;
        goalsFor += gf;
        goalsAgainst += ga;
        if (ga === 0) cleanSheets += 1;
        if (gf > ga) {
            wins += 1;
            form.push('W');
        } else if (gf === ga) {
            draws += 1;
            form.push('D');
        } else {
            losses += 1;
            form.push('L');
        }
    }

    const played = finished.length;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

    return {
        played,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDiff: goalsFor - goalsAgainst,
        cleanSheets,
        winRate,
        avgGoalsFor: played > 0 ? Math.round((goalsFor / played) * 10) / 10 : 0,
        avgGoalsAgainst: played > 0 ? Math.round((goalsAgainst / played) * 10) / 10 : 0,
        form: form.slice(0, 6),
    };
}
