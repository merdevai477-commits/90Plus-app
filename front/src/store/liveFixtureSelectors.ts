import type { Fixture } from '../../services/apiFootball';
import {
  resolveLiveMinuteLabel,
  synthesizePeriodStartSec,
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
  const extra = snapshot.fixture.fixture.status.extra ?? null;
  const startTimestamp =
    short === '2H'
      ? snapshot.fixture.fixture.periods.second ?? undefined
      : snapshot.fixture.fixture.periods.first ?? undefined;
  return resolveLiveMinuteLabel(short, elapsed, { startTimestamp, extra });
}

export function selectIsLive(snapshot: LiveFixtureSnapshot): boolean {
  return snapshot.phase === 'live';
}

export function selectIsFinished(snapshot: LiveFixtureSnapshot): boolean {
  return snapshot.phase === 'finished';
}

export function getPeriodStartTimestamp(fixture: Fixture): number | undefined {
  const short = fixture.fixture?.status?.short;
  if (!short) return undefined;
  const fromApi =
    short === '2H'
      ? fixture.fixture.periods.second ?? undefined
      : short === 'ET'
        ? fixture.fixture.periods.second ?? fixture.fixture.periods.first ?? undefined
        : fixture.fixture.periods.first ?? undefined;
  if (fromApi != null) return fromApi;

  // Scores365 and some feeds omit periods — synthesize so MM:SS can tick.
  const elapsed = fixture.fixture?.status?.elapsed;
  if (elapsed == null || elapsed < 0) return undefined;
  if (short !== '1H' && short !== '2H' && short !== 'ET') return undefined;
  return synthesizePeriodStartSec(short, elapsed);
}
