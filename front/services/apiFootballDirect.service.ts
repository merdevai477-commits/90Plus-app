/**
 * TEMP: direct API-Football v3 calls from the app (dev/quiz testing only).
 * Remove EXPO_PUBLIC_FOOTBALL_* from front/.env before production builds.
 */

import type { Fixture, Venue } from './apiFootball';
import { getQuizConfig } from '../config/env';
import { logger } from './logger';

interface ApiFootballEnvelope<T> {
  response: T;
  errors?: unknown;
  results?: number;
}

async function fetchDirect<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const { useDirectApi, footballApiKey, footballApiBase } = getQuizConfig();
  if (!useDirectApi || !footballApiKey) {
    throw new Error('[ApiFootballDirect] Direct mode off or missing API key');
  }

  const url = new URL(`${footballApiBase}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': footballApiKey },
  });

  if (!res.ok) {
    throw new Error(`[ApiFootballDirect] HTTP ${res.status} ${path}`);
  }

  const json = (await res.json()) as ApiFootballEnvelope<T>;
  if (json.errors && Object.keys(json.errors as object).length > 0) {
    logger.warn('[ApiFootballDirect] API errors', json.errors);
  }

  return json.response;
}

export const ApiFootballDirectService = {
  isEnabled(): boolean {
    const { useDirectApi, footballApiKey } = getQuizConfig();
    return useDirectApi && Boolean(footballApiKey);
  },

  async getFixturesByDate(date: string): Promise<Fixture[]> {
    const rows = await fetchDirect<Fixture[]>('/fixtures', { date });
    return Array.isArray(rows) ? rows : [];
  },

  async getVenueInfo(venueId: number): Promise<Venue | null> {
    const rows = await fetchDirect<Venue[]>('/venues', { id: venueId });
    const venue = Array.isArray(rows) ? rows[0] : null;
    return venue ?? null;
  },
};
