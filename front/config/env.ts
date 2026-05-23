import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const envTruthy = (value: string | undefined): boolean =>
  value === 'true' || value === '1';

const extraTruthy = (value: unknown): boolean =>
  value === true || value === 'true' || value === '1';

/** Read at call time so Metro reload picks up .env / app.config changes */
export function getQuizConfig() {
  return {
    useMatchesApi:
      envTruthy(process.env.EXPO_PUBLIC_QUIZ_USE_MATCHES_API) ||
      extraTruthy(extra.quizUseMatchesApi),
    useDirectApi:
      envTruthy(process.env.EXPO_PUBLIC_QUIZ_USE_DIRECT_FOOTBALL_API) ||
      extraTruthy(extra.quizUseDirectFootballApi),
    footballApiKey:
      (process.env.EXPO_PUBLIC_FOOTBALL_API_KEY as string | undefined) ||
      (extra.footballApiKey as string | undefined) ||
      '',
    footballApiBase:
      (process.env.EXPO_PUBLIC_FOOTBALL_API_BASE as string | undefined) ||
      (extra.footballApiBase as string | undefined) ||
      'https://v3.football.api-sports.io',
  };
}

const envToken =
  process.env.EXPO_PUBLIC_SPORTMONKS_TOKEN ||
  process.env.SPORTMONKS_API_TOKEN ||
  (extra.sportmonksToken as string | undefined) ||
  (extra.SPORTMONKS_TOKEN as string | undefined) ||
  '';

if (!envToken && __DEV__) {
  console.warn(
    '[env] SPORTMONKS token optional — quiz preview uses API-Football v3.',
  );
}

/** @deprecated Use getQuizConfig().useMatchesApi — kept for imports that expect a constant */
export const QUIZ_USE_MATCHES_API = getQuizConfig().useMatchesApi;

export const ENV = {
  SPORTMONKS_API_BASE: 'https://api.sportmonks.com/v3/football',
  SPORTMONKS_API_TOKEN: envToken,
};
