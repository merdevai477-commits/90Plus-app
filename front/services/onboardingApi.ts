import { getApiEndpoint } from '../config/api.config';
import { fetchWithClerkAuth, type GetTokenFn } from '../utils/clerkAuthToken';
import type { OnboardingClubPick } from '../utils/teamOnboarding';

export interface OnboardingCountry {
  id: string;
  name: string;
  nameEn: string;
  flag: string;
}

export interface OnboardingClubsResponse {
  global: OnboardingClubPick[];
  local: OnboardingClubPick[];
  country: OnboardingCountry | null;
  countryPersisted: boolean;
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const OnboardingApi = {
  async getClubs(
    getToken: GetTokenFn,
    language: 'ar' | 'en',
  ): Promise<OnboardingClubsResponse> {
    const url = `${getApiEndpoint('onboarding/clubs')}?language=${language}`;
    const res = await fetchWithClerkAuth(getToken, url, {
      headers: { Accept: 'application/json', 'Accept-Language': language },
    });
    if (!res) {
      throw new Error('auth');
    }
    const json = await readJson(res);
    if (!res.ok || json?.status !== 'SUCCESS' || !json?.data) {
      throw new Error(json?.message || 'load_failed');
    }
    return {
      global: Array.isArray(json.data.global) ? json.data.global : [],
      local: Array.isArray(json.data.local) ? json.data.local : [],
      country: json.data.country ?? null,
      countryPersisted: json.data.countryPersisted === true,
    };
  },

  async complete(
    getToken: GetTokenFn,
    body: { skipped: true } | { skipped?: false; teams: OnboardingClubPick[] },
    language: 'ar' | 'en',
  ): Promise<void> {
    const res = await fetchWithClerkAuth(getToken, getApiEndpoint('onboarding/teams'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': language,
        'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      body: JSON.stringify(body),
    });
    if (!res) {
      throw new Error('auth');
    }
    const json = await readJson(res);
    if (!res.ok || json?.status !== 'SUCCESS') {
      throw new Error(json?.message || 'save_failed');
    }
  },
};
