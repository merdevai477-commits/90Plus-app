jest.mock('../../globalState', () => ({
  globalState: {
    username: 'me_user',
    userProfile: { username: 'me_user' },
  },
}));

import { globalState } from '../../globalState';
import {
  isCurrentUserUsername,
  navigateUserProfile,
  normalizeProfileUsername,
} from '../navigateUserProfile';

describe('navigateUserProfile', () => {
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
  });
});
