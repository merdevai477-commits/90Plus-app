import type { Fixture } from '../services/apiFootball';
import { cacheService } from '../services/cacheService';
import { footballCacheService } from '../services/footballCacheService';
import {
  isApiFootballFixtureShape,
  matchCardToApiFixture,
} from './matchCardToApiFixture';

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchId(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const row = value as { id?: string | number; fixture?: { id?: number } };
  const nested = Number(row.fixture?.id);
  if (Number.isFinite(nested) && nested > 0) return nested;
  const id = Number(row.id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

/**
 * Instant local paint for match details: last cached API fixture, then
 * today's calendar list (and yesterday/tomorrow). Shared disk — no network.
 */
export async function findLocalPreviewFixture(
  fixtureId: number,
): Promise<Fixture | null> {
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return null;

  try {
    const cached = await footballCacheService.getMatch(fixtureId);
    if (isApiFootballFixtureShape(cached)) return cached;
    const fromCachedCard = matchCardToApiFixture(cached as any, fixtureId);
    if (fromCachedCard) return fromCachedCard;
  } catch {
    // disk cache is optional
  }

  const day = new Date();
  for (const offset of [0, -1, 1]) {
    const d = new Date(day);
    d.setDate(d.getDate() + offset);
    try {
      const list = await cacheService.getMatchesByDate(localDateKey(d), true);
      const hit = list?.find((row) => matchId(row) === fixtureId);
      if (!hit) continue;
      if (isApiFootballFixtureShape(hit)) return hit;
      const converted = matchCardToApiFixture(hit as any, fixtureId);
      if (converted) return converted;
    } catch {
      // continue other dates
    }
  }

  return null;
}
