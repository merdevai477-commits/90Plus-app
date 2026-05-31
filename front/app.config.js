module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;

  // Dev-client autolinking exclusions: see react-native.config.js (EAS_BUILD_PROFILE-aware).

  return {
    ...config,
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
    },
  };
};
