/**
 * iOS Universal Links — Apple App Site Association (AASA).
 * Served at /.well-known/apple-app-site-association and /apple-app-site-association.
 *
 * Only paths with implemented deep link handlers are listed in components.
 * Add /match/*, /player/*, etc. when their handlers exist in the app.
 */

export const APPLE_TEAM_ID = '337M3TRC5C';
export const IOS_BUNDLE_ID = 'com.mhmdsh1892.ninetyplusapp';
export const APPLE_APP_ID = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`;

/** Active universal link path patterns (must match front/app/_layout.tsx handleDeepLink). */
export const AASA_ACTIVE_PATHS = ['/reels/*', '/@*'] as const;

export interface AppleAppSiteAssociation {
  applinks: {
    details: Array<{
      appIDs: string[];
      components: Array<{ '/': string }>;
    }>;
  };
  webcredentials: {
    apps: string[];
  };
}

export function buildAppleAppSiteAssociation(): AppleAppSiteAssociation {
  return {
    applinks: {
      details: [
        {
          appIDs: [APPLE_APP_ID],
          components: AASA_ACTIVE_PATHS.map((p) => ({ '/': p })),
        },
      ],
    },
    webcredentials: {
      apps: [APPLE_APP_ID],
    },
  };
}
