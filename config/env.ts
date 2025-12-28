import Constants from 'expo-constants';

const { expoConfig } = Constants ?? {};
const extra = (expoConfig && (expoConfig as any).extra) || {};

const envToken =
  process.env.EXPO_PUBLIC_SPORTMONKS_TOKEN ||
  process.env.SPORTMONKS_API_TOKEN ||
  extra?.sportmonksToken ||
  extra?.SPORTMONKS_TOKEN ||
  '';

if (!envToken) {
  console.warn('[env] SPORTMONKS API token is missing. Set EXPO_PUBLIC_SPORTMONKS_TOKEN or env.extra.sportmonksToken.');
}

export const ENV = {
  // Use Sportmonks direct API base (v3 football)
  SPORTMONKS_API_BASE: 'https://api.sportmonks.com/v3/football',
  SPORTMONKS_API_TOKEN: envToken,
};
