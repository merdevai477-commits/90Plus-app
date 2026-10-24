import { resolveShareDeepLink } from '../navigateShareDeepLink';

describe('resolveShareDeepLink', () => {
  it('sends unsigned invite opens to registration and parks attribution separately', () => {
    expect(resolveShareDeepLink('https://90plus.pro/invite/AB23CD', false)).toEqual({
      kind: 'invite',
      path: '/auth',
    });
    expect(resolveShareDeepLink('ninetyplus://invite/AB23CD', false)).toEqual({
      kind: 'invite',
      path: '/auth',
    });
  });

  it('does not open Share & Win for signed-in invitees', () => {
    expect(resolveShareDeepLink('https://90plus.pro/invite/AB23CD', true)).toEqual({
      kind: 'invite',
      path: '/(tabs)/matches',
    });
  });

  it('blocks unsigned profile and reel opens behind auth', () => {
    expect(resolveShareDeepLink('https://90plus.pro/u/omar', false)).toEqual({
      kind: 'auth_wall',
      path: '/auth',
    });
    expect(
      resolveShareDeepLink(
        'https://90plus.pro/reels/11111111-2222-3333-4444-555555555555',
        false,
      ),
    ).toEqual({
      kind: 'auth_wall',
      path: '/auth',
    });
  });

  it('routes signed-in profile and reel opens to content', () => {
    expect(resolveShareDeepLink('https://90plus.pro/u/omar', true)).toEqual({
      kind: 'profile',
      path: '/user/[username]',
      username: 'omar',
    });
    expect(
      resolveShareDeepLink(
        'https://90plus.pro/reels/11111111-2222-3333-4444-555555555555',
        true,
      ),
    ).toEqual({
      kind: 'reel',
      path: '/(tabs)/reels',
      reelId: '11111111-2222-3333-4444-555555555555',
    });
  });
});
