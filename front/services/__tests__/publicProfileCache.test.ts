import {
  clearPublicProfileMemory,
  fetchPublicProfileCached,
  peekPublicProfile,
  setPublicProfileMemory,
} from '../publicProfileCache';
import type { SearchUserResult } from '../../src/services/authService';

function fakeUser(username: string): SearchUserResult {
  return {
    id: `id_${username}`,
    username,
    displayName: username,
    avatar: null,
    bio: null,
    isVerified: false,
    isDeveloper: false,
    level: 1,
    favoriteTeam: null,
  };
}

describe('publicProfileCache', () => {
  beforeEach(() => {
    clearPublicProfileMemory();
  });

  it('peeks what was set in memory', () => {
    setPublicProfileMemory('Alice', fakeUser('Alice'));
    expect(peekPublicProfile('alice')?.username).toBe('Alice');
  });

  it('dedupes concurrent fetches', async () => {
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return new Promise<SearchUserResult | null>((resolve) => {
        setTimeout(() => resolve(fakeUser('bob')), 20);
      });
    };

    const [a, b] = await Promise.all([
      fetchPublicProfileCached('bob', fetcher),
      fetchPublicProfileCached('bob', fetcher),
    ]);

    expect(calls).toBe(1);
    expect(a?.username).toBe('bob');
    expect(b?.username).toBe('bob');
  });

  it('revalidate skips memory short-circuit but still updates cache', async () => {
    setPublicProfileMemory('cara', fakeUser('cara'));
    let calls = 0;
    const next = fakeUser('cara');
    next.displayName = 'Cara Updated';

    const result = await fetchPublicProfileCached(
      'cara',
      async () => {
        calls += 1;
        return next;
      },
      { revalidate: true },
    );

    expect(calls).toBe(1);
    expect(result?.displayName).toBe('Cara Updated');
    expect(peekPublicProfile('cara')?.displayName).toBe('Cara Updated');
  });
});
