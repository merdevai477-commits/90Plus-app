import {
  INSTALL_CLICK_CONFLICT,
  isAndroidInviteBrowser,
  mergeInstallClick,
  parseInstallClick,
  signupMatchesInstallClick,
} from '../share-win-install-click.service';

describe('isAndroidInviteBrowser', () => {
  it('accepts a real Android browser', () => {
    expect(
      isAndroidInviteBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
  });

  it('rejects iOS, empty, and link-preview crawlers', () => {
    expect(isAndroidInviteBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false);
    expect(isAndroidInviteBrowser(undefined)).toBe(false);
    expect(isAndroidInviteBrowser('WhatsApp/2.23.20.0')).toBe(false);
    expect(isAndroidInviteBrowser('facebookexternalhit/1.1')).toBe(false);
  });
});

describe('mergeInstallClick', () => {
  it('stores the first code and keeps the earlier click of the same code', () => {
    const first = mergeInstallClick(null, 'AB23CD', 1_000);
    expect(first).toBe('AB23CD|1000');
    expect(mergeInstallClick(first, 'AB23CD', 500)).toBe('AB23CD|500');
    expect(mergeInstallClick(first, 'AB23CD', 2_000)).toBe('AB23CD|1000');
  });

  it('turns a second different code into a conflict and stays there', () => {
    const conflict = mergeInstallClick('AB23CD|1000', 'ZZ99YY', 2_000);
    expect(conflict).toBe(INSTALL_CLICK_CONFLICT);
    expect(mergeInstallClick(conflict, 'AB23CD', 3_000)).toBe(INSTALL_CLICK_CONFLICT);
    expect(parseInstallClick(conflict)).toBeNull();
  });
});

describe('signupMatchesInstallClick', () => {
  const clickedAt = Date.parse('2026-10-31T10:00:00.000Z');

  it('matches a signup shortly after the click', () => {
    const created = new Date(clickedAt + 5 * 60 * 1000);
    expect(signupMatchesInstallClick(clickedAt, created, new Date(clickedAt + 10 * 60 * 1000))).toBe(true);
  });

  it('rejects an account that already existed before the click', () => {
    const created = new Date(clickedAt - 60 * 60 * 1000);
    expect(signupMatchesInstallClick(clickedAt, created, new Date(clickedAt + 10 * 60 * 1000))).toBe(false);
  });

  it('rejects an account older than the referral window', () => {
    const created = new Date(clickedAt);
    const later = new Date(clickedAt + 49 * 60 * 60 * 1000);
    expect(signupMatchesInstallClick(clickedAt, created, later)).toBe(false);
  });
});
