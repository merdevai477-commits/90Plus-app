/**
 * SHARE & EARN DEEP LINKS — the contract that makes a shared link open the app.
 *
 * A referral link (https://90plus.pro/invite/<CODE>) only reaches the app when
 * three things line up, and they live in three different files:
 *
 *   1. src/config/appleAppSite.ts        → iOS Universal Links (AASA)
 *   2. front/app.json android.intentFilters → Android App Links
 *   3. front/app/_layout.tsx handleDeepLink → what the app does with the URL
 *
 * Only (1) and (2) are checkable from here; (3) is covered by the front-end
 * suite. These tests exist because /invite/* was missing from BOTH link
 * manifests, so every shared invite opened the website instead of the app.
 *
 * They also pin the "app is not installed" half: the Android intent must fall
 * back to the Play Store, NOT to the landing page it was launched from — that
 * fallback used to point at this same page, so a phone without 90Plus bounced
 * between page and intent and never reached a store.
 */

import path from 'path';
import fs from 'fs';

import {
  AASA_ACTIVE_PATHS,
  APPLE_APP_ID,
  buildAppleAppSiteAssociation,
} from '../../config/appleAppSite';
import {
  buildReferralLandingPage,
  buildGroupJoinLandingPage,
  buildReelLandingPage,
  buildProfileLandingPage,
  PLAY_STORE_URL,
  APP_STORE_URL,
} from '../share-landing-pages';

/** Every https path pattern the referral share can produce. */
const REFERRAL_PATHS = ['/invite/*', '/ref/*'];

describe('iOS Universal Links (AASA)', () => {
  it('claims the Share & Earn referral paths', () => {
    for (const pattern of REFERRAL_PATHS) {
      expect(AASA_ACTIVE_PATHS).toContain(pattern);
    }
  });

  it('keeps the paths that already worked', () => {
    expect(AASA_ACTIVE_PATHS).toContain('/reels/*');
    expect(AASA_ACTIVE_PATHS).toContain('/@*');
    expect(AASA_ACTIVE_PATHS).toContain('/groups/join/*');
  });

  it('serves them as AASA components under the real app id', () => {
    const aasa = buildAppleAppSiteAssociation();
    const detail = aasa.applinks.details[0];

    expect(detail.appIDs).toEqual([APPLE_APP_ID]);
    const claimed = detail.components.map((component) => component['/']);
    for (const pattern of REFERRAL_PATHS) {
      expect(claimed).toContain(pattern);
    }
  });

  it('is the same list the statically served file carries', () => {
    // public/.well-known/apple-app-site-association is shadowed by the express
    // route in production, but a stale copy is a trap for anyone reading it.
    const staticPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'public',
      '.well-known',
      'apple-app-site-association',
    );
    const staticAasa = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
    const staticPaths: string[] = staticAasa.applinks.details[0].components.map(
      (component: Record<string, string>) => component['/'],
    );

    expect(staticPaths.sort()).toEqual([...AASA_ACTIVE_PATHS].sort());
  });
});

describe('Android App Links (front/app.json intent filters)', () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', '..', 'front', 'app.json'), 'utf8'),
  );
  const filters: Array<{
    autoVerify?: boolean;
    data?: Array<{ scheme?: string; host?: string; pathPrefix?: string; path?: string }>;
  }> = appJson.expo.android.intentFilters;

  const prefixes = filters.flatMap((filter) =>
    (filter.data ?? []).map((entry) => entry.pathPrefix).filter(Boolean),
  );

  it('declares the referral prefixes', () => {
    expect(prefixes).toContain('/invite');
    expect(prefixes).toContain('/ref');
  });

  it('auto-verifies every https filter, or the link opens a chooser instead of the app', () => {
    for (const filter of filters) {
      const isHttps = (filter.data ?? []).some((entry) => entry.scheme === 'https');
      if (isHttps) expect(filter.autoVerify).toBe(true);
    }
  });

  it('points every declared prefix at the share host', () => {
    for (const filter of filters) {
      for (const entry of filter.data ?? []) {
        if (entry.scheme === 'https') expect(entry.host).toBe('90plus.pro');
      }
    }
  });

  it('covers exactly the paths iOS claims', () => {
    // AASA patterns are glob-ish ("/invite/*"), Android's are prefixes
    // ("/invite"). Compare them on the stem so the two manifests cannot drift.
    const iosStems = AASA_ACTIVE_PATHS.map((pattern) => pattern.replace(/\*$/, '').replace(/\/$/, ''));
    const androidStems = filters
      .flatMap((filter) => (filter.data ?? []).map((entry) => entry.pathPrefix))
      .filter((value): value is string => Boolean(value));

    for (const stem of iosStems) {
      expect(androidStems).toContain(stem);
    }
  });
});

describe('referral landing page — the app-is-not-installed path', () => {
  const html = buildReferralLandingPage('AB23CD');

  it('carries the referral code into the app on every route it offers', () => {
    // Universal/App Link (handled by the OS), custom scheme (in-app browsers),
    // and the Android intent all have to name the same code, or the invite
    // arrives with no attribution.
    expect(html).toContain('ninetyplus://invite/AB23CD');
    expect(html).toContain('intent://invite/AB23CD#Intent');
    expect(html).toContain('90plus.pro/invite/AB23CD');
  });

  it('falls back to the Play Store, not back to itself', () => {
    const fallback = /browser_fallback_url=([^;]+);/.exec(html)?.[1] ?? '';
    expect(decodeURIComponent(fallback)).toBe(PLAY_STORE_URL);
    // The bounce that used to happen: fallback pointing at this same page.
    expect(decodeURIComponent(fallback)).not.toContain('/invite/');
  });

  it('sends iPhones without the app to the App Store', () => {
    expect(html).toContain(`var appStoreUrl = ${JSON.stringify(APP_STORE_URL)}`);
    expect(html).toContain('window.location.replace(appStoreUrl)');
  });

  it('detects iPadOS, which reports itself as a Mac', () => {
    expect(html).toContain('navigator.maxTouchPoints');
  });

  it('uppercases the code so the link is case-insensitive', () => {
    expect(buildReferralLandingPage('ab23cd')).toContain('ninetyplus://invite/AB23CD');
  });
});

describe('the other share landing pages keep the same store fallback', () => {
  const pages: Array<[string, string]> = [
    ['reel', buildReelLandingPage('11111111-2222-3333-4444-555555555555')],
    ['profile', buildProfileLandingPage('omar')],
    ['group join', buildGroupJoinLandingPage('90PLUSAB12')],
    ['referral', buildReferralLandingPage('AB23CD')],
  ];

  it.each(pages)('%s page never loops back to itself', (_name, html) => {
    const fallback = decodeURIComponent(/browser_fallback_url=([^;]+);/.exec(html)?.[1] ?? '');
    expect(fallback).toBe(PLAY_STORE_URL);
  });

  it.each(pages)('%s page offers both stores as a last resort', (_name, html) => {
    expect(html).toContain(PLAY_STORE_URL);
    expect(html).toContain(APP_STORE_URL);
  });
});
