/**
 * 365Scores SportRadar Live Match Tracker (LMT).
 * Resolves partnerId via backend; WebView loads official GetWidget URL.
 */

import { getApiUrl } from '../config/api.config';

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
  /** Backend HTML shell (optional). Prefer widgetUrl in WebView. */
  embedUrl: string;
};

type LmtJsonResponse = {
  status?: string;
  response?: Omit<Scores365LmtInfo, 'embedUrl'>;
};

function buildEmbedUrl(kind: 'fixture' | 'game', id: number): string {
  const base = getApiUrl().replace(/\/$/, '');
  const path =
    kind === 'fixture'
      ? `football/cached/365/fixture/${id}/lmt`
      : `football/cached/365/game/${id}/lmt`;
  return `${base}/${path}`;
}

async function fetchLmtJson(
  path: string,
  options?: { language?: string; force?: boolean },
): Promise<Omit<Scores365LmtInfo, 'embedUrl'> | null> {
  const params = new URLSearchParams({ format: 'json' });
  if (options?.language) params.set('lang', options.language);
  if (options?.force) params.set('fresh', '1');

  try {
    const base = getApiUrl().replace(/\/$/, '');
    const res = await fetch(`${base}${path}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    // 404 = no partnerId / no LMT — normal for many matches
    if (res.status === 404 || res.status === 503) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as LmtJsonResponse;
    const info = data?.response;
    if (!info?.partnerId || !info?.widgetUrl) return null;
    return info;
  } catch {
    return null;
  }
}

export async function fetchFixtureLmt(
  fixtureId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!fixtureId || fixtureId <= 0) return null;
  const info = await fetchLmtJson(
    `/football/cached/365/fixture/${fixtureId}/lmt`,
    options,
  );
  if (!info) return null;
  return { ...info, embedUrl: buildEmbedUrl('fixture', fixtureId) };
}

export async function fetchGameLmt(
  gameId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!gameId || gameId <= 0) return null;
  const info = await fetchLmtJson(`/football/cached/365/game/${gameId}/lmt`, options);
  if (!info) return null;
  return { ...info, embedUrl: buildEmbedUrl('game', gameId) };
}
