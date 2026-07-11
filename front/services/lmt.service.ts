/**
 * 365Scores SportRadar Live Match Tracker (LMT).
 * Resolves partnerId via backend, then WebView loads the HTML embed page.
 */

import { getApiEndpoint } from '../config/api.config';
import { apiClient } from './api.client';

export type Scores365LmtInfo = {
  gameId: number;
  fixtureId: number | null;
  partnerId: string;
  langId: number;
  sportTypeId: number;
  widgetUrl: string;
  widgetType: string;
  widgetRatio: number | null;
  homeName: string | null;
  awayName: string | null;
  statusText: string | null;
  /** Backend HTML page that iframes GetWidget — preferred WebView URI. */
  embedUrl: string;
};

type LmtJsonResponse = {
  status?: string;
  response?: Omit<Scores365LmtInfo, 'embedUrl'>;
};

function buildEmbedUrl(kind: 'fixture' | 'game', id: number): string {
  const path =
    kind === 'fixture'
      ? `football/cached/365/fixture/${id}/lmt`
      : `football/cached/365/game/${id}/lmt`;
  return getApiEndpoint(path);
}

export async function fetchFixtureLmt(
  fixtureId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!fixtureId || fixtureId <= 0) return null;

  const params = new URLSearchParams({ format: 'json' });
  if (options?.language) params.set('lang', options.language);
  if (options?.force) params.set('fresh', '1');

  try {
    const { data } = await apiClient.get<LmtJsonResponse>(
      `/football/cached/365/fixture/${fixtureId}/lmt?${params.toString()}`,
    );
    const info = data?.response;
    if (!info?.partnerId || !info?.widgetUrl) return null;
    return {
      ...info,
      embedUrl: buildEmbedUrl('fixture', fixtureId),
    };
  } catch {
    return null;
  }
}

export async function fetchGameLmt(
  gameId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!gameId || gameId <= 0) return null;

  const params = new URLSearchParams({ format: 'json' });
  if (options?.language) params.set('lang', options.language);
  if (options?.force) params.set('fresh', '1');

  try {
    const { data } = await apiClient.get<LmtJsonResponse>(
      `/football/cached/365/game/${gameId}/lmt?${params.toString()}`,
    );
    const info = data?.response;
    if (!info?.partnerId || !info?.widgetUrl) return null;
    return {
      ...info,
      embedUrl: buildEmbedUrl('game', gameId),
    };
  } catch {
    return null;
  }
}
