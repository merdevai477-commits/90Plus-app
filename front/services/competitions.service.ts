/**
 * Predict & Win (توقع واربح) API client.
 */

import { getApiUrl } from '../config/api.config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface PrizeCategoryInfo {
  id: string;
  key: string;
  nameAr: string;
  /** English name. Optional so the client still works against an older API. */
  nameEn?: string | null;
  /** Cell subtitle on the category grid (Arabic). */
  description: string | null;
  /** English cell subtitle. */
  descriptionEn?: string | null;
  /** Optional artwork URL; falls back to the bundled illustration for `key`. */
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MatchPoolEntry {
  apiMatchId: number;
  home: { name: string; logo: string | null };
  away: { name: string; logo: string | null };
  /** Pool day, `YYYY-MM-DD`. */
  day: string;
  /** Kickoff as an absolute instant — predictions must close before this. */
  kickoffIso: string;
  /** `HH:mm` for display. */
  time: string;
  status: string;
  leagueName: string | null;
}

export interface SponsorInfo {
  id: string;
  name: string;
  /** Trade line under the sponsor name on the card. */
  description: string | null;
  logoUrl: string | null;
  address: string | null;
  hasDelivery: boolean;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    phoneCountryId?: string;
    phoneNational?: string;
    storeLogoDefault?: boolean;
  } | null;
  isVerified: boolean;
  isActive: boolean;
}

export interface CompetitionEntryInfo {
  id: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedWinner: 'home' | 'draw' | 'away' | null;
  isCorrect: boolean | null;
  isWinner: boolean;
  rank: number | null;
  createdAt: string;
}

export interface CompetitionInfo {
  id: string;
  sponsor: SponsorInfo;
  category: PrizeCategoryInfo;
  prizeName: string;
  prizeImageUrl: string | null;
  prizeType: string;
  prizeDescription: string | null;
  prizeCashAmount?: number | null;
  winnersCount: number;
  apiMatchId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string;
  leagueName: string | null;
  /** Latest fixture status seen by settlement (FT / PST / CANC / …). */
  matchStatus: string | null;
  /** Official result, present once the competition has settled. */
  resultHomeScore: number | null;
  resultAwayScore: number | null;
  predictionDeadline: string;
  predictionMode: 'WINNER' | 'EXACT_SCORE';
  status: CompetitionStatus;
  /** Entry conditions ("شروط المسابقة"). */
  rules: string | null;
  startAt: string | null;
  endAt: string | null;
  isFree: boolean;
  participantsCount: number;
  viewsCount?: number;
  winnerAwardedAt?: string | null;
  rejectionReason?: string | null;
  /** Set when an admin publishes the competition. */
  publishedAt?: string | null;
  /** Set when an admin accepts or rejects the draft. */
  reviewedAt?: string | null;
  createdAt?: string;
  myEntry: CompetitionEntryInfo | null;
}

export type CompetitionStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'SETTLED'
  | 'CANCELLED'
  | 'REJECTED';

export interface OwnerLeaderboardCandidate {
  entryId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedWinner: string | null;
  displayRank: number;
  isWinner: boolean;
  createdAt: string;
}

export interface OwnerLeaderboard {
  competitionId: string;
  prizeName: string;
  prizeType: string;
  sponsorName: string;
  status: string;
  resultHomeScore: number | null;
  resultAwayScore: number | null;
  matchFinished: boolean;
  winnersCount: number;
  awardedCount: number;
  stats: {
    wrong: number;
    correct: number;
    predictions: number;
    views: number;
  };
  candidates: OwnerLeaderboardCandidate[];
}

/** True only while the competition is still accepting predictions. */
export function isEntryOpen(competition: CompetitionInfo): boolean {
  if (competition.status !== 'PUBLISHED') return false;
  const now = Date.now();
  return (
    now < new Date(competition.predictionDeadline).getTime() &&
    now < new Date(competition.matchDate).getTime()
  );
}

export type CompetitionTab = 'all' | 'today' | 'mine' | 'sponsored';
export type CompetitionFilter = 'daily' | 'free' | 'sponsored' | 'popular';
/** Hub sort dropdown (Figma `Component 10`); `newest` is its default label. */
export type CompetitionSort = 'newest' | 'closing' | 'popular';
export const COMPETITION_SORTS: CompetitionSort[] = ['newest', 'closing', 'popular'];

export interface CreateCompetitionPayload {
  sponsor: {
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    address?: string | null;
    hasDelivery?: boolean;
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      whatsapp?: string;
      phoneCountryId?: string;
      phoneNational?: string;
      storeLogoDefault?: boolean;
    } | null;
  };
  categoryId: string;
  prizeName: string;
  prizeImageUrl?: string | null;
  prizeType: string;
  prizeDescription?: string | null;
  prizeCashAmount?: number | null;
  winnersCount: number;
  apiMatchId: number;
  /** Pool calendar day (`YYYY-MM-DD`) the match was chosen from. */
  poolDate?: string;
  predictionDeadline: string;
  predictionMode?: 'WINNER' | 'EXACT_SCORE';
  /** Entry conditions ("شروط المسابقة"). */
  rules?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isFree?: boolean;
}

/**
 * A failed request carries the server's machine-readable code, not its prose.
 *
 * The API only speaks Arabic (`'يجب تسجيل الدخول'`), so surfacing `message`
 * verbatim put Arabic sentences into English toasts. `code` is stable and the
 * UI renders `t.predictAndWin.errors[code]` instead.
 */
export class CompetitionApiError extends Error {
  readonly code: string;
  /** The server's own prose, kept for logging — never for display. */
  readonly serverMessage: string | null;

  constructor(code: string, serverMessage: string | null) {
    super(code);
    this.name = 'CompetitionApiError';
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

/** Codes the route layer maps; anything else renders as the generic message. */
const KNOWN_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'COMPETITION_NOT_FOUND',
  'COMPETITION_NOT_OPEN',
  'COMPETITION_NOT_DRAFT',
  'COMPETITION_SETTLED',
  'DEADLINE_PASSED',
  'MATCH_STARTED',
  'INVALID_PREDICTION',
  'INVALID_SPONSOR',
  'INVALID_SPONSOR_ADDRESS',
  'SPONSOR_DISABLED',
  'SPONSOR_NOT_FOUND',
  'INVALID_PRIZE',
  'INVALID_CASH_AMOUNT',
  'INVALID_WINNERS_COUNT',
  'INVALID_DEADLINE',
  'DEADLINE_AFTER_KICKOFF',
  'INVALID_WINDOW',
  'CATEGORY_NOT_FOUND',
  'INVALID_POOL_DATE',
  'MATCH_NOT_IN_POOL',
  'COMPETITION_PENDING',
  'CREATE_COOLDOWN',
  'NETWORK',
  'NOT_AUTHENTICATED',
]);

/** `true` when the code has its own copy; the UI falls back to `GENERIC`. */
export function isKnownCompetitionError(code: string): boolean {
  return KNOWN_ERROR_CODES.has(code);
}

async function parseError(response: Response): Promise<CompetitionApiError> {
  if (response.status === 401 || response.status === 403) {
    // A stale/absent token never reaches the service layer's own codes.
    try {
      const data = await response.json();
      const code = typeof data?.details?.code === 'string' ? data.details.code : null;
      return new CompetitionApiError(code ?? 'AUTH_REQUIRED', data?.message ?? null);
    } catch {
      return new CompetitionApiError('AUTH_REQUIRED', null);
    }
  }
  try {
    const data = await response.json();
    const code = typeof data?.details?.code === 'string' ? data.details.code : 'GENERIC';
    return new CompetitionApiError(code, data?.message ?? null);
  } catch {
    return new CompetitionApiError('GENERIC', response.statusText || null);
  }
}

/**
 * Normalise whatever `GET /competitions` put in `json.data` into the paginated
 * shape the hub expects. The route answers `{ items, nextCursor }`, but a
 * stale cache, proxy rewrite, or an older build can surface the rows one level
 * off (`data: [...]`) or under another key (`results`). Feeding that straight
 * into `setItems(result.items)` leaves state `undefined`, and a `FlatList` with
 * `data={undefined}` paints nothing — not even the empty placeholder.
 */
export function normalizeCompetitionListPage(raw: unknown): {
  items: CompetitionInfo[];
  nextCursor: string | null;
} {
  if (raw == null) return { items: [], nextCursor: null };
  if (Array.isArray(raw)) return { items: raw as CompetitionInfo[], nextCursor: null };

  if (typeof raw === 'object') {
    const page = raw as Record<string, unknown>;
    const items = Array.isArray(page.items)
      ? page.items
      : Array.isArray(page.data)
        ? page.data
        : Array.isArray(page.results)
          ? page.results
          : [];
    const nextCursor =
      typeof page.nextCursor === 'string'
        ? page.nextCursor
        : typeof page.next_cursor === 'string'
          ? page.next_cursor
          : null;
    return { items: items as CompetitionInfo[], nextCursor };
  }

  return { items: [], nextCursor: null };
}

async function authFetch(token: string | null, path: string, init?: RequestInit) {
  let response: Response;
  try {
    // Resolve per request — a module-load snapshot can freeze a stale host
    // (emulator alias, old LAN IP) and the hub then paints an empty list.
    const base = getApiUrl().replace(/\/$/, '');
    response = await fetchWithTimeout(`${base}/competitions${path}`, {
      ...init,
      timeout: 20_000,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/timeout/i.test(msg)) {
      throw new CompetitionApiError('NETWORK', msg);
    }
    // `fetch` rejects on DNS/TCP failure with a platform-specific message
    // ("Network request failed" on Android, "Load failed" on iOS). Neither is
    // showable copy, so it becomes a code like every other failure.
    throw new CompetitionApiError('NETWORK', null);
  }
  if (!response.ok) throw await parseError(response);
  const json = await response.json();
  return json.data;
}

export const CompetitionsService = {
  getPrizeCategories: (token?: string | null) =>
    authFetch(token ?? null, '/prize-categories') as Promise<PrizeCategoryInfo[]>,

  getMatchPool: (token: string, date?: string) =>
    authFetch(token, date ? `/match-pool?date=${encodeURIComponent(date)}` : '/match-pool') as Promise<
      MatchPoolEntry[]
    >,

  /** Owned competitions for the caller's sponsor profile. */
  listMine: async (token: string) => {
    const raw = await authFetch(token, '/mine');
    const itemsRaw =
      typeof raw === 'object' && raw !== null && 'items' in (raw as object)
        ? (raw as { items: unknown }).items
        : raw;
    const page = normalizeCompetitionListPage(itemsRaw);
    return {
      sponsor:
        typeof raw === 'object' && raw !== null && 'sponsor' in (raw as object)
          ? ((raw as { sponsor: SponsorInfo | null }).sponsor ?? null)
          : null,
      items: page.items,
    };
  },

  /** Save sponsor store profile linked to the signed-in Clerk user. */
  saveSponsorProfile: (token: string, sponsor: CreateCompetitionPayload['sponsor']) =>
    authFetch(token, '/mine/sponsor', {
      method: 'PUT',
      body: JSON.stringify({ sponsor }),
    }),

  list: (
    token: string | null,
    opts: {
      tab?: CompetitionTab;
      filter?: CompetitionFilter;
      sort?: CompetitionSort;
      cursor?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.tab) params.set('tab', opts.tab);
    if (opts.filter) params.set('filter', opts.filter);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.cursor) params.set('cursor', opts.cursor);
    const qs = params.toString();
    return authFetch(token, qs ? `/?${qs}` : '/').then(normalizeCompetitionListPage);
  },

  getById: (token: string | null, id: string) =>
    authFetch(token, `/${id}`) as Promise<CompetitionInfo>,

  predict: (
    token: string,
    id: string,
    prediction: { predictedHomeScore?: number; predictedAwayScore?: number; predictedWinner?: 'home' | 'draw' | 'away' },
  ) =>
    authFetch(token, `/${id}/predict`, {
      method: 'POST',
      body: JSON.stringify(prediction),
    }) as Promise<CompetitionEntryInfo>,

  create: (token: string, payload: CreateCompetitionPayload) =>
    authFetch(token, '/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }) as Promise<CompetitionInfo>,

  getLeaderboard: (token: string, id: string) =>
    authFetch(token, `/${id}/leaderboard`) as Promise<OwnerLeaderboard>,

  awardWinner: (token: string, id: string, entryId: string) =>
    authFetch(token, `/${id}/award`, {
      method: 'POST',
      body: JSON.stringify({ entryId }),
    }) as Promise<OwnerLeaderboard>,
};
