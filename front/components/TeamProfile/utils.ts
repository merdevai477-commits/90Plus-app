/**
 * Pure data helpers for the Team/Club profile. No JSX, no side effects —
 * safe to call from render paths.
 */

import type { Fixture, Trophy } from '../../services/apiFootball';
import type { SquadPlayer } from '../../hooks/useTeamProfile';
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

// ─── Trophies ────────────────────────────────────────────────────────────────

export interface AggregatedTrophy {
    leagueId: number;
    name: string;
    country: string;
    logo: string | null;
    titles: number;
    seasons: string[];
}

const WINNER_PLACES = new Set(['winner', '1st', 'champion', 'champions']);

export function isWinnerPlace(place: string | null | undefined): boolean {
    return WINNER_PLACES.has((place ?? '').trim().toLowerCase());
}

/**
 * Collapse the raw trophy list (one row per season) into per-competition title
 * counts, keeping only competitions actually won. Sorted by title count desc.
 */
export function aggregateTrophies(trophies: Trophy[] | undefined | null): AggregatedTrophy[] {
    if (!Array.isArray(trophies) || trophies.length === 0) return [];

    const byLeague = new Map<string, AggregatedTrophy>();
    for (const trophy of trophies) {
        if (!isWinnerPlace(trophy.place)) continue;
        const league = trophy.league;
        if (!league?.name) continue;
        const key = league.id != null ? `id:${league.id}` : `name:${league.name.toLowerCase()}`;
        const existing = byLeague.get(key);
        if (existing) {
            existing.titles += 1;
            if (trophy.season) existing.seasons.push(String(trophy.season));
        } else {
            byLeague.set(key, {
                leagueId: league.id ?? 0,
                name: league.name,
                country: league.country ?? '',
                logo: league.logo ?? null,
                titles: 1,
                seasons: trophy.season ? [String(trophy.season)] : [],
            });
        }
    }

    return [...byLeague.values()].sort((a, b) => b.titles - a.titles);
}

// ─── Squad grouping ──────────────────────────────────────────────────────────

export type PositionGroupKey = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';

export const POSITION_GROUP_ORDER: PositionGroupKey[] = [
    'Goalkeeper',
    'Defender',
    'Midfielder',
    'Attacker',
];

export function groupSquadByPosition(
    players: SquadPlayer[] | undefined | null,
): Record<PositionGroupKey, SquadPlayer[]> {
    const groups: Record<PositionGroupKey, SquadPlayer[]> = {
        Goalkeeper: [],
        Defender: [],
        Midfielder: [],
        Attacker: [],
    };
    if (!Array.isArray(players)) return groups;

    for (const player of players) {
        const pos = (player.position ?? '').toLowerCase();
        if (pos.startsWith('goal')) groups.Goalkeeper.push(player);
        else if (pos.startsWith('def')) groups.Defender.push(player);
        else if (pos.startsWith('mid')) groups.Midfielder.push(player);
        else if (pos.startsWith('att') || pos.startsWith('for') || pos.startsWith('str')) {
            groups.Attacker.push(player);
        } else groups.Midfielder.push(player); // unknown → keep visible
    }

    // Sort each group by shirt number (nulls last).
    for (const key of POSITION_GROUP_ORDER) {
        groups[key].sort((a, b) => {
            const an = a.number ?? 999;
            const bn = b.number ?? 999;
            return an - bn;
        });
    }
    return groups;
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

function toInt(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Normalize the API-Football team statistics payload. Returns null if empty. */
export function normalizeApiStatistics(stats: any): NormalizedTeamStats | null {
    if (!stats || typeof stats !== 'object') return null;
    const fixtures = stats.fixtures;
    const goals = stats.goals;
    if (!fixtures && !goals) return null;

    const played = toInt(fixtures?.played?.total);
    const wins = toInt(fixtures?.wins?.total);
    const draws = toInt(fixtures?.draws?.total);
    const losses = toInt(fixtures?.loses?.total);
    const goalsFor = toInt(goals?.for?.total?.total);
    const goalsAgainst = toInt(goals?.against?.total?.total);
    const cleanSheets =
        stats.clean_sheet?.total != null ? toInt(stats.clean_sheet.total) : null;

    const formStr = typeof stats.form === 'string' ? stats.form : '';
    const form = formStr.slice(-6).split('').filter(Boolean);

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
        form,
    };
}

/** Fallback stats derived from finished fixtures when the stats endpoint is empty. */
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
