/**
 * useMyProfileBasics
 *
 * Lightweight hook that fetches the current user's basics from
 * `/api/profile/me` — avatar (R2 url stored on the User row), display name,
 * level and xp. Falls back to the Clerk imageUrl when the backend hasn't
 * synced yet. Keeps the avatar in sync with the Profile screen so other
 * surfaces (rank profile card, headers, etc.) display the same image the
 * user just uploaded.
 *
 * The Profile screen itself keeps using `useProfileCache` for the heavy data
 * (videos, follow stats, FIFA card, etc.); this hook is a tight fan-out for
 * surfaces that only need the basics.
 */

import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getApiUrl } from '../config/api.config';

export interface MyProfileBasics {
  /** R2 avatar url (preferred), falling back to Clerk imageUrl. */
  avatar: string | null;
  /** Resolved display name (display name → username → first name). */
  displayName: string;
  username: string;
  level: number;
  xp: number;
}

interface ProfileMeUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  level?: number | null;
  xp?: number | null;
}

interface ProfileMeResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: ProfileMeUser;
  message?: string;
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
      try {
        const token = await getToken().catch(() => null);
        if (!token) return null;

        const res = await fetch(`${getApiUrl()}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          const err = new Error('Unauthorized') as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        if (!res.ok) return null;

        const json = (await res.json()) as ProfileMeResponse;
        if (json.status !== 'SUCCESS' || !json.data?.username) return null;

        const u = json.data;
        return {
          avatar: (u.avatar?.trim() || null) ?? null,
          displayName:
            (u.displayName && u.displayName.trim()) ||
            u.username ||
            clerkUser?.firstName ||
            '',
          username: u.username,
          level: u.level ?? 1,
          xp: u.xp ?? 0,
        };
      } catch {
        return null;
      }
    },
  });

  // Merge fetched data with the Clerk fallback so consumers always get an
  // avatar — even before the backend responds — without showing a placeholder.
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
