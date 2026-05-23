const DEV_CLIENT_PACKAGES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const isDevClientBuild = profile === 'development';
  const projectId = config.extra?.eas?.projectId;

  const autolinking = isDevClientBuild
    ? config.autolinking
    : {
        ...(config.autolinking ?? {}),
        exclude: [
          ...new Set([
            ...(config.autolinking?.exclude ?? []),
            ...DEV_CLIENT_PACKAGES,
          ]),
        ],
      };

  return {
    ...config,
    autolinking,
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
