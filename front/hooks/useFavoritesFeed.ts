/**
 * Favorites feed helpers — followed teams + active bell matches +
 * live-first 5 upcoming / 5 finished slice (max 10 total).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Competitor365Matches, Fixture as ApiFixture } from '../services/apiFootball';
import { useFavoriteTeam } from './useFavoriteTeam';
import {
    MatchFavoritesStorage,
    type StoredFavoriteMatch,
} from '../src/storage/matchFavorites.storage';
import type { StoredFollowedTeam } from '../src/storage/teamFavorites.storage';

/** Flat list-row fixture used by Matches screen MatchRow. */
export type FavoritesListFixture = {
    id: string;
    home: string;
    away: string;
    homeLogo: string;
    awayLogo: string;
    homeScore: number;
    awayScore: number;
    status: 'LIVE' | 'FT' | 'UPCOMING';
    minute?: string;
    live?: boolean;
    time?: string;
    leagueName?: string;
    leagueId?: number;
    leagueCountry?: string;
    leagueLogo?: string;
    matchDate?: string;
    statusShort?: string;
    elapsed?: number | null;
    extra?: number | null;
    startTimestamp?: number;
};

const LIVE_SHORT = new Set([
    '1H',
    '2H',
    'HT',
    'ET',
    'BT',
    'P',
    'LIVE',
    'INT',
]);

function mapApiStatus(short?: string | null): 'LIVE' | 'FT' | 'UPCOMING' {
    const s = (short || '').toUpperCase();
    if (LIVE_SHORT.has(s)) return 'LIVE';
    if (s === 'FT' || s === 'AET' || s === 'PEN') return 'FT';
    return 'UPCOMING';
}

export function apiFixtureToListFixture(f: ApiFixture): FavoritesListFixture {
    const short = f.fixture?.status?.short ?? '';
    const status = mapApiStatus(short);
    const date = f.fixture?.date ? new Date(f.fixture.date) : null;
    const time =
        date && !Number.isNaN(date.getTime())
            ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
            : undefined;
    return {
        id: String(f.fixture?.id ?? ''),
        home: f.teams?.home?.name || 'Home',
        away: f.teams?.away?.name || 'Away',
        homeLogo: f.teams?.home?.logo || '',
        awayLogo: f.teams?.away?.logo || '',
        homeScore: f.goals?.home ?? 0,
        awayScore: f.goals?.away ?? 0,
        status,
        live: status === 'LIVE',
        time,
        leagueName: f.league?.name,
        leagueId: f.league?.id,
        leagueCountry: f.league?.country,
        leagueLogo: f.league?.logo,
        matchDate: f.fixture?.date,
        statusShort: short || undefined,
        elapsed: f.fixture?.status?.elapsed ?? null,
        extra: f.fixture?.status?.extra ?? null,
        startTimestamp: f.fixture?.timestamp,
        minute:
            status === 'LIVE' && f.fixture?.status?.elapsed != null
                ? `${f.fixture.status.elapsed}'`
                : undefined,
    };
}

export function storedMatchToListFixture(m: StoredFavoriteMatch): FavoritesListFixture {
    const status = mapApiStatus(m.statusShort || m.status);
    const date = m.matchDate ? new Date(m.matchDate) : null;
    const time =
        date && !Number.isNaN(date.getTime())
            ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
            : undefined;
    return {
        id: m.id,
        home: m.homeTeam,
        away: m.awayTeam,
        homeLogo: m.homeTeamLogo || '',
        awayLogo: m.awayTeamLogo || '',
        homeScore: 0,
        awayScore: 0,
        status,
        live: status === 'LIVE',
        time,
        leagueName: m.leagueName,
        leagueLogo: m.leagueLogo,
        matchDate: m.matchDate,
        statusShort: m.statusShort || m.status,
    };
}

/**
 * Live first (all), then up to 5 upcoming, then up to 5 finished,
 * hard-capped at 10 while never dropping live fixtures.
 */
export function sliceTeamFavoriteMatches(data: Competitor365Matches): ApiFixture[] {
    const live = data.live ?? [];
    const upcoming = (data.upcoming ?? []).slice(0, 5);
    const finished = (data.finished ?? []).slice(0, 5);
    const budget = Math.max(0, 10 - live.length);
    const rest: ApiFixture[] = [];
    for (const f of upcoming) {
        if (rest.length >= budget) break;
        rest.push(f);
    }
    for (const f of finished) {
        if (rest.length >= budget) break;
        rest.push(f);
    }
    return [...live, ...rest];
}

export type LeagueFixtureGroup = {
    key: string;
    leagueName: string;
    leagueLogo?: string;
    fixtures: FavoritesListFixture[];
};

/** Group sliced fixtures under championship headers (matches-page look). */
export function groupFixturesByLeague(fixtures: FavoritesListFixture[]): LeagueFixtureGroup[] {
    const order: string[] = [];
    const map = new Map<string, LeagueFixtureGroup>();
    for (const fixture of fixtures) {
        const key = String(fixture.leagueId ?? fixture.leagueName ?? 'league');
        let group = map.get(key);
        if (!group) {
            group = {
                key,
                leagueName: fixture.leagueName || 'League',
                leagueLogo: fixture.leagueLogo,
                fixtures: [],
            };
            map.set(key, group);
            order.push(key);
        } else if (!group.leagueLogo && fixture.leagueLogo) {
            group.leagueLogo = fixture.leagueLogo;
        }
        group.fixtures.push(fixture);
    }
    return order.map((k) => map.get(k)!);
}

export function useFavoritesFeed(
    subscribedFixtureIds?: ReadonlySet<string>,
    subscriptionsReady = false,
): {
    followedTeams: StoredFollowedTeam[];
    notifiedMatches: StoredFavoriteMatch[];
    loading: boolean;
    refreshNotified: () => Promise<void>;
} {
    const { followedTeams, loading: teamsLoading } = useFavoriteTeam();
    const [storedMatches, setStoredMatches] = useState<StoredFavoriteMatch[]>([]);
    const [notifiedLoading, setNotifiedLoading] = useState(true);

    const refreshNotified = useCallback(async () => {
        try {
            const active = await MatchFavoritesStorage.getActiveMatches();
            if (!subscriptionsReady) {
                // Keep local snapshot until server bell ids hydrate — never prune early.
                setStoredMatches(active);
                return;
            }
            if (!subscribedFixtureIds || subscribedFixtureIds.size === 0) {
                for (const match of active) {
                    void MatchFavoritesStorage.removeFavorite(match.id);
                }
                setStoredMatches([]);
                return;
            }
            const keep: StoredFavoriteMatch[] = [];
            for (const match of active) {
                if (subscribedFixtureIds.has(match.id)) keep.push(match);
                else void MatchFavoritesStorage.removeFavorite(match.id);
            }
            setStoredMatches(keep);
        } catch {
            setStoredMatches([]);
        } finally {
            setNotifiedLoading(false);
        }
    }, [subscribedFixtureIds, subscriptionsReady]);

    useEffect(() => {
        void refreshNotified();
    }, [refreshNotified]);

    const notifiedMatches = useMemo(() => {
        // Only paint cards after hydrate, and only for fixtures with the bell on.
        if (!subscriptionsReady) return [];
        if (!subscribedFixtureIds || subscribedFixtureIds.size === 0) return [];
        return storedMatches.filter((m) => subscribedFixtureIds.has(m.id));
    }, [storedMatches, subscribedFixtureIds, subscriptionsReady]);

    return {
        followedTeams,
        notifiedMatches,
        loading: teamsLoading || notifiedLoading,
        refreshNotified,
    };
}
