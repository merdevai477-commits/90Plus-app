/**
 * useMyProfileBasics
 *
 * Lightweight hook for avatar, display name, level and xp.
 * Uses `/api/clerk/me` (same as profile cache) — avoids `/api/profile/me`
 * which shared a response-cache key collision with `/api/xp/me` on the server.
 */

import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { AuthService } from '../src/services/authService';

export interface MyProfileBasics {
  avatar: string | null;
  displayName: string;
  username: string;
  level: number;
  xp: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useMyProfileBasics(): {
  data: MyProfileBasics | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const query = useQuery<MyProfileBasics | null, Error>({
    queryKey: ['profile', 'me', 'basics', clerkUser?.id],
    enabled: isLoaded && !!isSignedIn && !!clerkUser?.id,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS * 2,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    queryFn: async () => {
      const token = await getToken().catch(() => null);
      if (!token) return null;

      const user = await AuthService.syncUserWithBackend(token);
      if (!user?.username) return null;

      return {
        avatar: (user.avatar?.trim() || null) ?? null,
        displayName:
          (user.displayName && user.displayName.trim()) ||
          user.username ||
          clerkUser?.firstName ||
          '',
        username: user.username,
        level: user.level ?? 1,
        xp: user.xp ?? 0,
      };
    },
  });

  const merged = useMemo<MyProfileBasics | null>(() => {
    if (!isSignedIn) return null;
    const remote = query.data;
    const clerkAvatar = clerkUser?.imageUrl ?? null;
    const clerkDisplayName =
      clerkUser?.fullName?.trim() ||
      clerkUser?.username ||
      clerkUser?.firstName ||
      '';

    if (!remote) {
      return {
        avatar: clerkAvatar,
        displayName: clerkDisplayName,
        username: clerkUser?.username ?? '',
        level: 1,
        xp: 0,
      };
    }

    return {
      avatar: remote.avatar ?? clerkAvatar,
      displayName: remote.displayName || clerkDisplayName,
      username: remote.username || clerkUser?.username || '',
      level: remote.level,
      xp: remote.xp,
    };
  }, [isSignedIn, clerkUser?.imageUrl, clerkUser?.fullName, clerkUser?.username, clerkUser?.firstName, query.data]);

  return {
    data: merged,
    isLoading: query.isLoading,
    refetch: () => {
      query.refetch();
    },
  };
}

export default useMyProfileBasics;
