module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;

  const defaultShareBaseUrl = 'https://90plus.pro';
  const shareBaseUrl = (
    process.env.EXPO_PUBLIC_SHARE_BASE_URL || defaultShareBaseUrl
  ).replace(/\/$/, '');
  let shareHost = '90plus.pro';
  try {
    shareHost = new URL(shareBaseUrl).hostname;
  } catch {
    // keep default Railway host
  }

  const intentFilters = (config.android?.intentFilters ?? []).map((filter) => ({
    ...filter,
    data: (filter.data ?? []).map((entry) =>
      entry.scheme === 'https' && entry.host === '90plus.pro'
        ? { ...entry, host: shareHost }
        : entry,
    ),
  }));

  // Dev-client autolinking exclusions: see react-native.config.js (EAS_BUILD_PROFILE-aware).

  const googlePlacesAndroidKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_ANDROID?.trim() || '';
  const googlePlacesIosKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_IOS?.trim() || '';

  return {
    ...config,
    android: {
      ...config.android,
      intentFilters,
      ...(googlePlacesAndroidKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: {
                ...config.android?.config?.googleMaps,
                apiKey: googlePlacesAndroidKey,
              },
            },
          }
        : {}),
    },
    ios: {
      ...config.ios,
      ...(googlePlacesIosKey
        ? {
            config: {
              ...config.ios?.config,
              googleMapsApiKey: googlePlacesIosKey,
            },
          }
        : {}),
    },
    ...(projectId
      ? {
          updates: {
            ...config.updates,
            url: `https://u.expo.dev/${projectId}`,
          },
        }
      : {}),
    extra: {
      ...config.extra,
      clerkPublishableKey:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        config.extra?.clerkPublishableKey,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || config.extra?.sentryDsn,
      quizUseMatchesApi:
        process.env.EXPO_PUBLIC_QUIZ_USE_MATCHES_API === 'true',
      quizUseDirectFootballApi:
        process.env.EXPO_PUBLIC_QUIZ_USE_DIRECT_FOOTBALL_API === 'true',
      footballApiKey: process.env.EXPO_PUBLIC_FOOTBALL_API_KEY || '',
      footballApiBase:
        process.env.EXPO_PUBLIC_FOOTBALL_API_BASE ||
        'https://v3.football.api-sports.io',
      shareBaseUrl,
      googlePlacesApiKeyAndroid: googlePlacesAndroidKey,
      googlePlacesApiKeyIos: googlePlacesIosKey,
    },
  };
};
