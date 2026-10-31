/**
 * Referral landing — Android Install Referrer URL + iOS clipboard payload.
 */

import {
  buildReferralLandingPage,
  buildReferralContestLandingPage,
  buildPlayStoreInviteUrl,
  PLAY_STORE_URL,
  APP_STORE_URL,
} from '../share-landing-pages';

describe('buildPlayStoreInviteUrl', () => {
  it('builds a single-encoded referrer URL for ABCDEF', () => {
    const url = buildPlayStoreInviteUrl('ABCDEF');
    expect(url).toBe(
      'https://play.google.com/store/apps/details?id=com.mhmdsh1892.ninetyplusapp&referrer=invite_ABCDEF',
    );
    expect(url).toContain(`id=com.mhmdsh1892.ninetyplusapp`);
    // encodeURIComponent('invite_ABCDEF') === 'invite_ABCDEF' (no double encoding)
    expect(url).not.toContain('invite%255F');
    expect(url).not.toContain('%2526');
  });

  it('returns a plain store URL for invalid / malicious input', () => {
    expect(buildPlayStoreInviteUrl('<script>')).toBe(PLAY_STORE_URL);
    expect(buildPlayStoreInviteUrl('../')).toBe(PLAY_STORE_URL);
    expect(buildPlayStoreInviteUrl('A'.repeat(50))).toBe(PLAY_STORE_URL);
    expect(buildPlayStoreInviteUrl('AB0O1D')).toBe(PLAY_STORE_URL);
  });
});

describe('buildReferralLandingPage — deferred payloads', () => {
  const html = buildReferralLandingPage('ABCDEF');

  it('embeds Android Play URL with referrer=invite_ABCDEF', () => {
    expect(html).toContain(
      `var playStoreUrl = ${JSON.stringify(buildPlayStoreInviteUrl('ABCDEF'))}`,
    );
    expect(html).toContain('referrer=invite_ABCDEF');
    expect(html).toContain('com.mhmdsh1892.ninetyplusapp');
  });

  it('embeds iOS clipboard string 90plus-invite:ABCDEF for tap-to-copy', () => {
    expect(html).toContain('var iosInvitePayload = "90plus-invite:ABCDEF"');
    expect(html).toContain('copyInviteThenAppStore');
    expect(html).toContain('navigator.clipboard.writeText');
    expect(html).toContain("document.execCommand('copy')");
    expect(html).toContain('تحميل التطبيق');
  });

  it('iOS valid code: store button has href="#" before JS; noscript has plain App Store URL', () => {
    expect(html).toMatch(/id="store-ios" href="#"/);
    expect(html).toContain(`<noscript><p><a class="btn primary" href="${APP_STORE_URL}">`);
    // Must not expose a real App Store href on #store-ios before JS
    expect(html).not.toMatch(
      new RegExp(`id="store-ios" href="${APP_STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    );
  });

  it('sends Android straight to the Play referrer URL and keeps the iOS clipboard path', () => {
    expect(html).toContain('if (isAndroid)');
    expect(html).toContain('if (isIOS)');
    expect(html).toContain('if (iosInvitePayload) return;');
    expect(html).toContain('ninetyplus://invite/ABCDEF');
    expect(html).toContain('var androidReferrerFirst = true');
    expect(html).toContain('window.location.replace(playStoreUrl)');
    // The package intent opens Play without referrer and hides this page.
    const autoIntent = html.indexOf('window.location.href = intentUrl');
    const referrerReturn = html.indexOf('if (androidReferrerFirst)');
    expect(referrerReturn).toBeGreaterThan(-1);
    expect(autoIntent).toBeGreaterThan(referrerReturn);
  });

  it('does not put raw script tags or path traversal into HTML for valid codes', () => {
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('../');
  });

  it('uses App Store URL from config and does not invent a package for iOS', () => {
    expect(html).toContain(`var appStoreUrl = ${JSON.stringify(APP_STORE_URL)}`);
    expect(APP_STORE_URL).toContain('apps.apple.com');
  });

  it('invalid codes get null iOS clipboard payload and plain Play URL', () => {
    const bad = buildReferralLandingPage('AB0O1D');
    expect(bad).toContain('var iosInvitePayload = null');
    expect(bad).toContain(`var playStoreUrl = ${JSON.stringify(PLAY_STORE_URL)}`);
    expect(bad).not.toContain('90plus-invite:AB0O1D');
    expect(bad).toMatch(
      new RegExp(`id="store-ios" href="${APP_STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    );
    expect(bad).not.toContain('<noscript>');
  });
});

describe('buildReferralContestLandingPage', () => {
  const html = buildReferralContestLandingPage('ABCDEF', 'pk_test_invite');

  it('signs the new account up on the invite page with that code', () => {
    expect(html).toContain('mountSignUp');
    expect(html).toContain('referralCode');
    expect(html).toContain('ABCDEF');
    expect(html).toContain('/api/share-win/referral/claim');
    expect(html).toContain('pk_test_invite');
  });

  it('buildReferralLandingPage uses the contest page only when a Clerk key is passed', () => {
    expect(buildReferralLandingPage('ABCDEF', { clerkPublishableKey: 'pk_test_invite' })).toContain('mountSignUp');
    expect(buildReferralLandingPage('ABCDEF')).not.toContain('mountSignUp');
    expect(buildReferralLandingPage('AB0O1D', { clerkPublishableKey: 'pk_test_invite' })).not.toContain('mountSignUp');
  });
});
