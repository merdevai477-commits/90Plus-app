import { useMemo } from 'react';
import { useUser } from '@clerk/clerk-expo';

import { globalState } from '../../globalState';
import type { CommunityAuthor } from '../../services/community.api';

/** The signed-in user as a Community author — used for ghost posts and comments. */
export function useCommunityMe(): CommunityAuthor {
  const { user } = useUser();
  const profile = globalState.userProfile;
  return useMemo<CommunityAuthor>(
    () => ({
      id: profile?.id ?? user?.id ?? 'me',
      username: profile?.username ?? user?.username ?? 'me',
      displayName: profile?.displayName ?? user?.fullName ?? null,
      avatar: globalState.localAvatar ?? profile?.avatar ?? user?.imageUrl ?? null,
      isVerified: Boolean((profile as { isVerified?: boolean } | null)?.isVerified),
    }),
    [profile, user?.id, user?.username, user?.fullName, user?.imageUrl],
  );
}
