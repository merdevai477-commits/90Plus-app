import type { Fixture } from '../../services/apiFootball';
import {
  resolveLiveMinuteLabel,
} from '../../components/Matches/leagueApiUtils';
import type { LiveFixtureSnapshot } from './liveFixtureStore.types';

export function selectStatusShort(snapshot: LiveFixtureSnapshot): string {
  return snapshot.fixture.fixture.status.short;
}

export function selectElapsed(snapshot: LiveFixtureSnapshot): number | null {
  return snapshot.fixture.fixture.status.elapsed ?? null;
}

export function selectScore(snapshot: LiveFixtureSnapshot): {
  home: number;
  away: number;
} {
  return {
    home: snapshot.fixture.goals.home ?? 0,
    away: snapshot.fixture.goals.away ?? 0,
  };
}

export function selectMinuteLabel(snapshot: LiveFixtureSnapshot): string | undefined {
  const short = snapshot.fixture.fixture.status.short;
  const elapsed = snapshot.fixture.fixture.status.elapsed;
  const startTimestamp =
    short === '2H'
      ? snapshot.fixture.fixture.periods.second ?? undefined
      : snapshot.fixture.fixture.periods.first ?? undefined;
  return resolveLiveMinuteLabel(short, elapsed, { startTimestamp });
}

export function selectIsLive(snapshot: LiveFixtureSnapshot): boolean {
  return snapshot.phase === 'live';
}

export function selectIsFinished(snapshot: LiveFixtureSnapshot): boolean {
  return snapshot.phase === 'finished';
}

export function getPeriodStartTimestamp(fixture: Fixture): number | undefined {
  const short = fixture.fixture.status.short;
  return short === '2H'
    ? fixture.fixture.periods.second ?? undefined
    : fixture.fixture.periods.first ?? undefined;
}
