import {
  parsePlayInstallReferrer,
  parseIosInviteClipboard,
  parseInviteFromUrl,
  buildPlayInviteReferrer,
  buildIosInviteClipboard,
} from '../share-win-invite-parse';

describe('share-win invite parse', () => {
  test('parses legacy and click_id Play referrers', () => {
    expect(parsePlayInstallReferrer('invite_AB23CD')).toEqual({
      code: 'AB23CD',
      clickId: null,
    });
    expect(parsePlayInstallReferrer('invite_AB23CD_ck_abc123XYZ0')).toEqual({
      code: 'AB23CD',
      clickId: 'ck_abc123XYZ0',
    });
    expect(parsePlayInstallReferrer('utm_source=x&referrer=invite_AB23CD_ck_abc123XYZ0')).toEqual({
      code: 'AB23CD',
      clickId: 'ck_abc123XYZ0',
    });
    expect(parsePlayInstallReferrer('organic')).toBeNull();
  });

  test('parses legacy and click_id iOS clipboard payloads', () => {
    expect(parseIosInviteClipboard('90plus-invite:AB23CD')).toEqual({
      code: 'AB23CD',
      clickId: null,
    });
    expect(parseIosInviteClipboard('90plus-invite:AB23CD:ck_abc123XYZ0')).toEqual({
      code: 'AB23CD',
      clickId: 'ck_abc123XYZ0',
    });
    expect(parseIosInviteClipboard('hello')).toBeNull();
  });

  test('parses deep links with ?c= click_id', () => {
    expect(parseInviteFromUrl('https://90plus.pro/invite/AB23CD?c=ck_abc123XYZ0')).toEqual({
      code: 'AB23CD',
      clickId: 'ck_abc123XYZ0',
    });
    expect(parseInviteFromUrl('ninetyplus://invite/AB23CD?c=ck_abc123XYZ0')).toEqual({
      code: 'AB23CD',
      clickId: 'ck_abc123XYZ0',
    });
    expect(parseInviteFromUrl('https://90plus.pro/invite/AB23CD')).toEqual({
      code: 'AB23CD',
      clickId: null,
    });
  });

  test('builders emit the new formats', () => {
    expect(buildPlayInviteReferrer('ab23cd', 'ck_abc123XYZ0')).toBe('invite_AB23CD_ck_abc123XYZ0');
    expect(buildIosInviteClipboard('ab23cd', 'ck_abc123XYZ0')).toBe(
      '90plus-invite:AB23CD:ck_abc123XYZ0',
    );
  });
});
