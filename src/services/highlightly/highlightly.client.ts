import { HIGHLIGHT_PAGE_LIMIT, HIGHLIGHT_TIMEZONE } from './highlightly.policy';

const BASE_URL = 'https://soccer.highlightly.net';
const TIMEOUT_MS = 8000;

export class HighlightlyRequestError extends Error {
  readonly status: number;
  readonly upstreamRemaining: number | null;

  constructor(status: number, upstreamRemaining: number | null = null) {
    super(`Highlightly request failed (${status})`);
    this.name = 'HighlightlyRequestError';
    this.status = status;
    this.upstreamRemaining = upstreamRemaining;
  }
}

export interface NormalizedHighlight {
  highlightlyId: number;
  highlightlyMatchId: number;
  category: string;
  type: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  imgUrl: string | null;
  source: string | null;
  channel: string | null;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string | null;
  matchDate: Date;
}

export interface HighlightlyPage {
  clips: NormalizedHighlight[];
  totalCount: number;
  offset: number;
  limit: number;
  tier: string | null;
  upstreamLimit: number | null;
  upstreamRemaining: number | null;
}

export function isHighlightlyConfigured(): boolean {
  return Boolean(process.env.HIGHLIGHTLY_API_KEY?.trim());
}

export async function fetchHighlightPage(params: {
  date: string;
  offset?: number;
  limit?: number;
  timezone?: string;
  signal?: AbortSignal;
  homeTeamName?: string;
  awayTeamName?: string;
  leagueName?: string;
}): Promise<HighlightlyPage> {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY?.trim();
  if (!apiKey) throw new HighlightlyRequestError(0);

  const url = new URL('/highlights', BASE_URL);
  url.searchParams.set('date', params.date);
  url.searchParams.set('timezone', params.timezone ?? HIGHLIGHT_TIMEZONE);
  url.searchParams.set('limit', String(params.limit ?? HIGHLIGHT_PAGE_LIMIT));
  url.searchParams.set('offset', String(params.offset ?? 0));
  if (params.homeTeamName) url.searchParams.set('homeTeamName', params.homeTeamName);
  if (params.awayTeamName) url.searchParams.set('awayTeamName', params.awayTeamName);
  if (params.leagueName) url.searchParams.set('leagueName', params.leagueName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  params.signal?.addEventListener('abort', abortFromCaller);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-rapidapi-key': apiKey,
      },
      signal: controller.signal,
    });
    const upstreamRemaining = readRateHeader(response.headers.get('x-ratelimit-requests-remaining'));
    const upstreamLimit = readRateHeader(response.headers.get('x-ratelimit-requests-limit'));

    if (!response.ok) {
      throw new HighlightlyRequestError(response.status, upstreamRemaining);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new HighlightlyRequestError(response.status || 502, upstreamRemaining);
    }

    return normalizePage(body, {
      offset: params.offset ?? 0,
      limit: params.limit ?? HIGHLIGHT_PAGE_LIMIT,
      upstreamLimit,
      upstreamRemaining,
    });
  } catch (error) {
    if (error instanceof HighlightlyRequestError) throw error;
    if (controller.signal.aborted) throw new HighlightlyRequestError(408);
    throw new HighlightlyRequestError(0);
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abortFromCaller);
  }
}

function readRateHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asDbInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 2_147_483_647) return null;
  return parsed;
}

export function normalizePage(
  body: unknown,
  defaults: {
    offset: number;
    limit: number;
    upstreamLimit: number | null;
    upstreamRemaining: number | null;
  },
): HighlightlyPage {
  const record = asRecord(body);
  const rows = Array.isArray(record?.data) ? record.data : [];
  const pagination = asRecord(record?.pagination);
  const plan = asRecord(record?.plan);
  const clips: NormalizedHighlight[] = [];
  for (const row of rows) {
    const clip = normalizeClip(row);
    if (clip) clips.push(clip);
  }
  return {
    clips,
    totalCount: asDbInt(pagination?.totalCount) ?? clips.length,
    offset: asDbInt(pagination?.offset) ?? defaults.offset,
    limit: asDbInt(pagination?.limit) ?? defaults.limit,
    tier: asText(plan?.tier),
    upstreamLimit: defaults.upstreamLimit,
    upstreamRemaining: defaults.upstreamRemaining,
  };
}

function normalizeClip(value: unknown): NormalizedHighlight | null {
  const row = asRecord(value);
  const match = asRecord(row?.match);
  const home = asRecord(match?.homeTeam);
  const away = asRecord(match?.awayTeam);
  const league = asRecord(match?.league);
  if (!row || !match) return null;

  const highlightlyId = asDbInt(row.id);
  const highlightlyMatchId = asDbInt(match.id);
  const url = asText(row.url);
  const homeTeamName = asText(home?.name);
  const awayTeamName = asText(away?.name);
  const matchDateRaw = asText(match.date);
  const matchDate = matchDateRaw ? new Date(matchDateRaw) : null;
  if (
    highlightlyId == null ||
    highlightlyMatchId == null ||
    !url ||
    !homeTeamName ||
    !awayTeamName ||
    !matchDate ||
    Number.isNaN(matchDate.getTime())
  ) {
    return null;
  }

  const category = (asText(row.category) ?? 'other').toLowerCase();
  const title = asText(row.title) ?? `${homeTeamName} vs ${awayTeamName}`;
  return {
    highlightlyId,
    highlightlyMatchId,
    category,
    type: (asText(row.type) ?? 'UNVERIFIED').toUpperCase(),
    title,
    description: asText(row.description),
    url,
    embedUrl: asText(row.embedUrl),
    imgUrl: asText(row.imgUrl),
    source: asText(row.source),
    channel: asText(row.channel),
    homeTeamName,
    awayTeamName,
    leagueName: asText(league?.name),
    matchDate,
  };
}
