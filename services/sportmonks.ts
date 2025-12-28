import { ENV } from '../config/env';

const DEFAULT_TIMEOUT = 12000;

class MissingTokenError extends Error {
  constructor() {
    super('Sportmonks API token is missing.');
    this.name = 'MissingTokenError';
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeout = DEFAULT_TIMEOUT) => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Sportmonks request timed out.'));
    }, timeout);
  });

  return Promise.race([promise, timeoutPromise]);
};

interface SportmonksResponse<T> {
  data: T;
  meta?: any;
}

export interface TeamSummary {
  id: number;
  name: string;
  image_path?: string;
  country_id?: number;
  founded?: number;
  short_code?: string;
}

export interface LeagueSummary {
  id: number;
  name: string;
  image_path?: string;
  country_id?: number;
  type?: string;
}

export interface FixtureTeam {
  id: number;
  name: string;
  image_path?: string;
  short_code?: string;
  country_id?: number;
}

export interface FixtureResult {
  id: number;
  name: string;
  starting_at: string;
  result_info?: string;
  venue_id?: number;
  state_id?: number;
  league_id?: number;
  round_id?: number;
  season_id?: number;
  matchday?: number;
  league?: LeagueSummary;
  venue?: {
    id: number;
    name: string;
    city?: string;
    capacity?: number;
  };
  participants?: Array<{
    id: number;
    name: string;
    meta?: {
      location?: 'home' | 'away';
      winner?: boolean;
      position?: string;
    };
    image_path?: string;
    short_code?: string;
    score?: {
      goals?: number;
      penalty_goals?: number;
    };
  }>;
  scores?: Array<{
    participant_id: number;
    scores: {
      goals?: number;
      penalty?: number;
      extra_time?: number;
    };
  }>;
  state?: {
    id: number;
    name: string;
    short_name?: string;
    finished?: boolean;
    is_live?: boolean;
  };
}

export interface FixtureFilters {
  date?: string; // YYYY-MM-DD
  leagueIds?: number[];
  teamIds?: number[];
  page?: number;
  perPage?: number;
  status?: 'live' | 'upcoming' | 'finished';
}

const buildUrl = (path: string, params: Record<string, string | number | undefined> = {}) => {
  if (!ENV.SPORTMONKS_API_TOKEN) {
    throw new MissingTokenError();
  }

  const base = ENV.SPORTMONKS_API_BASE.endsWith('/') ? ENV.SPORTMONKS_API_BASE.slice(0, -1) : ENV.SPORTMONKS_API_BASE;
  const fullPath = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const url = new URL(fullPath);
  
  // Only add non-filter parameters to the URL
  const { include, per_page, page, ...filterParams } = params;
  
  // Always include the API token for Sportmonks
  url.searchParams.set('api_token', ENV.SPORTMONKS_API_TOKEN);

  if (include) url.searchParams.set('include', String(include));
  if (per_page) url.searchParams.set('per_page', String(per_page));
  if (page) url.searchParams.set('page', String(page));

  // Add filter parameters
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const stringValue = (typeof value === 'number' ? value.toString() : value) as string;
    url.searchParams.set(key, stringValue);
  });

  return url;
};

const fetchJson = async <T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> => {
  if (!ENV.SPORTMONKS_API_TOKEN) {
    throw new MissingTokenError();
  }

  // Log the parameters being sent
  console.log('🔍 Sportmonks Request Params:', JSON.stringify(params, null, 2));
  
  const url = buildUrl(path, params);
  
  // Log the full URL (with token redacted)
  const debugUrl = url.toString();
  console.log('🔍 Sportmonks Request URL:', debugUrl
    .replace(/(api[_-]?key)=[^&]+/i, '$1=***')
    .replace(/(token)=[^&]+/i, '$1=***')
    .replace(/\?/g, '\n  ?')
    .replace(/&/g, '\n  &')
  );
  
  try {
    const response = await withTimeout(
      fetch(debugUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Sportmonks Error Response:', text);
      throw new Error(`Sportmonks request failed (${response.status}): ${text}`);
    }

    const responseData = await response.json();
    return responseData as T;
  } catch (error) {
    console.error('❌ Sportmonks Request Error:', error);
    throw error;
  }
};

export const SportmonksService = {
  async getFixtures(filters: FixtureFilters = {}): Promise<FixtureResult[]> {
    // Build Sportmonks params
    const params: Record<string, string> = {};

    // Includes for richer UI data
    params['include'] = 'lineups.details.type;state.type;events.player;participants;venue;league';

    // Pagination
    if (filters.perPage) params['per_page'] = String(filters.perPage);
    if (filters.page) params['page'] = String(filters.page);

    // Date filter (Sportmonks supports date)
    if (filters.date) params['date'] = filters.date;

    // League and Team filters (Sportmonks accepts IDs via filters)
    if (filters.leagueIds?.length) params['league_id'] = String(filters.leagueIds[0]);
    if (filters.teamIds?.length) params['team_id'] = String(filters.teamIds[0]);

    // Status (best-effort; may vary by API docs)
    if (filters.status === 'live') params['states'] = 'live';
    if (filters.status === 'finished') params['states'] = 'finished';
    if (filters.status === 'upcoming') params['states'] = 'upcoming';

    try {
      const result = await fetchJson<SportmonksResponse<FixtureResult[]>>('/fixtures', params);
      const items: FixtureResult[] = Array.isArray(result?.data) ? result.data : [];

      // Normalize: merge goals from scores[] into participants[].score.goals for UI consumption
      const normalized = items.map((item) => {
        const scoresMap = new Map<number, number>();
        (item.scores || []).forEach((s) => {
          const goals = typeof s.scores?.goals === 'number' ? s.scores.goals : 0;
          scoresMap.set(s.participant_id, goals);
        });

        const participants = (item.participants || []).map((p) => ({
          ...p,
          score: {
            goals: typeof p.score?.goals === 'number' ? p.score!.goals : (scoresMap.get(p.id) ?? 0),
            penalty_goals: typeof p.score?.penalty_goals === 'number' ? p.score!.penalty_goals : undefined,
          },
        }));

        return {
          ...item,
          participants,
        } as FixtureResult;
      });

      return normalized;
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      throw error;
    }
  },

  async getTeamFixtures(teamId: number, filters: Omit<FixtureFilters, 'teamIds'> = {}) {
    return this.getFixtures({ ...filters, teamIds: [teamId] });
  },

  async searchTeams(query: string): Promise<TeamSummary[]> {
    if (!query.trim()) return [];

    const path = `/teams/search/${encodeURIComponent(query.trim())}`;
    const result = await fetchJson<SportmonksResponse<any[]>>(path, { page: '1' });
    const items: any[] = Array.isArray(result?.data) ? result.data : [];
    return items.map((item: any) => ({
      id: item?.id,
      name: item?.name,
      image_path: item?.image_path,
      short_code: item?.short_code,
      country_id: item?.country_id,
      founded: item?.founded,
    }));
  },

  async searchLeagues(query: string): Promise<LeagueSummary[]> {
    if (!query.trim()) return [];

    const path = `/leagues/search/${encodeURIComponent(query.trim())}`;
    const result = await fetchJson<SportmonksResponse<any[]>>(path, { page: '1' });
    const items: any[] = Array.isArray(result?.data) ? result.data : [];
    return items.map((item: any) => ({
      id: item?.id,
      name: item?.name,
      image_path: item?.image_path,
      country_id: item?.country_id,
      type: item?.type,
    }));
  },
};

export type { FixtureResult as SportmonksFixture };