jest.mock('../../globalState', () => ({
  globalState: {
    username: 'me_user',
    userProfile: { username: 'me_user' },
  },
}));

jest.mock('../../src/services/authService', () => ({
  AuthService: {
    getUserByUsername: jest.fn(() => Promise.resolve(null)),
    getUserReels: jest.fn(() => Promise.resolve([])),
  },
}));

import { globalState } from '../../globalState';
import {
  isCurrentUserUsername,
  navigateUserProfile,
  normalizeProfileUsername,
  prefetchPublicUserProfile,
} from '../navigateUserProfile';
import { AuthService } from '../../src/services/authService';
import { clearPublicProfileMemory, peekPublicProfile } from '../../services/publicProfileCache';

describe('navigateUserProfile', () => {
  beforeEach(() => {
    clearPublicProfileMemory();
    jest.clearAllMocks();
  });

  it('normalizes @mentions', () => {
    expect(normalizeProfileUsername('@Me_User')).toBe('Me_User');
  });

  it('detects the signed-in username from either global field', () => {
    expect(isCurrentUserUsername('me_user')).toBe(true);
    expect(isCurrentUserUsername('@ME_USER')).toBe(true);
    (globalState as { userProfile: { username: string } | null }).userProfile = null;
    expect(isCurrentUserUsername('me_user')).toBe(true);
    expect(isCurrentUserUsername('other')).toBe(false);
  });

  it('routes own taps to the profile tab and others to /user', () => {
    const push = jest.fn();
    navigateUserProfile({ push } as never, 'me_user');
    expect(push).toHaveBeenCalledWith('/(tabs)/profile');
    push.mockClear();
    navigateUserProfile({ push } as never, 'someone_else');
    expect(push).toHaveBeenCalledWith({
      pathname: '/user/[username]',
      params: { username: 'someone_else' },
    });
    expect(AuthService.getUserByUsername).toHaveBeenCalled();
  });

  it('seeds memory when prefetch receives a SearchUserResult', () => {
    const seed = {
      id: '1',
      username: 'seeded',
      displayName: 'Seeded',
      avatar: null,
      bio: null,
      isVerified: false,
      isDeveloper: false,
      level: 1,
      favoriteTeam: null,
    };
    prefetchPublicUserProfile('seeded', seed);
    expect(peekPublicProfile('seeded')?.displayName).toBe('Seeded');
  });
});
