import { buildWidgetPayload } from './buildWidgetPayload';
import { getWidgetApiBase } from './constants';
import type { Fixture } from '../../services/apiFootball';
import type { MatchesWidgetPayload } from './types';
import { EMPTY_WIDGET_PAYLOAD } from './types';

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchJsonFixtures(url: string): Promise<Fixture[]> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  if (!response.ok) return [];

  const raw = await response.json();
  if (Array.isArray(raw)) return raw as Fixture[];
  if (Array.isArray(raw?.response)) return raw.response as Fixture[];
  if (Array.isArray(raw?.data)) return raw.data as Fixture[];
  return [];
}

function mergeFixtures(live: Fixture[], today: Fixture[]): Fixture[] {
  const byId = new Map<number, Fixture>();
  for (const f of [...live, ...today]) {
    byId.set(f.fixture.id, f);
  }
  return [...byId.values()];
}

/**
 * Fetches live + today's fixtures for home-screen widgets.
 * Safe to call from the main app or Android headless task (no Clerk auth).
 */
export async function fetchWidgetMatchesPayload(): Promise<MatchesWidgetPayload> {
  try {
    const base = getWidgetApiBase();
    const date = todayDateKey();

    const [live, today] = await Promise.all([
      fetchJsonFixtures(`${base}/football/fixtures/live`),
      fetchJsonFixtures(`${base}/football/cached/matches/${date}`),
    ]);

    const merged = mergeFixtures(live, today);
    if (merged.length === 0) {
      return { ...EMPTY_WIDGET_PAYLOAD, updatedAt: Date.now() };
    }

    return buildWidgetPayload(merged, 8);
  } catch {
    return { ...EMPTY_WIDGET_PAYLOAD, updatedAt: Date.now() };
  }
}
