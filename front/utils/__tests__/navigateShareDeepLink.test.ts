import { router } from 'expo-router';

import { navigateShareDeepLink, resolveShareDeepLink } from '../navigateShareDeepLink';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const POST_ID = '11111111-2222-3333-4444-555555555555';
const POST_URL = `https://90plus.pro/community/post/${POST_ID}`;

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

  it('routes signed-in community post opens to the post screen', () => {
    const expected = { kind: 'post', path: '/community/post/[id]', postId: POST_ID };
    expect(resolveShareDeepLink(POST_URL, true)).toEqual(expected);
    expect(resolveShareDeepLink(`ninetyplus://community/post/${POST_ID}`, true)).toEqual(expected);
  });

  it('blocks unsigned community post opens behind auth', () => {
    expect(resolveShareDeepLink(POST_URL, false)).toEqual({ kind: 'auth_wall', path: '/auth' });
  });
});

describe('navigateShareDeepLink — community posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the post when another screen is on top', () => {
    expect(navigateShareDeepLink(POST_URL, true, null)).toBe(true);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/community/post/[id]',
      params: { id: POST_ID },
    });
  });

  it('does not stack the post twice when the router already opened it', () => {
    expect(navigateShareDeepLink(POST_URL, true, POST_ID)).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sends signed-out visitors to registration instead', () => {
    expect(navigateShareDeepLink(POST_URL, false, POST_ID)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/auth');
    expect(router.push).not.toHaveBeenCalled();
  });
});
