/**
 * app.config.js — Dynamic Expo config
 *
 * Reads environment variables injected by EAS Build (via eas.json `env` blocks)
 * and merges them into the static app.json config. This ensures the correct
 * Clerk publishable key and API URL are baked into every build profile.
 *
 * Priority: process.env (EAS) > app.json `extra` fallbacks
 */

module.exports = ({ config }) => {
  const merged = {
    ...config,
    extra: {
      ...config.extra,
      // Override with env vars when present (set in eas.json per build profile)
      clerkPublishableKey:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        config.extra?.clerkPublishableKey,
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ||
        config.extra?.apiUrl,
    },
  };

  return merged;
};
