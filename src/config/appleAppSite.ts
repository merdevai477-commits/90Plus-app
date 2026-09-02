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

/**
 * Active universal link path patterns.
 *
 * THIS LIST IS THE iOS THIRD OF A THREE-WAY CONTRACT. A path opens the app
 * only when it appears in all three places:
 *   1. here                                     — iOS Universal Links
 *   2. front/app.json → android.intentFilters   — Android App Links
 *   3. front/app/_layout.tsx → handleDeepLink   — what the app does with it
 *
 * `/invite/*` and `/ref/*` are the Share & Earn referral links that
 * share-win.service.ts hands out (https://90plus.pro/invite/<CODE>, and its
 * `/ref/` alias in support.routes.ts). They were missing here, so iOS never
 * recognised a shared invite as a universal link: tapping it opened the web
 * landing page instead of the installed app. The app has always known what to
 * do with the code (handleDeepLink → parseReferralCodeFromUrl →
 * capturePendingReferral); it was simply never handed the URL.
 */
export const AASA_ACTIVE_PATHS = [
  '/reels/*',
  '/@*',
  '/groups/join/*',
  '/invite/*',
  '/ref/*',
] as const;

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
